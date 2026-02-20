import cv2
import time
import re
from collections import deque
from concurrent.futures import ThreadPoolExecutor

from .config import (
    CAM_INDEX, FRAME_WIDTH, FRAME_HEIGHT,
    OCR_EVERY_N_FRAMES, STABILITY_HITS,
    PLATE_COOLDOWN_SECONDS, SHOW_WINDOW,
)
from .ocr import PlateOCR
from .debounce import PlateDebouncer
from .client import send_plate_to_backend


# --- Tuning knobs ---
MIN_OCR_CONF = 0.45          # ignore very low confidence junk
RECENT_WINDOW = 8            # how many recent OCR reads to consider for consensus
MAX_EDIT_DISTANCE = 1        # fuzzy tolerance (1 is safe; 2 can be too permissive)


def normalize_plate(text: str) -> str:
    """Basic normalization: uppercase + remove non-alphanumerics."""
    if not text:
        return ""
    t = text.upper().strip()
    t = re.sub(r"[^A-Z0-9]", "", t)
    return t


def levenshtein_limited(a: str, b: str, max_dist: int) -> int:
    """
    Levenshtein distance with early exit when > max_dist.
    Fast enough for short plate strings.
    """
    if a == b:
        return 0
    la, lb = len(a), len(b)
    if abs(la - lb) > max_dist:
        return max_dist + 1

    # Ensure a is shorter
    if la > lb:
        a, b = b, a
        la, lb = lb, la

    prev = list(range(la + 1))
    for j in range(1, lb + 1):
        bj = b[j - 1]
        curr = [j] + [0] * la

        # Track min in row for early exit
        row_min = curr[0]

        for i in range(1, la + 1):
            cost = 0 if a[i - 1] == bj else 1
            curr[i] = min(
                prev[i] + 1,        # deletion
                curr[i - 1] + 1,    # insertion
                prev[i - 1] + cost  # substitution
            )
            if curr[i] < row_min:
                row_min = curr[i]

        if row_min > max_dist:
            return max_dist + 1
        prev = curr

    return prev[la]


def similar_plate(a: str, b: str) -> bool:
    """
    Decide whether two plates are 'similar enough' to be treated as same,
    to combat small OCR noise.
    """
    if not a or not b:
        return False
    if a == b:
        return True

    # Prefix tolerance (e.g., HELLO2 vs HELLO20)
    if (a.startswith(b) or b.startswith(a)) and abs(len(a) - len(b)) <= 1:
        return True

    # Small edit distance tolerance
    return levenshtein_limited(a, b, MAX_EDIT_DISTANCE) <= MAX_EDIT_DISTANCE


def compute_consensus(recent: deque):
    """
    recent = deque of (norm_plate, conf)
    Returns (consensus_plate, avg_conf, count)
    """
    if not recent:
        return None, 0.0, 0

    items = list(recent)
    best_score = -1.0
    best_cluster = None

    # Cluster around each candidate and choose best cluster
    for pivot, _pconf in items:
        cluster = [(p, c) for (p, c) in items if similar_plate(p, pivot)]
        count = len(cluster)
        avg_conf = sum(c for _, c in cluster) / max(1, count)

        # score: prioritize count; break ties with avg confidence
        score = count + 0.25 * avg_conf

        if score > best_score:
            best_score = score
            best_cluster = cluster

    if not best_cluster:
        return None, 0.0, 0

    # Choose a canonical plate string from cluster:
    # prefer shortest (removes trailing noise), then lexicographically
    plates = [p for p, _ in best_cluster]
    canonical = sorted(plates, key=lambda x: (len(x), x))[0]
    avg_conf = sum(c for _, c in best_cluster) / len(best_cluster)
    return canonical, avg_conf, len(best_cluster)


