from sqlalchemy import func
from ..extensions import db


class Admin(db.Model):
    """
    Separate table for system administrators.
    Kept independent from `users` so admin auth, role and audit
    do not mix with end-user (driver) accounts.
    """
    __tablename__ = "admins"

    id = db.Column(db.BigInteger, primary_key=True)
    username = db.Column(db.String, unique=True, nullable=False)
    password_hash = db.Column(db.String, nullable=False)

    full_name = db.Column(db.String, nullable=True)
    email = db.Column(db.String, nullable=True)

    # 'super' or 'staff' (kept for future fine-grained roles)
    role = db.Column(db.String, nullable=False, default="super")

    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    last_login_at = db.Column(db.DateTime(timezone=True), nullable=True)
