# ReCall

> Save it once. Find it by what it said, not where you saved it.

ReCall is a web app for UCU students preparing for exams. A student drops a link (YouTube, any web page, PDF), the app pulls out the text, puts the item into a topic, and lets the student find it later by what it said. OOAD course project, UCU, 2026.

**Team:** Uliana Kryshchuk · Olena Kulynyak · Sofiia Demenko

**Live prototype:** https://recall-ojro.onrender.com (free tier: the first visit after a quiet period takes ~50 s to wake up)

## Try it in one minute

1. Open https://recall-ojro.onrender.com and **sign up** with Google or with an email and password (Firebase Auth).
2. Paste a link (an article, a YouTube video, a PDF link) or **drop a file** (lecture PDF, slides, a photo of notes) onto the page.
3. The card shows "processing…" for a few seconds, then gets a topic and a short AI summary.
4. Type what you remember into **Search**, in Ukrainian or English, e.g. "how a hash table handles collisions". ReCall finds the item by meaning, not by the exact words.

## What works now (v0.8)

- Sign up / sign in with **Firebase Auth** (Google or email + password). We do not store passwords.
- Add a link: the API saves it and answers `202` at once; a background job fetches the page, extracts the text and picks a topic. The UI shows "processing…" until it is done.
- Sources: web pages (incl. their meta description, so JS-heavy sites are findable), YouTube and TikTok (title/caption via oEmbed), Instagram (caption from link-preview tags, best effort), PDF links (name only for now).
- Library as a grid of topic tiles; move an item to an existing topic or create a new one; delete with confirmation.
- Search ranks by individual words (stems, typos, site name and URL count too; "mini games" finds "minigames.com"), with the matching passage shown.
- **With an Anthropic API key (optional):** every saved link gets a 2–3 sentence summary (Ukrainian + English) and key topics from Claude; YouTube uses the video's subtitles when YouTube lets us read them. Search then works **by meaning and across languages** (a Ukrainian query finds an English article). Links the keyword rules cannot file get a topic from Claude. Without the key everything above keeps working as before.
- Ukrainian and English interface: the user picks the language on the sign-in screen or in Settings (default follows the browser). AI summaries are shown in the chosen language.
- **File upload:** drag a file onto the page or pick one (PDF, DOCX, PPTX, TXT, MD, PNG/JPG/WebP). Text is extracted in the background and the file opens again from its card. Limits so a 1000-page file cannot burn tokens: up to 10 MB per file (photos 5 MB), only the first 30 PDF pages / 60 slides are read, **the AI sees only the first 12,000 characters (≈ 8 pages, ~3–4k tokens)** while keyword search uses all the extracted text, 30 uploads a day and 100 MB of files per account. Photos of notes go to Claude as an image.
- Edit an item's title; cards show a preview image where the page or video has one.
- Usage events (sign-up, sign-in, add, search) for the validation metrics in the feedback report.

Planned next: exam prep (summary or self-check questions per topic), Telegram bot.

## Architecture

**Modular monolith**: one repository, one container, one deploy. Inside, the code is split into modules, and every external dependency sits behind a **port** (interface) with swappable **adapters** (ports & adapters), so any vendor can be replaced without touching the modules.

```
                 ┌──────────────── one container ────────────────┐
 browser ──HTTPS─┤ React SPA (static)   FastAPI  /api/*          │
   │             │                       ├─ identity  (users)    │──► Postgres (Neon):
   │ ID token    │                       ├─ library   (items)    │    items, users, events,
   └─Firebase────┤  AuthVerifier port ◄──┤  ingestion (extract)  │    uploaded files
     Auth        │                       ├─ files     (uploads)  │──► web pages, YouTube
                 │                       ├─ search    (ranking)  │
                 │                       ├─ ai        (Claude)   │──► Anthropic API (optional)
                 │                       ├─ analytics (events)   │
                 │  TaskQueue port: in-process worker threads    │
                 └───────────────────────────────────────────────┘
```

| Port | Adapter now | Adapter later (when there is a reason) |
|---|---|---|
| `AuthVerifier` | `FirebaseAuthVerifier` (checks ID tokens against Google keys), `DevAuthVerifier` for local/tests | Clerk / Auth0 |
| `TaskQueue` | `ThreadTaskQueue` (in-process), `InlineTaskQueue` for tests | Redis + RQ, or Cloud Tasks, once jobs get slow or the API gets more than one instance |
| `ContentExtractor` | `WebPageExtractor`, `YouTubeExtractor`, `TikTokExtractor` (oEmbed), `InstagramExtractor` (og tags), `PdfLinkExtractor` (name only) | subtitles, PDF text via the worker + object storage |
| `SearchIndex` | `SemanticSearch` (Claude picks matches by meaning) with `KeywordRanker` as fallback | pgvector + embeddings once libraries reach thousands of items |
| `TopicClassifier` | `KeywordTopicClassifier`, Claude fills in what the rules leave Unsorted | |
| `FileStore` | `PostgresFileStore` (bytes in Postgres) | S3-compatible storage (Cloudflare R2) |
| `LLMClient` | `ClaudeClient` (Anthropic SDK, `claude-haiku-5-5`), `NoLLM` without a key, `FakeLLM` in tests | another model or vendor |

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
| File storage | bytes in Postgres (`files` table) behind a `FileStore` port | files are capped at 10 MB and Render's disk is wiped on every deploy; Neon already backs up the DB. Swap in an S3-compatible adapter (Cloudflare R2) when files or the 0.5 GB Neon limit grow |
| Not yet | Redis, object storage + CDN, staging | no hot reads, files are small, one environment so far |

