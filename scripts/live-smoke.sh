#!/usr/bin/env bash
# End-to-end smoke test against a running backend (local or live).
# Usage: bash scripts/live-smoke.sh https://<render-app>.onrender.com
# Needs: bash, curl, node (used only to read JSON). Assumes `npm run seed` accounts exist.
# Override creds: ADMIN_EMAIL ADMIN_PASSWORD USER_EMAIL USER_PASSWORD USER2_EMAIL
# It creates and deletes its own temporary users; seeded data is left untouched.
set -u
BASE="${1:-${API_URL:-}}"; BASE="${BASE%/}"
[ -z "$BASE" ] && { echo "usage: $0 <backend-url>"; exit 2; }
API="$BASE/api"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}";  ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"
USER_EMAIL="${USER_EMAIL:-user1@example.com}";    USER_PASSWORD="${USER_PASSWORD:-Password123!}"
USER2_EMAIL="${USER2_EMAIL:-user2@example.com}"
ZERO_ID=000000000000000000000000
STAMP=$(date +%s)
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
PASS=0; FAIL=0

# jget '<js path>' -> reads $BODY, e.g. jget '.data.token'
jget() { printf '%s' "$BODY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const o=JSON.parse(s);const v=eval("o"+process.argv[1]);console.log(v===undefined?"":v)}catch(e){console.log("")}})' "$1"; }

# req METHOD PATH [TOKEN] [JSON_BODY]  -> sets STATUS and BODY
req() {
  local m="$1" p="$2" t="${3:-}" b="${4:-}"
  local args=(-s -g --max-time 90 -o "$TMP" -w '%{http_code}' -X "$m")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  [ -n "$b" ] && args+=(-H 'Content-Type: application/json' -d "$b")
  STATUS=$(curl "${args[@]}" "$API$p"); BODY=$(cat "$TMP")
}
# ok "label" EXPECTED_STATUS [EXPECTED_ERROR_CODE]
ok() {
  local good=1; [ "$STATUS" = "$2" ] || good=0
  [ -n "${3:-}" ] && [ "$(jget '.error.code')" != "$3" ] && good=0
  if [ $good = 1 ]; then PASS=$((PASS+1)); printf '  PASS %s -> %s %s\n' "$1" "$STATUS" "${3:-}"
  else FAIL=$((FAIL+1)); printf '  FAIL %s -> got %s (want %s %s) %s\n' "$1" "$STATUS" "$2" "${3:-}" "$BODY"; fi
}
eq() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); printf '  PASS %s = %s\n' "$1" "$2"; else FAIL=$((FAIL+1)); printf '  FAIL %s: got "%s" want "%s"\n' "$1" "$2" "$3"; fi; }

echo "== warm-up / health (a sleeping Render service can take ~50s) =="
STATUS=$(curl -s --max-time 120 -o "$TMP" -w '%{http_code}' "$BASE/health"); BODY=$(cat "$TMP"); ok "GET /health" 200

echo "== logins =="
req POST /auth/login "" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"; ok "admin login" 200; AT=$(jget '.data.token'); ADMIN_ID=$(jget '.data.user._id')
req POST /auth/login "" "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}";   ok "user1 login" 200; UT=$(jget '.data.token'); UID1=$(jget '.data.user._id')
req POST /auth/login "" "{\"email\":\"$USER2_EMAIL\",\"password\":\"$USER_PASSWORD\"}";  ok "user2 login" 200; U2T=$(jget '.data.token')
req POST /auth/login "" "{\"email\":\"$USER_EMAIL\",\"password\":\"wrong-password\"}";    ok "bad password" 401 INVALID_CREDENTIALS
req POST /auth/login "" '{"email":"not-an-email"}';                                       ok "login validation" 400 VALIDATION_ERROR
[ -z "$AT" ] || [ -z "$UT" ] || [ -z "$U2T" ] && { echo "Cannot continue without tokens (is the DB seeded?)"; exit 1; }

echo "== unauthenticated =="
req GET /auth/me;            ok "GET /auth/me" 401 UNAUTHENTICATED
req PUT /auth/me "" '{"name":"x"}'; ok "PUT /auth/me" 401 UNAUTHENTICATED
req GET /notes;              ok "GET /notes" 401 UNAUTHENTICATED
req POST /notes "" '{"title":"t","content":"c"}'; ok "POST /notes" 401 UNAUTHENTICATED
req GET /notes/$ZERO_ID;     ok "GET /notes/:id" 401 UNAUTHENTICATED
req POST /posts "" '{"title":"t","body":"b"}';    ok "POST /posts" 401 UNAUTHENTICATED
req GET /admin/notes;        ok "GET /admin/notes" 401 UNAUTHENTICATED
req GET /admin/users;        ok "GET /admin/users" 401 UNAUTHENTICATED
req GET /admin/users/by-interests; ok "GET by-interests" 401 UNAUTHENTICATED
req GET /notes "garbage.token.value"; ok "invalid token" 401 INVALID_TOKEN
req GET /nope;               ok "unknown route" 404 NOT_FOUND
echo "== public: posts of a user =="
req GET /users/$UID1/posts;  ok "GET /users/:id/posts (no token)" 200
req GET "/users/$UID1/posts?page=1&limit=2"; ok "posts paginated" 200; eq "posts limit" "$(jget '.pagination.limit')" 2
req GET /users/$ZERO_ID/posts; ok "posts of unknown user" 404 NOT_FOUND
req GET /users/abc/posts;    ok "posts, malformed id" 400 INVALID_ID

