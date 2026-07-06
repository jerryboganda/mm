#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy EMRCOG Recalls (July 2024, Paper 02) content to the Maternal Mind
# production database + upload the explanation figures.
#
# RUN THIS ON THE VPS, from the repository root (where docker-compose.yml lives):
#     bash MCQ_Extraction_July2024_02/deploy/deploy-emrcog-recalls.sh
#
# It is SAFE and IDEMPOTENT:
#   • takes a full DB backup first (backups/…sql.gz)
#   • adds the additive, nullable `images` column (IF NOT EXISTS)
#   • copies the 91 figures into the app's persistent uploads volume
#   • imports 141 MCQs + 1 learning note as an UPSERT (re-runnable)
#   • runs inside a single transaction; any error rolls the import back
#
# Flags:  --yes            skip the confirmation prompt
#         --no-backup      skip the pg_dump backup (not recommended)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DB_SVC="db"; APP_SVC="app"; DB_USER="postgres"; DB_NAME="maternalmind"
CONTAINER_UPLOADS="/app/uploads/content-images"

ASSUME_YES=0; DO_BACKUP=1
for a in "$@"; do
  case "$a" in
    --yes) ASSUME_YES=1 ;;
    --no-backup) DO_BACKUP=0 ;;
    *) echo "Unknown flag: $a" >&2; exit 2 ;;
  esac
done

# Resolve paths relative to this script so it can be run from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"          # MCQ_Extraction_July2024_02
ROOT_DIR="$(cd "$CONTENT_DIR/.." && pwd)"            # repo root
cd "$ROOT_DIR"

if [ ! -f docker-compose.yml ]; then
  echo "ERROR: docker-compose.yml not found in $ROOT_DIR — run from the repo root on the VPS." >&2
  exit 1
fi

# Detect compose command (v2 plugin vs legacy binary).
if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then COMPOSE="docker-compose"
else echo "ERROR: docker compose not found." >&2; exit 1; fi

psql_exec() { $COMPOSE exec -T "$DB_SVC" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"; }

echo "▶ Repo:        $ROOT_DIR"
echo "▶ Compose:     $COMPOSE"
echo "▶ DB:          service=$DB_SVC db=$DB_NAME"
echo "▶ Figures:     $(grep -c . "$SCRIPT_DIR/figure-copy-manifest.txt") files"
echo "▶ Import:      $(grep -c 'INSERT INTO mcqs ' "$SCRIPT_DIR/import-emrcog-recalls.sql") MCQs + notes"
echo

if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "This writes to PRODUCTION ($DB_NAME). Continue? [y/N] " ans
  case "$ans" in y|Y|yes|YES) ;; *) echo "Aborted."; exit 0 ;; esac
fi

# 0) DB reachable?
if ! psql_exec -c 'select 1' >/dev/null 2>&1; then
  echo "ERROR: cannot reach the '$DB_SVC' database container. Is the stack up (docker compose ps)?" >&2
  exit 1
fi

# 1) Backup
if [ "$DO_BACKUP" -eq 1 ]; then
  mkdir -p backups
  TS="$(date +%Y%m%d-%H%M%S)"
  BK="backups/emrcog-predeploy-$TS.sql.gz"
  echo "▶ [1/5] Backing up database → $BK"
  $COMPOSE exec -T "$DB_SVC" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BK"
  echo "   backup size: $(du -h "$BK" | cut -f1)"
else
  echo "▶ [1/5] Skipping backup (--no-backup)"
fi

# 2) Migration: additive nullable images column
echo "▶ [2/5] Applying migration (add mcqs.images if missing)"
psql_exec < "$SCRIPT_DIR/migrate-add-mcq-images.sql"

# 3) Stage + upload figures into the persistent uploads volume
echo "▶ [3/5] Uploading 91 figures into $CONTAINER_UPLOADS"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
missing=0
while IFS=$'\t' read -r src dst; do
  [ -z "${src:-}" ] && continue
  if [ -f "$CONTENT_DIR/$src" ]; then cp "$CONTENT_DIR/$src" "$STAGE/$dst"
  else echo "   MISSING source figure: $src" >&2; missing=$((missing+1)); fi
done < "$SCRIPT_DIR/figure-copy-manifest.txt"
[ "$missing" -eq 0 ] || { echo "ERROR: $missing figures missing; aborting before import." >&2; exit 1; }

$COMPOSE exec -T "$APP_SVC" mkdir -p "$CONTAINER_UPLOADS"
# Portable copy: tar-pipe (fast, works on any docker); falls back to compose cp.
if ! tar -C "$STAGE" -cf - . | $COMPOSE exec -T "$APP_SVC" tar -C "$CONTAINER_UPLOADS" -xf - 2>/dev/null; then
  echo "   tar-pipe unavailable; falling back to 'compose cp'"
  $COMPOSE cp "$STAGE/." "$APP_SVC:$CONTAINER_UPLOADS/"
fi
echo "   uploaded: $($COMPOSE exec -T "$APP_SVC" sh -c "ls -1 $CONTAINER_UPLOADS/emrcog0224-*.png 2>/dev/null | wc -l") figures present"

# 4) Import content (transactional upsert)
echo "▶ [4/5] Importing content (book / chapter / topic / 141 MCQs / 1 note)"
psql_exec < "$SCRIPT_DIR/import-emrcog-recalls.sql"

# 5) Verify
echo "▶ [5/5] Verifying"
psql_exec -c "select
  (select count(*) from mcqs where topic_id='emrcog-jul2024-02-topic') as mcqs,
  (select count(*) from mcqs where topic_id='emrcog-jul2024-02-topic' and images is not null) as mcqs_with_figures,
  (select count(*) from content_blocks where topic_id='emrcog-jul2024-02-topic') as content_blocks,
  (select is_published from books where id='emrcog-jul2024-02-book') as book_published;"

echo
echo "✅ DB import + figures done."
echo "   Next (see DEPLOY_RUNBOOK.md):"
echo "   • Rebuild the server so the API returns figures:  $COMPOSE up -d --build $APP_SVC"
echo "   • Build & submit the app (EAS) so figures render in the quiz UI."
echo "   • Roll back if needed:  gunzip -c backups/emrcog-predeploy-*.sql.gz | $COMPOSE exec -T $DB_SVC psql -U $DB_USER -d $DB_NAME"
