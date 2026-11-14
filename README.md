# ReCall

> Save it once. Find it by what it said, not where you saved it.

ReCall is a web app for UCU students preparing for exams. A student drops a link (YouTube, any web page, PDF), the app pulls out the text, puts the item into a topic, and lets the student find it later by what it said. OOAD course project, UCU, 2026.

**Team:** Uliana Kryshchuk · Olena Kulynyak · Sofiia Demenko

**Live prototype:** _add the URL here after deploy_

## What works now (v0.2)

- Sign up / sign in with **Firebase Auth** (Google or email + password). We do not store passwords.
- Add a link: the API saves it and answers `202` at once; a background job fetches the page, extracts the text and picks a topic. The UI shows "processing…" until it is done.
- Library grouped by topic, rename a topic, delete an item.
- Search over titles and extracted text, with the matching passage shown.
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
| `ContentExtractor` | `WebPageExtractor`, `YouTubeExtractor` (title), `PdfLinkExtractor` (name only) | subtitles, PDF text via the worker + object storage |
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

**Without Docker** (SQLite, dev sign-in by email only, no Firebase needed):

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

**With Docker** (Postgres + the production image, dev sign-in):

```bash
docker compose -f infra/docker-compose.yml up --build  # http://localhost:8000
```

Tests: `cd backend && python -m pytest -q` (they also run the Alembic migrations).

New migration after changing a model: `cd backend && alembic revision --autogenerate -m "what changed"`.

## Configuration

| Variable | Used by | Meaning |
|---|---|---|
| `DATABASE_URL` | API | Postgres URL (Neon); defaults to local SQLite |
| `AUTH_PROVIDER` | API | `firebase` (default, production) or `dev` (local only) |
| `FIREBASE_PROJECT_ID` | API | Firebase project whose ID tokens are accepted |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | frontend build | Firebase web config (public values). Empty API key = dev mode |
| `TASK_QUEUE` | API | `thread` (default) or `inline` |

## Deploy

### 1. Firebase (auth)
1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (Analytics not needed).
2. **Build → Authentication → Get started** → enable **Email/Password** and **Google**.
3. **Project settings → Your apps → Web (`</>`)** → register an app, copy `apiKey`, `authDomain`, `projectId`, `appId`.
4. After the app is deployed: **Authentication → Settings → Authorized domains** → add the Render domain (e.g. `recall.onrender.com`).

### 2a. Hosting with Terraform
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill repo URL + Firebase values
export RENDER_API_KEY=... RENDER_OWNER_ID=... NEON_API_KEY=...
terraform init && terraform apply
```
Note: the Render provider documents paid plans; if it rejects `free`, use 2b for the web service and keep only Neon in Terraform.

### 2b. Hosting by hand (same result)
1. [neon.tech](https://neon.tech) → new project (region Frankfurt) → copy the connection string.
2. [render.com](https://render.com) → **New → Web Service** → this repo → runtime **Docker**, plan **Free**, region Frankfurt, health check path `/api/health`.
3. Environment: `DATABASE_URL` (from Neon), `AUTH_PROVIDER=firebase`, `FIREBASE_PROJECT_ID`, and the four `VITE_FIREBASE_*` values (Render passes them to the Docker build).

### 3. CI/CD
Render → service → **Settings → Deploy Hook** → copy the URL → GitHub repo → **Settings → Secrets → Actions** → `RENDER_DEPLOY_HOOK_URL`. Turn off Render's own auto-deploy, so every push to `main` deploys only after tests pass.

Free-tier notes: the service sleeps after 15 minutes idle (the first request takes ~50 s, so open it a minute before the demo).
