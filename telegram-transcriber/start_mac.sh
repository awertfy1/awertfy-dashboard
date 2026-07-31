#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Checking Homebrew..."
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew не найден. Установите: https://brew.sh"
  exit 1
fi

echo "==> Checking ffmpeg..."
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Ставлю ffmpeg..."
  brew install ffmpeg
fi

echo "==> Checking Python 3..."
if ! command -v python3 >/dev/null 2>&1; then
  echo "Ставлю python..."
  brew install python
fi

if [[ ! -d .venv ]]; then
  echo "==> Creating virtualenv..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "==> Installing Python packages..."
pip install --upgrade pip
pip install -r requirements.txt
# Ensure transitive deps are present (Python 3.13 / pip quirks)
pip install requests tqdm huggingface_hub tokenizers av ctranslate2

if [[ ! -f .env ]]; then
  echo "==> Creating .env from .env.example"
  cp .env.example .env
  echo
  echo "Откройте файл .env и вставьте токен и ваш user id."
  echo "Потом снова запустите: ./start_mac.sh"
  exit 1
fi

if grep -q "your_bot_token_here" .env; then
  echo "В .env ещё стоит заглушка токена. Вставьте реальные значения и перезапустите."
  exit 1
fi

echo "==> Starting bot..."
python bot.py