def main():
    cap = cv2.VideoCapture(CAM_INDEX, cv2.CAP_DSHOW)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open webcam index {CAM_INDEX}")

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass

    ocr = PlateOCR()
    debouncer = PlateDebouncer(
        stability_hits=STABILITY_HITS,
        cooldown_seconds=PLATE_COOLDOWN_SECONDS,
    )

    frame_i = 0
    last_status = "Starting..."

    # UI drawing info
    last_bbox = None
    last_raw = None
    last_norm = None
    last_conf = 0.0

    # recent OCR normalized plates for consensus
    recent = deque(maxlen=RECENT_WINDOW)

    # OCR in background to keep UI smooth
    executor = ThreadPoolExecutor(max_workers=1)
    ocr_future = None
    ocr_frame_i = None

    print("Camera-agent running. Press Q to quit.")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                time.sleep(0.05)
                continue

            frame_i += 1

            # submit OCR job (non-blocking)
            if (frame_i % OCR_EVERY_N_FRAMES == 0) and (ocr_future is None or ocr_future.done()):
                ocr_future = executor.submit(ocr.read_plate_candidates, frame.copy())
                ocr_frame_i = frame_i

            # collect OCR result
            if ocr_future is not None and ocr_future.done():
                candidates = ocr_future.result()
                ocr_future = None

                if candidates:
                    # Print all OCR outputs (raw)
                    for plate, conf, _bbox in candidates:
                        print(f"[OCR] {plate}  conf={conf:.2f}  frame={ocr_frame_i}")

                    # Use best candidate (already sorted by your OCR impl)
                    raw_plate, conf, bbox = candidates[0]
                    norm_plate = normalize_plate(raw_plate)

                    last_raw = raw_plate
                    last_norm = norm_plate
                    last_conf = conf
                    last_bbox = bbox

                    if norm_plate and conf >= MIN_OCR_CONF:
                        recent.append((norm_plate, float(conf)))

                    consensus, c_conf, c_count = compute_consensus(recent)

                    if not consensus:
                        last_status = f"Seen: {norm_plate} conf={conf:.2f} (no consensus)"
                        print(f"[DECISION] raw={raw_plate} norm={norm_plate} -> no-consensus")
                    else:
                        hits = debouncer.observe(consensus)
                        stable = hits >= STABILITY_HITS
                        can_send = debouncer.can_send(consensus)

                        print(
                            f"[CONSENSUS] best={consensus} cluster={c_count}/{len(recent)} avgConf={c_conf:.2f}"
                        )
                        print(
                            f"[DECISION] raw={raw_plate} norm={norm_plate} conf={conf:.2f} "
                            f"debounceKey={consensus} hits={hits}/{STABILITY_HITS} stable={stable} can_send={can_send}"
                        )

                        last_status = (
                            f"Plate: {consensus} hits={hits}/{STABILITY_HITS} conf={c_conf:.2f}"
                        )

                        if stable and can_send:
                            print(f"[SEND][TRY] POST plate={consensus} conf={c_conf:.2f}")
                            status, body = send_plate_to_backend(consensus, c_conf)

                            if status is None:
                                print(f"[SEND][FAIL] plate={consensus} err={body}")
                                last_status = f"BACKEND DOWN: {body.get('error', body)}"
                            else:
                                ok_status = 200 <= status < 300
                                print(
                                    f"[SEND]{'[OK]' if ok_status else '[BAD]'} "
                                    f"HTTP {status} plate={consensus} resp={body}"
                                )
                                if ok_status:
                                    debouncer.mark_sent(consensus)
                                last_status = f"SENT {consensus} -> HTTP {status}"
                        else:
                            reasons = []
                            if not stable:
                                reasons.append("not-stable-yet")
                            if stable and not can_send:
                                reasons.append("cooldown-not-finished")
                            print(f"[SEND][SKIP] plate={consensus} reason={','.join(reasons)}")

            # display
            if SHOW_WINDOW:
                cv2.putText(
                    frame,
                    last_status[:120],
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (0, 255, 0),
                    2,
                )

                if last_bbox:
                    pts = last_bbox
                    x_coords = [int(p[0]) for p in pts]
                    y_coords = [int(p[1]) for p in pts]
                    x1, x2 = min(x_coords), max(x_coords)
                    y1, y2 = min(y_coords), max(y_coords)

                    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                    label = f"{last_norm} ({last_conf:.2f})" if last_norm else ""
                    if label:
                        cv2.putText(
                            frame,
                            label[:30],
                            (x1, max(20, y1 - 10)),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.7,
                            (255, 0, 0),
                            2,
                        )

                cv2.imshow("CarPark Entrance Camera-Agent", frame)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    break

    finally:
        cap.release()
        if SHOW_WINDOW:
            cv2.destroyAllWindows()
        executor.shutdown(wait=False)


if __name__ == "__main__":
    main()