echo "== register / profile =="
REG="{\"name\":\"Smoke Test\",\"email\":\"smoke$STAMP@example.com\",\"password\":\"Password123!\",\"role\":\"admin\",\"interests\":[\"Chess\",\" smoke \"]}"
req POST /auth/register "" "$REG"; ok "register" 201; eq "role forced to user" "$(jget '.data.user.role')" user; RT=$(jget '.data.token'); RID=$(jget '.data.user._id')
req POST /auth/register "" "$REG"; ok "register duplicate" 409 EMAIL_TAKEN
req POST /auth/register "" '{"name":"x","email":"a@b.co","password":"short"}'; ok "register weak password" 400 VALIDATION_ERROR
req GET /auth/me "$RT";      ok "GET /auth/me" 200; eq "interests normalised" "$(jget '.data.interests.join(",")')" "chess,smoke"
req PUT /auth/me "$RT" '{"name":"Smoke Renamed"}'; ok "PUT /auth/me" 200
req PUT /auth/me "$RT" '{}'; ok "PUT /auth/me empty" 400 VALIDATION_ERROR
req PUT /auth/me "$RT" '{"newPassword":"Password456!"}'; ok "new password needs current" 400 VALIDATION_ERROR

echo "== user: own notes =="
req POST /notes "$UT" "{\"title\":\"smoke $STAMP\",\"content\":\"hello\"}"; ok "create note" 201; NID=$(jget '.data._id')
req POST /notes "$UT" '{"title":"","content":"c"}'; ok "create note, empty title" 400 VALIDATION_ERROR
req GET "/notes?page=1&limit=5" "$UT"; ok "list notes" 200; eq "pagination.limit" "$(jget '.pagination.limit')" 5
req GET /notes/$NID "$UT";   ok "get own note" 200
req PUT /notes/$NID "$UT" '{"title":"edited"}'; ok "update own note" 200; eq "title edited" "$(jget '.data.title')" edited
req PUT /notes/$NID "$UT" '{}'; ok "update note, nothing to update" 400 VALIDATION_ERROR
req GET /notes/abc "$UT";    ok "get note, malformed id" 400 INVALID_ID
req GET /notes/$ZERO_ID "$UT"; ok "get missing note" 404 NOT_FOUND
echo "== user2 vs user1's note (404, not 403) =="
req GET /notes/$NID "$U2T";  ok "other user GET" 404 NOT_FOUND
req PUT /notes/$NID "$U2T" '{"title":"hack"}'; ok "other user PUT" 404 NOT_FOUND
req DELETE /notes/$NID "$U2T"; ok "other user DELETE" 404 NOT_FOUND
req GET /notes "$U2T";       ok "user2 list" 200

echo "== user: posts =="
req POST /posts "$UT" "{\"title\":\"smoke post $STAMP\",\"body\":\"public\"}"; ok "create post" 201
req POST /posts "$UT" '{"title":"x"}'; ok "create post, missing body" 400 VALIDATION_ERROR
req GET "/users/$UID1/posts?limit=50"; ok "posts visible publicly" 200

echo "== user hitting admin endpoints (403) =="
req GET /admin/users "$UT";            ok "GET /admin/users" 403 FORBIDDEN
req GET /admin/notes "$UT";            ok "GET /admin/notes" 403 FORBIDDEN
req GET /admin/users/by-interests "$UT"; ok "GET by-interests" 403 FORBIDDEN
req POST /admin/users "$UT" '{"name":"n","email":"n@n.co","password":"Password123!"}'; ok "POST /admin/users" 403 FORBIDDEN
req GET /admin/users/$UID1 "$UT";      ok "GET /admin/users/:id" 403 FORBIDDEN
req PUT /admin/users/$UID1 "$UT" '{"role":"admin"}'; ok "PUT /admin/users/:id" 403 FORBIDDEN
req DELETE /admin/users/$UID1 "$UT";   ok "DELETE /admin/users/:id" 403 FORBIDDEN

