import os
import shutil
from pathlib import Path

src_dir = Path(r"c:\Users\OWNER\Desktop\ChatBot\groq_transcriber_rebuild")
dest_dir = Path(r"C:\Users\OWNER\AppData\Roaming\Adobe\CEP\extensions\groq_transcriber")
scratch_dest = Path(r"C:\Users\OWNER\.gemini\antigravity\scratch\groq-transcriber")

print("Deploying Groq Transcriber Rebuilt Files...")

# 1. Ensure dest/py exists
py_dest = dest_dir / "py"
py_dest.mkdir(parents=True, exist_ok=True)

# 2. Copy py/transcribe.py
src_py = src_dir / "py" / "transcribe.py"
shutil.copy2(src_py, py_dest / "transcribe.py")
print(f"Copied {src_py} -> {py_dest / 'transcribe.py'}")

# 3. Copy jsx/hostscript.jsx
src_jsx = src_dir / "jsx" / "hostscript.jsx"
dest_jsx = dest_dir / "jsx" / "hostscript.jsx"
dest_jsx.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(src_jsx, dest_jsx)
print(f"Copied {src_jsx} -> {dest_jsx}")

# 4. Copy index.html
src_html = src_dir / "index.html"
dest_html = dest_dir / "index.html"
shutil.copy2(src_html, dest_html)
print(f"Copied {src_html} -> {dest_html}")

# 5. Mirror to scratch folder if exists
if scratch_dest.exists():
    shutil.copy2(src_py, scratch_dest / "transcribe.py")
    print(f"Copied mirror to {scratch_dest / 'transcribe.py'}")

print("[SUCCESS] All extension files deployed successfully!")
