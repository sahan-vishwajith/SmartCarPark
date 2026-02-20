from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from ..extensions import db
from datetime import datetime, timezone

misc_bp = Blueprint("misc", __name__)

@misc_bp.get("/health")
def health():
    return jsonify({"status": "healthy", "message": "Flask backend is running"}), 200

@misc_bp.get("/info")
def info():
    return jsonify({
        "app_name": "CarPark API",
        "version": "1.0.0",
        "environment": current_app.config.get("ENV", "production")
    }), 200

@misc_bp.get("/db-health")
def db_health():
    try:
        with db.engine.connect() as conn:
            result = conn.execute(text("select 1 as ok")).mappings().first()
        return jsonify({"db": "connected", "result": dict(result)}), 200
    except Exception as e:
        return jsonify({"db": "error", "message": str(e)}), 500

@misc_bp.get("/debug/now")
def debug_now():
    return jsonify({"utc_now": datetime.now(timezone.utc).isoformat()})
