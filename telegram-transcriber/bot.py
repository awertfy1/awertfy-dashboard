#!/usr/bin/env python3
"""Telegram bot: voice/audio/video -> transcription as .txt file."""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from aiogram import Bot, Dispatcher, F
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.client.telegram import TelegramAPIServer
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

# Local Bot API removes the public 20 MB download limit (needs Docker + api_id/hash).
LOCAL_API_URL = os.getenv("LOCAL_API_URL", "").strip().rstrip("/")
USE_LOCAL_API = bool(LOCAL_API_URL)
# Large Telegram videos need a long download timeout (default aiogram is only 30s).
DOWNLOAD_TIMEOUT_SEC = int(os.getenv("DOWNLOAD_TIMEOUT_SEC", "1800"))

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

if USE_LOCAL_API:
    session = AiohttpSession(api=TelegramAPIServer.from_base(LOCAL_API_URL))
    bot = Bot(token=TOKEN, session=session)
    log.info("Using local Bot API: %s (large files OK)", LOCAL_API_URL)
else:
    bot = Bot(token=TOKEN)
    log.warning(
        "LOCAL_API_URL is empty — files over ~20 MB will fail. "
        "Run ./start_local_api.sh and set LOCAL_API_URL in .env"
    )

dp = Dispatcher()

# Whisper is loaded in a background thread after polling starts.
_model = None
_model_error: str | None = None
_model_ready = asyncio.Event()

TMP_ROOT = Path(__file__).resolve().parent / "tmp"
TMP_ROOT.mkdir(exist_ok=True)


@dataclass
class QueueJob:
    chat_id: int
    user_id: int
    message_id: int
    file_id: str
    suffix: str
    label: str
    number: int


job_queue: asyncio.Queue[QueueJob | None] = asyncio.Queue()
queue_lock = asyncio.Lock()
queued_total = 0
done_total = 0
failed_total = 0
current_job: QueueJob | None = None
# Jobs waiting in queue (not yet taken by worker), for /queue and /clear
pending_jobs: list[QueueJob] = []


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


def compress_to_wav(src: Path, dst_wav: Path) -> None:
    """Extract + compress audio to mono 16 kHz WAV for Whisper."""
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
        "-c:a",
        "pcm_s16le",
        str(dst_wav),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-800:] or "ffmpeg compress failed")


def transcribe_wav(wav_path: Path) -> str:
    if _model is None:
        raise RuntimeError("Whisper model is not loaded yet")

    segments, _info = _model.transcribe(
        str(wav_path),
        language=LANGUAGE,
        vad_filter=True,
        beam_size=5,
    )
    text = "\n".join(seg.text.strip() for seg in segments if seg.text.strip())
    return text.strip()


async def download_telegram_file(file_id: str, suffix: str) -> Path:
    try:
        file = await bot.get_file(file_id)
    except TelegramBadRequest as exc:
        if "file is too big" in str(exc).lower():
            raise RuntimeError(
                "Файл слишком большой для обычного Telegram API (~20 МБ).\n"
                "Нужен локальный Bot API: запустите ./start_local_api.sh "
                "и пропишите LOCAL_API_URL в .env, затем перезапустите бота."
            ) from exc
        raise

    if not file.file_path:
        raise RuntimeError("Telegram did not return file_path")

    # Public cloud API hard-limit. Local Bot API allows up to ~2 GB.
    if (
        not USE_LOCAL_API
        and file.file_size
        and file.file_size > 20 * 1024 * 1024
    ):
        raise RuntimeError(
            "Файл больше 20 МБ. Включите локальный Bot API "
            "(./start_local_api.sh + LOCAL_API_URL в .env)."
        )

    workdir = Path(tempfile.mkdtemp(prefix="tg_", dir=TMP_ROOT))
    dest = workdir / f"input{suffix}"

    # Scale timeout a bit with size, but keep a high floor for slow links.
    timeout = DOWNLOAD_TIMEOUT_SEC
    if file.file_size:
        # ~100 KB/s worst case + 5 min buffer
        sized = int(file.file_size / 100_000) + 300
        timeout = max(timeout, sized)
        timeout = min(timeout, 7200)

    log.info(
        "Downloading file (%s bytes), timeout=%ss",
        file.file_size if file.file_size is not None else "?",
        timeout,
    )
    try:
        await bot.download_file(
            file.file_path,
            destination=dest,
            timeout=timeout,
        )
    except TimeoutError as exc:
        raise RuntimeError(
            f"Скачивание прервалось по таймауту ({timeout} с).\n"
            "Файл слишком большой/медленный для бота.\n"
            "Надёжнее: скачайте видео в Telegram Desktop → "
            "сожмите в mp3 через ffmpeg → пришлите лёгкий mp3 боту."
        ) from exc

    log.info(
        "Downloaded %s (%s bytes)",
        dest.name,
        file.file_size if file.file_size is not None else "?",
    )
    return dest


