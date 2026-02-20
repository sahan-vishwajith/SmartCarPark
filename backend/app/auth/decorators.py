from functools import wraps
from flask import request, jsonify, g
from .jwt_utils import decode_jwt

def get_current_user_id():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = decode_jwt(token)
            return int(payload["sub"])
        except Exception:
            pass

    # DEV fallback (optional)
    header_val = request.headers.get("X-User-Id")
    if header_val:
        try:
            return int(header_val)
        except ValueError:
            return None

    return None

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        uid = get_current_user_id()
        if not uid:
            return jsonify({"error": "Unauthorized"}), 401
        g.current_user_id = uid
        return f(*args, **kwargs)
    return wrapper
