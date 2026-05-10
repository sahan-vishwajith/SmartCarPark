from sqlalchemy import func
from ..extensions import db


class Payment(db.Model):
    """
    A successful (or attempted) payment for a booking.
    The frontend's PaymentModal posts here right after the booking
    is confirmed, so the admin dashboard can show a real payment
    summary right after the user pays.
    """
    __tablename__ = "payments"

    id = db.Column(db.BigInteger, primary_key=True)

    booking_id = db.Column(
        db.BigInteger, db.ForeignKey("bookings.id"), nullable=False, index=True
    )
    user_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id"), nullable=False, index=True
    )

    amount = db.Column(db.Numeric(12, 2), nullable=False)
    currency = db.Column(db.String(8), nullable=False, default="LKR")
    method = db.Column(db.String, nullable=False, default="CARD")  # CARD / CASH / WALLET
    status = db.Column(db.String, nullable=False, default="SUCCESS")  # SUCCESS / FAILED / REFUNDED

    # Last 4 of card (never the full PAN — we never store full card data)
    card_last4 = db.Column(db.String(4), nullable=True)
    card_holder = db.Column(db.String, nullable=True)

    paid_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
