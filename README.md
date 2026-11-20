# Secure Notes API

Node.js, Express, MongoDB (Mongoose), JWT auth, bcrypt password hashing, zod validation.
Roles: `user` (own notes) and `admin` (inherits user rights, manages users, can **read** everyone's notes).

## Setup
```bash
npm install
cp .env.example .env        # then edit; JWT_SECRET must be 32+ chars: openssl rand -hex 32
npm run seed                # local dev only: wipes + seeds demo data
npm run dev                 # http://localhost:4000
```
Production: `npm run start:prod` (syncs indexes to match `schema.index()`, then starts).

## Environment variables
| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | development | `production` disables mongoose autoIndex (indexes are synced at start) and refuses `seed` |
| `PORT` | 4000 | Render sets this itself |
| `MONGODB_URI` | required | include the database name |
| `JWT_SECRET` | required | 32+ chars |
| `JWT_EXPIRES_IN` | 1h | |
| `BCRYPT_ROUNDS` | 12 | 10-15 |
| `CORS_ORIGINS` | empty | comma-separated, exact origins, no trailing slash |
| `TRUST_PROXY` | 0 | set `1` behind Render so the login rate limit sees real client IPs |
| `LOGIN_RATE_MAX` / `LOGIN_RATE_WINDOW_MIN` | 10 / 15 | failed logins per IP per window |

## Endpoints
Full request/response shapes: [API_REFERENCE.md](API_REFERENCE.md). All lists accept `?page=&limit=` (limit max 50).

| Method + path | Access |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login` | public (register always creates role `user`) |
| `GET/PUT /api/auth/me` | signed in |
| `GET/POST /api/notes`, `GET/PUT/DELETE /api/notes/:id` | signed in, own notes (admin may `GET` any) |
| `POST /api/posts` | signed in |
| `GET /api/users/:id/posts` | public (Scenario 2, `$lookup`) |
| `GET /api/admin/notes` | admin |
| `GET/POST /api/admin/users`, `GET/PUT/DELETE /api/admin/users/:id` | admin |
| `GET /api/admin/users/by-interests[?interest=]` | admin (Scenario 1) |
| `GET /health` | public |

## Indexes (6 custom, all declared with `schema.index()`; `_id_` is built in)
| Index | Query it serves |
|---|---|
| `User { email: 1 }` unique | login `findOne({email})`, register duplicate check (race-safe 409) |
| `User { createdAt: -1 }` | `GET /admin/users` sort + skip/limit |
| `User { interests: 1 }` (multikey) | `GET /admin/users/by-interests?interest=x`: the leading `$match` |
| `Note { owner: 1, createdAt: -1 }` | `GET /notes` filter + sort + count; cascade `deleteMany({owner})` |
| `Note { createdAt: -1 }` | `GET /admin/notes` sort + skip/limit |
| `Post { author: 1, createdAt: -1 }` | `$lookup` in `GET /users/:id/posts` (match, sort, count); cascade `deleteMany({author})` |

Everything else (`GET /me`, `/notes/:id`, `/admin/users/:id`, the auth middleware) is a lookup by `_id`. Counts of whole collections use `estimatedDocumentCount()` (metadata, no index).
Verify: `node scripts/explainInterests.js chess` and `mongosh "<uri>" --file scripts/audit-indexes.js`.

## Design decisions
- **Admin is read-only on others' notes.** The spec gives admins "view everyone's notes", not edit/delete. `PUT`/`DELETE /notes/:id` always filter by `owner = me`, so an admin gets 404 on someone else's note.
- **404, not 403, for other people's notes.** A 403 would confirm that the note id exists. 403 is used only for role failures (a user calling an admin route).
- **Cascade delete.** Deleting a user removes their notes and posts first and the user document last, so a failure midway leaves the user in place and the request can simply be retried (no orphans).
- **No transactions.** Each step is idempotent and ordered so a retry converges; this avoids needing a replica set for a delete that is safe to repeat.
- **One aggregate with `$facet`.** The grouped page and the total group count come from a single `User.aggregate()` call, as the spec requires. The filtered form puts `{ $match: { interests } }` first so the multikey index narrows the input, and again after `$unwind` so only that interest's group survives.
- **Posts: one pipeline, two `$lookup`s.** The page of posts and the total count are separate `$lookup` sub-pipelines on the same index, so `$limit` is pushed down and an author's posts are never all buffered.
- **Aggregations take plain values.** `aggregate()` does not cast, so ids are converted to `ObjectId` and the interest filter is validated as a string (an object such as `?interest[$ne]=x` is a 400).
- **Auth.** bcrypt hashing, 1h JWT, user re-loaded from the DB on every request (deleted users and role changes apply immediately), constant-time-ish login (dummy hash), failed-login rate limit, helmet, strict CORS allow-list.
