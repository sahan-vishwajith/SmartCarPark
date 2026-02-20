import re

# Sri Lanka-ish / general: keep permissive (letters+digits with optional dash)
CLEAN_RE = re.compile(r"[^A-Z0-9-]")

def normalize_plate(text: str) -> str:
    if not text:
        return ""
    t = text.upper().strip()
    t = t.replace(" ", "")
    t = t.replace("_", "-")
    t = CLEAN_RE.sub("", t)
    # collapse multiple dashes
    while "--" in t:
        t = t.replace("--", "-")
    return t

def looks_like_plate(text: str) -> bool:
    if not text:
        return False
    t = normalize_plate(text)
    # basic sanity
    if len(t) < 5 or len(t) > 12:
        return False
    # must contain digits
    if not any(ch.isdigit() for ch in t):
        return False
    # must contain alnum
    if not any(ch.isalpha() for ch in t) and sum(ch.isdigit() for ch in t) < 4:
        return False
    return True