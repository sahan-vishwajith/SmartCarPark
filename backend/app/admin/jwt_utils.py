from datetime import datetime, timedelta, timezone
import jwt
from flask import current_app


# Audience tag prevents an admin token being accepted by user-facing endpoints,
# and a user token being accepted by admin endpoints.
ADMIN_AUDIENCE = "carpark-admin"


def utcnow():
    return datetime.now(timezone.utc)


def create_admin_jwt(admin_id: int, username: str, role: str = "super") -> str:
    now = utcnow()
    payload = {
        "sub": str(admin_id),
        "username": username,
        "role": role,
        "aud": ADMIN_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(
            (now + timedelta(minutes=current_app.config["JWT_EXPIRE_MINUTES"])).timestamp()
        ),
    }
    token = jwt.encode(
        payload,
        current_app.config["JWT_SECRET"],
        algorithm=current_app.config["JWT_ALGO"],
    )
    return token.decode("utf-8") if isinstance(token, bytes) else token


def decode_admin_jwt(token: str):
    return jwt.decode(
        token,
        current_app.config["JWT_SECRET"],
        algorithms=[current_app.config["JWT_ALGO"]],
        audience=ADMIN_AUDIENCE,
    )
