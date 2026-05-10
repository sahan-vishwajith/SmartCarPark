"""
Admin-facing API endpoints.

All routes here require a valid admin JWT (use the admin_required decorator).
The admin frontend lives at /admin/* in the existing React app and calls these.

Endpoint groups:
  - /admin/payments/latest                  -> last N completed payments (post-payment summaries)
  - /admin/bookings                         -> list bookings (filter/paginate)
  - /admin/bookings/<id>                    -> single booking detail (with payment + vehicle + slot)
  - /admin/bookings/<id>/slot               -> reassign slot for a booking
  - /admin/slots                            -> list all slots with current status (free/occupied/reserved/inactive)
  - /admin/slots/<id>                       -> activate/deactivate a slot
  - /admin/stats/overview                   -> top-level KPIs
  - /admin/stats/occupancy                  -> live occupancy breakdown for the slot map
  - /admin/stats/revenue                    -> revenue per day for the last N days
  - /admin/stats/bookings-per-day           -> stacked bookings count per day (by status)
  - /admin/stats/vehicle-types              -> vehicle type distribution
  - /admin/stats/peak-hours                 -> heatmap of bookings by hour x day-of-week
  - /admin/stats/recent-history             -> latest parking sessions + average parking time
"""
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from flask import Blueprint, jsonify, request, g
from sqlalchemy import func, or_

from ..extensions import db
from ..models import Booking, ParkingSlot, User, Payment
from .decorators import admin_required


admin_bp = Blueprint("admin", __name__)


# ---------- helpers ----------

