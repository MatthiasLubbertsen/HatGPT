"""
Upload a file to Hack Club's Bucky and print the returned URL.
Requires: requests (pip install requests)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from tkinter import Tk, filedialog

import requests

BUCKY_URL = "https://bucky.hackclub.com/"


def prompt_for_file() -> Path:
    # Use a minimal Tk root so the native file picker can show.
    root = Tk()
    root.withdraw()
    try:
        selected = filedialog.askopenfilename(title="Select a file to upload")
    finally:
        root.destroy()

    if not selected:
        print("No file selected.", file=sys.stderr)
        sys.exit(1)

    path = Path(selected)
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)
    if not path.is_file():
        print(f"Not a file: {path}", file=sys.stderr)
        sys.exit(1)
    return path


def upload_file(path: Path) -> Any:
    with path.open("rb") as fh:
        files = {"file": (path.name, fh)}
        response = requests.post(BUCKY_URL, files=files, timeout=30)
    response.raise_for_status()
    try:
        return response.json()
    except json.JSONDecodeError:
        # Server returned non-JSON but still succeeded; pass raw text back.
        return response.text


def main() -> None:
    path = prompt_for_file()
    try:
        result = upload_file(path)
    except requests.RequestException as exc:
        print(f"Upload failed: {exc}", file=sys.stderr)
        sys.exit(1)

    if isinstance(result, dict) and "url" in result:
        print(result["url"])
    else:
        print(result)


if __name__ == "__main__":
    main()
