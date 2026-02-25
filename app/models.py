from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class VideoRecord(BaseModel):
    id: str
    filename: str
    path: str
    duration: float | None = None
    fps: float | None = None
    status: Literal["pending", "indexing", "ready", "error"] = "pending"
    indexed_frames: int = 0
    total_frames: int = 0
    error: str | None = None
    created_at: datetime = None

    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, **data):
        if "created_at" not in data or data["created_at"] is None:
            data["created_at"] = datetime.utcnow()
        super().__init__(**data)

    @property
    def progress(self) -> float:
        if self.total_frames == 0:
            return 0.0
        return min(self.indexed_frames / self.total_frames, 1.0)


class VideoStatus(BaseModel):
    id: str
    filename: str
    status: str
    duration: float | None
    progress: float
    indexed_frames: int
    total_frames: int
    error: str | None = None


class SearchRequest(BaseModel):
    query: str
    n: int = 6
    threshold: float = 25.0


class SearchResult(BaseModel):
    video_id: str
    timestamp: float
    score: float
    thumbnail_url: str
    video_title: str


class VideoListItem(BaseModel):
    id: str
    filename: str
    status: str
    duration: float | None
    progress: float
    created_at: datetime
