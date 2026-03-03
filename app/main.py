from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes import router

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
app.include_router(router)