async def process_job(job: QueueJob) -> None:
    global done_total, failed_total, current_job
    current_job = job
    waiting = len(pending_jobs)
    status = await bot.send_message(
        job.chat_id,
        f"#{job.number}: разбираю {job.label}…\n"
        f"В очереди ещё: {waiting}",
        reply_to_message_id=job.message_id,
    )
    media_path: Path | None = None

    try:
        if not _model_ready.is_set():
            await status.edit_text(f"#{job.number}: жду загрузки модели…")
            await _model_ready.wait()
        if _model_error or _model is None:
            raise RuntimeError(_model_error or "Модель не загружена")

        await status.edit_text(f"#{job.number}: скачиваю…")
        media_path = await download_telegram_file(job.file_id, job.suffix)

        await status.edit_text(f"#{job.number}: сжимаю…")
        wav_path = media_path.with_name("compressed.wav")
        await asyncio.to_thread(compress_to_wav, media_path, wav_path)

        await status.edit_text(f"#{job.number}: расшифровываю…")
        text = await asyncio.to_thread(transcribe_wav, wav_path)

        if not text:
            await status.edit_text(f"#{job.number}: речь не распознана.")
            failed_total += 1
            return

        filename = f"transcript_{job.number}_{job.message_id}.txt"
        doc = BufferedInputFile(text.encode("utf-8"), filename=filename)
        await bot.send_document(
            chat_id=job.chat_id,
            document=doc,
            caption=f"#{job.number}: готово.",
            reply_to_message_id=job.message_id,
        )
        await status.delete()
        done_total += 1
    except Exception as exc:  # noqa: BLE001
        log.exception("Job #%s failed", job.number)
        failed_total += 1
        try:
            await status.edit_text(f"#{job.number}: ошибка: {exc}")
        except Exception:  # noqa: BLE001
            pass
    finally:
        current_job = None
        if media_path is not None:
            shutil.rmtree(media_path.parent, ignore_errors=True)


async def queue_worker() -> None:
    log.info("Queue worker started")
    while True:
        job = await job_queue.get()
        try:
            if job is None:
                return
            async with queue_lock:
                if job in pending_jobs:
                    pending_jobs.remove(job)
            await process_job(job)
        finally:
            job_queue.task_done()


async def enqueue_media(message: Message, file_id: str, suffix: str, label: str) -> None:
    global queued_total
    user_id = message.from_user.id if message.from_user else None
    log.info("Enqueue %s from user_id=%s", label, user_id)

    if not is_allowed(user_id):
        await message.answer("Доступ запрещён.")
        return

    async with queue_lock:
        queued_total += 1
        number = queued_total
        job = QueueJob(
            chat_id=message.chat.id,
            user_id=user_id or 0,
            message_id=message.message_id,
            file_id=file_id,
            suffix=suffix,
            label=label,
            number=number,
        )
        pending_jobs.append(job)
        position = len(pending_jobs) + (1 if current_job else 0)

    await job_queue.put(job)
    await message.answer(
        f"Добавлено в очередь как #{number} ({label}).\n"
        f"Сейчас в ожидании: {position}\n"
        "Можете кидать следующие файлы — разберу по одному.\n"
        "/queue — статус, /clear — очистить очередь"
    )


