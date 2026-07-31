# Telegram Transcriber Bot (macOS)

Бот принимает голосовые, аудио, видео и кружки — отвечает `.txt` файлом с расшифровкой (русский).

Доступ только для указанных Telegram user id.

## Быстрый старт на macOS

1. Установите [Homebrew](https://brew.sh), если ещё нет.
2. Скопируйте папку `telegram-transcriber` на Mac.
3. Создайте файл `.env` рядом с `bot.py`:

```bash
cd telegram-transcriber
cp .env.example .env
```

4. Откройте `.env` и заполните:

```env
TELEGRAM_BOT_TOKEN=...
ALLOWED_USER_IDS=...
LANGUAGE=ru
WHISPER_MODEL=small
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
```

5. Запустите:

```bash
chmod +x start_mac.sh
./start_mac.sh
```

При первом запуске скачается модель Whisper (`small`, ~500MB) — это один раз.

6. В Telegram найдите своего бота и отправьте `/start`, затем голосовое.

Пока окно терминала открыто и скрипт работает — бот онлайн. Чтобы остановить: `Ctrl+C`.

## Что поддерживается

- голосовые сообщения
- аудиофайлы (mp3, ogg, wav, m4a, flac…)
- видео и видеосообщения (кружки)
- документы с аудио/видео

Ответ всегда приходит как `.txt`.

## Настройки качества

В `.env`:

| Значение `WHISPER_MODEL` | Качество | Скорость / RAM |
|--------------------------|----------|----------------|
| `tiny` / `base`          | ниже     | быстрее        |
| `small` (по умолчанию)   | хорошо для RU | баланс    |
| `medium`                 | лучше    | медленнее      |

## Безопасность

- Не публикуйте токен бота.
- Файл `.env` не коммитится (см. `.gitignore`).
- Если токен светился в чате — лучше перевыпустить в [@BotFather](https://t.me/BotFather): `/revoke` или удалить и создать новый.
