#!/usr/bin/env python3
"""
Groq Word-by-Word Caption Generator for Adobe Premiere Pro CEP Plugin
Zero Word Stacking Engine: Strictly single-line, non-overlapping, continuous word-by-word subtitles.
Includes robust Windows Schannel TLS fallback, pre-verification, and secure credential handling.
"""

import os
import sys
import json
import argparse
import tempfile
import subprocess
import re
import uuid
import urllib.request
import urllib.error
import ssl
import socket
import shutil
from pathlib import Path

DEFAULT_API_KEY = ""
GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"
MAX_FILE_BYTES = 24 * 1024 * 1024  # 24MB safety limit (Groq max is 25MB)

def get_home_dir():
    try:
        return Path.home()
    except Exception:
        user_prof = os.environ.get("USERPROFILE") or os.environ.get("HOME")
        return Path(user_prof) if user_prof else Path("C:/")

# Ensure FFmpeg from common locations is available in PATH
for extra_path in [
    get_home_dir() / "Desktop" / "Video silence reomver" / ".venv" / "Scripts",
    get_home_dir() / "Desktop" / "Video silence remover" / ".venv" / "Scripts",
]:
    if extra_path.exists():
        p_str = str(extra_path)
        if p_str not in os.environ.get("PATH", ""):
            os.environ["PATH"] = p_str + os.pathsep + os.environ.get("PATH", "")


def mask_api_key(key):
    """Safely mask a Groq API key for logging and error reporting."""
    if not key or not isinstance(key, str):
        return "[not configured]"
    k = key.strip().strip('"').strip("'")
    if not k:
        return "[not configured]"
    if len(k) <= 8:
        return k[:3] + "***"
    return f"{k[:4]}...{k[-4:]} ({len(k)} chars)"


def redact_key(text, key=None):
    """Ensure no raw API key appears in exception strings or logs."""
    if not text:
        return ""
    text_str = str(text)
    if key and len(key) >= 8:
        text_str = text_str.replace(key, mask_api_key(key))
    # General regex to scrub any 20+ char gsk_ token
    text_str = re.sub(r'gsk_[A-Za-z0-9_-]{16,}', lambda m: m.group(0)[:6] + '...' + m.group(0)[-4:], text_str)
    return text_str


