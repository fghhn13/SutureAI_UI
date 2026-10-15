"""Demo recording management.

    python -m app.demo list                                  # registered demo recordings
    python -m app.demo register <video> [--id suture-demo-1] # add the file's SHA-256
    python -m app.demo check <video>                         # would this file match?

Uploads whose SHA-256 (or, as a fallback, filename) matches a registered recording get its
hand-made annotation instead of mock scores; see providers/demo.py.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from .config import get_settings
from .providers.demo import find_recording, load_registry


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    reg = sub.add_parser("register")
    reg.add_argument("video", type=Path)
    reg.add_argument("--id", default="suture-demo-1", help="registry entry to attach the hash to")
    chk = sub.add_parser("check")
    chk.add_argument("video", type=Path)
    args = parser.parse_args()

    demo_dir = get_settings().demo_dir
    registry_path = demo_dir / "registry.json"

    if args.cmd == "list":
        for rec in load_registry(demo_dir):
            print(f"{rec['id']}: {rec.get('title', '')}")
            print(f"  annotation: {rec['annotation']}")
            print(f"  sha256:     {', '.join(rec.get('sha256', [])) or '(none — filename match only)'}")
            print(f"  filenames:  {', '.join(rec.get('filenames', [])) or '-'}")
        return 0

    if not args.video.is_file():
        print(f"No such file: {args.video}", file=sys.stderr)
        return 1
    digest = sha256_of(args.video)

    if args.cmd == "check":
        match = find_recording(demo_dir, digest, args.video.name)
        if match:
            print(f"Matches '{match[0]['id']}' by {match[1]}.")
            return 0
        print(f"Not a registered demo recording (sha256 {digest}).")
        return 1

    data = json.loads(registry_path.read_text(encoding="utf-8"))
    rec = next((r for r in data["recordings"] if r["id"] == args.id), None)
    if rec is None:
        print(f"No registry entry '{args.id}'. Known: {[r['id'] for r in data['recordings']]}", file=sys.stderr)
        return 1
    hashes = rec.setdefault("sha256", [])
    if digest in hashes:
        print(f"Already registered for '{args.id}'.")
        return 0
    hashes.append(digest)
    registry_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Registered {args.video.name} for '{args.id}' (sha256 {digest}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
