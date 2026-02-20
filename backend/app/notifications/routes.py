from flask import Blueprint, jsonify, request, g
from ..extensions import db
from ..models import Notification
from ..auth.decorators import login_required
from datetime import datetime, timezone

notifications_bp = Blueprint("notifications", __name__)

def utcnow():
    return datetime.now(timezone.utc)

@notifications_bp.get("/notifications")
@login_required
def get_notifications():
    user_id = g.current_user_id
    now = utcnow()

    unread_only = request.args.get("unreadOnly", "true").lower() != "false"

    query = (
        db.session.query(Notification)
        .filter(Notification.user_id == user_id, Notification.send_at <= now)
        .order_by(Notification.created_at.desc())
    )

    if unread_only:
        query = query.filter(Notification.sent.is_(False))

    notifications = query.limit(20).all()

    result = [{
        "id": n.id,
        "bookingId": n.booking_id,
        "channel": n.channel,
        "payload": n.payload,
        "sendAt": n.send_at.isoformat(),
        "sent": n.sent,
    } for n in notifications]

    if unread_only and notifications:
        try:
            for n in notifications:
                n.sent = True
            db.session.commit()
        except Exception:
            db.session.rollback()

    return jsonify(result), 200

