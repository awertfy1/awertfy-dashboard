#!/usr/bin/env bash
# Starts local Telegram Bot API (removes ~20 MB download limit).
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "Сначала создайте .env (см. .env.example)"
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

if [[ -z "${TELEGRAM_API_ID:-}" || -z "${TELEGRAM_API_HASH:-}" ]]; then
  echo "В .env нужны TELEGRAM_API_ID и TELEGRAM_API_HASH"
  echo "Как получить: https://my.telegram.org → API development tools"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Нужен Docker Desktop для Mac: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker не запущен. Откройте Docker Desktop и подождите, пока он стартует."
  exit 1
fi

echo "==> Disconnect bot from cloud API (нужно один раз при переходе на локальный)..."
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/logOut" || true
echo

echo "==> Starting local Bot API on http://127.0.0.1:8081 ..."
docker rm -f telegram-bot-api >/dev/null 2>&1 || true
docker run -d \
  --name telegram-bot-api \
  --restart unless-stopped \
  -p 8081:8081 \
  -e TELEGRAM_API_ID="${TELEGRAM_API_ID}" \
  -e TELEGRAM_API_HASH="${TELEGRAM_API_HASH}" \
  aiogram/telegram-bot-api:latest

echo
echo "Готово. Проверьте:"
echo "  curl http://127.0.0.1:8081"
echo
echo "В .env должно быть:"
echo "  LOCAL_API_URL=http://127.0.0.1:8081"
echo
echo "Потом запустите бота: ./start_mac.sh"
