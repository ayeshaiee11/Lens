# LENS backend — setup

I assembled and test-ran this from the files you uploaded. Everything
worked correctly end to end (signup, investigations, sources,
notifications, maps, saved-toggles, trash/restore, profile edits) — so
the code itself is fine. The dashboard was probably looking "hardcoded"
because this server wasn't fully assembled/running yet.

## 1. Install
```
npm install
```
Requires **Node.js 22+** — this uses the built-in `node:sqlite` module,
not `better-sqlite3`, so there's no native build step.

## 2. Environment
```
cp .env.example .env
```
Then replace `JWT_SECRET` with a fresh value — don't reuse the one from
your original `_env` file, since it's already been shared in this chat:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Run
```
node server.js
```
Expect: `LENS backend listening on http://localhost:4000`

## 4. Point the frontend at it
The frontend defaults to `http://localhost:4000/api`. If you serve the
React app from a different origin, set this before it mounts:
```html
<script>window.__LENS_API_BASE__ = 'http://localhost:4000/api';</script>
```

## 5. Verify
```
curl http://localhost:4000/api/health
# {"ok":true}
```

## What to expect in the dashboard
A **brand-new** account is seeded with 6 demo investigations (LLMs,
Climate, Energy, Quantum, Ethics, Brain) — that's intentional, ported
1:1 from the old localStorage demo data in `seedData.js`. Every new
signup gets the *same* 6 to start, which is likely what read as
"hardcoded." Anything you create, save, or edit afterward is real and
persists in `data/lens.db` (SQLite file, created automatically).

## Folder layout
```
server.js
src/
  db.js                 # schema + seedUserContent()
  seedData.js            # the 6 demo investigations/sources
  middleware/auth.js      # requireAuth / signToken (JWT)
  utils/id.js             # id generator
  utils/notify.js         # pushNotification()
  routes/
    auth.js               # signup/login/guest/google/me
    users.js               # PATCH /api/me
    investigations.js      # CRUD + concepts/claims/questions saved-toggle
    sources.js              # CRUD + saved-toggle + unlink
    notifications.js        # list + mark read
    maps.js                  # derived from investigations
```
