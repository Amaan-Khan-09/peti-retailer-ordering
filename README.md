# Peti: retailer ordering for an FMCG distributor

Peti is a take-home build for a distributor in Jabalpur that serves 1,800 kirana shops. "Peti" is what shopkeepers call a case.

- **Retailers** order from their phones. They see their own prices, live stock and current schemes. The cart prices every scheme live, and they can repeat their last order in one tap.
- **WhatsApp orders** in Hinglish or Devanagari are read by AI into a draft. The order desk checks the draft before anything becomes an order. Each line shows the shop's original words, a confidence level and two alternatives. Unclear units are asked about, not guessed. The desk's corrections are remembered for that shop.
- **The order desk** confirms orders, clears credit holds, exports confirmed orders to Tally (XML or CSV), and sees which shops haven't ordered in 14 days.

**Stack:** React, TypeScript, Vite and Tailwind · FastAPI, SQLAlchemy and Postgres (SQLite locally) · Groq `gpt-oss-120b` with a Gemini fallback and a rule-based reader · Docker on Render.

- [`deployment.md`](deployment.md): how to run it, how it's deployed, and demo logins.
- The Technical Design Document is submitted separately.

```
backend/app/pricing.py          scheme engine: free goods and slab discounts (pure functions, fully tested)
backend/app/capture/            AI order capture: text.py (parser), llm.py (model), matcher.py (SKU mapping), service.py
backend/app/orders.py           stock reservation, credit holds, order states
backend/app/tally.py            Tally XML / CSV export
backend/tests/                  30 tests
frontend/src/pages/retailer/    shop, cart, orders
frontend/src/pages/desk/        overview, WhatsApp inbox, AI draft review, orders
```
