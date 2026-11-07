import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import desk as desk_router
from app.seed import SALESMAN_PHONES

from .conftest import login

VOICE_TRANSCRIPT = "भाईया, पाँच पेटी मैरी बिसकुट भेज देना, दो पेटी चाय पत्ती 500 ग्राम वाली और साबुन तीन डब्बा."


@pytest.fixture()
def rakesh(fresh_db):
    with TestClient(app) as client:
        login(client, SALESMAN_PHONES[0])
        yield client


def catalogue(client):
    return {i["code"]: i for i in client.get("/api/catalogue").json()["items"]}


def test_the_same_submission_twice_makes_one_order(sharma):
    before = catalogue(sharma)["SKU-DT-500"]
    body = {"lines": [{"sku_id": before["id"], "qty": 2, "unit": "CASE"}], "client_ref": "cart-1234-abcd"}
    first, retry = sharma.post("/api/orders", json=body).json(), sharma.post("/api/orders", json=body).json()
    assert first["id"] == retry["id"]
    assert catalogue(sharma)["SKU-DT-500"]["stock_cases"] == before["stock_cases"] - 2  # reserved once
    assert first["messages"][0]["text"].startswith(f"Peti: order {first['number']} received")


def test_salesman_works_only_on_their_beat(rakesh):
    bundle = rakesh.get("/api/salesman/bundle").json()
    mine = {s["id"] for s in bundle["shops"]}
    assert len(mine) == 10 and len(bundle["skus"]) == 18
    biscuit = next(s for s in bundle["skus"] if s["code"] == "SKU-BS-075")
    assert biscuit["schemes"][0]["kind"] == "FREE_GOODS" and bundle["shops"][0]["prices"] is not None
    line = [{"sku_id": biscuit["id"], "qty": 1, "unit": "CASE"}]
    placed = rakesh.post("/api/orders", json={"retailer_id": min(mine), "lines": line, "client_ref": "offline-0001-x"})
    assert placed.status_code == 201 and placed.json()["source"] == "salesman"
    other = next(i for i in range(1, 21) if i not in mine)
    assert rakesh.post("/api/orders", json={"retailer_id": other, "lines": line}).status_code == 404
    assert rakesh.get("/api/catalogue", params={"retailer_id": other}).status_code == 404
    assert all(o["retailer"]["id"] in mine for o in rakesh.get("/api/orders").json())
    assert rakesh.get("/api/desk/dashboard").status_code == 403


def test_retailers_and_desk_cannot_use_the_salesman_bundle(sharma, desk):
    assert sharma.get("/api/salesman/bundle").status_code == 403
    assert desk.get("/api/salesman/bundle").status_code == 403


def test_suggested_order_lists_what_the_shop_is_due_to_reorder(sharma):
    regulars = sharma.get("/api/suggestions").json()["items"]
    assert regulars and all(r["due_in_days"] == r["every_days"] - r["days_since"] for r in regulars)
    in_stock = [r for r in regulars if r["in_stock"]]
    assert regulars[:len(in_stock)] == in_stock  # out-of-stock regulars come last
    assert [r["due_in_days"] for r in in_stock] == sorted(r["due_in_days"] for r in in_stock)  # most overdue first


def test_loading_list_adds_up_per_van_and_overall(desk):
    loading = desk.get("/api/desk/loading-list").json()
    assert loading["order_count"] > 0
    assert sum(r["total_cases"] for r in loading["routes"]) == sum(i["cases"] + i["free_cases"] for i in loading["totals"])


def test_dashboard_measures_the_success_targets(desk):
    metrics = desk.get("/api/desk/dashboard").json()["metrics"]
    assert 0 < metrics["digital_share"] <= 100 and "desk_entry" in metrics["by_source"]
    assert metrics["ai_lines_checked"] > 0 and metrics["median_desk_minutes"] is not None


def test_voice_note_is_transcribed_then_read_like_a_message(desk, monkeypatch):
    monkeypatch.setattr(desk_router, "transcribe", lambda kind, data, media_type: (VOICE_TRANSCRIPT, "test-whisper"))
    voice = next(m for m in desk.get("/api/desk/messages").json() if m["kind"] == "voice")
    assert voice["has_media"] and desk.get(f"/api/desk/messages/{voice['id']}/media").headers["content-type"] == "audio/mpeg"
    draft = desk.post(f"/api/desk/messages/{voice['id']}/capture").json()
    assert draft["message"]["transcript_engine"] == "test-whisper"
    read = [((l["suggested"] or {}).get("code"), l["qty"], l["unit"]) for l in draft["lines"]]
    assert read == [("SKU-MR-100", 5, "CASE"), ("SKU-TE-500", 2, "CASE"), ("SKU-SP-100", 3, None)]  # "dabba" is asked


def test_unreadable_photo_falls_back_to_the_desk_typing_it(desk, monkeypatch):
    monkeypatch.setattr(desk_router, "transcribe", lambda kind, data, media_type: (None, ""))
    photo = next(m for m in desk.get("/api/desk/messages").json() if m["kind"] == "photo")
    failed = desk.post(f"/api/desk/messages/{photo['id']}/capture")
    assert failed.status_code == 409 and "type the order" in failed.json()["detail"]
    assert next(m for m in desk.get("/api/desk/messages").json() if m["id"] == photo["id"])["status"] == "NEEDS_TEXT"
    typed = desk.post(f"/api/desk/messages/{photo['id']}/text", json={"text": "glucose biscuit 200g - 4 peti"}).json()
    assert typed["transcript_engine"] == "typed by desk"
    line = desk.post(f"/api/desk/messages/{photo['id']}/capture").json()["lines"][0]
    assert (line["suggested"]["code"], line["qty"], line["unit"]) == ("SKU-BS-200", 4, "CASE")
    text_message = next(m for m in desk.get("/api/desk/messages").json() if m["kind"] == "text")
    assert desk.post(f"/api/desk/messages/{text_message['id']}/text", json={"text": "changed"}).status_code == 409


def test_uploads_are_checked_by_content_and_size(desk):
    upload = lambda name, data, kind: desk.post("/api/desk/messages/upload", data={"retailer_id": "1"},  # noqa: E731
                                                files={"file": (name, data, kind)})
    assert upload("order.txt", b"5 peti biscuit", "text/plain").status_code == 415
    assert upload("fake.jpg", b"not really a jpeg", "image/jpeg").status_code == 415
    assert upload("huge.jpg", b"\xff\xd8\xff" + b"0" * (5 * 1024 * 1024), "image/jpeg").status_code == 413
    ok = upload("list.jpg", b"\xff\xd8\xff\xe0" + b"0" * 100, "image/jpeg")
    assert ok.status_code == 201 and ok.json()["kind"] == "photo"
