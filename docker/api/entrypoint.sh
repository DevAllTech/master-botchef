#!/bin/sh
set -e

# O repo não tem pasta prisma/migrations: o banco sempre foi mantido com
# `prisma db push` (é o que o servidor Windows usa). O `migrate deploy` que
# estava aqui não tinha migration nenhuma para aplicar e nunca criava as tabelas.
#
# Sem --accept-data-loss de propósito: se o schema novo exigir apagar coluna,
# tabela ou dado (ou criar um índice único que os dados atuais violam), o push
# falha, o container não sobe e o erro aparece no log. Mudança destrutiva tem
# que ser decidida por alguém, com backup, e não acontecer sozinha num deploy.
#
# CLI local, nunca `npx`: o `npx` baixaria a última versão do Prisma se o
# binário faltasse.
echo "▶ Sincronizando o schema do banco (prisma db push)..."
/app/apps/api/node_modules/.bin/prisma db push \
  --schema=/app/prisma/schema.prisma --skip-generate

echo "▶ Iniciando API..."
exec node /app/apps/api/dist/server.js