def get_shared_config():
    """Load configuration from Uniprae shared configuration layer."""
    config_path = os.environ.get("UNIPRAE_CONFIG_PATH")
    if not config_path:
        local_app = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        config_path = Path(local_app) / "Uniprae" / "settings.json"
    else:
        config_path = Path(config_path)

    if config_path.exists():
        try:
            return json.loads(config_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    fallback = Path(tempfile.gettempdir()) / "uniprae-settings.json"
    if fallback.exists():
        try:
            return json.loads(fallback.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def get_api_key(cli_key=None):
    """Retrieve Groq API key with priority: CLI -> Shared Config -> ENV -> .env file."""
    if cli_key and cli_key.strip():
        return cli_key.strip().strip('"').strip("'")

    shared = get_shared_config()
    cfg_key = shared.get("groqApiKey") or shared.get("groq_api_key") or shared.get("apiKey")
    if cfg_key and str(cfg_key).strip():
        return str(cfg_key).strip().strip('"').strip("'")

    key = os.environ.get("GROQ_API_KEY")
    if key and key.strip():
        return key.strip().strip('"').strip("'")

    # Check .env in same directory or parent directories
    for parent in [Path(__file__).parent, Path(__file__).parent.parent]:
        env_file = parent / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("GROQ_API_KEY="):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if val:
                        return val
    return DEFAULT_API_KEY


def verify_groq_key(api_key):
    """
    Pre-verify the Groq API key against Groq models API without exposing the key.
    Categorizes errors into Missing key, Invalid or revoked key, TLS failure, Network failure, Groq rate limit.
    """
    if not api_key or not str(api_key).strip():
        raise RuntimeError("Missing key: No Groq API key provided. Save your key in the Uniprae panel or set GROQ_API_KEY.")

    key = str(api_key).strip().strip('"').strip("'")
    if not key.startswith("gsk_") or len(key) < 20:
        raise RuntimeError(f"Invalid or revoked key: Groq API key format is invalid ({mask_api_key(key)}). Key must start with 'gsk_'.")

    # 1. Try Windows curl if present
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if curl:
        curl_args = [
            curl, "--silent", "--show-error", "--max-time", "15",
            "--user-agent", "Uniprae/1.0 (Adobe Premiere Pro)",
            "--header", f"Authorization: Bearer {key}",
            "--write-out", "\n%{http_code}", GROQ_MODELS_URL
        ]
        res = subprocess.run(curl_args, capture_output=True, text=True, timeout=20)
        out_text = res.stdout or ""
        body, _, status_text = out_text.rpartition("\n")
        try:
            status = int(status_text.strip())
        except ValueError:
            status = 0

        if res.returncode == 0:
            if status == 200:
                return True
            elif status in (401, 403):
                raise RuntimeError(f"Invalid or revoked key: Groq rejected the API key (HTTP {status} invalid_api_key). Check or update your key in the Uniprae panel.")
            elif status == 429:
                raise RuntimeError("Groq rate limit: Groq API rate limit or quota reached (HTTP 429). Please wait before retrying.")
            else:
                raise RuntimeError(f"Groq API error ({status}): {redact_key(body, key)}")
        else:
            err_msg = (res.stderr or body).strip()
            # If not a transport-level error like Schannel/SEC_E_NO_CREDENTIALS, handle network failure
            is_transport = any(t in err_msg for t in ["SEC_E_NO_CREDENTIALS", "AcquireCredentialsHandle", "schannel", "SSL", "handshake"])
            if not is_transport:
                if any(t in err_msg for t in ["Could not resolve", "Failed to connect", "timed out"]):
                    raise RuntimeError(f"Network failure: Unable to reach api.groq.com ({err_msg}). Check your internet connection.")

    # 2. Python urllib HTTPS fallback
    req = urllib.request.Request(
        GROQ_MODELS_URL,
        headers={
            "Authorization": f"Bearer {key}",
            "User-Agent": "Uniprae/1.0 (Adobe Premiere Pro)",
            "Accept": "application/json"
        },
        method="GET"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                return True
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        if error.code in (401, 403):
            raise RuntimeError(f"Invalid or revoked key: Groq rejected the API key (HTTP {error.code} invalid_api_key). Check or update your key in the Uniprae panel.")
        elif error.code == 429:
            raise RuntimeError("Groq rate limit: Groq API rate limit or quota reached (HTTP 429). Please wait before retrying.")
        else:
            raise RuntimeError(f"Groq API error ({error.code}): {redact_key(detail, key)}")
    except urllib.error.URLError as error:
        if isinstance(error.reason, ssl.SSLError) or "SSL" in str(error.reason):
            raise RuntimeError(f"TLS failure: Secure connection to Groq failed ({error.reason}).")
        raise RuntimeError(f"Network failure: Unable to reach api.groq.com ({error.reason}). Check your internet connection.")
    except (socket.timeout, TimeoutError):
        raise RuntimeError("Network failure: Connection to api.groq.com timed out.")
    return True


def get_media_duration(file_path):
    """Get media duration in seconds using ffprobe."""
    try:
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(file_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except Exception:
        return None


def format_timestamp(seconds):
    """Convert seconds to standard SRT timestamp format: HH:MM:SS,mmm"""
    if seconds < 0:
        seconds = 0.0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        secs += millis // 1000
        millis %= 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def call_groq_api(file_path, api_key, model="whisper-large-v3", language=None, prompt=None):
    """Send audio file to Groq Whisper API and request word-level timestamps."""
    if model != "whisper-large-v3":
        model = "whisper-large-v3"

    fields = [
        ("model", model),
        ("response_format", "verbose_json"),
        ("timestamp_granularities[]", "word"),
    ]
    if language and language.lower() not in ["auto", ""]:
        fields.append(("language", language))
    if prompt:
        fields.append(("prompt", prompt))

    # Transport 1: System curl on Windows
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if curl:
        curl_args = [
            curl, "--silent", "--show-error", "--max-time", "300",
            "--user-agent", "Uniprae/1.0 (Adobe Premiere Pro)",
            "--header", f"Authorization: Bearer {api_key}",
            "--form", f"file=@{file_path}",
        ]
        for name, value in fields:
            curl_args.extend(["--form", f"{name}={value}"])
        curl_args.extend(["--write-out", "\n%{http_code}", GROQ_URL])
        result = subprocess.run(curl_args, capture_output=True, text=True, timeout=320)
        response_text = result.stdout or ""
        body, _, status_text = response_text.rpartition("\n")
        try:
            status = int(status_text.strip())
        except ValueError:
            status = 0

        if result.returncode == 0:
            if status == 200:
                try:
                    return json.loads(body)
                except Exception as ex:
                    raise RuntimeError(f"Groq response JSON parse error: {ex}")
            elif status in (401, 403):
                raise RuntimeError(f"Invalid or revoked key: Groq rejected the API key (HTTP {status} invalid_api_key). Check or update your key in the Uniprae panel.")
            elif status == 429:
                raise RuntimeError("Groq rate limit: Groq API rate limit reached (HTTP 429). Please wait before retrying.")
            else:
                raise RuntimeError(f"Groq API error ({status}): {redact_key(body, api_key)}")
        else:
            transport_error = (result.stderr or body).strip()
            is_transport_failure = any(term in transport_error for term in [
                "SEC_E_NO_CREDENTIALS", "AcquireCredentialsHandle", "schannel",
                "SSL", "handshake failure", "certificate", "curl: (35)", "curl: (60)"
            ])
            if not is_transport_failure:
                if any(t in transport_error for t in ["Could not resolve", "Failed to connect", "timed out"]):
                    raise RuntimeError(f"Network failure: Groq upload failed ({transport_error})")

    # Transport 2: Python urllib HTTPS fallback
    boundary = "----AdobeMCP" + uuid.uuid4().hex
    chunks = []
    for name, value in fields:
        chunks.extend([
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
            str(value).encode("utf-8"), b"\r\n",
        ])
    with open(file_path, "rb") as media:
        chunks.extend([
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(file_path)}"\r\n'.encode(),
            b"Content-Type: application/octet-stream\r\n\r\n",
            media.read(), b"\r\n",
        ])
    chunks.append(f"--{boundary}--\r\n".encode())
    request = urllib.request.Request(
        GROQ_URL,
        data=b"".join(chunks),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
            "User-Agent": "Uniprae/1.0 (Adobe Premiere Pro)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        if error.code in (401, 403):
            raise RuntimeError(f"Invalid or revoked key: Groq rejected the API key (HTTP {error.code} invalid_api_key). Check or update your key in the Uniprae panel.")
        elif error.code == 429:
            raise RuntimeError("Groq rate limit: Groq API rate limit reached (HTTP 429). Please wait before retrying.")
        else:
            raise RuntimeError(f"Groq API error ({error.code}): {redact_key(detail, api_key)}")
    except urllib.error.URLError as error:
        if isinstance(error.reason, ssl.SSLError) or "SSL" in str(error.reason):
            raise RuntimeError(f"TLS failure: Secure connection to Groq failed ({error.reason}).")
        raise RuntimeError(f"Network failure: Unable to reach api.groq.com ({error.reason}). Check your internet connection.")
    except (socket.timeout, TimeoutError):
        raise RuntimeError("Network failure: Connection to api.groq.com timed out.")


def clean_word_text(text, strip_punctuation=False, casing="uppercase"):
    """
    Cleans text and strictly prevents any word stacking:
    1. Removes all line breaks (single-line guarantee, never stacked vertically)
    2. Strips punctuation if enabled (for clean viral 1-word cuts)
    3. Applies casing (uppercase, lowercase, titlecase, or original)
    """
    if not text:
        return ""
    # ZERO VERTICAL STACKING: replace all newlines with a single space
    cleaned = " ".join(text.split())

    if strip_punctuation:
        cleaned = re.sub(r'^[^\w\s\']+|[^\w\s\']+$', '', cleaned).strip()

    c = (casing or "uppercase").lower()
    if c == "uppercase":
        return cleaned.upper()
    elif c == "lowercase":
        return cleaned.lower()
    elif c == "titlecase":
        return cleaned.title()
    elif c in ["gencaption", "original", "sentence"]:
        return cleaned
    return cleaned


def format_subtitles(res_json, style="word", casing="uppercase", strip_punctuation=False, offset_seconds=0.0, starting_index=1):
    """
    Convert Groq Whisper output into non-overlapping, zero-stacking, flicker-free SRT blocks.
    Guarantees:
    1. ZERO VERTICAL STACKING: strictly 1 horizontal line per subtitle.
    2. ZERO TEMPORAL STACKING: end_i <= start_{i+1} - 0.001s always.
    3. FLICKER-FREE: consecutive words within a phrase connect seamlessly.
    """
    words = res_json.get("words", [])
    segments = res_json.get("segments", [])

    if style == "sentence" or not words:
        blocks = []
        idx = starting_index
        for seg in segments:
            raw_text = seg.get("text", "").strip()
            if not raw_text:
                continue
            text = clean_word_text(raw_text, strip_punctuation=strip_punctuation, casing=casing)
            if not text:
                continue
            start_ts = float(seg.get("start", 0.0)) + offset_seconds
            end_ts = float(seg.get("end", start_ts + 1.0)) + offset_seconds
            if end_ts <= start_ts:
                end_ts = start_ts + 0.5
            blocks.append(f"{idx}\n{format_timestamp(start_ts)} --> {format_timestamp(end_ts)}\n{text}\n")
            idx += 1
        return "\n".join(blocks), idx

    word_items = []
    for w in words:
        raw_text = w.get("word", "").strip()
        if not raw_text:
            continue
        cleaned = clean_word_text(raw_text, strip_punctuation=strip_punctuation, casing=casing)
        if not cleaned:
            continue
        s = float(w.get("start", 0.0))
        e = float(w.get("end", s + 0.15))
        if e <= s:
            e = s + 0.10
        word_items.append({"text": cleaned, "start": s, "end": e})

    if not word_items:
        return "", starting_index

    n = len(word_items)
    for i in range(n):
        if i > 0 and word_items[i]["start"] < word_items[i-1]["start"] + 0.04:
            word_items[i]["start"] = word_items[i-1]["start"] + 0.04
        if word_items[i]["end"] <= word_items[i]["start"]:
            word_items[i]["end"] = word_items[i]["start"] + 0.10

    if style == "word":
        max_words = 1
        max_pause = 0.25
    elif style == "word_2":
        max_words = 2
        max_pause = 0.35
    elif style == "tiktok":
        max_words = 3
        max_pause = 0.45
    else:  # phrase
        max_words = 5
        max_pause = 0.60

    groups = []
    curr_group = []
    last_end = None

    for w in word_items:
        w_start = w["start"]
        w_end = w["end"]
        pause = (w_start - last_end) if last_end is not None else 0.0

        should_split = False
        if len(curr_group) >= max_words:
            should_split = True
        elif pause > max_pause and len(curr_group) > 0:
            should_split = True
        elif curr_group and not strip_punctuation and any(curr_group[-1]["text"].endswith(p) for p in [".", "!", "?", ","]):
            should_split = True

        if should_split and curr_group:
            groups.append(curr_group)
            curr_group = []

        curr_group.append(w)
        last_end = w_end

    if curr_group:
        groups.append(curr_group)

    blocks = []
    idx = starting_index
    num_groups = len(groups)

    for g_idx in range(num_groups):
        grp = groups[g_idx]
        g_start = grp[0]["start"]
        g_end = grp[-1]["end"]
        g_text = " ".join(item["text"] for item in grp)

        if g_end < g_start + 0.09:
            g_end = g_start + 0.09

        if g_idx < num_groups - 1:
            next_start = groups[g_idx + 1][0]["start"]
            if g_end >= next_start:
                g_end = max(g_start + 0.06, next_start - 0.001)
                if next_start <= g_start + 0.06:
                    groups[g_idx + 1][0]["start"] = g_start + 0.07
                    next_start = groups[g_idx + 1][0]["start"]
                    g_end = next_start - 0.001
            else:
                gap = next_start - g_end
                if gap <= 0.30:
                    g_end = next_start - 0.001
                else:
                    g_end = min(g_end + 0.10, next_start - 0.04)
        else:
            g_end = max(g_end + 0.15, g_start + 0.30)

        s_ts = g_start + offset_seconds
        e_ts = g_end + offset_seconds
        blocks.append(f"{idx}\n{format_timestamp(s_ts)} --> {format_timestamp(e_ts)}\n{g_text}\n")
        idx += 1

    return "\n".join(blocks), idx


def convert_to_optimized_audio(input_path, output_path, start_time=None, duration=None):
    """Convert media to lightweight mono MP3 (16kHz, 32k) for ultra-fast API uploads."""
    cmd = ["ffmpeg", "-y"]
    if start_time is not None:
        cmd.extend(["-ss", str(start_time)])
    if duration is not None:
        cmd.extend(["-t", str(duration)])
    cmd.extend([
        "-i", str(input_path),
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-b:a", "32k",
        "-f", "mp3",
        str(output_path)
    ])
    subprocess.run(cmd, capture_output=True, check=True)


def transcribe_media(input_file, output_srt=None, model="whisper-large-v3", language=None, style="word", casing="uppercase", strip_punctuation=False, api_key=None):
    input_path = Path(input_file).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if output_srt is None:
        output_path = input_path.with_suffix(".srt")
    else:
        output_path = Path(output_srt).resolve()

    key = get_api_key(api_key)
    if not key:
        raise RuntimeError("Missing key: No Groq API key provided. Please configure your key in the panel or set GROQ_API_KEY.")

    # Pre-verify key before heavy media processing
    verify_groq_key(key)

    file_size = input_path.stat().st_size
    is_audio = input_path.suffix.lower() in [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"]

    all_srt_blocks = []
    current_index = 1

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)

        if is_audio and file_size <= MAX_FILE_BYTES:
            print(f"Uploading '{input_path.name}' ({file_size / 1024 / 1024:.2f} MB) to Groq Whisper ({model})...")
            res_json = call_groq_api(str(input_path), key, model=model, language=language)
            srt_part, current_index = format_subtitles(
                res_json, style=style, casing=casing, strip_punctuation=strip_punctuation, offset_seconds=0.0, starting_index=current_index
            )
            all_srt_blocks.append(srt_part)
        else:
            print(f"Optimizing audio with FFmpeg...")
            opt_audio = temp_dir_path / "optimized.mp3"
            convert_to_optimized_audio(input_path, opt_audio)
            opt_size = opt_audio.stat().st_size

            if opt_size <= MAX_FILE_BYTES:
                print(f"Audio optimized ({opt_size / 1024 / 1024:.2f} MB). Transcribing with Groq ({model})...")
                res_json = call_groq_api(str(opt_audio), key, model=model, language=language)
                srt_part, current_index = format_subtitles(
                    res_json, style=style, casing=casing, strip_punctuation=strip_punctuation, offset_seconds=0.0, starting_index=current_index
                )
                all_srt_blocks.append(srt_part)
            else:
                total_duration = get_media_duration(opt_audio) or get_media_duration(input_path)
                if not total_duration:
                    raise RuntimeError("Failed to determine audio duration for segment chunking.")

                chunk_duration = 1200  # 20-minute chunks
                print(f"Audio duration: {total_duration / 60:.1f} minutes. Processing in chunks...")

                offset = 0.0
                while offset < total_duration:
                    chunk_file = temp_dir_path / f"chunk_{int(offset)}.mp3"
                    dur = min(chunk_duration, total_duration - offset)
                    print(f"Transcribing segment {int(offset//60)}m - {int((offset+dur)//60)}m...")
                    convert_to_optimized_audio(input_path, chunk_file, start_time=offset, duration=dur)
                    res_json = call_groq_api(str(chunk_file), key, model=model, language=language)

                    shifted_srt, current_index = format_subtitles(
                        res_json, style=style, casing=casing, strip_punctuation=strip_punctuation, offset_seconds=offset, starting_index=current_index
                    )
                    all_srt_blocks.append(shifted_srt)
                    offset += dur

    srt_content = "\n\n".join(b.strip() for b in all_srt_blocks if b.strip()) + "\n"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(srt_content, encoding="utf-8")
    print(f"\n[Success] Subtitles saved: {output_path}")
    return output_path


def transcribe_from_clips(clips_file, output_srt, model="whisper-large-v3", language=None, style="word", casing="uppercase", strip_punctuation=False, api_key=None):
    """
    Transcribes audio slices from timeline clips while preserving exact timeline positioning and silence gaps.
    """
    key = get_api_key(api_key)
    if not key:
        raise RuntimeError("Missing key: No Groq API key provided. Please configure your key in the panel or set GROQ_API_KEY.")

    verify_groq_key(key)

    clips_data = json.loads(Path(clips_file).read_text(encoding="utf-8"))
    if not clips_data:
        raise ValueError("Clips list is empty.")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        clips_data.sort(key=lambda c: c.get("start", 0))

        concat_list_file = temp_dir_path / "concat.txt"
        concat_lines = []
        current_timeline_pos = 0.0

        for idx, c in enumerate(clips_data):
            src_path = Path(c["path"])
            clip_start = c.get("start", 0.0)
            clip_end = c.get("end", clip_start)
            clip_dur = clip_end - clip_start
            in_pt = c.get("inPoint", 0.0)

            gap = clip_start - current_timeline_pos
            if gap > 0.05:
                silence_file = temp_dir_path / f"silence_{idx}.mp3"
                subprocess.run([
                    "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono",
                    "-t", str(gap), "-b:a", "32k", "-f", "mp3", str(silence_file)
                ], capture_output=True, check=True)
                concat_lines.append(f"file '{silence_file.as_posix()}'")
                current_timeline_pos += gap

            slice_audio = temp_dir_path / f"slice_{idx}.mp3"
            cmd = ["ffmpeg", "-y"]
            if in_pt > 0:
                cmd.extend(["-ss", str(in_pt)])
            if clip_dur > 0:
                cmd.extend(["-t", str(clip_dur)])
            cmd.extend([
                "-i", str(src_path),
                "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k",
                "-f", "mp3", str(slice_audio)
            ])
            subprocess.run(cmd, capture_output=True, check=True)
            concat_lines.append(f"file '{slice_audio.as_posix()}'")
            current_timeline_pos += clip_dur

        concat_list_file.write_text("\n".join(concat_lines), encoding="utf-8")
        merged_audio = temp_dir_path / "timeline_master.mp3"
        subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(concat_list_file), "-c", "copy", str(merged_audio)
        ], capture_output=True, check=True)

        return transcribe_media(
            str(merged_audio), output_srt, model=model, language=language,
            style=style, casing=casing, strip_punctuation=strip_punctuation, api_key=key
        )


if __name__ == "__main__":
    shared = get_shared_config()
    default_style = shared.get("captionStyle", "word")
    default_casing = shared.get("captionCasing", "uppercase")
    default_lang = shared.get("captionLanguage")
    default_strip_punc = (shared.get("captionPunctuation") == "strip")

    parser = argparse.ArgumentParser(description="Groq Word-by-Word Caption Engine for Premiere Pro")
    parser.add_argument("input", nargs="?", default=None, help="Path to input audio/video file")
    parser.add_argument("--clips", help="Path to JSON file containing timeline clips metadata")
    parser.add_argument("-o", "--output", default=None, help="Path to output .srt file")
    parser.add_argument("-m", "--model", default="whisper-large-v3", help="Groq model (default: whisper-large-v3)")
    parser.add_argument("-l", "--language", default=default_lang, help="Language code or auto")
    parser.add_argument("-s", "--style", default=default_style, choices=["word", "word_2", "tiktok", "phrase", "sentence"],
                        help="Caption pacing: 'word' (1 word), 'word_2' (2 words), 'tiktok' (2-3 words), 'phrase' (4-5 words), 'sentence'")
    parser.add_argument("-c", "--casing", default=default_casing, choices=["uppercase", "gencaption", "lowercase", "titlecase"],
                        help="Letter casing: 'uppercase' (ALL CAPS), 'gencaption', 'lowercase', 'titlecase'")
    parser.add_argument("--strip-punctuation", action="store_true", default=default_strip_punc,
                        help="Strip punctuation for clean viral 1-word captions (recommended for word mode)")
    parser.add_argument("--api-key", default=None, help="Groq API key override")
    parser.add_argument("--verify-only", action="store_true", help="Verify the Groq API key and exit")

    # Backward compatibility flags
    parser.add_argument("--layout", default="spread", help="Deprecated layout option (forced to spread/single-line)")
    parser.add_argument("-u", "--uppercase", action="store_true", help="Shortcut for --casing uppercase")

    args = parser.parse_args()
    casing_choice = "uppercase" if args.uppercase else args.casing
    target_key = get_api_key(args.api_key)

    try:
        if args.verify_only:
            verify_groq_key(target_key)
            print(json.dumps({"success": True, "verified": True, "keyMask": mask_api_key(target_key)}))
            sys.exit(0)

        if args.clips:
            transcribe_from_clips(
                args.clips, args.output, model=args.model, language=args.language,
                style=args.style, casing=casing_choice, strip_punctuation=args.strip_punctuation,
                api_key=target_key
            )
        elif args.input:
            transcribe_media(
                args.input, args.output, model=args.model, language=args.language,
                style=args.style, casing=casing_choice, strip_punctuation=args.strip_punctuation,
                api_key=target_key
            )
        else:
            parser.print_help()
            sys.exit(1)
    except Exception as e:
        safe_msg = redact_key(str(e), target_key)
        print(f"[Error] {safe_msg}", file=sys.stderr)
        sys.exit(1)
