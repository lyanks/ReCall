# ReCall

> Save it once. Find it by what it said, not where you saved it.

ReCall is a web app for UCU students preparing for exams. A student drops a link (YouTube, any web page, PDF), the app pulls out the text, puts the item into a topic, and lets the student find it later by what it said. OOAD course project, UCU, 2026.

**Team:** Uliana Kryshchuk · Olena Kulynyak · Sofiia Demenko

**Live prototype:** https://recall-ojro.onrender.com (free tier: the first visit after a quiet period takes ~50 s to wake up)

## What works now (v0.2)

- Sign up / sign in with **Firebase Auth** (Google or email + password). We do not store passwords.
- Add a link: the API saves it and answers `202` at once; a background job fetches the page, extracts the text and picks a topic. The UI shows "processing…" until it is done.
- Sources: web pages (incl. their meta description, so JS-heavy sites are findable), YouTube and TikTok (title/caption via oEmbed), Instagram (caption from link-preview tags, best effort), PDF links (name only for now).
- Library as a grid of topic tiles; move an item to an existing topic or create a new one; delete with confirmation.
- Search ranks by individual words (stems, typos, site name and URL count too; "mini games" finds "minigames.com"), with the matching passage shown. Cross-language search by meaning is the next step (embeddings behind the `SearchIndex` port).
- Ukrainian and English interface: the user picks the language on the sign-in screen or in Settings (default follows the browser).
- Usage events (sign-up, sign-in, add, search) for the validation metrics in the feedback report.

Planned next: YouTube subtitles, PDF upload and text extraction, LLM summaries and topics (Claude API behind an `LLMClient` port), semantic search, Telegram bot.

## Architecture

**Modular monolith**: one repository, one container, one deploy. Inside, the code is split into modules, and every external dependency sits behind a **port** (interface) with swappable **adapters** (ports & adapters), so any vendor can be replaced without touching the modules.

```
                 ┌──────────────── one container ────────────────┐
 browser ──HTTPS─┤ React SPA (static)   FastAPI  /api/*          │
   │             │                       ├─ identity  (users)    │──► Postgres (Neon)
   │ ID token    │                       ├─ library   (items)    │
   └─Firebase────┤  AuthVerifier port ◄──┤  ingestion (extract)  │──► web pages, YouTube
     Auth        │                       ├─ analytics (events)   │
                 │  TaskQueue port: in-process worker threads    │
                 └───────────────────────────────────────────────┘
```

| Port | Adapter now | Adapter later (when there is a reason) |
|---|---|---|
| `AuthVerifier` | `FirebaseAuthVerifier` (checks ID tokens against Google keys), `DevAuthVerifier` for local/tests | Clerk / Auth0 |
| `TaskQueue` | `ThreadTaskQueue` (in-process), `InlineTaskQueue` for tests | Redis + RQ, or Cloud Tasks, once jobs get slow or the API gets more than one instance |
| `ContentExtractor` | `WebPageExtractor`, `YouTubeExtractor`, `TikTokExtractor` (oEmbed), `InstagramExtractor` (og tags), `PdfLinkExtractor` (name only) | subtitles, PDF text via the worker + object storage |
| `SearchIndex` | `KeywordRanker` (word-by-word, stems, typo-tolerant) | embeddings via Claude/`LLMClient` for search by meaning |
| `TopicClassifier` | `KeywordTopicClassifier` | Claude API through `LLMClient`, `FakeClient` in tests |

### Stack decisions ("start naive, add a block only with a reason")

| Block | Choice | Why |
|---|---|---|
| API | Python + FastAPI | Python is best for text extraction and LLM work later |
| Frontend | React + Vite SPA, served by the same container | one deploy, no CORS |
| Database | PostgreSQL + SQLAlchemy + **Alembic** migrations | migrations run on every container start |
| Auth | **Firebase Auth** | never write our own auth |
| Background jobs | `202 + id` and an in-process queue behind a port | fetching a page can take seconds; a separate Redis worker is not needed yet |
| Container | Docker, one multi-stage image | |
| CI/CD | GitHub Actions: tests → Docker build → deploy hook | |
| Infrastructure | **Terraform** (Render + Neon providers) | IaC without AWS |
| Hosting | Option B, PaaS: **Render** (container) + **Neon** (Postgres) | free tiers, nothing to administer |
| Not yet | Redis, object storage + CDN, staging | no hot reads, no file uploads, one environment so far |

