from fastapi.testclient import TestClient

from app.main import app


def sku_ids(client, retailer_id=None):
    params = {"retailer_id": retailer_id} if retailer_id else {}
    return {i["code"]: i for i in client.get("/api/catalogue", params=params).json()["items"]}


def test_sign_in_rejects_wrong_codes_and_hides_unknown_numbers(fresh_db):
    with TestClient(app) as client:
        assert client.post("/api/auth/otp", json={"phone": "9876543210"}).json() == {"sent": True, "demo_code": None}
        unknown = client.post("/api/auth/verify", json={"phone": "9876543210", "code": "123456"})
        assert unknown.status_code == 400 and "not right" in unknown.json()["detail"]  # same answer as a wrong code
        client.post("/api/auth/otp", json={"phone": "9000000101"})
        assert client.post("/api/auth/verify", json={"phone": "9000000101", "code": "000000"}).status_code == 400
        assert client.post("/api/auth/otp", json={"phone": "12345"}).status_code == 422
        assert client.get("/api/me").status_code == 401


def test_retailers_see_only_their_own_prices_and_orders(sharma, gupta):
    assert sku_ids(sharma)["SKU-BS-075"]["price"] == 8.00  # special price for this shop
    assert sku_ids(gupta)["SKU-BS-075"]["price"] == 8.10
    assert sku_ids(gupta, retailer_id=1)["SKU-BS-075"]["price"] == 8.10  # retailer_id is ignored for retailers
    sharma_order = sharma.get("/api/orders").json()[0]
    assert gupta.get(f"/api/orders/{sharma_order['id']}").status_code == 404
    assert gupta.get("/api/desk/messages").status_code == 403


def test_order_reserves_stock_and_blocks_out_of_stock(sharma, desk):
    items = sku_ids(sharma)
    before = items["SKU-BS-075"]["stock_cases"]
    response = sharma.post("/api/orders", json={"lines": [{"sku_id": items["SKU-BS-075"]["id"], "qty": 10, "unit": "CASE"}]})
    assert response.status_code == 201
    order = response.json()
    assert order["status"] == "PLACED" and order["free_cases_total"] == 1
    assert sku_ids(sharma)["SKU-BS-075"]["stock_cases"] == before - 11
    blocked = sharma.post("/api/orders", json={"lines": [{"sku_id": items["SKU-TE-250"]["id"], "qty": 1, "unit": "CASE"}]})
    assert blocked.status_code == 409 and "Out of stock" in blocked.json()["detail"]["errors"][0]
    desk.post(f"/api/desk/orders/{order['id']}/cancel")
    assert sku_ids(sharma)["SKU-BS-075"]["stock_cases"] == before


def test_credit_limit_puts_order_on_hold_until_desk_releases(gupta, desk):
    items = sku_ids(gupta)
    order = gupta.post("/api/orders", json={"lines": [{"sku_id": items["SKU-DT-1KG"]["id"], "qty": 5, "unit": "CASE"}]}).json()
    assert order["status"] == "CREDIT_HOLD" and "Credit limit" in order["hold_reason"]
    assert desk.post(f"/api/desk/orders/{order['id']}/confirm").status_code == 409
    assert desk.post(f"/api/desk/orders/{order['id']}/release").json()["status"] == "CONFIRMED"


def test_capture_needs_a_person_and_learns_corrections(desk):
    sample = next(m for m in desk.get("/api/desk/messages").json() if "chai patti 250" in m["text"])
    draft = desk.post(f"/api/desk/messages/{sample['id']}/capture").json()
    assert draft["engine"] == "rules" and len(draft["lines"]) == 3
    tea = draft["lines"][2]
    assert tea["suggested"]["code"] == "SKU-TE-250" and "out of stock" in tea["reasons"][0]
    te500 = next(a for a in tea["alternatives"] if a["code"] == "SKU-TE-500")
    decisions = [{"line_id": l["id"], "sku_id": l["suggested"]["id"], "qty": l["qty"], "unit": l["unit"]} for l in draft["lines"]]
    decisions[2]["sku_id"] = te500["id"]
    result = desk.post(f"/api/desk/captures/{draft['id']}/confirm", json={"lines": decisions}).json()
    assert result["order"]["source"] == "ai_capture" and result["learned"] == [tea["phrase"]]
    assert desk.post(f"/api/desk/captures/{draft['id']}/confirm", json={"lines": decisions}).status_code == 409

    retailer_id = sample["retailer"]["id"]
    again = desk.post("/api/desk/messages", json={"retailer_id": retailer_id, "text": "chai patti 250 wala 1 peti"}).json()
    line = desk.post(f"/api/desk/messages/{again['id']}/capture").json()["lines"][0]
    assert line["suggested"]["code"] == "SKU-TE-500" and line["level"] == "HIGH"


def test_capture_will_not_place_an_order_with_an_unknown_unit(desk):
    message = next(m for m in desk.get("/api/desk/messages").json() if "dabba" in m["text"])
    draft = desk.post(f"/api/desk/messages/{message['id']}/capture").json()
    decisions = [{"line_id": l["id"], "sku_id": (l["suggested"] or {}).get("id"), "qty": l["qty"], "unit": l["unit"]}
                 for l in draft["lines"]]
    response = desk.post(f"/api/desk/captures/{draft['id']}/confirm", json={"lines": decisions})
    assert response.status_code == 422 and "case or piece" in response.json()["detail"]


def test_tally_export_marks_orders_exported_once(desk):
    placed = desk.get("/api/orders", params={"status": "PLACED"}).json()
    for order in placed:
        desk.post(f"/api/desk/orders/{order['id']}/confirm")
    response = desk.post("/api/desk/export", json={"format": "xml"})
    assert response.status_code == 200 and "<VOUCHERNUMBER>ORD-" in response.text
    assert int(response.headers["X-Exported-Count"]) >= len(placed)
    assert desk.post("/api/desk/export", json={"format": "csv"}).status_code == 409
    assert desk.get("/api/orders", params={"status": "CONFIRMED"}).json() == []


def test_dashboard_lists_shops_quiet_for_14_days(desk):
    quiet = {r["shop_name"]: r["days_since_order"] for r in desk.get("/api/desk/dashboard").json()["quiet_retailers"]}
    assert quiet["Sahu General"] == 31 and quiet["Namdev Stores"] is None
    assert "Sharma Kirana Store" not in quiet