def _to_utc_z(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _utcnow():
    return datetime.now(timezone.utc)


def _booking_brief(b: Booking, slot_label: str | None = None, user: User | None = None):
    return {
        "id": b.id,
        "userId": b.user_id,
        "status": b.status,
        "slotId": b.allocated_slot_id,
        "slotLabel": slot_label,
        "startTime": _to_utc_z(b.start_time),
        "endTime": _to_utc_z(b.end_time),
        "driverArrived": bool(getattr(b, "driver_arrived", False)),
        "slotOccupied": bool(getattr(b, "slot_occupied", False)),
        "createdAt": _to_utc_z(getattr(b, "created_at", None)),
        "updatedAt": _to_utc_z(getattr(b, "updated_at", None)),
        "vehicle": (
            {
                "driverName": user.driver_name if user else None,
                "vehicleNumber": user.vehicle_number if user else None,
                "vehicleType": user.vehicle_type if user else None,
                "phoneNumber": user.phone_number if user else None,
                "username": user.username if user else None,
            }
            if user
            else None
        ),
    }


# =========================================================
# Payments — what the admin sees right after a user pays
# =========================================================

@admin_bp.get("/payments/latest")
@admin_required
def latest_payments():
    """
    Returns the N most recent payments (default 20) joined with booking, slot and user
    so the admin dashboard can render a "summary of that vehicle's parking" card
    without making N+1 round trips.
    """
    try:
        limit = max(1, min(100, int(request.args.get("limit", 20))))
    except ValueError:
        limit = 20

    rows = (
        db.session.query(Payment, Booking, ParkingSlot, User)
        .join(Booking, Payment.booking_id == Booking.id)
        .outerjoin(ParkingSlot, Booking.allocated_slot_id == ParkingSlot.id)
        .outerjoin(User, Payment.user_id == User.id)
        .order_by(Payment.paid_at.desc())
        .limit(limit)
        .all()
    )

    items = []
    for payment, booking, slot, user in rows:
        items.append(
            {
                "payment": {
                    "id": payment.id,
                    "amount": float(payment.amount or 0),
                    "currency": payment.currency,
                    "method": payment.method,
                    "status": payment.status,
                    "cardLast4": payment.card_last4,
                    "cardHolder": payment.card_holder,
                    "paidAt": _to_utc_z(payment.paid_at),
                },
                "booking": {
                    "id": booking.id,
                    "status": booking.status,
                    "startTime": _to_utc_z(booking.start_time),
                    "endTime": _to_utc_z(booking.end_time),
                    "driverArrived": bool(getattr(booking, "driver_arrived", False)),
                    "slotOccupied": bool(getattr(booking, "slot_occupied", False)),
                },
                "slot": (
                    {"id": slot.id, "label": slot.label, "isActive": bool(slot.is_active)}
                    if slot
                    else None
                ),
                "vehicle": (
                    {
                        "driverName": user.driver_name if user else None,
                        "vehicleNumber": user.vehicle_number if user else None,
                        "vehicleType": user.vehicle_type if user else None,
                        "phoneNumber": user.phone_number if user else None,
                        "username": user.username if user else None,
                    }
                    if user
                    else None
                ),
            }
        )

    return jsonify({"items": items, "count": len(items)}), 200


# =========================================================
# Bookings — list, detail, reassign slot
# =========================================================

@admin_bp.get("/bookings")
@admin_required
def list_bookings():
    """
    Query params:
      status   - optional, comma-separated list (PENDING,CONFIRMED,...)
      q        - optional, matches vehicle number / driver name / username (ILIKE)
      from     - optional ISO timestamp; only bookings starting after this
      to       - optional ISO timestamp; only bookings starting before this
      limit    - default 50, max 200
      offset   - default 0
    """
    status = request.args.get("status")
    q = (request.args.get("q") or "").strip()
    try:
        limit = max(1, min(200, int(request.args.get("limit", 50))))
    except ValueError:
        limit = 50
    try:
        offset = max(0, int(request.args.get("offset", 0)))
    except ValueError:
        offset = 0

    query = (
        db.session.query(Booking, ParkingSlot, User)
        .outerjoin(ParkingSlot, Booking.allocated_slot_id == ParkingSlot.id)
        .outerjoin(User, Booking.user_id == User.id)
    )

    if status:
        statuses = [s.strip().upper() for s in status.split(",") if s.strip()]
        if statuses:
            query = query.filter(Booking.status.in_(statuses))

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                User.vehicle_number.ilike(like),
                User.driver_name.ilike(like),
                User.username.ilike(like),
            )
        )

    def _parse_iso(s):
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None

    dt_from = _parse_iso(request.args.get("from", "") or "")
    dt_to = _parse_iso(request.args.get("to", "") or "")
    if dt_from:
        query = query.filter(Booking.start_time >= dt_from)
    if dt_to:
        query = query.filter(Booking.start_time <= dt_to)

    total = query.with_entities(func.count(Booking.id)).scalar() or 0

    rows = (
        query.order_by(Booking.start_time.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    items = [
        _booking_brief(b, slot.label if slot else None, user) for (b, slot, user) in rows
    ]
    return jsonify({"items": items, "total": int(total), "limit": limit, "offset": offset}), 200


@admin_bp.get("/bookings/<int:booking_id>")
@admin_required
def get_booking_detail(booking_id: int):
    row = (
        db.session.query(Booking, ParkingSlot, User)
        .outerjoin(ParkingSlot, Booking.allocated_slot_id == ParkingSlot.id)
        .outerjoin(User, Booking.user_id == User.id)
        .filter(Booking.id == booking_id)
        .first()
    )
    if not row:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404
    booking, slot, user = row

    payment = (
        db.session.query(Payment)
        .filter_by(booking_id=booking_id)
        .order_by(Payment.paid_at.desc())
        .first()
    )

    return jsonify(
        {
            "booking": _booking_brief(booking, slot.label if slot else None, user),
            "payment": (
                {
                    "id": payment.id,
                    "amount": float(payment.amount or 0),
                    "currency": payment.currency,
                    "method": payment.method,
                    "status": payment.status,
                    "cardLast4": payment.card_last4,
                    "cardHolder": payment.card_holder,
                    "paidAt": _to_utc_z(payment.paid_at),
                }
                if payment
                else None
            ),
        }
    ), 200


@admin_bp.patch("/bookings/<int:booking_id>/slot")
@admin_required
def reassign_slot(booking_id: int):
    """
    Move a booking from its current slot to a different one.
    Body: { "slotId": <int> }   OR   { "slotLabel": "P12" }
    Refuses if the destination slot has another overlapping CONFIRMED booking.
    """
    data = request.get_json() or {}
    slot_id = data.get("slotId")
    slot_label = (data.get("slotLabel") or "").strip()

    booking = db.session.query(Booking).filter_by(id=booking_id).first()
    if not booking:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    if slot_id is None and not slot_label:
        return jsonify({"error": "Bad Request", "message": "Provide slotId or slotLabel"}), 400

    if slot_label and slot_id is None:
        slot = db.session.query(ParkingSlot).filter(ParkingSlot.label.ilike(slot_label)).first()
    else:
        slot = db.session.query(ParkingSlot).filter_by(id=int(slot_id)).first()

    if not slot:
        return jsonify({"error": "Not Found", "message": "Target slot not found"}), 404
    if not slot.is_active:
        return jsonify({"error": "Conflict", "message": "Target slot is inactive"}), 409

    # Conflict check: another CONFIRMED booking on the same slot whose window overlaps
    overlap = (
        db.session.query(Booking.id)
        .filter(
            Booking.id != booking.id,
            Booking.allocated_slot_id == slot.id,
            Booking.status == "CONFIRMED",
            Booking.start_time < booking.end_time,
            Booking.end_time > booking.start_time,
        )
        .first()
    )
    if overlap:
        return jsonify(
            {
                "error": "Conflict",
                "message": f"Slot {slot.label} is already booked for an overlapping window",
            }
        ), 409

    old_slot_id = booking.allocated_slot_id
    booking.allocated_slot_id = slot.id
    if hasattr(booking, "updated_at"):
        booking.updated_at = _utcnow()
    db.session.commit()

    # ✅ Push the change to the user's BookingPage in real-time (WebSocket)
    try:
        from ..bookings.ws import broadcast_booking_tracking
        broadcast_booking_tracking(booking)
    except Exception:
        # Broadcast failure must not break the admin reassign
        pass

    return jsonify(
        {
            "ok": True,
            "bookingId": booking.id,
            "oldSlotId": old_slot_id,
            "newSlotId": slot.id,
            "newSlotLabel": slot.label,
        }
    ), 200


# =========================================================
# Slots — list and toggle
# =========================================================

def _slot_status_now(slot: ParkingSlot, now: datetime, slot_to_active_booking: dict) -> str:
    """
    Compute a display status for the slot:
      - "INACTIVE" if is_active is False
      - "OCCUPIED" if there's a CONFIRMED booking right now AND slot_occupied=true
      - "RESERVED" if there's a CONFIRMED booking right now AND not yet occupied
      - "FREE"     otherwise
    """
    if not slot.is_active:
        return "INACTIVE"
    booking = slot_to_active_booking.get(slot.id)
    if not booking:
        return "FREE"
    return "OCCUPIED" if bool(getattr(booking, "slot_occupied", False)) else "RESERVED"


def _build_active_booking_map(now: datetime):
    """For each slot, the CONFIRMED booking that contains 'now' (if any)."""
    rows = (
        db.session.query(Booking)
        .filter(
            Booking.status == "CONFIRMED",
            Booking.start_time <= now,
            Booking.end_time >= now,
        )
        .all()
    )
    out = {}
    for b in rows:
        if b.allocated_slot_id is not None and b.allocated_slot_id not in out:
            out[b.allocated_slot_id] = b
    return out


@admin_bp.get("/slots")
@admin_required
def list_slots():
    now = _utcnow()
    slots = db.session.query(ParkingSlot).order_by(ParkingSlot.id.asc()).all()
    active_map = _build_active_booking_map(now)

    items = []
    for s in slots:
        items.append(
            {
                "id": s.id,
                "label": s.label,
                "isActive": bool(s.is_active),
                "status": _slot_status_now(s, now, active_map),
                "currentBookingId": (active_map.get(s.id).id if active_map.get(s.id) else None),
            }
        )
    return jsonify({"items": items, "count": len(items), "asOf": _to_utc_z(now)}), 200


@admin_bp.patch("/slots/<int:slot_id>")
@admin_required
def update_slot(slot_id: int):
    """
    Body may contain:
      isActive: bool       -> activate/deactivate
      label:    str        -> rename (must be unique-ish; we don't enforce strictly)
    """
    data = request.get_json() or {}
    slot = db.session.query(ParkingSlot).filter_by(id=slot_id).first()
    if not slot:
        return jsonify({"error": "Not Found", "message": "Slot not found"}), 404

    if "isActive" in data:
        slot.is_active = bool(data["isActive"])
    if "label" in data:
        new_label = (data.get("label") or "").strip()
        if new_label:
            slot.label = new_label

    db.session.commit()

    return jsonify(
        {
            "ok": True,
            "slot": {
                "id": slot.id,
                "label": slot.label,
                "isActive": bool(slot.is_active),
            },
        }
    ), 200


# =========================================================
# Stats / Visualizations
# =========================================================

@admin_bp.get("/stats/overview")
@admin_required
def stats_overview():
    now = _utcnow()
    today = now.date()
    start_of_today = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    last_7 = now - timedelta(days=7)
    last_30 = now - timedelta(days=30)

    total_bookings = db.session.query(func.count(Booking.id)).scalar() or 0
    bookings_today = (
        db.session.query(func.count(Booking.id))
        .filter(Booking.created_at >= start_of_today)
        .scalar()
        or 0
    )

    revenue_7 = (
        db.session.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.status == "SUCCESS", Payment.paid_at >= last_7)
        .scalar()
        or 0
    )
    revenue_30 = (
        db.session.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.status == "SUCCESS", Payment.paid_at >= last_30)
        .scalar()
        or 0
    )

    total_slots = db.session.query(func.count(ParkingSlot.id)).scalar() or 0
    active_slots = (
        db.session.query(func.count(ParkingSlot.id))
        .filter(ParkingSlot.is_active.is_(True))
        .scalar()
        or 0
    )

    active_map = _build_active_booking_map(now)
    occupied_now = sum(
        1 for b in active_map.values() if bool(getattr(b, "slot_occupied", False))
    )
    reserved_now = sum(
        1 for b in active_map.values() if not bool(getattr(b, "slot_occupied", False))
    )

    total_users = db.session.query(func.count(User.id)).scalar() or 0

    return jsonify(
        {
            "asOf": _to_utc_z(now),
            "totals": {
                "bookings": int(total_bookings),
                "bookingsToday": int(bookings_today),
                "users": int(total_users),
                "slots": int(total_slots),
                "activeSlots": int(active_slots),
            },
            "occupancyNow": {
                "occupied": occupied_now,
                "reserved": reserved_now,
                "free": max(0, int(active_slots) - occupied_now - reserved_now),
                "inactive": max(0, int(total_slots) - int(active_slots)),
            },
            "revenue": {
                "last7DaysLkr": float(revenue_7),
                "last30DaysLkr": float(revenue_30),
                "currency": "LKR",
            },
        }
    ), 200


