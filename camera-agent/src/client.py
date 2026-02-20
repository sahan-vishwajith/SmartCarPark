import requests
from datetime import datetime, timezone
from .config import BACKEND_URL, CAMERA_API_KEY, CAMERA_ID


def send_plate_to_backend(plate: str, confidence: float):
    url = f"{BACKEND_URL}/api/entrance/plate-scan"
    payload = {
        "plate": plate,
        "confidence": float(confidence),
        "cameraId": CAMERA_ID,
        "capturedAt": datetime.now(timezone.utc).isoformat(),
    }

    try:
        res = requests.post(
            url,
            json=payload,
            headers={
                "X-Camera-Key": CAMERA_API_KEY,
                "Content-Type": "application/json",
            },
            timeout=10,
        )
    except requests.exceptions.RequestException as e:
        # backend down / timeout / refused -> don't crash the agent
        return None, {"error": f"{type(e).__name__}: {str(e)}"}

    try:
        body = res.json()
    except Exception:
        body = {"raw": res.text}

    return res.status_code, body