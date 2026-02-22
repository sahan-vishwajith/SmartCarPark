# app/bookings/ws.py
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


def _broadcast_to_booking_id(booking_id: int, message: dict):
    """Broadcast a prepared message dict to all WS clients subscribed to booking_id."""
    with _lock:
        conns = list(_clients.get(int(booking_id), set()))

    dead = []
    for ws in conns:
        ok = _send_safe(ws, message)
        if not ok:
            dead.append(ws)

    if dead:
        with _lock:
            s = _clients.get(int(booking_id), set())
            for ws in dead:
                s.discard(ws)
            if not s:
                _clients.pop(int(booking_id), None)


def broadcast_booking_tracking(booking: Booking):
    """
    Used by your existing API flows (when you update booking via this service).
    Sends a "tracking_update" message to subscribed clients.
    """
    payload = {
        "type": "tracking_update",
        "bookingId": booking.id,
        "slotId": booking.allocated_slot_id,  # ID; frontend uses label separately
        "driverArrived": bool(getattr(booking, "driver_arrived", False)),
        "slotOccupied": bool(getattr(booking, "slot_occupied", False)),
        "updatedAt": booking.updated_at.isoformat() if getattr(booking, "updated_at", None) else None,
    }
    _broadcast_to_booking_id(int(booking.id), payload)


def broadcast_booking_tracking_payload(payload: dict):
    """
    ✅ Used by Postgres LISTEN/NOTIFY listener (DB triggers), or any external source.
    Expected keys in payload:
      bookingId, slotId, driverArrived, slotOccupied, updatedAt
    We wrap it into the same message shape the frontend already understands.
    """
    try:
        booking_id = int(payload.get("bookingId"))
    except Exception:
        return

    msg = {
        "type": "tracking_update",
        "bookingId": booking_id,
        "slotId": payload.get("slotId"),
        "driverArrived": bool(payload.get("driverArrived", False)),
        "slotOccupied": bool(payload.get("slotOccupied", False)),
        "updatedAt": payload.get("updatedAt"),
    }
    _broadcast_to_booking_id(booking_id, msg)


def register_booking_ws(sock):
    @sock.route("/ws/bookings/<booking_id>")
    def booking_ws(ws, booking_id):
        booking_id_int = None
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

            # ✅ validate JWT (and optionally authorize ownership)
            try:
                claims = decode_token(token)  # if your decode_token returns claims
            except Exception:
                _send_safe(ws, {"type": "error", "message": "unauthorized"})
                return

            booking = Booking.query.get(booking_id_int)
            if not booking:
                _send_safe(ws, {"type": "error", "message": "booking_not_found"})
                return

            # ✅ OPTIONAL: enforce "only owner can subscribe"
            # If your decode_token returns user_id under "user_id" or "sub", adjust below.
            try:
                user_id = claims.get("user_id") if isinstance(claims, dict) else None
                if user_id is not None and int(booking.user_id) != int(user_id):
                    _send_safe(ws, {"type": "error", "message": "forbidden"})
                    return
            except Exception:
                # if claims shape unknown, skip strict check
                pass

            # ✅ register connection
            with _lock:
                _clients.setdefault(booking_id_int, set()).add(ws)

            # ✅ initial state
            _send_safe(
                ws,
                {
                    "type": "tracking_state",
                    "bookingId": booking.id,
                    "slotId": booking.allocated_slot_id,
                    "driverArrived": bool(getattr(booking, "driver_arrived", False)),
                    "slotOccupied": bool(getattr(booking, "slot_occupied", False)),
                    "updatedAt": booking.updated_at.isoformat() if getattr(booking, "updated_at", None) else None,
                },
            )

            # ✅ keep alive (optional ping/pong support)
            while True:
                msg = ws.receive()
                if msg is None:
                    break
                if msg == "ping":
                    _send_safe(ws, {"type": "pong"})

        except Exception as e:
            # ✅ Never let Flask dump HTML into the WS stream
            _send_safe(ws, {"type": "error", "message": f"ws_exception: {str(e)}"})

        finally:
            try:
                if booking_id_int is not None:
                    with _lock:
                        s = _clients.get(int(booking_id_int), set())
                        s.discard(ws)
                        if not s:
                            _clients.pop(int(booking_id_int), None)
            except Exception:
                pass