@admin_bp.get("/stats/occupancy")
@admin_required
def stats_occupancy():
    """Same data the slot map needs, but minimal/cached-friendly."""
    now = _utcnow()
    slots = db.session.query(ParkingSlot).order_by(ParkingSlot.id.asc()).all()
    active_map = _build_active_booking_map(now)
    items = [
        {
            "id": s.id,
            "label": s.label,
            "status": _slot_status_now(s, now, active_map),
        }
        for s in slots
    ]
    return jsonify({"items": items, "asOf": _to_utc_z(now)}), 200


@admin_bp.get("/stats/revenue")
@admin_required
def stats_revenue():
    try:
        days = max(1, min(90, int(request.args.get("days", 14))))
    except ValueError:
        days = 14

    now = _utcnow()
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    rows = (
        db.session.query(
            func.date_trunc("day", Payment.paid_at).label("day"),
            func.coalesce(func.sum(Payment.amount), 0).label("amount"),
            func.count(Payment.id).label("count"),
        )
        .filter(Payment.status == "SUCCESS", Payment.paid_at >= start)
        .group_by("day")
        .order_by("day")
        .all()
    )

    by_day = {}
    for r in rows:
        day = r.day
        if day.tzinfo is None:
            day = day.replace(tzinfo=timezone.utc)
        key = day.date().isoformat()
        by_day[key] = {"amountLkr": float(r.amount or 0), "count": int(r.count or 0)}

    series = []
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        item = by_day.get(d, {"amountLkr": 0.0, "count": 0})
        series.append({"date": d, **item})

    return jsonify({"days": days, "currency": "LKR", "series": series}), 200


