docker compose cp pandorahearts_backup_2026-02-24_1758.sql postgres:/tmp/pandorahearts_backup_2026-02-24_1758.sql
docker compose exec -T postgres sh -lc 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -f /tmp/pandorahearts_backup_2026-02-24_1758.sql'

# Faire un backup
mkdir -p backups

docker compose exec -T postgres sh -lc \
'pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" --clean --if-exists --no-owner --no-privileges' \
> backups/pandorahearts_$(date +%F_%H-%M-%S).sql

# Faire un restore
FILE="backups/TON_FICHIER.sql"

docker compose exec -T postgres sh -lc \
'psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"' \
< "$FILE"