@dp.message(CommandStart())
async def cmd_start(message: Message) -> None:
    user_id = message.from_user.id if message.from_user else None
    log.info("/start from user_id=%s", user_id)
    if not is_allowed(user_id):
        await message.answer(f"Доступ запрещён. Ваш id: {user_id}")
        return

    ready = "готова ✅" if _model_ready.is_set() and _model is not None else "ещё загружается ⏳"
    api_mode = (
        "локальный API (большие файлы OK) ✅"
        if USE_LOCAL_API
        else "облачный API (лимит ~20 МБ) ⚠️"
    )
    await message.answer(
        f"Бот онлайн.\nМодель: {ready}\nAPI: {api_mode}\n\n"
        "Кидайте много голосовых/аудио/видео подряд.\n"
        "Я складываю в очередь и разбираю по одному → .txt\n\n"
        "/queue — что в очереди\n"
        "/clear — очистить очередь\n"
        "/ready — готова ли модель"
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


@dp.message(Command("queue"))
async def cmd_queue(message: Message) -> None:
    if not is_allowed(message.from_user.id if message.from_user else None):
        await message.answer("Доступ запрещён.")
        return

    async with queue_lock:
        pending = list(pending_jobs)
        current = current_job

    lines = [
        f"Готово: {done_total}",
        f"Ошибки: {failed_total}",
        f"Всего принято: {queued_total}",
    ]
    if current:
        lines.append(f"Сейчас: #{current.number} ({current.label})")
    else:
        lines.append("Сейчас: ничего")

    if pending:
        preview = ", ".join(f"#{j.number}" for j in pending[:15])
        if len(pending) > 15:
            preview += f" … +{len(pending) - 15}"
        lines.append(f"В очереди ({len(pending)}): {preview}")
    else:
        lines.append("В очереди: пусто")

    await message.answer("\n".join(lines))


@dp.message(Command("clear"))
async def cmd_clear(message: Message) -> None:
    if not is_allowed(message.from_user.id if message.from_user else None):
        await message.answer("Доступ запрещён.")
        return

    removed = 0
    async with queue_lock:
        removed = len(pending_jobs)
        pending_jobs.clear()
        # Drain asyncio queue without touching the job currently processing.
        while True:
            try:
                job_queue.get_nowait()
                job_queue.task_done()
            except asyncio.QueueEmpty:
                break

    await message.answer(
        f"Очередь очищена ({removed} шт.).\n"
        "Текущий файл, если уже обрабатывается, доделается."
    )


@dp.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await cmd_start(message)


@dp.message(F.voice)
async def on_voice(message: Message) -> None:
    assert message.voice
    await enqueue_media(message, message.voice.file_id, ".ogg", "голосовое")


@dp.message(F.audio)
async def on_audio(message: Message) -> None:
    assert message.audio
    suffix = Path(message.audio.file_name or "audio.mp3").suffix or ".mp3"
    await enqueue_media(message, message.audio.file_id, suffix, "аудио")


@dp.message(F.video)
async def on_video(message: Message) -> None:
    assert message.video
    suffix = Path(message.video.file_name or "video.mp4").suffix or ".mp4"
    await enqueue_media(message, message.video.file_id, suffix, "видео")


@dp.message(F.video_note)
async def on_video_note(message: Message) -> None:
    assert message.video_note
    await enqueue_media(message, message.video_note.file_id, ".mp4", "кружок")


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
    await enqueue_media(message, message.document.file_id, suffix or ".bin", label)


@dp.message()
async def on_other(message: Message) -> None:
    user_id = message.from_user.id if message.from_user else None
    log.info("Unhandled message from user_id=%s content_type=%s", user_id, message.content_type)
    if not is_allowed(user_id):
        return
    await message.answer(
        "Кидайте аудио/видео файлы пачкой — я поставлю в очередь.\n"
        "/queue /clear /start"
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
        "Bot @%s starting polling NOW. Allowed users: %s | local_api=%s",
        me.username,
        sorted(ALLOWED_USER_IDS),
        USE_LOCAL_API,
    )
    log.info("Whisper will load in background — do not close this window")

    asyncio.create_task(_preload_model())
    asyncio.create_task(queue_worker())
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
