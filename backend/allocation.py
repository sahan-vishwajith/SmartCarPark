# allocation.py
from datetime import datetime, timedelta
from sqlalchemy import and_

from models import db, ParkingSlot, Booking


DEFAULT_DURATION_MINUTES = 60  # 1 hour booking for now


def allocate_slot_for_time(start_time: datetime) -> ParkingSlot | None:
    """
    Find a free slot for the given start_time and fixed duration.
    Returns a ParkingSlot or None if no free slot is found.
    """
    end_time = start_time + timedelta(minutes=DEFAULT_DURATION_MINUTES)

    # 1. All active slots
    active_slots = ParkingSlot.query.filter_by(is_active=True).all()
    if not active_slots:
        return None

    active_slot_ids = [s.id for s in active_slots]

    # 2. All bookings overlapping this time window
    overlapping = (
        Booking.query.filter(
            Booking.status == "CONFIRMED",
            Booking.slot_id.in_(active_slot_ids),
            # time-overlap: start < other_end AND end > other_start
            and_(Booking.start_time < end_time, Booking.end_time > start_time),
        ).all()
    )

    busy_slot_ids = {b.slot_id for b in overlapping}

    # 3. First slot that is not busy
    for slot in active_slots:
        if slot.id not in busy_slot_ids:
            return slot

    return None
