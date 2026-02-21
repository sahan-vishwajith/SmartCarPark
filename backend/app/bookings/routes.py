from flask import Blueprint, jsonify, request, g
from datetime import datetime, timezone, timedelta
from ..extensions import db
from ..models import Booking, ParkingSlot
from ..auth.decorators import login_required
from .services import (
    allocate_free_slot,
    utcnow,
    set_driver_arrived,
    set_slot_occupied,
    get_booking_tracking_state,
)

bookings_bp = Blueprint("bookings", __name__)

# ✅ Sri Lanka fixed offset (Asia/Colombo) = UTC+05:30
COLOMBO_TZ = timezone(timedelta(hours=5, minutes=30))


def _to_utc_z(dt: datetime) -> str:
    """Return ISO string in UTC with Z suffix."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_start_time_to_utc(data: dict) -> datetime:
    """
    Accepts:
      1) ISO UTC startTime: "2026-02-21T12:30:00.000Z" or "+00:00"
      2) Usual input: date="YYYY-MM-DD" and startTime="HH:MM" (assumed Sri Lanka local)
      3) Usual input: date="YYYY-MM-DD" and startTimeLocal="HH:MM"
    Returns: timezone-aware datetime in UTC
    """
    date_str = (data.get("date") or "").strip()
    start_iso_or_hhmm = (data.get("startTime") or "").strip()
    start_local = (data.get("startTimeLocal") or "").strip()

    # ✅ Case 1: startTime is ISO (has 'T')
    if start_iso_or_hhmm and "T" in start_iso_or_hhmm:
        iso = start_iso_or_hhmm.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    # ✅ Case 2: usual input with startTimeLocal (HH:MM)
    if date_str and start_local:
        naive = datetime.strptime(f"{date_str} {start_local}", "%Y-%m-%d %H:%M")
        return naive.replace(tzinfo=COLOMBO_TZ).astimezone(timezone.utc)

    # ✅ Case 3: usual input with startTime as HH:MM
    if date_str and start_iso_or_hhmm:
        # allow HH:MM or HH:MM:SS
        fmt = "%Y-%m-%d %H:%M:%S" if start_iso_or_hhmm.count(":") == 2 else "%Y-%m-%d %H:%M"
        naive = datetime.strptime(f"{date_str} {start_iso_or_hhmm}", fmt)
        return naive.replace(tzinfo=COLOMBO_TZ).astimezone(timezone.utc)

    raise ValueError("Missing start time input")


@bookings_bp.post("/prebook-confirm")
@login_required
def prebook_confirm():
    data = request.get_json() or {}
    user_id = g.current_user_id

    try:
        start_time_utc = _parse_start_time_to_utc(data)
    except Exception:
        return jsonify(
            {
                "error": "Bad Request",
                "message": "Invalid date or time format",
                "hint": "Send either startTime as ISO (2026-02-21T12:30:00.000Z) OR {date:'YYYY-MM-DD', startTime:'HH:MM'}",
            }
        ), 400

    if start_time_utc <= utcnow():
        return jsonify({"error": "Bad Request", "message": "Start time must be in the future"}), 400

    try:
        slot, end_time = allocate_free_slot(start_time_utc)
        if not slot:
            return jsonify({"error": "Conflict", "message": "No available slots for that time window"}), 409

        # Ensure end_time is UTC-aware
        if end_time and end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        elif end_time:
            end_time = end_time.astimezone(timezone.utc)

        booking = Booking(
            user_id=user_id,
            start_time=start_time_utc,  # ✅ stored in UTC
            end_time=end_time,          # ✅ stored in UTC
            status="CONFIRMED",
            allocated_slot_id=slot.id,
            driver_arrived=False,
            slot_occupied=False,
        )
        db.session.add(booking)
        db.session.commit()

        return jsonify(
            {
                "bookingId": booking.id,
                "slotId": slot.label,

                # ✅ Return UTC ISO with Z (frontend will display local correctly)
                "startTime": _to_utc_z(booking.start_time),
                "endTime": _to_utc_z(booking.end_time),

                "status": booking.status,
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500


@bookings_bp.get("/bookings/<int:booking_id>")
@login_required
def get_booking(booking_id):
    user_id = g.current_user_id

    booking = db.session.query(Booking).filter_by(id=booking_id).first()
    if not booking or booking.user_id != user_id:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    slot_label = None
    if booking.allocated_slot_id is not None:
        slot = db.session.query(ParkingSlot).filter_by(id=booking.allocated_slot_id).first()
        slot_label = slot.label if slot else None

    return jsonify(
        {
            "id": booking.id,
            "slotId": slot_label,

            # ✅ Always send Z times
            "startTime": _to_utc_z(booking.start_time),
            "endTime": _to_utc_z(booking.end_time),

            "status": booking.status,
            "driverArrived": bool(getattr(booking, "driver_arrived", False)),
            "slotOccupied": bool(getattr(booking, "slot_occupied", False)),
            "updatedAt": _to_utc_z(getattr(booking, "updated_at", None)),
        }
    ), 200


# -----------------------------------------
# ✅ New APIs to update tracking state in DB
# -----------------------------------------

@bookings_bp.put("/bookings/<int:booking_id>/driver-arrived")
@login_required
def api_set_driver_arrived(booking_id):
    user_id = g.current_user_id
    booking = db.session.query(Booking).filter_by(id=booking_id).first()
    if not booking or booking.user_id != user_id:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    body = request.get_json(silent=True) or {}
    arrived = bool(body.get("driverArrived"))

    updated = set_driver_arrived(booking_id, arrived)
    if not updated:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    return jsonify(
        {"ok": True, "bookingId": updated.id, "driverArrived": bool(updated.driver_arrived)}
    ), 200


@bookings_bp.put("/bookings/<int:booking_id>/slot-occupied")
@login_required
def api_set_slot_occupied(booking_id):
    user_id = g.current_user_id
    booking = db.session.query(Booking).filter_by(id=booking_id).first()
    if not booking or booking.user_id != user_id:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    body = request.get_json(silent=True) or {}
    occupied = bool(body.get("slotOccupied"))

    updated = set_slot_occupied(booking_id, occupied)
    if not updated:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    return jsonify(
        {"ok": True, "bookingId": updated.id, "slotOccupied": bool(updated.slot_occupied)}
    ), 200


# -----------------------------------------
# (Optional) Tracking state fetch endpoint
# -----------------------------------------

@bookings_bp.get("/bookings/<int:booking_id>/tracking")
@login_required
def get_tracking(booking_id):
    user_id = g.current_user_id
    booking = db.session.query(Booking).filter_by(id=booking_id).first()
    if not booking or booking.user_id != user_id:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    state = get_booking_tracking_state(booking_id)
    if not state:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    return jsonify(state), 200