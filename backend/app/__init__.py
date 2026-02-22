# app/__init__.py
import os
from pathlib import Path
from flask import Flask, jsonify
from dotenv import load_dotenv

from .config import DevConfig, ProdConfig
from .extensions import db, cors, sock

# ✅ Postgres NOTIFY listener
from .bookings.pg_notify_listener import start_booking_tracking_listener


def create_app():
    # Always load backend/.env (works in PyCharm/VSCode/terminal)
    env_path = Path(__file__).resolve().parents[1] / ".env"
    load_dotenv(env_path)

    print("DATABASE_URL loaded?", bool(os.getenv("DATABASE_URL")))

    app = Flask(__name__)

    env = os.getenv("FLASK_ENV", "production")
    app.config.from_object(DevConfig if env == "development" else ProdConfig)

    # IMPORTANT: override DB URI after dotenv is loaded
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set in .env")

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url

    print("ENABLE_PG_LISTENER:", os.getenv("ENABLE_PG_LISTENER"))
    print("PG_LISTEN_DATABASE_URL set?:", bool(os.getenv("PG_LISTEN_DATABASE_URL")))

    # ✅ init extensions
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    db.init_app(app)
    sock.init_app(app)  # ✅ websocket support

    # Register blueprints
    from .misc.routes import misc_bp
    from .auth.routes import auth_bp
    from .bookings.routes import bookings_bp
    from .notifications.routes import notifications_bp

    app.register_blueprint(misc_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(bookings_bp, url_prefix="/api")
    app.register_blueprint(notifications_bp, url_prefix="/api")

    # ✅ register websocket routes (not a blueprint)
    from .bookings.ws import register_booking_ws
    register_booking_ws(sock)

    # ✅ Start PG LISTEN/NOTIFY listener when enabled
    # NOTE: We start it unconditionally when ENABLE_PG_LISTENER=1.
    # The listener itself prevents double-start per process.
    if os.environ.get("ENABLE_PG_LISTENER", "0") == "1":
        start_booking_tracking_listener(app)

    # Error handlers
    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not Found", "message": "The requested resource was not found"}), 404

    @app.errorhandler(500)
    def internal_error(_):
        return jsonify({"error": "Internal Server Error", "message": "An unexpected error occurred"}), 500

    return app