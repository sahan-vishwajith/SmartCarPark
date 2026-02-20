import os
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000").rstrip("/")
CAMERA_API_KEY = os.getenv("CAMERA_API_KEY", "")
CAMERA_ID = os.getenv("CAMERA_ID", "entrance-laptop-1")

CAM_INDEX = int(os.getenv("CAM_INDEX", "0"))
FRAME_WIDTH = int(os.getenv("FRAME_WIDTH", "1280"))
FRAME_HEIGHT = int(os.getenv("FRAME_HEIGHT", "720"))

OCR_EVERY_N_FRAMES = int(os.getenv("OCR_EVERY_N_FRAMES", "5"))
STABILITY_HITS = int(os.getenv("STABILITY_HITS", "3"))
PLATE_COOLDOWN_SECONDS = int(os.getenv("PLATE_COOLDOWN_SECONDS", "20"))

SHOW_WINDOW = os.getenv("SHOW_WINDOW", "true").lower() == "true"

if not CAMERA_API_KEY:
    raise RuntimeError("CAMERA_API_KEY missing in camera-agent .env")