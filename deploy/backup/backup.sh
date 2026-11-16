#!/bin/sh
# Backup do banco do BotChef, rodando dentro do container `backup` (imagem
# postgres:16-alpine, a mesma do banco, que já traz o pg_dump certo; Alpine:
# só sh e o date do busybox).
#
# Todo dia, na hora BACKUP_HOUR:BACKUP_MINUTE:
#   - dump em /backups/daily/botchef-AAAA-MM-DD_HHMM.sql.gz (SQL puro: restaura
#     com psql em qualquer Postgres >= 16)
#   - aos domingos copia o dump para /backups/weekly/
#   - apaga o que passar de KEEP_DAILY diários e KEEP_WEEKLY semanais
#
# /backups é ~/menuchef/data/backups/botchef no servidor: o `offsite` do
# compose do MenuChef leva essa pasta para o Drive junto com os dumps de lá.
#
# Restaurar: ver RUNBOOK do backend do MenuChef ("BotChef no mesmo servidor").

set -u

: "${BACKUP_HOUR:=3}"
: "${BACKUP_MINUTE:=30}"
: "${KEEP_DAILY:=7}"
: "${KEEP_WEEKLY:=4}"

mkdir -p /backups/daily /backups/weekly

log() { echo "[backup $(date '+%F %T')] $*"; }

prune() {
  dir="$1"; keep="$2"
  # Mais novos primeiro; remove do (keep+1)-ésimo em diante.
  ls -1t "$dir"/botchef-*.sql.gz 2>/dev/null | tail -n +"$((keep + 1))" | while read -r old; do
    rm -f -- "$old" && log "removido $old"
  done
}

run_backup() {
  stamp="$(date '+%F_%H%M')"
  file="/backups/daily/botchef-${stamp}.sql.gz"
  tmp="${file}.partial"

  log "dump iniciado"
  # Grava em .partial e só renomeia no fim, para nunca sobrar um dump
  # truncado com cara de bom. PGHOST/PGUSER/PGPASSWORD/PGDATABASE vêm do compose.
  if pg_dump --no-owner --no-privileges | gzip -6 > "$tmp" \
      && [ "$(gzip -dc "$tmp" | tail -c 200 | grep -c 'PostgreSQL database dump complete')" -ge 1 ]; then
    mv "$tmp" "$file"
    log "dump ok: $file ($(du -h "$file" | cut -f1))"
  else
    rm -f "$tmp"
    log "ERRO: dump falhou"
    return 1
  fi

  if [ "$(date +%u)" = "7" ]; then
    cp "$file" /backups/weekly/
  fi

  prune /backups/daily "$KEEP_DAILY"
  prune /backups/weekly "$KEEP_WEEKLY"
}

# `backup.sh now` faz um backup na hora e sai (útil antes de deploy).
if [ "${1:-}" = "now" ]; then
  run_backup
  exit $?
fi

log "agendado para $(printf '%02d:%02d' "$BACKUP_HOUR" "$BACKUP_MINUTE") todo dia (fuso $(date +%Z))"
while true; do
  now=$(date +%s)
  next=$(date -d "$(printf '%02d:%02d' "$BACKUP_HOUR" "$BACKUP_MINUTE")" +%s)
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  run_backup || true
done
