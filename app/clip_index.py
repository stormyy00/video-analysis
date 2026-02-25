"""
ClipIndex — semantic video frame indexer using OpenCLIP.

Adapted from the ClipIndex pattern by John Robinson (johnrobinsn):
https://storming-the-castle.github.io/2022/01/10/video-search-openai-clip.html

Changes from original:
- Uses open_clip instead of the original clip package
- Uses ViT-B-32 (faster/lighter than RN50x4 for M2 validation)
- MPS device support for Apple Silicon
- Patchify implemented as plain numpy slicing (no patchify library)
- Progress callback for FastAPI status updates
"""
from __future__ import annotations

import logging
from typing import Callable

import open_clip
import torch
from PIL import Image

from app.video_utils import patchify_frame, save_thumbnail, video_frames

logger = logging.getLogger(__name__)

MODEL_NAME = "ViT-B-32"
PRETRAINED = "openai"


def _get_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


class ClipIndex:
    """
    Indexes a video by encoding CLIP features for frames at a fixed frequency,
    then supports cosine similarity search over natural language queries.
    """

    def __init__(self, patch_size: int = 360):
        self.patch_size = patch_size
        self.patch_step = patch_size // 2
        self.device = _get_device()

        logger.info("Loading OpenCLIP model %s on device %s", MODEL_NAME, self.device)
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            MODEL_NAME, pretrained=PRETRAINED
        )
        self.tokenizer = open_clip.get_tokenizer(MODEL_NAME)
        self.model = self.model.to(self.device)
        self.model.eval()

        # Index state — populated by indexVideo()
        self.index_features: torch.Tensor | None = None  # (N, embed_dim)
        self.index_metadata: list[dict] = []             # [{video_id, t, thumbnail_url}]

    def indexVideo(
        self,
        path: str,
        video_id: str,
        freq: float = 1.0,
        thumbnails_dir: str = "thumbnails",
        on_progress: Callable[[int, int], None] | None = None,
    ) -> None:
        """
        Index frames from a video at `freq` frames per second.

        Args:
            path: Path to the video file.
            video_id: Unique video identifier stored in metadata.
            freq: How many seconds to skip between indexed frames (1.0 = 1 frame/sec).
            thumbnails_dir: Where to save thumbnail JPEGs.
            on_progress: Optional callback(indexed_frames, total_frames).
        """
        last_indexed_t = -freq  # ensure first frame is always indexed
        frame_batch_rgb: list[Image.Image] = []
        frame_batch_meta: list[dict] = []
        thumbnail_frames: list[tuple] = []  # (frame_rgb_np, t) for saving thumbs later

        all_features: list[torch.Tensor] = []
        all_meta: list[dict] = []

        indexed_count = 0

        for frame_rgb, t in video_frames(path):
            if t - last_indexed_t < freq:
                continue
            last_indexed_t = t

            # Generate patches from this frame
            patches = patchify_frame(frame_rgb, self.patch_size, self.patch_step)

            # Save first patch frame as the thumbnail (use the original frame)
            thumbnail_frames.append((frame_rgb, t))

            for patch in patches:
                pil = Image.fromarray(patch)
                frame_batch_rgb.append(self.preprocess(pil))
                frame_batch_meta.append({"video_id": video_id, "t": t, "thumbnail_url": ""})

            # Encode in batches of 64 to manage memory
            if len(frame_batch_rgb) >= 64:
                features, meta = self._encode_batch(frame_batch_rgb, frame_batch_meta)
                all_features.append(features)
                all_meta.extend(meta)
                frame_batch_rgb = []
                frame_batch_meta = []

            indexed_count += 1
            if on_progress:
                on_progress(indexed_count, indexed_count)  # total unknown until end

        # Encode remaining frames
        if frame_batch_rgb:
            features, meta = self._encode_batch(frame_batch_rgb, frame_batch_meta)
            all_features.append(features)
            all_meta.extend(meta)

        # Save thumbnails (one per indexed second, not per patch)
        thumbnail_map: dict[float, str] = {}
        for frame_rgb, t in thumbnail_frames:
            url = save_thumbnail(frame_rgb, video_id, t, thumbnails_dir)
            thumbnail_map[t] = url

        # Attach thumbnail_url to metadata
        for m in all_meta:
            m["thumbnail_url"] = thumbnail_map.get(m["t"], "")

        # Concatenate all features into a single tensor
        if all_features:
            self.index_features = torch.cat(all_features, dim=0)
            self.index_metadata = all_meta
        else:
            logger.warning("No frames were indexed for video %s", video_id)

        if on_progress:
            on_progress(indexed_count, indexed_count)

    def _encode_batch(
        self, pil_images: list[Image.Image], meta: list[dict]
    ) -> tuple[torch.Tensor, list[dict]]:
        tensor = torch.stack(pil_images).to(self.device)
        with torch.no_grad():
            features = self.model.encode_image(tensor)
        features = features / features.norm(dim=-1, keepdim=True)
        return features.cpu(), meta

    def search(
        self, query: str, n: int = 6, threshold: float = 25.0
    ) -> list[dict]:
        """
        Search for frames matching a natural language query.

        Returns a list of dicts: [{video_id, t, score, thumbnail_url}]
        sorted by descending score.
        """
        if self.index_features is None:
            return []

        tokens = self.tokenizer([query]).to(self.device)
        with torch.no_grad():
            query_features = self.model.encode_text(tokens)
        query_features = query_features / query_features.norm(dim=-1, keepdim=True)
        query_features = query_features.cpu()

        # Cosine similarity via dot product (both sides normalized)
        similarity = (100.0 * query_features @ self.index_features.T).squeeze(0)

        top_k = min(n * 10, len(self.index_metadata))
        values, indices = similarity.topk(top_k)

        results = []
        seen_times: list[float] = []

        for score, idx in zip(values.tolist(), indices.tolist()):
            if score < threshold:
                break
            if len(results) >= n:
                break

            meta = self.index_metadata[idx]
            t = meta["t"]

            # Deduplicate results that are too close in time (within 0.5s)
            if any(abs(t - seen_t) < 0.5 for seen_t in seen_times):
                continue

            seen_times.append(t)
            results.append({
                "video_id": meta["video_id"],
                "t": t,
                "score": score,
                "thumbnail_url": meta.get("thumbnail_url", ""),
            })

        return results
