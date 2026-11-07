import os
import tempfile

import pytest

_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_db.close()
os.environ.update(DATABASE_URL=f"sqlite:///{_db.name}", GROQ_API_KEY="", GEMINI_API_KEY="", DEMO_MODE="true",
                  SEED_ON_START="false")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import DESK_PHONE, RETAILER_PHONES, reset  # noqa: E402


def login(client: TestClient, phone: str) -> dict:
    code = client.post("/api/auth/otp", json={"phone": phone}).json()["demo_code"]
    response = client.post("/api/auth/verify", json={"phone": phone, "code": code})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture()
def fresh_db():
    reset()


@pytest.fixture()
def desk(fresh_db):
    with TestClient(app) as client:
        login(client, DESK_PHONE)
        yield client


@pytest.fixture()
def sharma(fresh_db):
    with TestClient(app) as client:
        login(client, RETAILER_PHONES[0])
        yield client


@pytest.fixture()
def gupta(fresh_db):
    with TestClient(app) as client:
        login(client, RETAILER_PHONES[1])
        yield client
