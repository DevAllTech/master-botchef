#!/bin/sh
set -e

echo "▶ Aplicando migrations do banco..."
npx prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "▶ Iniciando API..."
exec node /app/apps/api/dist/server.js
