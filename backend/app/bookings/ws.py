import json
from threading import Lock
from flask import request

from ..models import Booking
from ..auth.jwt_utils import decode_token

_clients = {}  # booking_id(int) -> set(ws)
_lock = Lock()


def _send_safe(ws, obj):
    try:
        ws.send(json.dumps(obj))
        return True
    except Exception:
        return False


def broadcast_booking_tracking(booking: Booking):
    payload = {
        "type": "tracking_update",
        "bookingId": booking.id,
        "slotId": booking.allocated_slot_id,  # ID; frontend uses label separately
        "driverArrived": bool(getattr(booking, "driver_arrived", False)),
        "slotOccupied": bool(getattr(booking, "slot_occupied", False)),
        "updatedAt": booking.updated_at.isoformat() if getattr(booking, "updated_at", None) else None,
    }

    with _lock:
        conns = list(_clients.get(int(booking.id), set()))

    dead = []
    for ws in conns:
        ok = _send_safe(ws, payload)
        if not ok:
            dead.append(ws)

    if dead:
        with _lock:
            s = _clients.get(int(booking.id), set())
            for ws in dead:
                s.discard(ws)


def register_booking_ws(sock):
    @sock.route("/ws/bookings/<booking_id>")
    def booking_ws(ws, booking_id):
        try:
            # ✅ booking_id is int in your system
            try:
                booking_id_int = int(booking_id)
            except ValueError:
                _send_safe(ws, {"type": "error", "message": "invalid_booking_id"})
                return

            token = request.args.get("token")
            if not token:
                _send_safe(ws, {"type": "error", "message": "missing_token"})
                return

            # ✅ validate JWT
            try:
                decode_token(token)
            except Exception:
                _send_safe(ws, {"type": "error", "message": "unauthorized"})
                return

            booking = Booking.query.get(booking_id_int)
            if not booking:
                _send_safe(ws, {"type": "error", "message": "booking_not_found"})
                return

            with _lock:
                _clients.setdefault(booking_id_int, set()).add(ws)

            # ✅ initial state
            _send_safe(ws, {
                "type": "tracking_state",
                "bookingId": booking.id,
                "slotId": booking.allocated_slot_id,
                "driverArrived": bool(getattr(booking, "driver_arrived", False)),
                "slotOccupied": bool(getattr(booking, "slot_occupied", False)),
                "updatedAt": booking.updated_at.isoformat() if getattr(booking, "updated_at", None) else None,
            })

            # ✅ keep alive
            while True:
                msg = ws.receive()
                if msg is None:
                    break

        except Exception as e:
            # ✅ Never let Flask dump HTML into the WS stream
            _send_safe(ws, {"type": "error", "message": f"ws_exception: {str(e)}"})

        finally:
            try:
                with _lock:
                    s = _clients.get(int(booking_id), set())
                    s.discard(ws)
                    if not s:
                        _clients.pop(int(booking_id), None)
            except Exception:
                pass