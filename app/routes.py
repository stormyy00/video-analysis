from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app import store
from app.clip_index import ClipIndex
from app.models import (
    SearchRequest,
    SearchResult,
    ThumbnailEntry,
    VideoListItem,
    VideoRecord,
    VideoStatus,
)
from app.store import ClipIndexData
from app.video_utils import get_video_duration

logger = logging.getLogger(__name__)

# Canonical API router for video/search endpoints.
router = APIRouter()

VIDEOS_DIR = Path("videos")
THUMBNAILS_DIR = Path("thumbnails")
VIDEOS_DIR.mkdir(exist_ok=True)
THUMBNAILS_DIR.mkdir(exist_ok=True)


def _index_video(video_id: str) -> None:
    record = store.videos.get(video_id)
    if not record:
        return

    try:
        record.status = "indexing"
        logger.info("Starting indexing for video %s (%s)", video_id, record.filename)

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
        logger.info(
            "Indexing complete for video %s - %d feature vectors",
            video_id,
            record.indexed_frames,
        )
    except Exception as exc:
        logger.exception("Indexing failed for video %s", video_id)
        record.status = "error"
        record.error = str(exc)


@router.post("/api/videos/upload", response_model=VideoStatus)
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload a video and start async CLIP indexing."""
    allowed = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    video_id = str(uuid.uuid4())
    dest = VIDEOS_DIR / f"{video_id}{ext}"

    async with aiofiles.open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            await f.write(chunk)

    duration, fps, _raw_frames = get_video_duration(str(dest))
    expected_indexed = max(1, int(duration)) if duration else 0

    record = VideoRecord(
        id=video_id,
        filename=file.filename,
        path=str(dest),
        duration=duration,
        fps=fps,
        total_frames=expected_indexed,
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


@router.get("/api/videos", response_model=list[VideoListItem])
async def list_videos():
    """List all uploaded videos and indexing status."""
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


@router.get("/api/videos/{video_id}", response_model=VideoStatus)
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


@router.get("/api/videos/{video_id}/status", response_model=VideoStatus)
async def get_video_status(video_id: str):
    """Polling endpoint for indexing progress."""
    return await get_video(video_id)


@router.delete("/api/videos/{video_id}")
async def delete_video(video_id: str):
    record = store.videos.get(video_id)
    if not record:
        raise HTTPException(status_code=404, detail="Video not found")

    store.videos.pop(video_id, None)
    store.clip_indices.pop(video_id, None)

    try:
        Path(record.path).unlink(missing_ok=True)
    except Exception:
        pass

    thumb_dir = THUMBNAILS_DIR / video_id
    if thumb_dir.exists():
        shutil.rmtree(thumb_dir, ignore_errors=True)

    return {"deleted": video_id}


def _cluster_to_scenes(raw: list[dict], gap: float = 2.0) -> list[dict]:
    """Cluster frame matches into contiguous scene windows."""
    if not raw:
        return []

    sorted_raw = sorted(raw, key=lambda r: r["t"])
    clusters: list[list[dict]] = []
    cluster = [sorted_raw[0]]
    for item in sorted_raw[1:]:
        if item["t"] - cluster[-1]["t"] <= gap:
            cluster.append(item)
        else:
            clusters.append(cluster)
            cluster = [item]
    clusters.append(cluster)

    scenes: list[dict] = []
    for c in clusters:
        best = max(c, key=lambda r: r["score"])
        scenes.append(
            {
                **best,
                "t_start": c[0]["t"],
                "t_end": c[-1]["t"] + 1.0,
            }
        )
    return scenes


@router.post("/api/search", response_model=list[SearchResult])
async def search(req: SearchRequest):
    """Semantic search across indexed videos."""
    if not store.clip_indices:
        return []

    all_results: list[SearchResult] = []
    for video_id, idx_data in store.clip_indices.items():
        if req.video_id and video_id != req.video_id:
            continue

        record = store.videos.get(video_id)
        if not record or record.status != "ready":
            continue

        index = _get_clip_index()
        index.index_features = idx_data.index_features
        index.index_metadata = idx_data.index_metadata

        raw = index.search(req.query, n=req.n * 5, threshold=req.threshold)
        scenes = _cluster_to_scenes(raw)
        for scene in scenes:
            all_results.append(
                SearchResult(
                    video_id=scene["video_id"],
                    timestamp=scene["t"],
                    t_start=scene["t_start"],
                    t_end=scene["t_end"],
                    score=scene["score"],
                    thumbnail_url=scene["thumbnail_url"],
                    video_title=record.filename,
                    duration=record.duration,
                )
            )

    all_results.sort(key=lambda r: r.score, reverse=True)
    return all_results[: req.n]


@router.get("/api/videos/{video_id}/stream")
async def stream_video(video_id: str, request_range: str | None = None):
    """Stream a video file with range-friendly headers."""
    del request_range  # Kept for compatibility with clients sending range info.

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


@router.get("/api/videos/{video_id}/thumbnails", response_model=list[ThumbnailEntry])
async def list_thumbnails(video_id: str):
    """List indexed thumbnails for a video, sorted by timestamp."""
    record = store.videos.get(video_id)
    if not record:
        raise HTTPException(status_code=404, detail="Video not found")

    thumb_dir = THUMBNAILS_DIR / video_id
    if not thumb_dir.exists():
        return []

    entries: list[ThumbnailEntry] = []
    for file in thumb_dir.iterdir():
        if file.suffix.lower() != ".jpg":
            continue
        try:
            timestamp = float(file.stem)
        except ValueError:
            continue
        entries.append(
            ThumbnailEntry(
                timestamp=timestamp,
                url=f"/thumbnails/{video_id}/{file.name}",
            )
        )

    entries.sort(key=lambda e: e.timestamp)
    return entries


_shared_clip_index: ClipIndex | None = None


def _get_clip_index() -> ClipIndex:
    global _shared_clip_index
    if _shared_clip_index is None:
        logger.info("Loading shared ClipIndex model for search...")
        _shared_clip_index = ClipIndex(patch_size=360)
    return _shared_clip_index
