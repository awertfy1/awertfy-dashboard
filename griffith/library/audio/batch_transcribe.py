#!/usr/bin/env python3
"""Batch-transcribe all MP3s from drive_dl into griffith library transcripts."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from pathlib import Path

from faster_whisper import WhisperModel

SRC = Path("/workspace/konspect/drive_dl")
OUT = Path("/workspace/griffith/library/audio/transcripts")
STATE = Path("/workspace/griffith/library/audio/batch_state.json")
LOG = Path("/workspace/griffith/library/audio/batch.log")

OUT.mkdir(parents=True, exist_ok=True)


def slugify(name: str) -> str:
    stem = Path(name).stem
    stem = stem.replace("№", "N").replace(",", "")
    stem = re.sub(r"\s+", "_", stem)
    stem = re.sub(r"[^\w\-а-яА-ЯёЁ]+", "_", stem, flags=re.UNICODE)
    stem = re.sub(r"_+", "_", stem).strip("_")
    return stem[:120] or "untitled"


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf-8"))
    return {"done": {}, "failed": {}}


def save_state(state: dict) -> None:
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def log(msg: str) -> None:
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def main() -> int:
    files = sorted(
        list(SRC.glob("*.MP3")) + list(SRC.glob("*.mp3")),
        key=lambda p: (duration(p), p.name.lower()),  # short first
    )
    state = load_state()
    log(f"files={len(files)} loading model=small")
    model = WhisperModel("small", device="cpu", compute_type="int8")

    for i, audio in enumerate(files, 1):
        key = audio.name
        out_path = OUT / f"{slugify(key)}.md"
        if key in state["done"] and out_path.exists() and out_path.stat().st_size > 200:
            log(f"[{i}/{len(files)}] SKIP {key}")
            continue
        try:
            d = duration(audio)
            log(f"[{i}/{len(files)}] START {key} ({d/60:.1f} min)")
            t0 = time.time()
            segments, info = model.transcribe(
                str(audio),
                language="ru",
                vad_filter=True,
            )
            timed = []
            plain = []
            for seg in segments:
                m = int(seg.start // 60)
                s = int(seg.start % 60)
                text = seg.text.strip()
                if not text:
                    continue
                timed.append(f"[{m:02d}:{s:02d}] {text}")
                plain.append(text)
            body = "\n".join(timed)
            full = " ".join(plain)
            md = (
                f"# {Path(key).stem}\n\n"
                f"Источник: Google Drive / `{key}`\n"
                f"Длительность: {d/60:.1f} мин\n"
                f"Язык: {info.language}\n\n"
                f"## По времени\n\n{body}\n\n"
                f"## Сплошной текст\n\n{full}\n"
            )
            out_path.write_text(md, encoding="utf-8")
            elapsed = time.time() - t0
            state["done"][key] = {
                "out": str(out_path),
                "chars": len(full),
                "minutes": round(d / 60, 2),
                "elapsed_sec": round(elapsed, 1),
            }
            save_state(state)
            log(
                f"[{i}/{len(files)}] DONE {key} chars={len(full)} "
                f"wall={elapsed/60:.1f}m out={out_path.name}"
            )
        except Exception as e:
            state.setdefault("failed", {})[key] = str(e)
            save_state(state)
            log(f"[{i}/{len(files)}] FAIL {key}: {e}")

    log(f"COMPLETE done={len(state['done'])} failed={len(state.get('failed', {}))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
