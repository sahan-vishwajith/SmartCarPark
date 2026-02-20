import time
from dataclasses import dataclass

@dataclass
class PlateState:
    plate: str
    hits: int
    last_seen_ts: float

class PlateDebouncer:
    """
    Stability + cooldown:
      - increments hits when same plate repeats
      - fires when hits >= stability_hits AND cooldown passed
    """
    def __init__(self, stability_hits: int, cooldown_seconds: int):
        self.stability_hits = stability_hits
        self.cooldown_seconds = cooldown_seconds
        self.state: PlateState | None = None
        self.last_sent = {}  # plate -> ts

    def observe(self, plate: str) -> int:
        now = time.time()

        if self.state and self.state.plate == plate:
            self.state.hits += 1
            self.state.last_seen_ts = now
        else:
            self.state = PlateState(plate=plate, hits=1, last_seen_ts=now)

        return self.state.hits

    def can_send(self, plate: str) -> bool:
        now = time.time()
        last = self.last_sent.get(plate, 0)
        return (now - last) >= self.cooldown_seconds

    def mark_sent(self, plate: str):
        self.last_sent[plate] = time.time()