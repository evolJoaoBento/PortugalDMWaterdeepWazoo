#!/usr/bin/env python3
"""Write data/spell-effects.json from Jack Kerouac's animated-spell-effects pack.

The pack is 376 transparent WebM files and 1.09 GB. This records what is in it —
paths, sizes and the shape each file was drawn for — in a few tens of kilobytes,
so the table can offer every effect while shipping only the curated ones.

Run from the repository root:  python scripts/fx-index.py
"""
import json, os, re, sys, urllib.request
from datetime import date

COMMIT = "436fa96d7e9e97f8e6116c19c65f495d269f8093"
REPO = "jackkerouac/animated-spell-effects"
TREE = f"https://api.github.com/repos/{REPO}/git/trees/{COMMIT}?recursive=1"
OUT = os.path.join("data", "spell-effects.json")
BUNDLE_DIR = os.path.join("assets", "spell-effects")

SHAPES = ("circle", "square", "rectangle", "ray", "cone")


def shape_of(filename):
    """The footprint the animation was drawn for, from the pack's own naming.

    The pack marks files CIRCLE / SQUARE / RECTANGLE / RAY / CONE. Some have no
    marker at all, and those get "" rather than a guess.
    """
    low = filename.lower()
    for s in SHAPES:
        if re.search(r"[_-]" + s + r"([_.]|$)", low):
            return s
    return ""


def pretty(filename):
    """A name a person can read: 'fire_ball_RAY_02.webm' -> 'fire ball 02'."""
    stem = re.sub(r"\.webm$", "", filename, flags=re.I)
    for s in SHAPES:
        stem = re.sub(r"[_-]" + s + r"(?=[_.]|$)", "", stem, flags=re.I)
    return re.sub(r"[_-]+", " ", stem).strip()


def main():
    req = urllib.request.Request(TREE, headers={"User-Agent": "wazoo-fx-index"})
    with urllib.request.urlopen(req) as r:
        tree = json.load(r)["tree"]

    effects = []
    for node in tree:
        p = node["path"]
        if not p.endswith(".webm") or not p.startswith("spell-effects/"):
            continue
        rel = p[len("spell-effects/"):]          # e.g. fire/fire_ball_RAY_02.webm
        parts = rel.split("/")
        if len(parts) != 2:
            continue
        category, filename = parts
        effects.append({
            "path": rel,
            "name": pretty(filename),
            "category": category,
            "shape": shape_of(filename),
            "kb": node["size"] // 1024,
            # True when the file is actually in the repo. fx-fetch.py downloads
            # them; until then this is False for everything, which is honest.
            "bundled": os.path.exists(os.path.join(BUNDLE_DIR, category, filename)),
        })

    effects.sort(key=lambda e: e["path"])
    os.makedirs("data", exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"commit": COMMIT, "generated": date.today().isoformat(),
                   "count": len(effects), "effects": effects}, f, indent=1)
        f.write("\n")

    bundled = sum(1 for e in effects if e["bundled"])
    print(f"{len(effects)} effects, {bundled} bundled -> {OUT}")
    if len(effects) < 300:
        print("ERROR: expected ~376 effects; the tree API may have failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
