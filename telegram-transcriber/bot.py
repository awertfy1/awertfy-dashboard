#!/usr/bin/env python3
"""Telegram bot: voice/audio/video -> transcription as .txt file."""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from aiogram import Bot, Dispatcher, F
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandStart
from aiogram.types import BufferedInputFile, Message
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
log = logging.getLogger("transcriber")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
LANGUAGE = os.getenv("LANGUAGE", "ru").strip() or "ru"
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small").strip() or "small"
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu").strip() or "cpu"
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8").strip() or "int8"

ALLOWED_USER_IDS = {
    int(x.strip())
    for x in os.getenv("ALLOWED_USER_IDS", "").split(",")
    if x.strip().isdigit()
}

if not TOKEN:
    raise SystemExit("TELEGRAM_BOT_TOKEN is missing. Put it in .env")

if not ALLOWED_USER_IDS:
    raise SystemExit("ALLOWED_USER_IDS is missing. Put your Telegram user id in .env")

if shutil.which("ffmpeg") is None:
    raise SystemExit("ffmpeg not found. On macOS: brew install ffmpeg")

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Whisper is loaded in a background thread after polling starts.
_model = None
_model_error: str | None = None
_model_ready = asyncio.Event()
_model_lock = asyncio.Lock()

TMP_ROOT = Path(__file__).resolve().parent / "tmp"
TMP_ROOT.mkdir(exist_ok=True)


def is_allowed(user_id: int | None) -> bool:
    return user_id is not None and user_id in ALLOWED_USER_IDS


def _load_model_sync():
    """Blocking Whisper load (runs in a worker thread)."""
    from faster_whisper import WhisperModel

    log.info(
        "Loading Whisper model=%s device=%s compute=%s (can take several minutes first time)",
        WHISPER_MODEL,
        WHISPER_DEVICE,
        WHISPER_COMPUTE_TYPE,
    )
    model = WhisperModel(
        WHISPER_MODEL,
        device=WHISPER_DEVICE,
        compute_type=WHISPER_COMPUTE_TYPE,
    )
    log.info("Whisper model ready")
    return model


async def ensure_model_ready(message: Message) -> bool:
    """Wait until model is loaded; tell the user if still downloading."""
    if _model_ready.is_set() and _model is not None:
        return True
    if _model_error:
        await message.answer(f"Модель не загрузилась: {_model_error}")
        return False

    await message.answer(
        "Модель ещё загружается (первый раз это нормально, 2–10 минут).\n"
        "Как будет готова — напишите /ready или пришлите файл ещё раз."
    )
    try:
        await asyncio.wait_for(_model_ready.wait(), timeout=1.0)
    except TimeoutError:
        return False
    return _model is not None


def extract_audio(src: Path, dst_wav: Path) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(src),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        str(dst_wav),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-800:] or "ffmpeg failed")


def transcribe_file(media_path: Path) -> str:
    if _model is None:
        raise RuntimeError("Whisper model is not loaded yet")

    wav_path = media_path.with_suffix(".wav")
    try:
        extract_audio(media_path, wav_path)
        segments, _info = _model.transcribe(
            str(wav_path),
            language=LANGUAGE,
            vad_filter=True,
            beam_size=5,
        )
        text = "\n".join(seg.text.strip() for seg in segments if seg.text.strip())
        return text.strip()
    finally:
        if wav_path.exists():
            wav_path.unlink(missing_ok=True)


async def download_telegram_file(file_id: str, suffix: str) -> Path:
    try:
        file = await bot.get_file(file_id)
    except TelegramBadRequest as exc:
        # Official Bot API cannot download files larger than ~20 MB.
        if "file is too big" in str(exc).lower():
            raise RuntimeError(
                "Файл больше 20 МБ — лимит Telegram для ботов.\n"
                "Сожмите аудио или разрежьте на части покороче и пришлите снова."
            ) from exc
        raise

    if not file.file_path:
        raise RuntimeError("Telegram did not return file_path")

    if file.file_size and file.file_size > 20 * 1024 * 1024:
        raise RuntimeError(
            "Файл больше 20 МБ — лимит Telegram для ботов.\n"
            "Сожмите аудио или разрежьте на части покороче и пришлите снова."
        )

    workdir = Path(tempfile.mkdtemp(prefix="tg_", dir=TMP_ROOT))
    dest = workdir / f"input{suffix}"
    await bot.download_file(file.file_path, destination=dest)
    return dest


