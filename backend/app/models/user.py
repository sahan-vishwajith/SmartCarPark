from sqlalchemy import func
from ..extensions import db

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
