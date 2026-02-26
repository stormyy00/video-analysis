from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app import store
from app.clip_index import ClipIndex
from app.models import (
    SearchRequest,
    SearchResult,
    VideoListItem,
    VideoRecord,
    VideoStatus,
)
from app.store import ClipIndexData

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

VIDEOS_DIR = Path("videos")
THUMBNAILS_DIR = Path("thumbnails")
VIDEOS_DIR.mkdir(exist_ok=True)
THUMBNAILS_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Video Search API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/thumbnails", StaticFiles(directory=str(THUMBNAILS_DIR)), name="thumbnails")


# ---------------------------------------------------------------------------
# Background indexing task
# ---------------------------------------------------------------------------

def _index_video(video_id: str) -> None:
    record = store.videos.get(video_id)
    if not record:
        return

    try:
        record.status = "indexing"
        logger.info("Starting indexing for video %s (%s)", video_id, record.filename)

        # Reuse the shared model — avoids loading weights twice
        index = _get_clip_index()

        def on_progress(indexed: int, _total: int) -> None:
            record.indexed_frames = indexed

        index.indexVideo(
            path=record.path,
            video_id=video_id,
            freq=1.0,
            thumbnails_dir=str(THUMBNAILS_DIR),
            on_progress=on_progress,
        )

        store.clip_indices[video_id] = ClipIndexData(
            index_features=index.index_features,
            index_metadata=index.index_metadata,
        )

        if index.index_features is not None:
            record.indexed_frames = index.index_features.shape[0]
            record.total_frames = record.indexed_frames

        record.status = "ready"
        logger.info("Indexing complete for video %s — %d feature vectors", video_id, record.indexed_frames)

    except Exception as exc:
        logger.exception("Indexing failed for video %s", video_id)
        record.status = "error"
        record.error = str(exc)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/api/videos/upload", response_model=VideoStatus)
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload a video file and kick off async CLIP indexing."""
    allowed = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    video_id = str(uuid.uuid4())
    dest = VIDEOS_DIR / f"{video_id}{ext}"

    async with aiofiles.open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):  # 1 MB chunks
            await f.write(chunk)

    # Get basic video metadata
    from app.video_utils import get_video_duration
    duration, fps, total_frames = get_video_duration(str(dest))

    record = VideoRecord(
        id=video_id,
        filename=file.filename,
        path=str(dest),
        duration=duration,
        fps=fps,
        total_frames=total_frames,
        status="pending",
    )
    store.videos[video_id] = record

    background_tasks.add_task(_index_video, video_id)

    return VideoStatus(
        id=record.id,
        filename=record.filename,
        status=record.status,
        duration=record.duration,
        progress=record.progress,
        indexed_frames=record.indexed_frames,
        total_frames=record.total_frames,
    )


@app.get("/api/videos", response_model=list[VideoListItem])
async def list_videos():
    """List all uploaded videos with their indexing status."""
    return [
        VideoListItem(
            id=r.id,
            filename=r.filename,
            status=r.status,
            duration=r.duration,
            progress=r.progress,
            created_at=r.created_at,
        )
        for r in store.videos.values()
    ]


@app.get("/api/videos/{video_id}", response_model=VideoStatus)
async def get_video(video_id: str):
    record = store.videos.get(video_id)
    if not record:
        raise HTTPException(status_code=404, detail="Video not found")
    return VideoStatus(
        id=record.id,
        filename=record.filename,
        status=record.status,
        duration=record.duration,
        progress=record.progress,
        indexed_frames=record.indexed_frames,
        total_frames=record.total_frames,
        error=record.error,
    )


@app.get("/api/videos/{video_id}/status", response_model=VideoStatus)
async def get_video_status(video_id: str):
    """Polling endpoint — call this until status == 'ready'."""
    return await get_video(video_id)


@app.delete("/api/videos/{video_id}")
async def delete_video(video_id: str):
    record = store.videos.get(video_id)
    if not record:
        raise HTTPException(status_code=404, detail="Video not found")

    # Remove from memory
    store.videos.pop(video_id, None)
    store.clip_indices.pop(video_id, None)

    # Remove video file
    try:
        Path(record.path).unlink(missing_ok=True)
    except Exception:
        pass

    # Remove thumbnails directory
    import shutil
    thumb_dir = THUMBNAILS_DIR / video_id
    if thumb_dir.exists():
        shutil.rmtree(thumb_dir, ignore_errors=True)

    return {"deleted": video_id}


def _cluster_to_scenes(raw: list[dict], gap: float = 2.0) -> list[dict]:
    """Cluster per-frame results into scene windows by grouping frames within `gap` seconds."""
    if not raw:
        return []
    sorted_raw = sorted(raw, key=lambda r: r["t"])
    clusters: list[list[dict]] = []
    cluster = [sorted_raw[0]]
    for r in sorted_raw[1:]:
        if r["t"] - cluster[-1]["t"] <= gap:
            cluster.append(r)
        else:
            clusters.append(cluster)
            cluster = [r]
    clusters.append(cluster)

    scenes = []
    for c in clusters:
        best = max(c, key=lambda r: r["score"])
        scenes.append({
            **best,
            "t_start": c[0]["t"],
            "t_end": c[-1]["t"] + 1.0,  # +1s since each frame covers ~1 second
        })
    return scenes


@app.post("/api/search", response_model=list[SearchResult])
async def search(req: SearchRequest):
    """
    Semantic search across all indexed videos.

    Returns results sorted by descending similarity score.
    """
    if not store.clip_indices:
        return []

    all_results: list[SearchResult] = []

    for video_id, idx_data in store.clip_indices.items():
        record = store.videos.get(video_id)
        if not record or record.status != "ready":
            continue

        # Reconstruct a ClipIndex shell for search (model already loaded once per process)
        # Re-use the shared model if available, otherwise each search loads it fresh.
        # For V1 simplicity: load once and cache on the app state.
        index = _get_clip_index()
        index.index_features = idx_data.index_features
        index.index_metadata = idx_data.index_metadata

        # Collect all above-threshold frames (over-fetch), then cluster into scenes
        raw = index.search(req.query, n=req.n * 5, threshold=req.threshold)
        scenes = _cluster_to_scenes(raw)
        for s in scenes:
            all_results.append(
                SearchResult(
                    video_id=s["video_id"],
                    timestamp=s["t"],
                    t_start=s["t_start"],
                    t_end=s["t_end"],
                    score=s["score"],
                    thumbnail_url=s["thumbnail_url"],
                    video_title=record.filename,
                    duration=record.duration,
                )
            )

    # Sort all results across videos by score
    all_results.sort(key=lambda r: r.score, reverse=True)
    return all_results[: req.n]


@app.get("/api/videos/{video_id}/stream")
async def stream_video(video_id: str, request_range: str | None = None):
    """
    Stream a video file with HTTP range request support.
    This enables HTML5 <video> seeking to work correctly.
    """
    from fastapi import Request
    record = store.videos.get(video_id)
    if not record:
        raise HTTPException(status_code=404, detail="Video not found")

    path = Path(record.path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    file_size = path.stat().st_size
    ext = path.suffix.lower()
    content_type_map = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
    }
    content_type = content_type_map.get(ext, "video/mp4")

    return FileResponse(
        path=str(path),
        media_type=content_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
        },
    )


# ---------------------------------------------------------------------------
# Shared CLIP model (loaded once, reused for all searches)
# ---------------------------------------------------------------------------

_shared_clip_index: ClipIndex | None = None


def _get_clip_index() -> ClipIndex:
    global _shared_clip_index
    if _shared_clip_index is None:
        logger.info("Loading shared ClipIndex model for search...")
        _shared_clip_index = ClipIndex(patch_size=360)
    return _shared_clip_index
