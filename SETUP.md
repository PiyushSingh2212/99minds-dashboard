# 99minds Dashboard — Setup Guide

Full-stack app: React frontend + Express/MongoDB backend, deployed to Vercel.

---

## Step 1 — MongoDB Atlas (5 min)

1. Go to https://cloud.mongodb.com → sign up free
2. Create a new **Free M0** cluster (any region)
3. Under **Database Access** → Add user: `99minds` / any password → role: "Atlas Admin"
4. Under **Network Access** → Add IP: `0.0.0.0/0` (allow all — needed for Vercel)
5. Click **Connect** → **Drivers** → copy the connection string
   - Looks like: `mongodb+srv://99minds:<password>@cluster0.abc12.mongodb.net/`
   - Replace `<password>` and append the DB name: `...mongodb.net/99minds?retryWrites=true&w=majority`

---

## Step 2 — Run locally (2 min)

```bash
# In the project root:
npm run install:all

# Terminal 1 — backend
cp backend/.env.example backend/.env
# Edit backend/.env: paste MONGODB_URI, set API_KEY to any random string
npm run dev:backend

# Terminal 2 — frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env:
#   VITE_API_URL=http://localhost:3001/api
#   VITE_API_KEY=same-key-as-backend
npm run dev:frontend
```

Open http://localhost:5173 — you should see the dashboard.

---

## Step 3 — Deploy to Vercel (5 min)

1. Push this folder to a GitHub repo
2. Go to https://vercel.com → New Project → import your repo
3. In **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | Your Atlas connection string |
| `API_KEY` | Your chosen secret key |
| `FRONTEND_URL` | Leave blank for now (fill in after first deploy) |
| `VITE_API_URL` | `https://YOUR-PROJECT.vercel.app/api` |
| `VITE_API_KEY` | Same secret key |

4. Click **Deploy** — Vercel builds both frontend and backend automatically
5. After deploy, copy your live URL and update `FRONTEND_URL` in env vars → Redeploy

---

## Step 4 — Wire the Chrome Extension

In the 99minds Lead Extractor extension popup:
- **Dashboard URL**: `https://YOUR-PROJECT.vercel.app`
- **API Key**: same key as above

After every extraction, the extension will POST leads to `/api/leads/import` and they appear live in the dashboard.

---

## Step 5 — Wire n8n

Add an **HTTP Request** node at the end of your blog automation workflow:

- Method: `POST`
- URL: `https://YOUR-PROJECT.vercel.app/api/automation/run`
- Headers: `x-api-key: YOUR_API_KEY`
- Body (JSON):
```json
{
  "status": "success",
  "blogsPublished": {{ $json.blogsPublished }},
  "keywordsResearched": {{ $json.keywordsResearched }},
  "duration": {{ $json.duration }}
}
```

Every n8n run will now appear in the **Automation** tab of the dashboard.

---

## API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/stats` | GET | — | Dashboard summary stats |
| `/api/leads` | GET | — | Paginated leads (search, filter, sort) |
| `/api/leads/import` | POST | ✓ | Bulk upsert leads from CSV |
| `/api/leads/export` | GET | — | Download all leads as CSV |
| `/api/leads/:id` | PATCH | ✓ | Update contacted/notes |
| `/api/connections` | GET | — | Paginated connections |
| `/api/connections/bulk` | POST | ✓ | Bulk import connections |
| `/api/connections/activity` | GET | — | Recent activity feed |
| `/api/automation/run` | POST | ✓ | Log an n8n automation run |
| `/api/automation/runs` | GET | — | Recent run history |
| `/api/health` | GET | — | Health check |

Auth = include header `x-api-key: YOUR_API_KEY`
