# Peti: deployment and demo guide

- **Repository:** https://github.com/Amaan-Khan-09/peti-retailer-ordering
- **Live app:** LIVE_URL_PLACEHOLDER

## Demo login details

Sign-in is by mobile number and a one-time code. SMS is mocked: in demo mode the code is shown on the sign-in screen, and you can tap it to fill it in. The sign-in page also has one-tap buttons for each account. Only registered numbers can sign in.

| Role | Mobile number | What to look at |
|---|---|---|
| Retailer | `9000000101` | Sharma Kirana Store. Has special prices, a "usual order" card, and the brief's sample WhatsApp message. |
| Retailer | `9000000102` | Gupta General Store. Close to its credit limit, so an order over ₹3,500 goes on credit hold. |
| Salesman | `9000000201` | Rakesh Tiwari. His beat is 10 shops, including the two above. Takes orders without signal. |
| Salesman | `9000000202` | Imran Qureshi. A different beat of 10 shops: he can't see Rakesh's shops. |
| Order desk | `9000000001` | WhatsApp text, Hindi voice-note and photo orders read by AI; orders, credit holds and Tally export; van loading; success targets. |

**A 5-minute tour**

1. **Retailer `9000000101`:**
   - The top card shows the shop's available credit. "Your usual order" lists its regular products, with when each is due. Tap **Add all**.
   - Each product shows its price per case (+GST), MRP and the shop's margin. **ADD** turns into a stepper, and the cart bar shows the running total.
   - Add *Glucose biscuit 75 g* and set it to 9 cases. The cart offers "Add 1 more case to get 1 free"; tap it and the free case appears.
   - Switch to Hindi with **हिं**. Product names, categories, schemes and nudges all change.
   - Place the order and open it to see the WhatsApp updates sent to the shop (mocked).
2. **Salesman `9000000201`:**
   - Open *Gupta General Store* and add 5 cases of *Detergent powder 1 kg*.
   - Turn the network off: in Chrome press F12, open the Network tab, and choose Offline. The cart is still priced on the phone, and a banner says there is no signal.
   - **Save order**. It waits in the **Outbox**.
   - Turn the network back on. The order is sent by itself and lands on credit hold.
3. **Order desk `9000000001`:**
   - **WhatsApp inbox:** read Sharma Kirana's text message. Tea 250 g is out of stock, so switch that line to 500 g and create the order; the correction is remembered for that shop.
   - Read Yadav Kirana's **voice note**. Whisper transcribes the Hindi, and "dabba" is asked about (case or piece?) instead of guessed.
   - Read Patel Provision's **photo of a handwritten list**. Every line is read from the photo.
   - **Orders:** confirm an order, approve the credit hold, then **Export to Tally** (XML, or the CSV button).
   - **Van loading:** today's confirmed orders by area, ready to print.
   - **Overview:** the three success targets, and shops with no order in 14 days.

To reset the demo data, run `python -m app.seed --reset` in `backend/`.

## Run it locally

You need Python 3.12 or newer, Node.js 20 or newer, and git.

```bash
git clone https://github.com/Amaan-Khan-09/peti-retailer-ordering.git
cd peti-retailer-ordering

# 1. Backend (API on http://localhost:8000)
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env               # optional: add GROQ_API_KEY to turn on the AI reader, voice notes and photos
uvicorn app.main:app --reload --port 8000
```

On first start the app creates a SQLite database (`backend/peti.db`) with the sample data, including a sample voice note and photo. There are no migrations yet. If you pull a change to the data model, delete `backend/peti.db` and restart.

```bash
# 2. Frontend (in a second terminal; dev server on http://localhost:5173, proxies /api to :8000)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and use the demo numbers above. To run everything on one port instead, use `npm run build` in `frontend/`; then `uvicorn` serves the built app at http://localhost:8000.

**Tests**
- Backend, 41 tests: `cd backend && python -m pytest -q`. They cover the scheme engine, the message parser and matcher, the checks on the AI's output, voice and photo handling, access control by role, stock, credit, idempotent orders, suggestions, the loading list and the metrics.
- Frontend, 15 tests: `cd frontend && npm test`. The phone's offline scheme engine is checked against the same case file as the server engine.

Without an AI key, text messages are read by the rule-based reader, and the screen says so. Voice notes and photos show a "type the order" box instead. Everything else works the same.

## How it is deployed

- **Platform:** Render, from the `render.yaml` Blueprint in the repository root. The region is Singapore, which is the closest Render region to India.
- **Web service:** one Docker image (`Dockerfile`). A Node stage builds the React app, and the Python 3.12 stage runs FastAPI with uvicorn and serves the built files. The app and API share one origin, so the session cookie is first-party and no CORS setup is needed. Responses are gzipped, and hashed assets are cached for a year. The container runs as a non-root user.
- **Database:** Render Postgres, connected through `DATABASE_URL`. Tables are created on start. Sample data is loaded only when the database is empty.
- **Health check:** `GET /api/health` returns `{"ok": true, "ai": "configured" | "rules-only"}`.

**Steps:** push the repo to GitHub, then in Render choose **New → Blueprint** and select the repo. Render creates the web service and the database. Enter `GROQ_API_KEY` when asked, then deploy.

### Environment variables (names only)

| Name | Needed | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes in production | Postgres connection string. Render fills it from the database. |
| `JWT_SECRET` | Yes in production | Signs the session cookie. Render generates it. The app refuses to start in production without it. |
| `APP_ENV` | Set by the Dockerfile | `production` turns on the secret check. |
| `COOKIE_SECURE` | Yes in production | `true`, so the cookie is only sent over HTTPS. |
| `DEMO_MODE` | Optional | `true` shows the one-time code on screen instead of sending an SMS. |
| `SEED_ON_START` | Optional | `true` loads the sample data into an empty database. |
| `GROQ_API_KEY` | Optional | Turns on the AI order reader, voice-note transcription and photo reading. |
| `GROQ_MODEL` | Optional | Order reader. Defaults to `openai/gpt-oss-120b`. |
| `GROQ_WHISPER_MODEL` | Optional | Voice notes. Defaults to `whisper-large-v3`. |
| `GROQ_VISION_MODEL` | Optional | Photos of lists. Defaults to `qwen/qwen3.8-27b`. |
| `GEMINI_API_KEY` | Optional | Fallback for the order reader and photos. |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-2.5-flash`. |
| `CORS_ORIGINS` | Optional | Only needed if the frontend is hosted on a different origin. |
| `STATIC_DIR` | Set by the Dockerfile | Where the built frontend lives. |

No secrets are stored in the repository. `backend/.env` is git-ignored, and `backend/.env.example` lists names only.
