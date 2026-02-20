import easyocr
import numpy as np
import cv2
from .plate import normalize_plate, looks_like_plate

class PlateOCR:
    def __init__(self):
        # English is enough for plates
        self.reader = easyocr.Reader(["en"], gpu=False)

    def preprocess(self, frame):
        """
        Simple preprocessing to help OCR.
        You can improve later with plate detection/cropping.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.bilateralFilter(gray, 11, 17, 17)
        # adaptive threshold often helps
        th = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 31, 7
        )
        return th

    def read_plate_candidates(self, frame):
        """
        Returns list of (plate, confidence, bbox)
        bbox is for debug drawing (optional)
        """
        img = self.preprocess(frame)

        results = self.reader.readtext(img)  # [(bbox, text, conf), ...]
        candidates = []

        for bbox, text, conf in results:
            plate = normalize_plate(text)
            if looks_like_plate(plate):
                candidates.append((plate, float(conf), bbox))

        # sort by confidence desc
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates