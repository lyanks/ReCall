# ЗБІРКА (Zbirka)

> Save it once. Find it by what it said, not where you saved it.

Zbirka is a web app for UCU students preparing for exams. A student drops a link (YouTube, any web page, PDF); the app pulls out the text, puts the item into a topic, and lets the student find it later by what it said. OOAD course project, UCU, 2026.

**Team:** Uliana Kryshchuk · Olena Kulynyak · Sofiia Demenko

**Live prototype:** _add the Render URL here after deploy_

## What works now (prototype v0.1)

- Sign up / sign in with email and password (passwords hashed with PBKDF2, sessions via JWT)
- Add a link: the backend detects the source type, fetches the page title and text (YouTube: title via oEmbed)
- Automatic topic (keyword rules for now) that the student can rename
- Library grouped by topic, search over titles and extracted text, with the matching passage shown
- Usage events (sign-up, sign-in, add, search) logged for the validation metrics

Planned next: YouTube subtitles, PDF upload and text extraction, LLM summaries, semantic search, Google sign-in, Telegram bot.

## Repository layout

```
backend/   FastAPI + SQLAlchemy API (Python 3.12), tests in backend/tests
frontend/  React + Vite single-page app
infra/     docker-compose.yml (local stack) and render.yaml (deploy blueprint)
docs/      plans, OOAD artifacts, user-feedback report
```

## Run locally

**Option A, Docker (everything):**

```bash
docker compose -f infra/docker-compose.yml up --build
# app: http://localhost:5173   API docs: http://localhost:8000/docs
```

**Option B, without Docker (uses SQLite):**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload            # http://localhost:8000/docs

cd ../frontend
npm install
npm run dev                              # http://localhost:5173
```

Tests: `cd backend && python -m pytest -q`

## Configuration

| Variable | Where | Meaning |
|---|---|---|
| `DATABASE_URL` | backend | Postgres URL; defaults to local SQLite |
| `JWT_SECRET` | backend | secret for signing sessions; **must** be set in production |
| `CORS_ORIGINS` | backend | comma-separated frontend URLs allowed to call the API |
| `VITE_API_URL` | frontend (build time) | public URL of the backend |

## Deploy (Render, free, HTTPS)

1. Sign in to [render.com](https://render.com) with GitHub.
2. **New → Blueprint**, choose this repository, set **Blueprint Path** to `infra/render.yaml`, apply. This creates `zbirka-db` (Postgres), `zbirka-api` and `zbirka-web`.
3. When asked for the unset variables (or later under each service's **Environment**):
   - `zbirka-api` → `CORS_ORIGINS` = the `zbirka-web` URL, e.g. `https://zbirka-web.onrender.com`
   - `zbirka-web` → `VITE_API_URL` = the `zbirka-api` URL, e.g. `https://zbirka-api.onrender.com`
4. Redeploy `zbirka-web` so the build picks up `VITE_API_URL`. Open the web URL and sign up.

Free-tier notes: the API sleeps after 15 minutes idle (first request takes ~50 s, so open it a minute before the demo), and the free Postgres expires after 30 days.
