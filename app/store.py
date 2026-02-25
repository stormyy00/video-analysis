from __future__ import annotations

from dataclasses import dataclass, field

import torch

from app.models import VideoRecord


@dataclass
class ClipIndexData:
    """Holds the in-memory CLIP index for a single video."""
    index_features: torch.Tensor          # shape: (N, embed_dim), normalized
    index_metadata: list[dict]            # [{video_id, t}] — one entry per indexed frame patch


# In-memory stores — plain dicts, no DB
videos: dict[str, VideoRecord] = {}
clip_indices: dict[str, ClipIndexData] = {}
