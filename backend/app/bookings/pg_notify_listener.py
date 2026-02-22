# app/bookings/pg_notify_listener.py
import json
import os
import time
import threading
import select
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

_LISTENER_STARTED = False


def _normalize_dsn(uri: str) -> str:
    if not uri:
        return uri
    uri = uri.replace("postgres://", "postgresql://", 1)
    if uri.startswith("postgresql+psycopg2://"):
        uri = uri.replace("postgresql+psycopg2://", "postgresql://", 1)
    if uri.startswith("postgresql+asyncpg://"):
        uri = uri.replace("postgresql+asyncpg://", "postgresql://", 1)
    return uri


def start_booking_tracking_listener(app):
    """
    LISTEN booking_tracking; on NOTIFY -> broadcast to WS.
    - Prints logs (so you can see it working)
    - Auto reconnect
    - Starts only once per process (avoids double start)
    """
    global _LISTENER_STARTED
    if _LISTENER_STARTED:
        print("[PG] Listener already started (skip)")
        return
    _LISTENER_STARTED = True

    dsn = os.getenv("PG_LISTEN_DATABASE_URL") or app.config.get("SQLALCHEMY_DATABASE_URI")
    dsn = _normalize_dsn(dsn)

    # print safe host for debugging (no password)
    try:
        safe_host = dsn.split("@", 1)[-1]
    except Exception:
        safe_host = "unknown"

    def _run_forever():
        while True:
            conn = None
            try:
                print(f"[PG] Connecting listener... host={safe_host}")
                conn = psycopg2.connect(dsn)
                conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                cur = conn.cursor()

                cur.execute("select pg_backend_pid();")
                pid = cur.fetchone()[0]
                print(f"[PG] Connected ✅ pid={pid}")

                cur.execute("LISTEN booking_tracking;")
                print("[PG] LISTEN booking_tracking started ✅")

                while True:
                    # wait for notifications
                    if select.select([conn], [], [], 10) == ([], [], []):
                        continue

                    conn.poll()
                    while conn.notifies:
                        n = conn.notifies.pop(0)
                        try:
                            payload = json.loads(n.payload)
                        except Exception:
                            print("[PG] Bad payload:", n.payload)
                            continue

                        print("[PG] NOTIFY booking_tracking ✅", payload)

                        with app.app_context():
                            from .ws import broadcast_booking_tracking_payload
                            broadcast_booking_tracking_payload(payload)

            except Exception as e:
                print(f"[PG] Listener crashed ❌ {e}  (retrying in 3s)")
                time.sleep(3)
            finally:
                try:
                    if conn:
                        conn.close()
                except Exception:
                    pass

    threading.Thread(target=_run_forever, daemon=True).start()