# models.py
from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class ParkingSlot(db.Model):
    __tablename__ = "parking_slots"

    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(50), unique=True, nullable=False)  # e.g. "A-01"
    is_active = db.Column(db.Boolean, default=True, nullable=False)


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=True)  # link to your users table later
    slot_id = db.Column(db.Integer, db.ForeignKey("parking_slots.id"), nullable=False)
    slot = db.relationship("ParkingSlot", backref="bookings")

    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=False)

    status = db.Column(db.String(20), nullable=False, default="CONFIRMED")
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
