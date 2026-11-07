import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from .config import BACKEND_DIR, settings
from .db import Base, SessionLocal, engine
from .models import Sku
from .routers import auth, desk, shop
from .seed import seed

logging.basicConfig(level=logging.INFO)
STATIC_DIR = Path(os.getenv("STATIC_DIR", BACKEND_DIR.parent / "frontend" / "dist"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    if settings.seed_on_start:
        with SessionLocal() as db:
            if not db.scalar(select(Sku.id).limit(1)):
                seed(db)
    yield


app = FastAPI(title="Peti — retailer ordering", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=800)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    if request.url.path.startswith("/assets/"):  # file names carry a content hash, so they never change
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


for router in (auth.router, shop.router, desk.router):
    app.include_router(router)


@app.get("/api/health")
def health():
    return {"ok": True, "ai": "configured" if settings.groq_api_key or settings.gemini_api_key else "rules-only"}


if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = (STATIC_DIR / path).resolve()
        if path and file.is_file() and STATIC_DIR.resolve() in file.parents:
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html")