@admin_bp.get("/stats/bookings-per-day")
@admin_required
def stats_bookings_per_day():
    try:
        days = max(1, min(90, int(request.args.get("days", 14))))
    except ValueError:
        days = 14

    now = _utcnow()
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    rows = (
        db.session.query(
            func.date_trunc("day", Booking.created_at).label("day"),
            Booking.status,
            func.count(Booking.id).label("count"),
        )
        .filter(Booking.created_at >= start)
        .group_by("day", Booking.status)
        .all()
    )

    statuses = ["CONFIRMED", "PENDING", "REJECTED", "CANCELLED"]
    by_day = defaultdict(lambda: {s: 0 for s in statuses})
    for r in rows:
        day = r.day
        if day.tzinfo is None:
            day = day.replace(tzinfo=timezone.utc)
        key = day.date().isoformat()
        by_day[key][r.status or "PENDING"] = int(r.count or 0)

    series = []
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        counts = by_day.get(d, {s: 0 for s in statuses})
        series.append({"date": d, **counts})

    return jsonify({"days": days, "statuses": statuses, "series": series}), 200


@admin_bp.get("/stats/vehicle-types")
@admin_required
def stats_vehicle_types():
    """
    Distribution of bookings by user.vehicle_type.
    A user can have multiple bookings, so we count per booking (more useful here).
    """
    rows = (
        db.session.query(
            func.coalesce(User.vehicle_type, "Unknown").label("type"),
            func.count(Booking.id).label("count"),
        )
        .join(User, Booking.user_id == User.id)
        .group_by("type")
        .order_by(func.count(Booking.id).desc())
        .all()
    )
    items = [{"type": r.type, "count": int(r.count or 0)} for r in rows]
    return jsonify({"items": items}), 200


