from datetime import datetime, timedelta, timezone
from flask import current_app
from ..extensions import db
from ..models import ParkingSlot, Booking


def utcnow():
    return datetime.now(timezone.utc)


def allocate_free_slot(start_time, duration_minutes=None):
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)

    if duration_minutes is None:
        duration_minutes = current_app.config["BOOKING_DURATION_MINUTES"]

    end_time = start_time + timedelta(minutes=duration_minutes)

    active_slots = (
        db.session.query(ParkingSlot)
        .filter(ParkingSlot.is_active.is_(True))
        .order_by(ParkingSlot.id.asc())
        .all()
    )
    if not active_slots:
        return None, end_time

    active_slot_ids = [s.id for s in active_slots]

    overlapping = (
        db.session.query(Booking)
        .filter(
            Booking.status == "CONFIRMED",
            Booking.allocated_slot_id.isnot(None),
            Booking.allocated_slot_id.in_(active_slot_ids),
            Booking.start_time < end_time,
            Booking.end_time > start_time,
        )
        .all()
    )

    busy_ids = {b.allocated_slot_id for b in overlapping}
    free_slot = next((s for s in active_slots if s.id not in busy_ids), None)
    return free_slot, end_time


# -----------------------------
# Real-time tracking state APIs
# -----------------------------

def _touch_updated_at(booking: Booking):
    # Only update if you added this column
    if hasattr(booking, "updated_at"):
        booking.updated_at = utcnow()


def _broadcast_tracking(booking: Booking):
    """
    Broadcast booking tracking updates to connected WS clients.
    Import inside to avoid circular imports.
    """
    try:
        from .ws import broadcast_booking_tracking  # app/bookings/ws.py
        broadcast_booking_tracking(booking)
    except Exception:
        # Don't break API if WS is not configured/running
        pass


def get_booking_tracking_state(booking_id):
    booking = db.session.query(Booking).get(booking_id)
    if not booking:
        return None

    return {
        "bookingId": booking.id,
        "slotId": getattr(booking, "allocated_slot_id", None),
        "driverArrived": bool(getattr(booking, "driver_arrived", False)),
        "slotOccupied": bool(getattr(booking, "slot_occupied", False)),
        "updatedAt": booking.updated_at.isoformat() if hasattr(booking, "updated_at") and booking.updated_at else None,
    }


def set_driver_arrived(booking_id, arrived: bool):
    booking = db.session.query(Booking).get(booking_id)
    if not booking:
        return None

    # Requires: Booking.driver_arrived (BOOLEAN)
    booking.driver_arrived = bool(arrived)
    _touch_updated_at(booking)

    db.session.commit()
    _broadcast_tracking(booking)
    return booking


def set_slot_occupied(booking_id, occupied: bool):
    booking = db.session.query(Booking).get(booking_id)
    if not booking:
        return None

    # Requires: Booking.slot_occupied (BOOLEAN)
    booking.slot_occupied = bool(occupied)

    # Optional rule: if slot occupied, driver has arrived
    if booking.slot_occupied and hasattr(booking, "driver_arrived"):
        booking.driver_arrived = True

    _touch_updated_at(booking)

    db.session.commit()
    _broadcast_tracking(booking)
    return booking