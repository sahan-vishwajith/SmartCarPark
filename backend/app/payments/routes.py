"""
Driver-facing payment endpoints.

  POST /api/payments                         -> create a payment for a booking
  GET  /api/payments/by-booking/<id>         -> fetch the latest payment + booking summary

The frontend `PaymentModal.jsx` already creates the booking via /prebook-confirm
and gets back a bookingId. Right after that it calls POST /api/payments to
record the payment so the admin dashboard can show a real summary.
"""
from datetime import timezone
from decimal import Decimal

from flask import Blueprint, jsonify, request, g
from ..extensions import db
from ..models import Booking, Payment, ParkingSlot, User
from ..auth.decorators import login_required


payments_bp = Blueprint("payments", __name__)


# Default Sri Lanka pricing (mirrors frontend lib/pricing.js)
BASE_FEE_LKR = Decimal("30")
PER_MINUTE_LKR = Decimal("5")


def _to_utc_z(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _compute_default_amount(booking: Booking) -> Decimal:
    """Pre-charge = base fee + (booking duration in minutes * per-minute)."""
    if not booking.start_time or not booking.end_time:
        return BASE_FEE_LKR
    minutes = max(0, int((booking.end_time - booking.start_time).total_seconds() // 60))
    return BASE_FEE_LKR + (Decimal(minutes) * PER_MINUTE_LKR)


def _last4(card_number: str) -> str | None:
    if not card_number:
        return None
    digits = "".join(ch for ch in str(card_number) if ch.isdigit())
    return digits[-4:] if len(digits) >= 4 else None


def _payment_summary_json(payment: Payment, booking: Booking, slot: ParkingSlot | None, user: User | None):
    return {
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


@payments_bp.post("/payments")
@login_required
def create_payment():
    data = request.get_json() or {}
    user_id = g.current_user_id

    booking_id = data.get("bookingId")
    if not booking_id:
        return jsonify({"error": "Bad Request", "message": "bookingId required"}), 400

    booking = db.session.query(Booking).filter_by(id=booking_id).first()
    if not booking or booking.user_id != user_id:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    # Amount: trust client-provided LKR amount when sensible, otherwise compute
    raw_amount = data.get("amount")
    try:
        amount = Decimal(str(raw_amount)) if raw_amount is not None else _compute_default_amount(booking)
    except Exception:
        amount = _compute_default_amount(booking)
    if amount < 0:
        amount = Decimal("0")

    method = (data.get("method") or "CARD").upper()
    if method not in ("CARD", "CASH", "WALLET"):
        method = "CARD"

    card = data.get("card") or {}
    card_holder = (card.get("cardName") or card.get("holder") or "").strip() or None
    card_last4 = _last4(card.get("cardNumber") or card.get("number") or "")

    payment = Payment(
        booking_id=booking.id,
        user_id=user_id,
        amount=amount,
        currency=(data.get("currency") or "LKR").upper(),
        method=method,
        status="SUCCESS",
        card_last4=card_last4,
        card_holder=card_holder,
    )
    db.session.add(payment)
    db.session.commit()

    slot = None
    if booking.allocated_slot_id is not None:
        slot = db.session.query(ParkingSlot).filter_by(id=booking.allocated_slot_id).first()
    user = db.session.query(User).filter_by(id=user_id).first()

    return jsonify(_payment_summary_json(payment, booking, slot, user)), 201


@payments_bp.get("/payments/by-booking/<int:booking_id>")
@login_required
def get_payment_for_booking(booking_id: int):
    user_id = g.current_user_id

    booking = db.session.query(Booking).filter_by(id=booking_id).first()
    if not booking or booking.user_id != user_id:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    payment = (
        db.session.query(Payment)
        .filter_by(booking_id=booking_id)
        .order_by(Payment.paid_at.desc())
        .first()
    )
    if not payment:
        return jsonify({"error": "Not Found", "message": "No payment for this booking"}), 404

    slot = None
    if booking.allocated_slot_id is not None:
        slot = db.session.query(ParkingSlot).filter_by(id=booking.allocated_slot_id).first()
    user = db.session.query(User).filter_by(id=user_id).first()

    return jsonify(_payment_summary_json(payment, booking, slot, user)), 200
