#!/usr/bin/env python3
"""Validate ASO metadata files against App Store / Google Play character limits.
Run: python3 aso/validate.py
"""
from pathlib import Path

LIMITS = {
    "name.txt": 30,                # Apple App Name (Play Title allows 50)
    "subtitle.txt": 30,           # Apple Subtitle
    "short-description.txt": 80,  # Play Short description
    "keywords.txt": 100,          # Apple Keywords
    "promotional-text.txt": 170,  # Apple Promotional Text
    "description.txt": 4000,      # Apple/Play Description
    "whats-new.txt": 4000,        # Apple/Play release notes
}
ROOT = Path(__file__).parent
ok = True
for loc in ["en-US", "pl-PL"]:
    print(f"\n=== {loc} ===")
    for fname, limit in LIMITS.items():
        f = ROOT / loc / fname
        if not f.exists():
            print(f"  {fname:24} MISSING"); ok = False; continue
        n = len(f.read_text(encoding="utf-8").rstrip("\n"))
        flag = "OK " if n <= limit else "OVER"
        if n > limit: ok = False
        extra = ""
        if fname == "keywords.txt":
            kw = f.read_text(encoding="utf-8").strip()
            if " ," in kw or ", " in kw: extra = " [WARN: space near comma]"
        print(f"  {fname:24} {n:>4}/{limit:<4} {flag}{extra}")
print("\nALL WITHIN LIMITS" if ok else "\nFIX NEEDED")
