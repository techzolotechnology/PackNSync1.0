# Deploy PickAndSync with GitHub

This repo includes a **GitHub Actions CI/CD pipeline** so pushes to `main` build and deploy the website.

## What the pipeline does

| Workflow | When | What |
|----------|------|------|
| **CI** (`.github/workflows/ci.yml`) | Every push & PR | Install → Prisma generate → lint → build frontend |
| **Deploy** (`.github/workflows/deploy.yml`) | Push to `main` / manual run | Build frontend → **GitHub Pages** → optionally trigger **Render** API |

```
GitHub (push main)
   ├─ CI: build check
   ├─ Frontend → GitHub Pages (static site)
   └─ Backend  → Render (Docker + Postgres) via deploy hook
```

---

## One-time setup (do this with sir / team)

### 1) Enable GitHub Pages

1. Repo → **Settings** → **Pages**
2. **Source**: **GitHub Actions** (required — do **not** use “Deploy from a branch”, or GitHub will publish the README instead of the React app)
3. Custom domain: `pickandsync.com` (DNS A/ALIAS + CNAME as GitHub shows)

### 2) Deploy the API on Render (free)

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect this GitHub repo (it will read `render.yaml`)
3. After the service is live, copy the API URL, e.g.  
   `https://packandsync-api.onrender.com`
4. In Render → your web service → **Settings** → **Deploy Hook** → copy the URL
5. Set env vars on Render (at least):
   - `FRONTEND_URL` = your GitHub Pages URL  
     e.g. `https://<org>.github.io/<repo>`
   - `FRONTEND_URLS` = same (comma-separated if multiple)
   - Optional: `OPENAI_API_KEY`, Cloudinary, ZeptoMail `SMTP_*` + `EMAIL_FROM`, etc. (same as local `.env`)

### 3) Add GitHub Actions secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Example | Required |
|--------|---------|----------|
| `VITE_API_URL` | `https://packandsync-api.onrender.com/api` | **Yes** |
| `VITE_SOCKET_URL` | `https://packandsync-api.onrender.com` | **Yes** |
| `RENDER_DEPLOY_HOOK_URL` | `https://api.render.com/deploy/srv-...` | Recommended |
| `VITE_GOOGLE_MAPS_API_KEY` | your Maps key | Optional |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` / test | Optional |

### 4) Push to deploy

```powershell
git add .
git commit -m "Add GitHub CI/CD deploy pipeline"
git push origin main
```

Then open: **Actions** tab → watch **Deploy** → when green, open the Pages URL from the job summary.

Manual deploy: **Actions** → **Deploy** → **Run workflow**.

---

## Local vs production URLs

| | Local | Production |
|--|--------|------------|
| Website | `http://localhost:5173` | `https://<org>.github.io/<repo>/` |
| API | Vite proxy to the common deployed API | `https://packandsync-api.onrender.com/api` |

All clients default to the common deployed API. Frontend builds can override it with `VITE_API_URL` / `VITE_SOCKET_URL`; local Vite proxy development can deliberately target another backend with `VITE_DEV_BACKEND_ORIGIN`.

For **custom domains** (e.g. `pickandsync.com`), the workflow builds with `VITE_BASE=/` so JS/CSS load from `/assets/...`.  
If you only use `https://<org>.github.io/<repo>/` with **no** custom domain, change `VITE_BASE` in `.github/workflows/deploy.yml` to `/<repo>/`.

---

## Files added

- `.github/workflows/ci.yml` — continuous integration
- `.github/workflows/deploy.yml` — Pages deploy + Render hook
- `backend/Dockerfile` — production API image
- `render.yaml` — Render Blueprint (API + Postgres)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Pages site loads but API fails / CORS | Set `FRONTEND_URLS` on Render to include `https://pickandsync.com` (and `https://www.pickandsync.com`). The API also allows these by default after the CORS fix. |
| Blank page / JS+CSS 404 on custom domain | Rebuild with `VITE_BASE=/` (already set for pickandsync.com) |
| Blank page on `github.io/Repo/` only | Set `VITE_BASE` to `/RepoName/` in deploy.yml |
| Deploy job skips backend | Add `RENDER_DEPLOY_HOOK_URL` secret |
| `VITE_API_URL` empty build | Add the secret, then re-run **Deploy** workflow |
| Render free tier sleeps | First request after idle can take ~30–60s |

---

## What to tell sir

> We added a GitHub Actions pipeline: CI builds on every PR, and merges to `main` deploy the React site to GitHub Pages and trigger the Node/Postgres API on Render via Docker.
