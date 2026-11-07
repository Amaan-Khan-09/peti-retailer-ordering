import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

DEV_SECRET = "dev-only-secret-change-me-in-production-32b"


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'peti.db'}")
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


class Settings:
    def __init__(self) -> None:
        self.env = os.getenv("APP_ENV", "development")
        self.database_url = _database_url()
        self.jwt_secret = os.getenv("JWT_SECRET", DEV_SECRET)
        # Demo mode shows the OTP on screen instead of sending an SMS (SMS is mocked for this build).
        self.demo_mode = os.getenv("DEMO_MODE", "true").lower() == "true"
        self.seed_on_start = os.getenv("SEED_ON_START", "true").lower() == "true"
        self.cookie_secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")
        self.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.cors_origins = [o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o]
        if self.env == "production" and self.jwt_secret == DEV_SECRET:
            raise RuntimeError("JWT_SECRET must be set in production")


settings = Settings()
