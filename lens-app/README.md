<div align="center">

# LENS

**A research investigation workspace — turn scattered sources into a living knowledge map.**

[![Node](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-node:sqlite-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

</div>

---

## What is LENS?

LENS is a full-stack research tool for people who are drowning in tabs. Drop in a URL, a PDF, a YouTube video, or a research paper, and LENS reads it, pulls out the concepts/claims/open questions inside it, and plots them onto an interactive knowledge map for that investigation — building the map up automatically as you add more sources.

Instead of a folder of bookmarks, you end up with a graph of *what you actually know*, *what you're claiming*, and *what you still need to find out* — per topic, growing over time.

## Features

- **AI-assisted knowledge mapping** — new investigations are seeded with real starter concepts generated from the title; every source you add is scraped, analyzed, and merged into the map as new nodes and edges.
- **Multi-format source ingestion** — URLs, YouTube links, research papers, and PDF uploads (parsed server-side, never persisted to disk).
- **Live investigation dashboard** — progress tracking, status/visibility states, saved items, trash & restore.
- **Interactive graph view** — concepts, claims, and questions rendered as a connected map per investigation.
- **Auth that doesn't get in the way** — email/password, guest mode, and Google Sign-In (ID-token flow, no client secret required).
- **Notifications** — a real activity feed for source additions, investigation changes, and analysis results.
- **Command palette, saved items, and a full settings/profile flow** — the details that make an app feel finished, not scaffolded.

## Architecture

```
┌──────────────────────┐        REST / JSON        ┌───────────────────────┐
│   React Frontend      │ ─────────────────────────▶ │   Express API          │
│   LensDashboard.jsx    │ ◀───────────────────────── │   (JWT-authenticated)  │
└──────────────────────┘                             └───────────┬───────────┘
                                                                  │
                                                     ┌────────────┴────────────┐
                                                     │   Source pipeline        │
                                                     │   scrape → LLM analyze   │
                                                     │   → merge into map       │
                                                     └────────────┬────────────┘
                                                                  │
                                                       ┌──────────┴──────────┐
                                                       │  SQLite (node:sqlite)│
                                                       │  WAL mode, FKs on    │
                                                       └──────────────────────┘
```

Every source follows the same pipeline: **scrape → LLM-extract concepts/claims/questions → deduplicate against the existing map → re-lay-out the graph → persist in a single transaction.** If analysis fails (no API key, network blip, bad model output), the source is still saved — enrichment is a bonus layer, never a blocker.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React (hooks-based, no external state library), Tailwind, Lucide icons, Three.js accents |
| Backend | Node.js 22+, Express |
| Database | `node:sqlite` (built into Node — zero native build step), WAL journal mode |
| Auth | JWT + bcrypt, Google Identity Services |
| File handling | `multer` in-memory storage — PDFs are parsed and discarded, never written to disk |
| AI | LLM-driven concept/claim/question extraction from scraped source content |

## Getting started

**Requirements:** Node.js 22+ (uses the built-in `node:sqlite` module).

```bash
# clone
git clone https://github.com/<your-username>/lens.git
cd lens

# backend
cd lens-backend
npm install
cp .env.example .env        # then set your own JWT_SECRET
node server.js               # → http://localhost:4000

# frontend
cd ../lens-frontend
npm install
npm run dev
```

Point the frontend at a non-default API by setting this before the bundle mounts:

```html
<script>window.__LENS_API_BASE__ = 'https://your-api-url';</script>
```

Verify the backend is alive:

```bash
curl http://localhost:4000/api/health   # {"ok":true}
```

## API overview

| Route | Purpose |
|---|---|
| `POST /api/auth/*` | signup, login, guest session, Google sign-in |
| `GET/PATCH /api/me` | profile |
| `GET/POST/PATCH/DELETE /api/investigations` | full investigation lifecycle, incl. trash/restore, map-saved toggle, saved-item toggles |
| `GET/POST/DELETE /api/sources` | source CRUD, linking to investigations, saved toggle, unlink |
| `GET/PATCH /api/notifications` | activity feed |
| `GET /api/maps` | derived graph data |

All routes except `/api/health` and `/api/auth/*` require a `Bearer` JWT.

## Project structure

```
lens-backend/
  server.js
  src/
    db.js                  # schema + migrations
    seedData.js             # demo investigation layout helpers
    middleware/auth.js       # requireAuth / JWT signing
    services/
      scrapeSource.js         # content extraction per source type
      analyzeSource.js        # LLM concept/claim/question extraction
    routes/
      auth.js  users.js  investigations.js  sources.js  notifications.js  maps.js
lens-frontend/
  LensDashboard.jsx          # the entire client app
```

## Security notes

- JWT secrets are never committed — rotate anything that ever touched a shared `.env`.
- PDF uploads are held in memory only for the duration of the request, never written to disk.
- Every investigation/source route checks ownership (`user_id`) before returning or mutating data.

## Roadmap

- [ ] Real-time collaborative maps ("Shared with me" is scaffolded but not yet live)
- [ ] Postgres/Turso backend option for serverless deployment
- [ ] Export investigation → PDF/Markdown report

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
<sub>Built for people who research too much and forget too fast.</sub>
</div>