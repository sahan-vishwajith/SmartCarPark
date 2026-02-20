from sqlalchemy import func
from ..extensions import db

class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id"), nullable=False)

    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=False)

    status = db.Column(db.String, nullable=False)  # PENDING/CONFIRMED/REJECTED/CANCELLED
    allocated_slot_id = db.Column(db.BigInteger, db.ForeignKey("parking_slots.id"), nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    driver_arrived = db.Column(db.Boolean, nullable=False, default=False)
    slot_occupied = db.Column(db.Boolean, nullable=False, default=False)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())