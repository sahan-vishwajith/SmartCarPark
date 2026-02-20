from datetime import datetime, timedelta, timezone
import jwt
from flask import current_app

def utcnow():
    return datetime.now(timezone.utc)

def create_jwt(user_id: int, username: str) -> str:
    now = utcnow()
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=current_app.config["JWT_EXPIRE_MINUTES"])).timestamp()),
    }
    token = jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm=current_app.config["JWT_ALGO"])
    return token.decode("utf-8") if isinstance(token, bytes) else token

def decode_jwt(token: str):
    return jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=[current_app.config["JWT_ALGO"]])
