import json
from threading import Lock
from flask import request
from ..models.booking import Booking
# 👇 IMPORTANT: use your existing JWT verify logic here
from ..auth.jwt_utils import decode_token
_clients = {}   # booking_id -> set(ws)
_lock = Lock()


def _is_valid_ws_token(token: str):
    if not token:
        return None
    try:
        return decode_token(token)  # should return payload/user or raise
    except Exception:
        return None


def _payload(booking: Booking, msg_type: str):
    return {
        "type": msg_type,
        "bookingId": booking.id,
        "slotId": booking.slot_id,
        "driverArrived": bool(booking.driver_arrived),
        "slotOccupied": bool(booking.slot_occupied),
        "updatedAt": booking.updated_at.isoformat() if booking.updated_at else None,
    }


def broadcast_booking_tracking(booking: Booking):
    data = json.dumps(_payload(booking, "tracking_update"))

    with _lock:
        conns = list(_clients.get(str(booking.id), set()))

    dead = []
    for ws in conns:
        try:
            ws.send(data)
        except Exception:
            dead.append(ws)

    if dead:
        with _lock:
            s = _clients.get(str(booking.id), set())
            for ws in dead:
                s.discard(ws)


def register_booking_ws(sock):
    @sock.route("/ws/bookings/<booking_id>")
    def booking_ws(ws, booking_id):
        token = request.args.get("token")
        user = _is_valid_ws_token(token)
        if not user:
            ws.send(json.dumps({"type": "error", "message": "unauthorized"}))
            return

        booking = Booking.query.get(booking_id)
        if not booking:
            ws.send(json.dumps({"type": "error", "message": "booking_not_found"}))
            return

        with _lock:
            _clients.setdefault(str(booking_id), set()).add(ws)

        # ✅ send initial state immediately
        ws.send(json.dumps(_payload(booking, "tracking_state")))

        try:
            while True:
                msg = ws.receive()
                if msg is None:
                    break
        finally:
            with _lock:
                s = _clients.get(str(booking_id), set())
                s.discard(ws)
                if not s:
                    _clients.pop(str(booking_id), None)