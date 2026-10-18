"""Convert the app's bundled Barlow web fonts to TTF for the XeLaTeX build.

    python docs/design/tools/prepare-fonts.py [out_dir]

TeX Live ships Montserrat but not Barlow. The app already carries Barlow through
@fontsource (node_modules), so this unpacks those .woff files into docs/design/build/fonts
(or out_dir, e.g. docs/user-guide/build/fonts for the user guide) instead of downloading
anything. Needs fontTools (`pip install fonttools`).
"""

import sys
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "node_modules" / "@fontsource" / "barlow" / "files"
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "build" / "fonts"

WEIGHTS = {500: "Medium", 600: "SemiBold", 700: "Bold"}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for weight, name in WEIGHTS.items():
        src = SRC / f"barlow-latin-{weight}-normal.woff"
        if not src.exists():
            raise SystemExit(f"Missing {src}; run npm install first.")
        font = TTFont(src)
        font.flavor = None  # plain sfnt
        dest = OUT / f"Barlow-{name}.ttf"
        font.save(dest)
        print(f"  {dest}")


if __name__ == "__main__":
    main()
