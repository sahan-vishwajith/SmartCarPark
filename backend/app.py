from flask import Flask, jsonify, request, g
from flask_cors import CORS
import os
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, text
from sqlalchemy.types import JSON
from datetime import datetime, timedelta, timezone
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

load_dotenv()

app = Flask(__name__)

# Enable CORS for all /api routes
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Environment variables
DEBUG = os.getenv("FLASK_ENV") == "development"
PORT = int(os.getenv("PORT", 5000))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in .env")

# SQLAlchemy configuration
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
# Supabase requires SSL in most environments
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "connect_args": {"sslmode": "require"}
}

db = SQLAlchemy(app)


# ─────────────────────────
#   Database Models
# ─────────────────────────

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.BigInteger, primary_key=True)
    username = db.Column(db.String, unique=True, nullable=False)
    password_hash = db.Column(db.String, nullable=True)
    driver_name = db.Column(db.String, nullable=True)
    vehicle_number = db.Column(db.String, nullable=True)
    vehicle_type = db.Column(db.String, nullable=True)
    phone_number = db.Column(db.String, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())


class ParkingSlot(db.Model):
    __tablename__ = "parking_slots"

    id = db.Column(db.BigInteger, primary_key=True)
    label = db.Column(db.String, nullable=False)  # MUST match labels in ss.json
    is_active = db.Column(db.Boolean, nullable=False, default=True)


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id"), nullable=False)
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=False)
    status = db.Column(db.String, nullable=False)  # PENDING, CONFIRMED, REJECTED, CANCELLED
    allocated_slot_id = db.Column(
        db.BigInteger, db.ForeignKey("parking_slots.id"), nullable=True
    )
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id"), nullable=False)
    booking_id = db.Column(db.BigInteger, db.ForeignKey("bookings.id"), nullable=True)
    channel = db.Column(db.String, nullable=False)  # e.g., PUSH
    payload = db.Column(JSON, nullable=False)
    send_at = db.Column(db.DateTime(timezone=True), nullable=False)
    sent = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())


# ─────────────────────────
#   Auth / JWT helpers
# ─────────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGO = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# 🔧 default booking duration (minutes) for immediate allocation
DEFAULT_BOOKING_DURATION_MINUTES = int(
    os.getenv("BOOKING_DURATION_MINUTES", "60")
)


def utcnow():
    """Return timezone-aware UTC now."""
    return datetime.now(timezone.utc)


def create_jwt_for_user(user: User) -> str:
    now = utcnow()
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRE_MINUTES)).timestamp()),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def decode_jwt(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])


