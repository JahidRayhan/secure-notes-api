# API reference (verified against a live MongoDB)

Base: `/api`. Auth: `Authorization: Bearer <jwt>` (1h expiry).
Success item: `{ data }`. Success list: `{ data: [], pagination: { page, limit, total, totalPages } }`.
Error: `{ error: { message, code } }` (validation messages are folded into `message`).
Pagination: `?page=1&limit=10`, limit max 50 (bad values fall back to defaults, no 400).

Error codes: UNAUTHENTICATED, TOKEN_EXPIRED, INVALID_TOKEN (401, clear token and go to login) /
FORBIDDEN (403) / NOT_FOUND, USER_NOT_FOUND (404) / VALIDATION_ERROR, INVALID_ID (400) /
EMAIL_TAKEN (409) / INVALID_CREDENTIALS (401) / RATE_LIMITED (429).

## Shapes
User: `{ _id, name, email, role: 'user'|'admin', interests: string[], createdAt }`
Note: `{ _id, title, content, owner (id string), createdAt, updatedAt }`
Admin note: same, but `owner` is `{ _id, name, email }`
Post: `{ _id, title, body, author (id string), createdAt }`

## Auth
- POST /auth/register `{ name, email, password(8-72), interests? }` -> 201 `{ data: { token, user } }` (role always user)
- POST /auth/login `{ email, password }` -> `{ data: { token, user } }`
- GET /auth/me -> `{ data: user }`
- PUT /auth/me `{ name?, interests?, currentPassword?, newPassword? }` (at least one field; newPassword needs currentPassword)

## Notes (any signed-in user)
- GET /notes -> own notes, newest first, paginated
- POST /notes `{ title(<=200), content(<=20000) }` -> 201
- GET /notes/:id -> own note (admin: any note)
- PUT /notes/:id `{ title?, content? }` -> own only (admin gets 404 on others')
- DELETE /notes/:id -> `{ data: { id } }`, own only
- Other people's notes return 404 (not 403) for non-admins.

## Posts
- POST /posts `{ title, body }` (auth) -> 201
- GET /users/:id/posts (public, no token) -> paginated; 404 if user does not exist

## Admin (role admin, else 403)
- GET /admin/notes -> all notes, `owner` populated
- GET /admin/users, POST /admin/users `{ name, email, password, role?, interests? }`
- GET/PUT/DELETE /admin/users/:id (PUT any of name, email, password, role, interests)
  - cannot delete self (400 CANNOT_DELETE_SELF), cannot change own role (403 CANNOT_CHANGE_OWN_ROLE)
  - DELETE -> `{ data: { id, deleted: true, notesDeleted, postsDeleted } }`
- GET /admin/users/by-interests?interest=<string> -> paginated groups `{ interest, count, users: [{ _id, name, email }] }`
  - `interest` is optional: trimmed, lowercased, max 40 chars (400 VALIDATION_ERROR otherwise; a blank value means no filter).
  - Exact match. With it, the result is at most one group (the requested interest, listing every user who has it); no match -> `data: []`, `total: 0`.
  - Without it: every group, ordered by user count desc then name.

## Seed accounts (after `npm run seed`)
admin@example.com / Admin123!   user1..user10@example.com / Password123!