echo "== admin: notes =="
req GET /admin/notes "$AT";  ok "list all notes" 200; eq "owner populated" "$(jget '.data[0].owner.email !== undefined')" true
req GET /notes/$NID "$AT";   ok "admin reads user's note" 200
req PUT /notes/$NID "$AT" '{"title":"admin edit"}'; ok "admin cannot edit others' note" 404 NOT_FOUND
req DELETE /notes/$NID "$AT"; ok "admin cannot delete others' note" 404 NOT_FOUND
req DELETE /notes/$NID "$UT"; ok "owner deletes note" 200
req GET /notes/$NID "$UT";   ok "deleted note is gone" 404 NOT_FOUND

echo "== admin: users =="
req GET "/admin/users?page=1&limit=3" "$AT"; ok "list users" 200; eq "pagination.limit" "$(jget '.pagination.limit')" 3
req GET /admin/users/$UID1 "$AT"; ok "get user" 200; eq "no passwordHash" "$(jget '.data.passwordHash')" ""
req GET /admin/users/$ZERO_ID "$AT"; ok "get missing user" 404 USER_NOT_FOUND
req GET /admin/users/abc "$AT"; ok "get user, malformed id" 400
req POST /admin/users "$AT" "{\"name\":\"Temp\",\"email\":\"temp$STAMP@example.com\",\"password\":\"Password123!\",\"interests\":[\"chess\"]}"; ok "create user" 201; TID=$(jget '.data._id')
req POST /admin/users "$AT" "{\"name\":\"Temp\",\"email\":\"temp$STAMP@example.com\",\"password\":\"Password123!\"}"; ok "create duplicate" 409 EMAIL_TAKEN
req PUT /admin/users/$TID "$AT" '{"name":"Temp Renamed","interests":["chess","go"]}'; ok "update user" 200
req PUT /admin/users/$ZERO_ID "$AT" '{"name":"x"}'; ok "update missing user" 404 USER_NOT_FOUND
req PUT /admin/users/$ADMIN_ID "$AT" '{"role":"user"}'; ok "cannot demote self" 403 CANNOT_CHANGE_OWN_ROLE
req DELETE /admin/users/$ADMIN_ID "$AT"; ok "cannot delete self" 400 CANNOT_DELETE_SELF

echo "== admin: by-interests (single aggregate, with and without the filter) =="
req GET "/admin/users/by-interests?limit=5" "$AT"; ok "all groups" 200
req GET "/admin/users/by-interests?interest=chess" "$AT"; ok "filter chess" 200
eq "one group" "$(jget '.data.length')" 1; eq "group is chess" "$(jget '.data[0].interest')" chess
req GET "/admin/users/by-interests?interest=%20%20CHESS%20" "$AT"; ok "filter is trimmed + lowercased" 200; eq "group is chess" "$(jget '.data[0].interest')" chess
req GET "/admin/users/by-interests?interest=no-such-interest-$STAMP" "$AT"; ok "filter, no match" 200; eq "empty data" "$(jget '.data.length')" 0; eq "total 0" "$(jget '.pagination.total')" 0
req GET "/admin/users/by-interests?interest=$(printf 'a%.0s' $(seq 1 41))" "$AT"; ok "filter > 40 chars" 400 VALIDATION_ERROR
req GET "/admin/users/by-interests?interest[\$ne]=x" "$AT"; ok "operator injection rejected" 400 VALIDATION_ERROR

echo "== cascade delete: temp user's notes + posts go with the user =="
req POST /auth/login "" "{\"email\":\"temp$STAMP@example.com\",\"password\":\"Password123!\"}"; ok "temp login" 200; TT=$(jget '.data.token')
req POST /notes "$TT" '{"title":"n","content":"c"}'; ok "temp note" 201
req POST /posts "$TT" '{"title":"p","body":"b"}';    ok "temp post" 201
req DELETE /admin/users/$TID "$AT"; ok "delete temp user" 200; eq "notesDeleted" "$(jget '.data.notesDeleted')" 1; eq "postsDeleted" "$(jget '.data.postsDeleted')" 1
req GET /admin/users/$TID "$AT"; ok "user is gone" 404 USER_NOT_FOUND
req GET /users/$TID/posts;       ok "their posts are gone" 404 NOT_FOUND
req GET /auth/me "$TT";          ok "deleted user's token is dead" 401 UNAUTHENTICATED
req DELETE /admin/users/$TID "$AT"; ok "delete twice" 404 USER_NOT_FOUND

echo "== cleanup: remove the registered smoke user =="
req DELETE /admin/users/$RID "$AT"; ok "delete smoke user" 200

echo; echo "RESULT: $PASS passed, $FAIL failed"; [ "$FAIL" = 0 ]
