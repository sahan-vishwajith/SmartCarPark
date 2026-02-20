from sqlalchemy import func
from sqlalchemy.types import JSON
from ..extensions import db

class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id"), nullable=False)
    booking_id = db.Column(db.BigInteger, db.ForeignKey("bookings.id"), nullable=True)

    channel = db.Column(db.String, nullable=False)  # PUSH
    payload = db.Column(JSON, nullable=False)

    send_at = db.Column(db.DateTime(timezone=True), nullable=False)
    sent = db.Column(db.Boolean, nullable=False, default=False)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

