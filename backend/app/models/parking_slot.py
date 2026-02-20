from ..extensions import db

class ParkingSlot(db.Model):
    __tablename__ = "parking_slots"

    id = db.Column(db.BigInteger, primary_key=True)
    label = db.Column(db.String, nullable=False)  # must match ss.json labels
    is_active = db.Column(db.Boolean, nullable=False, default=True)