## AI: why no embeddings

Search by meaning usually means embeddings + a vector index. We chose a simpler design that needs one vendor and no new infrastructure:

- The Anthropic API has no embeddings endpoint; a second vendor (Voyage, OpenAI) means a second key and account, and a local multilingual model does not fit the 512 MB free Render instance.
- A student's library is small (tens to hundreds of links). For each search we send compact cards (title, topic, AI summary, keywords; ~100 tokens each, newest 200 items) to `claude-haiku-5-5` and it returns the ids that answer the query, in any language. Keyword hits the model leaves out are still shown after its picks. If the API fails or is slow, search silently falls back to keywords.
- Cost with Haiku 5.5 ($0.10 / $0.50 per million tokens): about $0.0005 per saved link and $0.001 per search, so a semester of use is cents.
- When libraries grow to thousands of items, a pgvector adapter can replace `SemanticSearch` behind the same `SearchIndex` port.

## Repository layout

```
backend/    FastAPI app (app/modules/<module>), Alembic migrations, tests
frontend/   React + Vite SPA (src/auth.js is the Firebase adapter)
infra/      docker-compose.yml (local stack), terraform/ (Render + Neon)
docs/       plan, feedback report template
Dockerfile  the one production image
.github/    CI/CD workflow (tests → Docker build → deploy → smoke check of the live site)
```

## Run locally

**Without Docker** (SQLite, dev sign-in by email only, no internet needed for auth):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export AUTH_PROVIDER=dev                               # Windows: set AUTH_PROVIDER=dev
export ANTHROPIC_API_KEY=sk-ant-...                    # optional: AI summaries + search by meaning
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

Set `ANTHROPIC_API_KEY` in your shell first if you want the AI features in the container too.

Tests: `cd backend && python -m pytest -q` (they also run the Alembic migrations).

New migration after changing a model: `cd backend && alembic revision --autogenerate -m "what changed"`.

## Configuration

| Variable | Used by | Meaning |
|---|---|---|
| `DATABASE_URL` | API | Postgres URL (Neon); defaults to local SQLite |
| `AUTH_PROVIDER` | API | `firebase` (default) or `dev` (local only: sign in by email, no password) |
| `FIREBASE_PROJECT_ID` | API | Firebase project whose ID tokens are accepted; defaults to `recall-ucu-edu` |
| `FIREBASE_WEB_API_KEY` | API | public Firebase web key used for sign-in by login and password-reset emails; defaults to the one in `frontend/.env.production` |
| `TASK_QUEUE` | API | `thread` (default) or `inline` (tests) |
| `ANTHROPIC_API_KEY` | API | optional; turns on AI summaries and search by meaning |
| `AI_MODEL` | API | Claude model for both tasks; defaults to `claude-haiku-5-5` |
| `CORS_ORIGINS` | API | comma-separated origins; only needed if the frontend is served from another host |
| `STATIC_DIR` | API | built frontend to serve; defaults to `frontend/dist`; the Dockerfile sets `/srv/static` |

The Firebase **web** config (`apiKey`, `authDomain`, …) is in `frontend/.env.production`. These values are public by design and end up in the JS bundle anyway; access is protected by Firebase's authorized-domains list. `npm run dev` without `.env.local` runs in dev mode.

## Deploy

Our deployment: https://recall-ojro.onrender.com (Render web service from this repo's `Dockerfile`, Neon Postgres, Firebase Auth). To deploy your own copy:

Firebase project: `recall-ucu-edu` (Authentication → Email/Password and Google enabled).

### 1. Database: Neon
[neon.tech](https://neon.tech) → **New project** → name `recall`, region **AWS Europe Central (Frankfurt)** → copy the connection string (`postgresql://…`).

### 2. App: Render
1. [render.com](https://render.com) → sign in with GitHub → **New → Web Service** → pick `lyanks/ReCall`.
2. Language **Docker**, branch `main`, region **Frankfurt**, instance type **Free**.
3. **Environment variables:** `DATABASE_URL` = the Neon string. Optional: `ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com) → API Keys) for AI summaries and search by meaning; items saved earlier get summaries in the background after the next start.
4. **Advanced → Health Check Path:** `/api/health`. **Auto-Deploy:** off (CI deploys after tests pass).
5. Create. The first build takes ~3–5 minutes; migrations run automatically on start.

### 3. Let Firebase accept the new domain
Firebase console → **Authentication → Settings → Authorized domains → Add domain** → your Render host, e.g. `recall-xxxx.onrender.com`. Without this, Google sign-in fails with `auth/unauthorized-domain`.

### 4. CI/CD
Render → service → **Settings → Deploy Hook** → copy the URL → GitHub repo → **Settings → Secrets and variables → Actions → New repository secret** `RENDER_DEPLOY_HOOK_URL`. From then on every push to `main` runs tests → Docker build → deploy, and a **smoke** job waits until the live site reports the new version and checks it answers. It can also be run by hand: **Actions → CI/CD → Run workflow**. To point it at your own host, change `APP_URL` at the top of `.github/workflows/ci.yml`.

### Alternative: Terraform (Render + Neon as code)
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
export RENDER_API_KEY=... RENDER_OWNER_ID=... NEON_API_KEY=...
terraform init && terraform apply
```
The Render provider documents paid plans; if it rejects `free`, create the web service by hand (step 2) and keep only Neon in Terraform.

Free-tier notes: the service sleeps after 15 minutes idle (the first request takes ~50 s, so open it a minute before the demo).
