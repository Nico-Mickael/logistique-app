#!/bin/sh
set -e

echo "Running migrations..."
npx sequelize-cli db:migrate

echo "Seeding database if empty..."
node scripts/seed-if-empty.js

echo "Starting backend..."
exec npm run dev
