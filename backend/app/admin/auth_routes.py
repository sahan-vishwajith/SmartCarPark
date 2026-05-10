from flask import Blueprint, jsonify, request, g
from werkzeug.security import check_password_hash
from datetime import datetime, timezone
from ..extensions import db
from ..models import Admin
from .jwt_utils import create_admin_jwt
from .decorators import admin_required


admin_auth_bp = Blueprint("admin_auth", __name__)


@admin_auth_bp.post("/login")
def admin_login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    admin = db.session.query(Admin).filter_by(username=username).first()
    if (
        not admin
        or not admin.is_active
        or not admin.password_hash
        or not check_password_hash(admin.password_hash, password)
    ):
        return jsonify({"error": "Invalid admin credentials"}), 401

    admin.last_login_at = datetime.now(timezone.utc)
    db.session.commit()

    token = create_admin_jwt(admin.id, admin.username, admin.role)
    return jsonify(
        {
            "token": token,
            "admin": _admin_json(admin),
        }
    ), 200


@admin_auth_bp.get("/me")
@admin_required
def admin_me():
    admin = db.session.query(Admin).filter_by(id=g.current_admin_id).first()
    if not admin:
        return jsonify({"error": "Not Found"}), 404
    return jsonify({"admin": _admin_json(admin)}), 200


def _admin_json(admin: Admin):
    return {
        "id": admin.id,
        "username": admin.username,
        "fullName": admin.full_name,
        "email": admin.email,
        "role": admin.role,
        "isActive": admin.is_active,
    }