## Repository layout

```
backend/    FastAPI app (app/modules/<module>), Alembic migrations, tests
frontend/   React + Vite SPA (src/auth.js is the Firebase adapter)
infra/      docker-compose.yml (local stack), terraform/ (Render + Neon)
docs/       plan, feedback report template
Dockerfile  the one production image
.github/    CI/CD workflow
```

## Run locally

**Without Docker** (SQLite, dev sign-in by email only, no internet needed for auth):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export AUTH_PROVIDER=dev                               # Windows: set AUTH_PROVIDER=dev
alembic upgrade head
uvicorn app.main:app --reload                          # API docs: http://localhost:8000/api/docs

cd ../frontend
npm install
npm run dev                                            # app: http://localhost:5173
```

**With Docker** (Postgres + the production image, real Firebase sign-in):

```bash
docker compose -f infra/docker-compose.yml up --build  # http://localhost:8000
```

Tests: `cd backend && python -m pytest -q` (they also run the Alembic migrations).

New migration after changing a model: `cd backend && alembic revision --autogenerate -m "what changed"`.

## Configuration

| Variable | Used by | Meaning |
|---|---|---|
| `DATABASE_URL` | API | Postgres URL (Neon); defaults to local SQLite |
| `AUTH_PROVIDER` | API | `firebase` (default) or `dev` (local only: sign in by email, no password) |
| `FIREBASE_PROJECT_ID` | API | Firebase project whose ID tokens are accepted; defaults to `recall-ucu-edu` |
| `TASK_QUEUE` | API | `thread` (default) or `inline` (tests) |

The Firebase **web** config (`apiKey`, `authDomain`, …) is in `frontend/.env.production`. These values are public by design and end up in the JS bundle anyway; access is protected by Firebase's authorized-domains list. `npm run dev` without `.env.local` runs in dev mode.

## Deploy

Firebase project: `recall-ucu-edu` (Authentication → Email/Password and Google enabled).

### 1. Database: Neon
[neon.tech](https://neon.tech) → **New project** → name `recall`, region **AWS Europe Central (Frankfurt)** → copy the connection string (`postgresql://…`).

### 2. App: Render
1. [render.com](https://render.com) → sign in with GitHub → **New → Web Service** → pick `lyanks/ReCall`.
2. Language **Docker**, branch `main`, region **Frankfurt**, instance type **Free**.
3. **Environment variables:** `DATABASE_URL` = the Neon string. Nothing else is required.
4. **Advanced → Health Check Path:** `/api/health`. **Auto-Deploy:** off (CI deploys after tests pass).
5. Create. The first build takes ~3–5 minutes; migrations run automatically on start.

### 3. Let Firebase accept the new domain
Firebase console → **Authentication → Settings → Authorized domains → Add domain** → your Render host, e.g. `recall-xxxx.onrender.com`. Without this, Google sign-in fails with `auth/unauthorized-domain`.

### 4. CI/CD
Render → service → **Settings → Deploy Hook** → copy the URL → GitHub repo → **Settings → Secrets and variables → Actions → New repository secret** `RENDER_DEPLOY_HOOK_URL`. From then on every push to `main` runs tests → Docker build → deploy.

### Alternative: Terraform (Render + Neon as code)
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
export RENDER_API_KEY=... RENDER_OWNER_ID=... NEON_API_KEY=...
terraform init && terraform apply
```
The Render provider documents paid plans; if it rejects `free`, create the web service by hand (step 2) and keep only Neon in Terraform.

Free-tier notes: the service sleeps after 15 minutes idle (the first request takes ~50 s, so open it a minute before the demo).