@admin_bp.get("/stats/peak-hours")
@admin_required
def stats_peak_hours():
    """
    7 x 24 heatmap (day-of-week x hour-of-day) of CONFIRMED booking start times.
    Postgres: dow=0 (Sunday) .. 6 (Saturday).
    """
    rows = (
        db.session.query(
            func.extract("dow", Booking.start_time).label("dow"),
            func.extract("hour", Booking.start_time).label("hour"),
            func.count(Booking.id).label("count"),
        )
        .filter(Booking.status == "CONFIRMED")
        .group_by("dow", "hour")
        .all()
    )

    matrix = [[0 for _ in range(24)] for _ in range(7)]
    for r in rows:
        d = int(r.dow or 0)
        h = int(r.hour or 0)
        if 0 <= d < 7 and 0 <= h < 24:
            matrix[d][h] = int(r.count or 0)

    return jsonify(
        {
            "matrix": matrix,
            "daysLabels": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            "hoursLabels": [f"{h:02d}" for h in range(24)],
        }
    ), 200


@admin_bp.get("/stats/recent-history")
@admin_required
def stats_recent_history():
    """
    Latest parking sessions + average parking duration.
    A "completed parking session" is heuristically any booking that has
    slot_occupied=True at any point AND end_time has passed.
    Average is over actual parking duration when both arrival & exit are known;
    when not, falls back to (end_time - start_time).
    """
    try:
        limit = max(1, min(50, int(request.args.get("limit", 10))))
    except ValueError:
        limit = 10

    now = _utcnow()

    recent_rows = (
        db.session.query(Booking, ParkingSlot, User)
        .outerjoin(ParkingSlot, Booking.allocated_slot_id == ParkingSlot.id)
        .outerjoin(User, Booking.user_id == User.id)
        .order_by(Booking.start_time.desc())
        .limit(limit)
        .all()
    )

    recent = []
    for b, slot, user in recent_rows:
        duration_min = None
        if b.start_time and b.end_time:
            duration_min = max(0, int((b.end_time - b.start_time).total_seconds() // 60))
        recent.append(
            {
                "bookingId": b.id,
                "slotLabel": slot.label if slot else None,
                "vehicleNumber": user.vehicle_number if user else None,
                "driverName": user.driver_name if user else None,
                "vehicleType": user.vehicle_type if user else None,
                "status": b.status,
                "startTime": _to_utc_z(b.start_time),
                "endTime": _to_utc_z(b.end_time),
                "driverArrived": bool(getattr(b, "driver_arrived", False)),
                "slotOccupied": bool(getattr(b, "slot_occupied", False)),
                "durationMinutes": duration_min,
            }
        )

    # Average parking duration in minutes (over CONFIRMED bookings that have ended)
    avg_row = (
        db.session.query(
            func.avg(func.extract("epoch", Booking.end_time - Booking.start_time) / 60.0)
        )
        .filter(Booking.status == "CONFIRMED", Booking.end_time <= now)
        .scalar()
    )
    avg_minutes = float(avg_row) if avg_row is not None else 0.0

    completed_count = (
        db.session.query(func.count(Booking.id))
        .filter(Booking.status == "CONFIRMED", Booking.end_time <= now)
        .scalar()
        or 0
    )

    return jsonify(
        {
            "recent": recent,
            "averageParkingMinutes": round(avg_minutes, 1),
            "completedSessions": int(completed_count),
        }
    ), 200
