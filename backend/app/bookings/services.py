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