def get_current_user_id():
    """
    Get user_id from Authorization: Bearer <token>.
    (Keeps X-User-Id as dev fallback if token missing)
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = decode_jwt(token)
            return int(payload["sub"])
        except Exception as e:
            print("JWT decode failed:", e)

    # DEV fallback: X-User-Id header (you can remove this later)
    header_val = request.headers.get("X-User-Id")
    if header_val:
        try:
            return int(header_val)
        except ValueError:
            pass

    return None


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        g.current_user_id = user_id
        return f(*args, **kwargs)

    return wrapper


# ─────────────────────────
#   Misc helpers
# ─────────────────────────

def parse_iso_datetime(value, field_name):
    if not value:
        raise ValueError(f"{field_name} is required")
    try:
        dt = datetime.fromisoformat(value)
        # If no timezone info provided, assume UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        raise ValueError(f"{field_name} must be an ISO datetime string")


def allocate_free_slot(start_time, duration_minutes=DEFAULT_BOOKING_DURATION_MINUTES):
    """
    Allocate a free slot immediately for [start_time, end_time) window.
    Returns (slot, end_time) or (None, end_time) if no slot is free.

    IMPORTANT: ParkingSlot.label must match frontend ss.json labels.
    """
    if start_time.tzinfo is None:
        # ensure aware datetime (treat as UTC for now)
        start_time = start_time.replace(tzinfo=timezone.utc)

    end_time = start_time + timedelta(minutes=duration_minutes)

    # 1) All active slots
    active_slots = (
        db.session.query(ParkingSlot)
        .filter(ParkingSlot.is_active.is_(True))
        .order_by(ParkingSlot.id.asc())
        .all()
    )
    if not active_slots:
        return None, end_time

    active_slot_ids = [s.id for s in active_slots]

    # 2) All overlapping *confirmed* bookings that already have a slot
    overlapping = (
        db.session.query(Booking)
        .filter(
            Booking.status == "CONFIRMED",
            Booking.allocated_slot_id.isnot(None),
            Booking.allocated_slot_id.in_(active_slot_ids),
            Booking.start_time < end_time,
            Booking.end_time > start_time,
        )
        .all()
    )

    busy_ids = {b.allocated_slot_id for b in overlapping}

    # 3) Pick the first active slot that's not busy
    free_slot = next((s for s in active_slots if s.id not in busy_ids), None)

    return free_slot, end_time


# ─────────────────────────
#   Routes
# ─────────────────────────

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "message": "Flask backend is running"
    }), 200


@app.route("/api/info", methods=["GET"])
def get_info():
    return jsonify({
        "app_name": "CarPark API",
        "version": "1.0.0",
        "environment": os.getenv("FLASK_ENV", "production")
    }), 200


@app.route("/api/db-health", methods=["GET"])
def db_health():
    try:
        with db.engine.connect() as conn:
            result = conn.execute(text("select 1 as ok")).mappings().first()
        return jsonify({"db": "connected", "result": dict(result)}), 200
    except Exception as e:
        return jsonify({"db": "error", "message": str(e)}), 500


# ─────────────────────────
#   OLD prebook-requests (kept for now)
# ─────────────────────────

@app.route("/api/prebook-requests", methods=["POST"])
@login_required
def create_prebook_request():
    """
    LEGACY FLOW:
    POST /api/prebook-requests
    body: { startTime: "2026-02-20T09:00:00", endTime: "2026-02-20T10:00:00" }

    Creates PENDING booking + notifications.
    You can keep this or remove later if you fully move to immediate allocation.
    """
    data = request.get_json() or {}

    try:
        start_time = parse_iso_datetime(data.get("startTime"), "startTime")
        end_time = parse_iso_datetime(data.get("endTime"), "endTime")
    except ValueError as e:
        return jsonify({"error": "Bad Request", "message": str(e)}), 400

    now_utc = utcnow()

    # 1. Basic validation
    if start_time >= end_time:
        return jsonify({
            "error": "Bad Request",
            "message": "startTime must be earlier than endTime"
        }), 400

    # Must be in the future
    if start_time <= now_utc:
        return jsonify({
            "error": "Bad Request",
            "message": "Start time must be in the future"
        }), 400

    # Must be at least 15 minutes from now (so reminder time is also in future)
    min_start = now_utc + timedelta(minutes=15)
    if start_time <= min_start:
        return jsonify({
            "error": "Bad Request",
            "message": "Start time must be at least 15 minutes from now"
        }), 400

    user_id = g.current_user_id

    try:
        # 2. Check capacity in that time window

        # Count active slots
        total_slots = db.session.query(func.count(ParkingSlot.id)) \
            .filter(ParkingSlot.is_active.is_(True)) \
            .scalar()

        if not total_slots or total_slots <= 0:
            return jsonify({
                "error": "Conflict",
                "message": "No active parking slots configured"
            }), 409

        # Count overlapping bookings with status PENDING or CONFIRMED
        overlapping_bookings = db.session.query(func.count(Booking.id)) \
            .filter(
                Booking.status.in_(["PENDING", "CONFIRMED"]),
                Booking.start_time < end_time,
                Booking.end_time > start_time
            ) \
            .scalar()

        if overlapping_bookings >= total_slots:
            return jsonify({
                "error": "Conflict",
                "message": "No slots available in this time window"
            }), 409

        # 3. Create booking as PENDING (no specific slot yet)
        booking = Booking(
            user_id=user_id,
            start_time=start_time,
            end_time=end_time,
            status="PENDING",
            allocated_slot_id=None
        )
        db.session.add(booking)
        db.session.flush()  # get booking.id without committing yet

        # 4. Immediate notification: "your request is accepted"
        immediate_payload = {
            "type": "BOOKING_ACCEPTED",
            "startTime": data.get("startTime"),
            "endTime": data.get("endTime")
        }

        immediate_notification = Notification(
            user_id=user_id,
            booking_id=booking.id,
            channel="PUSH",
            payload=immediate_payload,
            send_at=now_utc,
            sent=False
        )
        db.session.add(immediate_notification)

        # 5. Schedule reminder notification 15 minutes before startTime
        notify_at = start_time - timedelta(minutes=15)

        reminder_payload = {
            "type": "BOOKING_REMINDER",
            "bookingId": booking.id,
            "message": "Your parking slot will be assigned soon",
            "startTime": data.get("startTime"),
            "endTime": data.get("endTime"),
        }

        reminder_notification = Notification(
            user_id=user_id,
            booking_id=booking.id,
            channel="PUSH",
            payload=reminder_payload,
            send_at=notify_at,
            sent=False
        )
        db.session.add(reminder_notification)

        db.session.commit()

        return jsonify({
            "bookingId": booking.id,
            "status": booking.status,
            "startTime": data.get("startTime"),
            "endTime": data.get("endTime")
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Internal Server Error",
            "message": str(e)
        }), 500


# ─────────────────────────
#   NEW FLOW: immediate slot assignment on payment
# ─────────────────────────

@app.route("/api/prebook-confirm", methods=["POST"])
@login_required
def prebook_confirm():
    """
    New flow:

    Body:
    {
      "date": "2026-02-20",       # YYYY-MM-DD
      "startTime": "09:00",       # HH:MM (24h)
      "payment": { ... }          # demo / future use
    }

    Behavior:
      - Parse date + startTime into a timezone-aware datetime
      - Allocate a free slot immediately (CONFIRMED booking)
      - Return bookingId + slot label (to highlight in React map and navigate)
    """
    data = request.get_json() or {}
    user_id = g.current_user_id

    date_str = (data.get("date") or "").strip()
    start_str = (data.get("startTime") or "").strip()

    if not date_str or not start_str:
        return jsonify({
            "error": "Bad Request",
            "message": "date and startTime are required"
        }), 400

    # Basic parse: treat given local time as UTC for now
    try:
        naive = datetime.strptime(f"{date_str} {start_str}", "%Y-%m-%d %H:%M")
        start_time = naive.replace(tzinfo=timezone.utc)
    except ValueError:
        return jsonify({
            "error": "Bad Request",
            "message": "Invalid date or time format"
        }), 400

    now_utc = utcnow()
    if start_time <= now_utc:
        return jsonify({
            "error": "Bad Request",
            "message": "Start time must be in the future"
        }), 400

    # TODO: validate payment details here (data.get("payment")) – for now assume success

    try:
        # Allocate slot for this start_time
        slot, end_time = allocate_free_slot(start_time)
        if not slot:
            return jsonify({
                "error": "Conflict",
                "message": "No available slots for that time window"
            }), 409

        # Create CONFIRMED booking
        booking = Booking(
            user_id=user_id,
            start_time=start_time,
            end_time=end_time,
            status="CONFIRMED",
            allocated_slot_id=slot.id,
        )
        db.session.add(booking)
        db.session.commit()

        # Return bookingId + slot label (this label must match ss.json labels)
        return jsonify({
            "bookingId": booking.id,
            "slotId": slot.label,
            "date": date_str,
            "startTime": start_str,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Internal Server Error",
            "message": str(e)
        }), 500


@app.route("/api/bookings/<int:booking_id>", methods=["GET"])
@login_required
def get_booking(booking_id):
    """
    Fetch a single booking for the logged-in user.
    Used by /booking/:id React page to visualize the map with the reserved slot.
    """
    user_id = g.current_user_id

    booking = db.session.query(Booking).filter_by(id=booking_id).first()
    if not booking:
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    if booking.user_id != user_id:
        # Don't leak existence of others' bookings
        return jsonify({"error": "Not Found", "message": "Booking not found"}), 404

    slot = None
    if booking.allocated_slot_id is not None:
        slot = db.session.query(ParkingSlot).filter_by(
            id=booking.allocated_slot_id
        ).first()

    return jsonify({
        "id": booking.id,
        "slotId": slot.label if slot else None,
        "startTime": booking.start_time.isoformat(),
        "endTime": booking.end_time.isoformat(),
        "status": booking.status,
    }), 200


@app.route("/api/notifications", methods=["GET"])
@login_required
def get_notifications():
    """
    Returns notifications for the current user.
    Default: only unread + send_at <= now.
    Marks them as sent so they only show once.
    Optional query param: ?unreadOnly=false to get recent history.
    """
    user_id = g.current_user_id
    now = utcnow()

    unread_only = request.args.get("unreadOnly", "true").lower() != "false"

    query = (
        db.session.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.send_at <= now,
        )
        .order_by(Notification.created_at.desc())
    )

    if unread_only:
        query = query.filter(Notification.sent.is_(False))

    notifications = query.limit(20).all()

    result = []
    for n in notifications:
        result.append({
            "id": n.id,
            "bookingId": n.booking_id,
            "channel": n.channel,
            "payload": n.payload,
            "sendAt": n.send_at.isoformat(),
            "sent": n.sent,
        })

    # Mark as sent if we only fetched unread
    if unread_only and notifications:
        try:
            for n in notifications:
                n.sent = True
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print("Failed to mark notifications as sent:", e)

    return jsonify(result), 200


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    driver_name = (data.get("driverName") or "").strip()
    vehicle_number = (data.get("vehicleNumber") or "").strip()
    vehicle_type = (data.get("vehicleType") or "").strip()
    phone_number = (data.get("phoneNumber") or "").strip()

    # Basic validation
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if not driver_name or not vehicle_number or not vehicle_type or not phone_number:
        return jsonify({"error": "All profile fields are required"}), 400

    # Username must be unique
    existing = db.session.query(User).filter_by(username=username).first()
    if existing:
        return jsonify({"error": "Username already taken"}), 409

    password_hash = generate_password_hash(password)

    user = User(
        username=username,
        password_hash=password_hash,
        driver_name=driver_name,
        vehicle_number=vehicle_number,
        vehicle_type=vehicle_type,
        phone_number=phone_number,
    )

    db.session.add(user)
    db.session.commit()

    token = create_jwt_for_user(user)

    return jsonify(
        {
            "token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "driverName": user.driver_name,
                "vehicleNumber": user.vehicle_number,
                "vehicleType": user.vehicle_type,
                "phoneNumber": user.phone_number,
            },
        }
    ), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = db.session.query(User).filter_by(username=username).first()
    if not user or not user.password_hash:
        return jsonify({"error": "Invalid username or password"}), 401

    if not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid username or password"}), 401

    token = create_jwt_for_user(user)

    return jsonify(
        {
            "token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "driverName": user.driver_name,
                "vehicleNumber": user.vehicle_number,
                "vehicleType": user.vehicle_type,
                "phoneNumber": user.phone_number,
            },
        }
    ), 200


# ─────────────────────────
#   Slot assignment job + debug endpoint (legacy delayed flow)
# ─────────────────────────

def assign_slots_and_notify():
    """
    Core logic:
      - find PENDING bookings that start within next 15 minutes
      - try to assign a free slot
      - create SLOT_ASSIGNED or SLOT_REJECTED notifications
    """
    now = utcnow()

    # Bookings that start in (now, now+15min]
    bookings = (
        db.session.query(Booking)
        .filter(
            Booking.status == "PENDING",
            Booking.start_time <= now + timedelta(minutes=15),
            Booking.start_time > now,
        )
        .order_by(Booking.start_time.asc())
        .all()
    )

    if not bookings:
        return

    # All active slots
    active_slots = (
        db.session.query(ParkingSlot)
        .filter(ParkingSlot.is_active.is_(True))
        .order_by(ParkingSlot.id.asc())
        .all()
    )
    active_slot_ids = [s.id for s in active_slots]

    for booking in bookings:
        # Slots already taken in this booking's time window
        busy_slot_rows = (
            db.session.query(Booking.allocated_slot_id)
            .filter(
                Booking.status == "CONFIRMED",
                Booking.allocated_slot_id.isnot(None),
                Booking.start_time < booking.end_time,
                Booking.end_time > booking.start_time,
            )
            .all()
        )
        busy_slot_ids = [row.allocated_slot_id for row in busy_slot_rows]

        free_slot_id = next(
            (sid for sid in active_slot_ids if sid not in busy_slot_ids),
            None,
        )

        if free_slot_id is None:
            # No slot: mark REJECTED
            booking.status = "REJECTED"

            reject_payload = {
                "type": "SLOT_REJECTED",
                "bookingId": booking.id,
                "message": "No slot could be assigned for your booking window.",
            }

            n = Notification(
                user_id=booking.user_id,
                booking_id=booking.id,
                channel="PUSH",
                payload=reject_payload,
                send_at=now,
                sent=False,
            )
            db.session.add(n)
        else:
            # Assign & confirm
            booking.status = "CONFIRMED"
            booking.allocated_slot_id = free_slot_id

            assign_payload = {
                "type": "SLOT_ASSIGNED",
                "bookingId": booking.id,
                "slotId": free_slot_id,
                "startTime": booking.start_time.isoformat(),
                "endTime": booking.end_time.isoformat(),
            }

            n = Notification(
                user_id=booking.user_id,
                booking_id=booking.id,
                channel="PUSH",
                payload=assign_payload,
                send_at=now,
                sent=False,
            )
            db.session.add(n)

    db.session.commit()


@app.route("/api/debug/run-assign-slots", methods=["POST"])
def debug_run_assign_slots():
    """
    Debug endpoint to manually trigger assign_slots_and_notify().
    Use this while developing instead of a real cron/scheduler.
    """
    try:
        assign_slots_and_notify()
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────
#   Error Handlers
# ─────────────────────────

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "error": "Not Found",
        "message": "The requested resource was not found"
    }), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected error occurred"
    }), 500


@app.route("/api/debug/now")
def debug_now():
    return jsonify({
        "utc_now": datetime.now(timezone.utc).isoformat()
    })


# ─────────────────────────
#   Main
# ─────────────────────────

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=DEBUG
    )
