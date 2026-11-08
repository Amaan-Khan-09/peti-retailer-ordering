# Peti: retailer ordering for an FMCG distributor

Peti is a take-home build for a distributor in Jabalpur that serves 1,800 kirana shops. "Peti" is what shopkeepers call a case.

- **Retailers** order from low-end phones in Hindi or English. They see their own prices, their margin on the MRP, live stock and schemes, and a "usual order" built from their own buying rhythm. The cart prices every scheme as they go and shows what the schemes save.
- **Salesmen** take orders at the counter **without signal**. Prices, schemes and credit for the day's beat are kept on the phone, and the same scheme engine runs there. Orders wait in an outbox and are sent, exactly once, when signal returns.
- **WhatsApp orders** come in as texts, **Hindi voice notes** or **photos of handwritten lists**. AI reads them into a draft that the desk checks. Each line shows the shop's own words, a confidence level and two alternatives. Unclear units are asked about, not guessed, and nothing is ordered until a person confirms it. Desk corrections are remembered for that shop.
- **The order desk** clears credit holds, exports to Tally (XML or CSV), prints van loading lists, sees shops with no order in 14 days, and tracks the client's three success targets.

**Stack:**
- Frontend: React, TypeScript, Vite and Tailwind, as an installable app.
- Backend: FastAPI, SQLAlchemy and Postgres (SQLite locally).
- AI on Groq: `gpt-oss-120b` (reading orders), `whisper-large-v3` (voice notes) and `qwen3.8` (photos), with a Gemini fallback and a rule-based reader.
- Docker on Render.

See [`deployment.md`](deployment.md) for running it, how it's deployed, and demo logins. The Technical Design Document is submitted separately.

```
backend/app/pricing.py           scheme engine: free goods and slab discounts (pure functions)
frontend/src/offline/pricing.ts  the same engine on the phone, checked against the same cases (tests/fixtures)
backend/app/capture/             AI capture: text.py (parser), llm.py (reader), media.py (voice/photo), matcher.py, service.py
backend/app/orders.py            stock reservation, credit holds, idempotent orders, WhatsApp updates (mocked)
backend/app/suggest.py           usual-order suggestions from each shop's buying rhythm
backend/app/tally.py             Tally XML / CSV export
backend/app/routers/             auth, shop, salesman, desk (inbox, capture, loading list, metrics)
frontend/src/offline/store.ts    salesman bundle and outbox (works offline, syncs once)
frontend/src/pages/              retailer, salesman and desk screens
```
