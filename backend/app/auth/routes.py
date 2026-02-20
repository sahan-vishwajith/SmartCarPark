from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from ..extensions import db
from ..models import User
from .jwt_utils import create_jwt

auth_bp = Blueprint("auth", __name__)

@auth_bp.post("/register")
def register():
    data = request.get_json() or {}

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    driver_name = (data.get("driverName") or "").strip()
    vehicle_number = (data.get("vehicleNumber") or "").strip()
    vehicle_type = (data.get("vehicleType") or "").strip()
    phone_number = (data.get("phoneNumber") or "").strip()

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if not driver_name or not vehicle_number or not vehicle_type or not phone_number:
        return jsonify({"error": "All profile fields are required"}), 400

    if db.session.query(User).filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 409

    user = User(
        username=username,
        password_hash=generate_password_hash(password),
        driver_name=driver_name,
        vehicle_number=vehicle_number,
        vehicle_type=vehicle_type,
        phone_number=phone_number,
    )
    db.session.add(user)
    db.session.commit()

    token = create_jwt(user.id, user.username)
    return jsonify({"token": token, "user": _user_json(user)}), 201

@auth_bp.post("/login")
def login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = db.session.query(User).filter_by(username=username).first()
    if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid username or password"}), 401

    token = create_jwt(user.id, user.username)
    return jsonify({"token": token, "user": _user_json(user)}), 200

def _user_json(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "driverName": user.driver_name,
        "vehicleNumber": user.vehicle_number,
        "vehicleType": user.vehicle_type,
        "phoneNumber": user.phone_number,
    }
