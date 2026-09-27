"""
silence_remover_ppro.py
CLI bridge script for Adobe Premiere Pro Video Silencer CEP Extension.
Interfaces with auto-editor to analyze media, remove silence, and generate
Premiere Pro XML with individual clipped cuts or rendered media.
"""

import sys
import os
import argparse
import subprocess
import json
import xml.etree.ElementTree as ET
from pathlib import Path
import tempfile
import importlib.util
import shutil

def get_home_dir():
    try:
        return Path.home()
    except Exception:
        user_prof = os.environ.get("USERPROFILE") or os.environ.get("HOME")
        return Path(user_prof) if user_prof else Path("C:/")


def get_shared_config():
    """Load configuration from Uniprae shared configuration layer."""
    config_path = os.environ.get("UNIPRAE_CONFIG_PATH")
    if not config_path:
        local_app = os.environ.get("LOCALAPPDATA") or str(get_home_dir() / "AppData" / "Local")
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


def extract_segments(xml_path):
    """Read retained source ranges, including NTSC time bases; never import a sequence."""
    sequence = ET.parse(xml_path).getroot().find("sequence")
    if sequence is None:
        raise ValueError("Missing sequence in silence analysis XML")
    def rate(element, fallback):
        info = element.find("rate")
        if info is None:
            return fallback
        value = float(info.findtext("timebase", str(fallback)))
        return value * 1000 / 1001 if info.findtext("ntsc", "FALSE").upper() == "TRUE" else value
    fps = rate(sequence, 30)
    track = sequence.find("media/video/track")
    if track is None or not track.findall("clipitem"):
        track = sequence.find("media/audio/track")
    if track is None:
        raise ValueError("No retained media ranges in analysis")
    segments = []
    for clip in track.findall("clipitem"):
        source_fps = rate(clip, fps)
        start = float(clip.findtext("in", "-1")) / source_fps
        end = float(clip.findtext("out", "-1")) / source_fps
        if start < 0 or end <= start:
            raise ValueError("Invalid retained source range")
        segments.append({"in": start, "out": end})
    if not segments:
        raise ValueError("No speech detected; timeline was not changed")
    return segments


def constrain_segments(segments, source_in=None, source_out=None, min_duration=0.04):
    """Clamp retained ranges to the selected Premiere clip's source interval."""
    start = max(0.0, float(source_in or 0.0))
    stop = float(source_out or 0.0)
    if stop <= start:
        return segments
    constrained = []
    for segment in segments:
        seg_start = max(start, float(segment["in"]))
        seg_stop = min(stop, float(segment["out"]))
        if seg_stop - seg_start >= min_duration:
            constrained.append({"in": seg_start, "out": seg_stop})
    if not constrained:
        raise ValueError("No speech was detected inside the selected clip range; timeline was not changed")
    return constrained


def get_ffprobe_duration(file_path):
    """Retrieve media duration in seconds using ffprobe."""
    try:
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return float(result.stdout.strip())
    except Exception:
        return None


def format_time(seconds):
    """Format seconds into HH:MM:SS or MM:SS."""
    if seconds is None:
        return "N/A"
    seconds = max(0, seconds)
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def get_auto_editor_bin():
    """Find the auto-editor executable."""
    base_dir = Path(__file__).resolve().parent
    configured = os.environ.get('ADOBE_MCP_AUTO_EDITOR')
    if configured:
        if not Path(configured).is_file():
            raise ValueError('ADOBE_MCP_AUTO_EDITOR does not point to an executable')
        return [configured]

    candidates = [
        get_home_dir() / "Desktop" / "Video silence reomver" / ".venv" / "Scripts" / "auto-editor.exe",
        get_home_dir() / "Desktop" / "Video silence remover" / ".venv" / "Scripts" / "auto-editor.exe",
        base_dir / ".venv" / "Scripts" / "auto-editor.exe",
        base_dir / ".venv" / "Lib" / "site-packages" / "auto_editor" / "bin" / "auto-editor.exe",
        base_dir.parent / "bin" / "auto-editor.exe",
        Path(sys.prefix) / 'Scripts' / 'auto-editor.exe',
        Path(sys.prefix) / 'Lib' / 'site-packages' / 'auto_editor' / 'bin' / 'auto-editor.exe',
    ]
    for c in candidates:
        if c.exists():
            script_dir = str(c.parent)
            if script_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = script_dir + os.pathsep + os.environ.get("PATH", "")
            return str(c)

    which_bin = shutil.which("auto-editor.exe") or shutil.which("auto-editor")
    if which_bin:
        return which_bin

    # Check venv python module
    if importlib.util.find_spec('auto_editor'):
        return [sys.executable, "-m", "auto_editor"]

    return ["auto-editor"]


