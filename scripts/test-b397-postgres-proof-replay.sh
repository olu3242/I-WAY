#!/usr/bin/env bash
set -euo pipefail
# Disposable PostgreSQL only: prove two concurrent uses of one proof cannot commit.
proof="$(printf '%064d' 397)"
invitation='88888888-8888-4888-8888-888888888888'
tenant='77777777-7777-4777-8777-777777777777'
psql -v ON_ERROR_STOP=1 -c "INSERT INTO operations_onboarding.invitations(id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at) VALUES ('$invitation','$tenant','66666666-6666-4666-8666-666666666666','replay397@example.invalid','{}','fixture',repeat('a',64),'VERIFIED',now()+interval '1 hour')"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
for i in 1 2; do
 (
  psql -v ON_ERROR_STOP=1 -At <<SQL >"$dir/$i.out" 2>&1
BEGIN;
INSERT INTO operations_onboarding.identity_proof_uses(proof_hash,invitation_id,tenant_id)
VALUES ('$proof','$invitation','$tenant');
SELECT pg_sleep(0.3);
COMMIT;
SQL
 ) &
done
wait || true
success=0
for i in 1 2; do
 if grep -q '^COMMIT$' "$dir/$i.out"; then success=$((success+1)); fi
done
[ "$success" -eq 1 ] || { echo "FAIL: expected exactly one replay proof commit, got $success"; cat "$dir"/*.out; exit 1; }
count="$(psql -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM operations_onboarding.identity_proof_uses WHERE proof_hash='$proof'")"
[ "$count" = 1 ] || { echo "FAIL: replay ledger count=$count"; exit 1; }
echo 'PASS: concurrent duplicate proof yields one commit and one ledger record'
