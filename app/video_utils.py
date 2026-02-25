from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Generator

import cv2
import numpy as np


def video_frames(path: str) -> Generator[tuple[np.ndarray, float], None, None]:
    """Yield (frame_rgb, timestamp_seconds) for every frame in the video."""
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    count = 0
    ret, frame = cap.read()
    while ret:
        count += 1
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        yield frame_rgb, count / fps
        ret, frame = cap.read()
    cap.release()


def video_frame(path: str, timestamp: float = 0.0) -> np.ndarray | None:
    """Return a single RGB frame at the given timestamp (seconds)."""
    cap = cv2.VideoCapture(path)
    cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        return None
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)


def get_video_duration(path: str) -> tuple[float, float, int]:
    """Return (duration_seconds, fps, total_frames)."""
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    duration = total_frames / fps if fps > 0 else 0.0
    return duration, fps, total_frames


def save_thumbnail(frame_rgb: np.ndarray, video_id: str, timestamp: float, thumbnails_dir: str = "thumbnails") -> str:
    """Save frame as JPEG thumbnail and return its relative URL path."""
    dir_path = Path(thumbnails_dir) / video_id
    dir_path.mkdir(parents=True, exist_ok=True)

    # Use timestamp formatted to 3 decimal places as filename
    filename = f"{timestamp:.3f}.jpg"
    file_path = dir_path / filename

    frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
    cv2.imwrite(str(file_path), frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])

    return f"/thumbnails/{video_id}/{filename}"


def patchify_frame(frame: np.ndarray, patch_size: int = 360, step: int | None = None) -> list[np.ndarray]:
    """
    Split a frame into overlapping square patches.
    Replaces the `patchify` library dependency.
    Returns a list of (patch_size, patch_size, 3) numpy arrays.
    """
    if step is None:
        step = patch_size // 2

    h, w = frame.shape[:2]
    patches = []

    for y in range(0, max(h - patch_size + 1, 1), step):
        for x in range(0, max(w - patch_size + 1, 1), step):
            patch = frame[y : y + patch_size, x : x + patch_size]
            if patch.shape[0] == patch_size and patch.shape[1] == patch_size:
                patches.append(patch)

    # Always include at least the center crop if no full patches fit
    if not patches:
        cy = max(0, (h - patch_size) // 2)
        cx = max(0, (w - patch_size) // 2)
        patch = frame[cy : cy + patch_size, cx : cx + patch_size]
        # Pad if necessary
        if patch.shape[0] < patch_size or patch.shape[1] < patch_size:
            pad_h = patch_size - patch.shape[0]
            pad_w = patch_size - patch.shape[1]
            patch = np.pad(patch, ((0, pad_h), (0, pad_w), (0, 0)), mode="edge")
        patches.append(patch)

    return patches
