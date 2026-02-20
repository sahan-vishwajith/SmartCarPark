from flask import Blueprint, jsonify, request, g
from datetime import datetime, timezone
from ..extensions import db
from ..models import Booking, ParkingSlot
from ..auth.decorators import login_required
from .services import allocate_free_slot, utcnow

bookings_bp = Blueprint("bookings", __name__)

@bookings_bp.post("/prebook-confirm")
@login_required
def prebook_confirm():
    data = request.get_json() or {}
    user_id = g.current_user_id

    date_str = (data.get("date") or "").strip()
    start_str = (data.get("startTime") or "").strip()

    if not date_str or not start_str:
        return jsonify({"error": "Bad Request", "message": "date and startTime are required"}), 400

    try:
        naive = datetime.strptime(f"{date_str} {start_str}", "%Y-%m-%d %H:%M")
        start_time = naive.replace(tzinfo=timezone.utc)  # keep your current behavior
    except ValueError:
        return jsonify({"error": "Bad Request", "message": "Invalid date or time format"}), 400

    if start_time <= utcnow():
        return jsonify({"error": "Bad Request", "message": "Start time must be in the future"}), 400

    try:
        slot, end_time = allocate_free_slot(start_time)
        if not slot:
            return jsonify({"error": "Conflict", "message": "No available slots for that time window"}), 409

        booking = Booking(
            user_id=user_id,
            start_time=start_time,
            end_time=end_time,
            status="CONFIRMED",
            allocated_slot_id=slot.id,
        )
        db.session.add(booking)
        db.session.commit()

        return jsonify({
            "bookingId": booking.id,
            "slotId": slot.label,
            "date": date_str,
            "startTime": start_str,
        }), 200
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

    return jsonify({
        "id": booking.id,
        "slotId": slot_label,
        "startTime": booking.start_time.isoformat(),
        "endTime": booking.end_time.isoformat(),
        "status": booking.status,
    }), 200

