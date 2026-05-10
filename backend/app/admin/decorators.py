from functools import wraps
from flask import request, jsonify, g
from .jwt_utils import decode_admin_jwt


def get_current_admin_id():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = decode_admin_jwt(token)
            return int(payload["sub"]), payload.get("username"), payload.get("role")
        except Exception:
            pass
    return None, None, None


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        admin_id, username, role = get_current_admin_id()
        if not admin_id:
            return jsonify({"error": "Unauthorized", "message": "Admin token required"}), 401
        g.current_admin_id = admin_id
        g.current_admin_username = username
        g.current_admin_role = role
        return f(*args, **kwargs)
    return wrapper
