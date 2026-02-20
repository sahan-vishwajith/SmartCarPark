import os

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"sslmode": "require"}  # Supabase
    }

    JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
    JWT_ALGO = "HS256"
    JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24 * 7)))

    BOOKING_DURATION_MINUTES = int(os.getenv("BOOKING_DURATION_MINUTES", "60"))

class DevConfig(Config):
    DEBUG = True

class ProdConfig(Config):
    DEBUG = False