async def handle_media(message: Message, file_id: str, suffix: str, label: str) -> None:
    user_id = message.from_user.id if message.from_user else None
    log.info("Incoming %s from user_id=%s chat_id=%s", label, user_id, message.chat.id)

    if not is_allowed(user_id):
        await message.answer("Доступ запрещён.")
        return

    if not await ensure_model_ready(message):
        return

    status = await message.answer(f"Принял {label}. Расшифровываю…")
    media_path: Path | None = None

    try:
        media_path = await download_telegram_file(file_id, suffix)
        text = await asyncio.to_thread(transcribe_file, media_path)

        if not text:
            await status.edit_text("Речь не распознана (тишина или очень шумно).")
            return

        filename = f"transcript_{message.message_id}.txt"
        doc = BufferedInputFile(text.encode("utf-8"), filename=filename)
        await message.answer_document(
            document=doc,
            caption="Готово. Текст в файле.",
        )
        await status.delete()
    except Exception as exc:  # noqa: BLE001 — show user-friendly error
        log.exception("Transcription failed")
        await status.edit_text(f"Ошибка: {exc}")
    finally:
        if media_path is not None:
            shutil.rmtree(media_path.parent, ignore_errors=True)


@dp.message(CommandStart())
async def cmd_start(message: Message) -> None:
    user_id = message.from_user.id if message.from_user else None
    log.info("/start from user_id=%s", user_id)
    if not is_allowed(user_id):
        await message.answer(f"Доступ запрещён. Ваш id: {user_id}")
        return

    ready = "готова ✅" if _model_ready.is_set() and _model is not None else "ещё загружается ⏳"
    await message.answer(
        f"Бот онлайн. Модель: {ready}\n\n"
        "Пришлите голосовое, аудио (mp3), видео или кружок.\n"
        "Отвечу .txt файлом с расшифровкой.\n\n"
        "Лимит Telegram: файл до 20 МБ."
    )


@dp.message(Command("ready"))
async def cmd_ready(message: Message) -> None:
    if not is_allowed(message.from_user.id if message.from_user else None):
        await message.answer("Доступ запрещён.")
        return
    if _model_error:
        await message.answer(f"Ошибка загрузки модели: {_model_error}")
    elif _model_ready.is_set() and _model is not None:
        await message.answer("Модель готова. Можно присылать файлы.")
    else:
        await message.answer("Модель ещё загружается. Подождите и снова /ready")


@dp.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await cmd_start(message)


@dp.message(F.voice)
async def on_voice(message: Message) -> None:
    assert message.voice
    await handle_media(message, message.voice.file_id, ".ogg", "голосовое")


@dp.message(F.audio)
async def on_audio(message: Message) -> None:
    assert message.audio
    suffix = Path(message.audio.file_name or "audio.mp3").suffix or ".mp3"
    await handle_media(message, message.audio.file_id, suffix, "аудио")


@dp.message(F.video)
async def on_video(message: Message) -> None:
    assert message.video
    suffix = Path(message.video.file_name or "video.mp4").suffix or ".mp4"
    await handle_media(message, message.video.file_id, suffix, "видео")


@dp.message(F.video_note)
async def on_video_note(message: Message) -> None:
    assert message.video_note
    await handle_media(message, message.video_note.file_id, ".mp4", "кружок")


@dp.message(F.document)
async def on_document(message: Message) -> None:
    assert message.document
    name = (message.document.file_name or "").lower()
    mime = (message.document.mime_type or "").lower()
    audio_ext = {".ogg", ".oga", ".mp3", ".m4a", ".wav", ".flac", ".aac", ".opus"}
    video_ext = {".mp4", ".mov", ".mkv", ".webm", ".avi"}
    suffix = Path(name).suffix.lower()

    is_media = (
        suffix in audio_ext
        or suffix in video_ext
        or mime.startswith("audio/")
        or mime.startswith("video/")
    )
    if not is_media:
        if is_allowed(message.from_user.id if message.from_user else None):
            await message.answer(
                "Пришлите аудио/видео файл (ogg, mp3, wav, m4a, mp4, mov…)."
            )
        return

    label = "видеофайл" if (suffix in video_ext or mime.startswith("video/")) else "аудиофайл"
    await handle_media(message, message.document.file_id, suffix or ".bin", label)


@dp.message()
async def on_other(message: Message) -> None:
    user_id = message.from_user.id if message.from_user else None
    log.info("Unhandled message from user_id=%s content_type=%s", user_id, message.content_type)
    if not is_allowed(user_id):
        return
    await message.answer(
        "Я принимаю только голосовые / аудио / видео / кружки / mp3-файлы.\n"
        "Напишите /start"
    )


async def _preload_model() -> None:
    global _model, _model_error
    try:
        loaded = await asyncio.to_thread(_load_model_sync)
        _model = loaded
        log.info("Background model preload finished OK")
    except Exception as exc:  # noqa: BLE001
        _model_error = str(exc)
        log.exception("Background model preload failed")
    finally:
        _model_ready.set()


async def main() -> None:
    me = await bot.get_me()
    log.info(
        "Bot @%s starting polling NOW. Allowed users: %s",
        me.username,
        sorted(ALLOWED_USER_IDS),
    )
    log.info("Whisper will load in background — do not close this window")

    # Start model download/load without blocking Telegram updates.
    asyncio.create_task(_preload_model())

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