def process_silence(media_path, margin=None, mode=None, threshold=None, seq_name=None, output_dir=None, source_in=None, source_out=None):
    """
    Runs auto-editor on media_path.
    mode = 'premiere' generates an FCPXML / Premiere XML for timeline clipping.
    mode = 'render' generates a rendered video / audio file.
    """
    media_path = os.path.abspath(media_path)
    if not os.path.exists(media_path):
        return {"success": False, "error": f"Input media not found: {media_path}"}

    shared = get_shared_config()
    if margin is None:
        margin = float(shared.get("silenceMargin", 0.2))
    if mode is None:
        mode = str(shared.get("silenceOutput", "premiere"))
    if threshold is None and shared.get("silenceThreshold"):
        threshold = str(shared.get("silenceThreshold"))

    orig_duration = get_ffprobe_duration(media_path)
    stem = Path(media_path).stem

    if not output_dir:
        workflow_root = os.environ.get("UNIPRAE_WORKFLOW_DIR")
        if not workflow_root:
            local_app = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
            workflow_root = Path(local_app) / "Uniprae" / "workflows"
        else:
            workflow_root = Path(workflow_root)
        workflow_root = Path(workflow_root)
        workflow_root.mkdir(parents=True, exist_ok=True)
        output_dir = tempfile.mkdtemp(prefix="silence-", dir=str(workflow_root))
    os.makedirs(output_dir, exist_ok=True)

    auto_editor_bin = get_auto_editor_bin()
    if isinstance(auto_editor_bin, list):
        cmd = list(auto_editor_bin)
    else:
        cmd = [auto_editor_bin]

    cmd.append(media_path)
    cmd.extend(["--margin", f"{margin}sec"])
    cmd.append("--no-open")

    if threshold is not None and str(threshold).strip():
        # auto-editor edit expression e.g. audio:threshold=4% or audio:threshold=-30dB
        th = str(threshold).strip()
        if not th.endswith("%") and not th.endswith("dB"):
            th = f"{th}%"
        cmd.extend(["--edit", f"audio:threshold={th}"])

    # Make the generated Premiere XML itself honor a selected clip's source
    # interval. This matters when XML is imported as the Silenced sequence.
    bound_start = max(0.0, float(source_in or 0.0))
    bound_stop = float(source_out or 0.0)
    if bound_stop > bound_start:
        cut_ranges = []
        if bound_start > 0:
            cut_ranges.append(f"0sec,{bound_start}sec")
        if orig_duration is not None and bound_stop < orig_duration:
            cut_ranges.append(f"{bound_stop}sec,{orig_duration}sec")
        for cut_range in cut_ranges:
            cmd.extend(["--cut-out", cut_range])

    if mode == "premiere":
        xml_out = os.path.join(output_dir, f"{stem}_Silenced_Clips.xml")
        cmd.extend(["--export", "premiere", "-o", xml_out])
    else:
        ext = Path(media_path).suffix or ".mp4"
        render_out = os.path.join(output_dir, f"{stem}_Silenced{ext}")
        cmd.extend(["-o", render_out])

    # Run auto-editor
    try:
        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace',
            check=True
        )
    except subprocess.CalledProcessError as e:
        err_msg = (e.stderr or e.stdout or str(e)).strip()
        return {"success": False, "error": f"auto-editor failed: {err_msg}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

    # If XML mode, parse and enhance the generated Premiere XML
    if mode == "premiere":
        if not os.path.exists(xml_out):
            # Check if auto-editor placed it near the source
            fallback = os.path.splitext(media_path)[0] + "_ALTERED.xml"
            if os.path.exists(fallback):
                shutil.move(fallback, xml_out)
            else:
                return {"success": False, "error": f"Expected XML output not found: {xml_out}"}

        # Modify sequence name in XML if specified
        final_seq_name = seq_name or "Silenced"
        clip_count = 0
        cut_duration_seconds = None

        try:
            tree = ET.parse(xml_out)
            root = tree.getroot()
            seq_elem = root.find("sequence")
            if seq_elem is not None:
                name_elem = seq_elem.find("name")
                if name_elem is not None:
                    name_elem.text = final_seq_name

                # Calculate duration from rate and duration frames
                rate_elem = seq_elem.find("rate")
                timebase = 30.0
                if rate_elem is not None:
                    tb_elem = rate_elem.find("timebase")
                    if tb_elem is not None and tb_elem.text:
                        timebase = float(tb_elem.text)

                dur_elem = seq_elem.find("duration")
                if dur_elem is not None and dur_elem.text:
                    cut_duration_seconds = float(dur_elem.text) / timebase

                # Count clips on the first video or audio track
                video_track = seq_elem.find(".//media/video/track")
                if video_track is not None:
                    clip_count = len(video_track.findall("clipitem"))
                else:
                    audio_track = seq_elem.find(".//media/audio/track")
                    if audio_track is not None:
                        clip_count = len(audio_track.findall("clipitem"))

            tree.write(xml_out, encoding="utf-8", xml_declaration=True)
        except Exception as ex:
            return {"success": False, "error": "Cannot read silence analysis: " + str(ex)}

        try:
            segments = constrain_segments(extract_segments(xml_out), source_in, source_out)
        except Exception as ex:
            return {"success": False, "error": str(ex)}

        selected_duration = (float(source_out) - float(source_in or 0.0)) if source_out is not None and float(source_out) > float(source_in or 0.0) else orig_duration
        cut_duration_seconds = sum(segment["out"] - segment["in"] for segment in segments)
        clip_count = len(segments)
        silence_removed = None
        silence_pct = None
        if selected_duration is not None:
            silence_removed = max(0.0, selected_duration - cut_duration_seconds)
            silence_pct = (silence_removed / selected_duration * 100) if selected_duration > 0 else 0

        return {
            "success": True,
            "mode": "premiere",
            "xml_path": xml_out,
            "segments": segments,
            "media_path": media_path,
            "sequence_name": final_seq_name,
            "clip_count": clip_count,
            "original_duration_seconds": selected_duration,
            "cut_duration_seconds": cut_duration_seconds,
            "silence_removed_seconds": silence_removed,
            "silence_percentage": round(silence_pct, 1) if silence_pct is not None else None,
            "original_duration_formatted": format_time(selected_duration),
            "cut_duration_formatted": format_time(cut_duration_seconds),
            "silence_removed_formatted": format_time(silence_removed)
        }

    else:
        # Render mode
        final_out = render_out
        if not os.path.exists(final_out):
            fallback_render = os.path.splitext(media_path)[0] + f"_ALTERED{ext}"
            if os.path.exists(fallback_render):
                shutil.move(fallback_render, final_out)
            else:
                return {"success": False, "error": f"Rendered output not found: {final_out}"}

        cut_duration = get_ffprobe_duration(final_out)
        silence_removed = None
        silence_pct = None
        if orig_duration is not None and cut_duration is not None:
            silence_removed = max(0.0, orig_duration - cut_duration)
            silence_pct = (silence_removed / orig_duration * 100) if orig_duration > 0 else 0

        return {
            "success": True,
            "mode": "render",
            "output_path": final_out,
            "original_duration_seconds": orig_duration,
            "cut_duration_seconds": cut_duration,
            "silence_removed_seconds": silence_removed,
            "silence_percentage": round(silence_pct, 1) if silence_pct is not None else None,
            "original_duration_formatted": format_time(orig_duration),
            "cut_duration_formatted": format_time(cut_duration),
            "silence_removed_formatted": format_time(silence_removed)
        }


def main():
    shared = get_shared_config()
    default_margin = float(shared.get("silenceMargin", 0.2))
    default_mode = str(shared.get("silenceOutput", "premiere"))
    default_threshold = shared.get("silenceThreshold") or None

    parser = argparse.ArgumentParser(description="Adobe Premiere Pro Video Silence Remover Bridge")
    parser.add_argument("input", help="Path to input media file")
    parser.add_argument("--margin", type=float, default=default_margin, help="Margin around speech in seconds (default 0.2)")
    parser.add_argument("--mode", choices=["premiere", "render"], default=default_mode, help="Export mode (premiere or render)")
    parser.add_argument("--threshold", type=str, default=default_threshold, help="Audio silence threshold (e.g. 4%% or -30dB)")
    parser.add_argument("--seq-name", type=str, default=None, help="Premiere sequence title")
    parser.add_argument("--output-dir", type=str, default=None, help="Custom output directory")
    parser.add_argument("--source-in", type=float, default=None, help="Selected clip source in-point in seconds")
    parser.add_argument("--source-out", type=float, default=None, help="Selected clip source out-point in seconds")

    args = parser.parse_args()

    result = process_silence(
        media_path=args.input,
        margin=args.margin,
        mode=args.mode,
        threshold=args.threshold,
        seq_name=args.seq_name,
        output_dir=args.output_dir,
        source_in=args.source_in,
        source_out=args.source_out
    )

    print(json.dumps(result, indent=2))
    if not result.get("success"):
        sys.exit(1)


if __name__ == "__main__":
    main()
