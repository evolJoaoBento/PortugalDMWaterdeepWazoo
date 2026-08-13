# Animated Spell Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the DM drag a box on the map table and play an animated spell effect there, on both the table and the players' screen, once, and then gone.

**Architecture:** A new shared `assets/spellfx.js` — loaded by both pages exactly as `assets/fog.js` is — owns the effect catalogue, where a file is fetched from, the live playbacks, and the drawing. 35 curated WebM files ship in the repo; the other 341 are indexed and pulled from a pinned jsDelivr commit on first use, then cached in IndexedDB. A cast crosses the existing `BroadcastChannel` as `{t:"cast", path, rect}` with the rectangle in image space, like every other coordinate in this tool.

**Tech Stack:** Plain browser JavaScript, no build step, no package manager. Canvas 2D, `<video>` with transparent VP8 WebM, IndexedDB, BroadcastChannel. Python 3 for two one-off asset scripts.

**Spec:** `docs/superpowers/specs/2026-08-13-spell-effects-design.md`

## Global Constraints

- **No build step, no package manager, no CLI test runner.** Every page is self-contained HTML with inline CSS and JS; the only shared files are in `assets/`. Do not add npm, bundlers, or a framework.
- **Tests are in-page suites.** `map-table.html?test=1` runs `runTests()` and writes `PASS n/n` or `FAIL n/n` into the tab title and into `<pre id="tests">`. There is no headless runner. To run tests: serve the folder (`python -m http.server 8731 --bind 127.0.0.1`) and open `http://127.0.0.1:8731/map-table.html?test=1` in a browser, then read the tab title.
- **The suite is synchronous.** `runTests()` cannot `await`. Every new test must exercise a pure function or a fake object — never a real video, fetch, or IndexedDB call.
- **Cache busting.** `assets/*.js` is versioned by query token. The current token is `?v=20260813d` in `map-table.html` and `map-screen.html`. **When you change any shared asset, bump the token in every page that references it**, and bump `<meta name="wazoo-build">` in both pages. Find references with `grep -n "fog.js\|spellfx.js" *.html`.
- **All coordinates that cross the channel are IMAGE space.** The two windows have different canvas sizes and device pixel ratios. A rectangle in device pixels lands somewhere else on the projector. This is the single rule that the map table's own design doc says will silently break everything if broken.
- **The repository is public and the players read it.** Never commit a map. Effect animations are not spoilers and are fine to commit.
- **GPL-3.0.** The bundled effects are redistributed GPL-3.0 work. `assets/spell-effects/LICENSE` and `assets/spell-effects/CREDITS.md` must exist before or in the same commit as the first `.webm`, and the credit must also appear in the effects panel and `README.md`.
- **Pinned pack commit:** `436fa96d7e9e97f8e6116c19c65f495d269f8093`. Every CDN URL and every download uses this exact SHA, never `@master`.
- **Commit style:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`). Hand-written commits only; the publishing tools write their own.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/fx-index.py` | Create: reads the pack's file tree from the GitHub API, writes `data/spell-effects.json`. Run by hand when the pack changes. |
| `scripts/fx-fetch.py` | Create: downloads the curated 35 files from the pinned commit into `assets/spell-effects/`. Run once. |
| `data/spell-effects.json` | Create (generated, committed): the whole catalogue — path, name, category, shape, kb, bundled. |
| `assets/spell-effects/**.webm` | Create: the 35 bundled animations. |
| `assets/spell-effects/LICENSE`, `CREDITS.md` | Create: GPL-3.0 text and attribution. |
| `assets/fog.js` | Modify: database version 2 with an `fx` blob store, plus `putFx`/`getFx`. The schema lives here because both pages open the same database and one definition of it is the point. |
| `assets/spellfx.js` | Create: catalogue (load, search, shape), delivery (bundled → cached → CDN), playback (cast, draw, playing), all shared by both windows. |
| `map-table.html` | Modify: the Effects panel, arming, the cast gesture, the channel send, and every new test. |
| `map-screen.html` | Modify: receive `preload` and `cast`, draw effects above the fog and the laser. |
| `README.md` | Modify: one credit line. |

---

### Task 1: The catalogue index

**Files:**
- Create: `scripts/fx-index.py`
- Create: `data/spell-effects.json` (its output)

**Interfaces:**
- Consumes: nothing.
- Produces: `data/spell-effects.json` with the shape
  `{"commit": str, "generated": str, "count": int, "effects": [{"path": str, "name": str, "category": str, "shape": str, "kb": int, "bundled": bool}]}`.
  `path` is relative to the pack's `spell-effects/` folder, e.g. `fire/fire_ball_RAY_02.webm`.
  `shape` is one of `circle`, `square`, `ray`, `cone`, `rectangle`, or `""`.
  Task 3 reads this file; Task 4 rewrites it with `bundled` set.

- [ ] **Step 1: Write the script**

Create `scripts/fx-index.py`:

```python
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
            # True when the file is actually in the repo. Task 4 downloads them;
            # until then this is False for everything, which is honest.
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
```

- [ ] **Step 2: Run it**

```bash
cd press
python scripts/fx-index.py
```

Expected: `376 effects, 0 bundled -> data/spell-effects.json`

- [ ] **Step 3: Check the output by eye**

```bash
python -c "import json; d=json.load(open('data/spell-effects.json')); print(d['count'], d['commit'][:7]); print(d['effects'][0]); print([e for e in d['effects'] if e['shape']==''][:3])"
```

Expected: count `376`, commit `436fa96`, the first entry an `air/` file with a non-empty `name`, and the shapeless list containing files like `air/shockwave_01_transcentre.webm`. Confirm no entry has a `path` starting with `spell-effects/`.

- [ ] **Step 4: Commit**

```bash
git add scripts/fx-index.py data/spell-effects.json
git commit -m "feat: index the spell effects pack

376 animations, their categories, the footprint each was drawn for, and
their weight — a few tens of kilobytes standing in for 1.09 GB, so the
table can offer the whole pack while shipping only the ones it needs."
```

---

### Task 2: A place to keep fetched effects

**Files:**
- Modify: `assets/fog.js` (the storage section, around `openDb`)
- Test: `map-table.html` (`runTests()`)

**Interfaces:**
- Consumes: the existing `Fog.openDb()`, `put()`, `get()` helpers in `assets/fog.js`.
- Produces: `Fog.putFx(path, blob) -> Promise<void>` and `Fog.getFx(path) -> Promise<{path, blob}|null>`,
  where `path` is the pack-relative path from Task 1. Task 5 uses both.

- [ ] **Step 1: Write the failing test**

In `map-table.html`, inside `runTests()`, just after the block that ends with the `"an empty table says so"` assertion, add:

```js
  /* ── where a fetched effect is kept ───────────────────────────────
     The pack is 1.09 GB and the repo carries 35 of it. Anything else is
     fetched once and kept, so the second cast works with the router
     unplugged. It goes in the same database as the maps, because both
     pages open that one and a second database is a second schema to
     keep in step. */
  ok("the store has somewhere to put a fetched effect",
     typeof Fog.putFx === "function" && typeof Fog.getFx === "function");
  ok("the database version leaves room for it", Fog.DB_VERSION === 2,
     "adding a store needs a version, or the upgrade never runs");
```

- [ ] **Step 2: Run the suite and watch it fail**

Serve and open `http://127.0.0.1:8731/map-table.html?test=1`. Expected: tab title reads `FAIL`, with `the store has somewhere to put a fetched effect` and `the database version leaves room for it` among the failures.

- [ ] **Step 3: Make it pass**

In `assets/fog.js`, replace the storage preamble and `openDb`:

```js
  var DB = "waterdeep-table", MAPS = "maps", FOG = "fog", FX = "fx";
  var DB_VERSION = 2;

  function openDb(){
    return new Promise(function(res, rej){
      var r = indexedDB.open(DB, DB_VERSION);
      r.onupgradeneeded = function(){
        var db = r.result;
        if(!db.objectStoreNames.contains(MAPS)) db.createObjectStore(MAPS, {keyPath:"id"});
        if(!db.objectStoreNames.contains(FOG))  db.createObjectStore(FOG,  {keyPath:"mapId"});
        /* Effects fetched from the CDN, keyed by their pack-relative path. */
        if(!db.objectStoreNames.contains(FX))   db.createObjectStore(FX,   {keyPath:"path"});
      };
      r.onsuccess = function(){
        /* A page left open on the old version blocks this one's upgrade
           forever. Letting go when asked is what keeps a stale projector
           window from wedging a fresh table. */
        r.result.onversionchange = function(){ r.result.close(); };
        res(r.result);
      };
      r.onerror = function(){ rej(r.error); };
    });
  }
```

Add beside `putFog`/`getFog`:

```js
  /* Blobs, not object URLs: a URL is only valid in the document that made
     it, and both windows read this store. */
  function putFx(path, blob){ return put(FX, {path:path, blob:blob}); }
  function getFx(path){ return get(FX, path); }
```

Add to the `root.Fog = {…}` export block:

```js
    DB_VERSION: DB_VERSION,
    putFx: putFx, getFx: getFx,
```

- [ ] **Step 4: Run the suite and watch it pass**

Reload `http://127.0.0.1:8731/map-table.html?test=1`. Expected: tab title reads `PASS n/n` with `n` two higher than before this task.

- [ ] **Step 5: Bump the cache token**

`assets/fog.js` changed, so both pages must ask for a new URL:

```bash
cd press
sed -i 's/fog\.js?v=20260813d/fog.js?v=20260814a/; s/wazoo-build" content="20260813d"/wazoo-build" content="20260814a"/' map-table.html map-screen.html
grep -n "fog.js?v=\|wazoo-build" map-table.html map-screen.html
```

Expected: all four lines now read `20260814a`.

- [ ] **Step 6: Commit**

```bash
git add assets/fog.js map-table.html map-screen.html
git commit -m "feat: a store for effects fetched from the pack

Version 2 of the same database the maps live in, with an fx store keyed
by the pack-relative path. Connections give way on versionchange, so a
projector left open on version 1 cannot block the table's upgrade."
```

---

### Task 3: The catalogue, searchable

**Files:**
- Create: `assets/spellfx.js`
- Modify: `map-table.html` (add the `<script>` tag, add tests)
- Modify: `map-screen.html` (add the `<script>` tag)

**Interfaces:**
- Consumes: `data/spell-effects.json` from Task 1.
- Produces, on `window.SpellFx`:
  - `SpellFx.PACK_COMMIT` — the pinned SHA, string
  - `SpellFx.shapeOf(filename) -> string` — `circle|square|rectangle|ray|cone|""`
  - `SpellFx.search(effects, query) -> array` — filtered and sorted, bundled first
  - `SpellFx.urlFor(effect) -> string` — bundled local path, else the pinned CDN URL
  - `SpellFx.loadIndex(url) -> Promise<{commit, effects}>` — fetch once, memoised
  - `SpellFx.index() -> {commit, effects}|null` — whatever `loadIndex` last resolved
  Tasks 5, 6 and 7 use all of these.

- [ ] **Step 1: Write the failing tests**

In `map-table.html`, inside `runTests()`, after the block added in Task 2, add:

```js
  /* ── the catalogue ────────────────────────────────────────────────
     376 effects the DM has to find one of, mid-combat, without
     scrolling. The index is a few kilobytes of paths; these are the
     rules that turn it into an answer. */
  ok("the pack is pinned to a commit, not to a moving branch",
     /^[0-9a-f]{40}$/.test(SpellFx.PACK_COMMIT), SpellFx.PACK_COMMIT);

  ok("a shape is read from the pack's own naming",
     SpellFx.shapeOf("fire_ball_RAY_02.webm") === "ray" &&
     SpellFx.shapeOf("frost_CONE_01.webm") === "cone" &&
     SpellFx.shapeOf("fire_explosion_CIRCLE_01.webm") === "circle" &&
     SpellFx.shapeOf("earth-hole_RECTANGLE_01.webm") === "rectangle" &&
     SpellFx.shapeOf("smoke_pillar_SQUARE_01.webm") === "square");
  ok("a file with no marker claims no shape",
     SpellFx.shapeOf("shockwave_01_transcentre.webm") === "" &&
     SpellFx.shapeOf("arrow_straight_01.webm") === "",
     "guessing a footprint the animator did not draw for is worse than admitting none");
  ok("CIRCLE inside a word is not a shape",
     SpellFx.shapeOf("semicircleish_01.webm") === "");

  const FX = [
    {path:"fire/fire_ball_RAY_02.webm", name:"fire ball 02", category:"fire", shape:"ray", bundled:false},
    {path:"fire/fire_explosion_CIRCLE_01.webm", name:"fire explosion 01", category:"fire", shape:"circle", bundled:true},
    {path:"ice/frost_CONE_01.webm", name:"frost 01", category:"ice", shape:"cone", bundled:true}
  ];
  ok("an empty search is the whole catalogue", SpellFx.search(FX, "").length === 3);
  ok("a search matches the name", SpellFx.search(FX, "explosion").length === 1);
  ok("a search matches the category",
     SpellFx.search(FX, "fire").length === 2 && SpellFx.search(FX, "ice").length === 1);
  ok("a search matches the shape", SpellFx.search(FX, "cone")[0].path === "ice/frost_CONE_01.webm");
  ok("search ignores case and stray spaces", SpellFx.search(FX, "  FROST ").length === 1);
  ok("every word has to match",
     SpellFx.search(FX, "fire cone").length === 0 && SpellFx.search(FX, "fire circle").length === 1,
     "two words narrow the list; they do not widen it");
  ok("what is in the repo is offered first",
     SpellFx.search(FX, "")[0].bundled === true &&
     SpellFx.search(FX, "").filter(e => !e.bundled).length === 1,
     "an effect that needs the network should not be the first thing under the cursor");

  ok("a bundled effect is read from this site",
     SpellFx.urlFor(FX[1]) === "assets/spell-effects/fire/fire_explosion_CIRCLE_01.webm");
  ok("anything else comes from the pinned commit",
     SpellFx.urlFor(FX[0]) ===
       "https://cdn.jsdelivr.net/gh/jackkerouac/animated-spell-effects@" +
       SpellFx.PACK_COMMIT + "/spell-effects/fire/fire_ball_RAY_02.webm",
     SpellFx.urlFor(FX[0]));
```

- [ ] **Step 2: Run the suite and watch it fail**

Open `http://127.0.0.1:8731/map-table.html?test=1`. Expected: `FAIL`, with an error in the console — `SpellFx is not defined` — because the script does not exist yet.

- [ ] **Step 3: Write the module**

Create `assets/spellfx.js`:

```js
/* ═══════════════════════════════════════════════════════════════════
   SpellFx — the map table's animated effects, shared by both windows.

   The animations are Jack Kerouac's Animated Spell Effects, GPL-3.0:
   https://github.com/jackkerouac/animated-spell-effects
   35 of them are in this repository under assets/spell-effects/, with
   the licence and the credits beside them. The rest of the pack — 341
   more files, over a gigabyte — is indexed in data/spell-effects.json
   and fetched from a pinned CDN commit the first time it is cast.

   This file is loaded by the table and by the projector, for the same
   reason fog.js is: two copies of "where does this file come from" is
   two chances for the two windows to show different things.
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var PACK_COMMIT = "436fa96d7e9e97f8e6116c19c65f495d269f8093";
  var PACK_REPO = "jackkerouac/animated-spell-effects";
  var BUNDLE_DIR = "assets/spell-effects/";
  var INDEX_URL = "data/spell-effects.json";

  var SHAPES = ["circle", "square", "rectangle", "ray", "cone"];

  /* The footprint an animation was drawn for, from the pack's own naming:
     fire_ball_RAY_02.webm is a ray. A marker has to stand on its own —
     bounded by _ - . or the end — or "semicircleish" would read as a
     circle. Files with no marker claim none; the placing gesture does not
     use this yet, and guessing would be worse than an empty string. */
  function shapeOf(filename){
    var low = String(filename || "").toLowerCase();
    for(var i = 0; i < SHAPES.length; i++){
      if(new RegExp("[_-]" + SHAPES[i] + "([_.]|$)").test(low)) return SHAPES[i];
    }
    return "";
  }

  /* Filter the catalogue to what the DM typed.

     Every word must match something — name, category or shape — so a
     second word narrows rather than widens: "fire cone" is a cone of
     fire, not everything fiery plus every cone. Bundled effects sort
     first, because those play instantly and the rest need the network. */
  function search(effects, query){
    var words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
    var hits = (effects || []).filter(function(e){
      var hay = (e.name + " " + e.category + " " + e.shape + " " + e.path).toLowerCase();
      return words.every(function(w){ return hay.indexOf(w) !== -1; });
    });
    return hits.sort(function(a, b){
      if(a.bundled !== b.bundled) return a.bundled ? -1 : 1;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });
  }

  /* Where the bytes are. Bundled effects are same-origin files in this
     repository; everything else is the pack itself, at the commit the
     index was built from — never @master, because an index that
     disagrees with the CDN is a 404 in front of the players. */
  function urlFor(effect){
    if(effect.bundled) return BUNDLE_DIR + effect.path;
    return "https://cdn.jsdelivr.net/gh/" + PACK_REPO + "@" + PACK_COMMIT +
           "/spell-effects/" + effect.path;
  }

  /* The catalogue, fetched once and kept. Both pages call this at boot;
     it is a few tens of kilobytes and it never changes while the page is
     open. A failure resolves to an empty catalogue rather than throwing:
     no effects is a smaller problem than a table that will not start. */
  var theIndex = null, indexPromise = null;
  function loadIndex(url){
    if(indexPromise) return indexPromise;
    indexPromise = fetch(url || INDEX_URL)
      .then(function(r){ return r.ok ? r.json() : {effects:[]}; })
      .catch(function(){ return {effects:[]}; })
      .then(function(d){ theIndex = { commit: d.commit || "", effects: d.effects || [] };
                         return theIndex; });
    return indexPromise;
  }
  function index(){ return theIndex; }

  root.SpellFx = {
    PACK_COMMIT: PACK_COMMIT,
    PACK_REPO: PACK_REPO,
    BUNDLE_DIR: BUNDLE_DIR,
    INDEX_URL: INDEX_URL,
    shapeOf: shapeOf,
    search: search,
    urlFor: urlFor,
    loadIndex: loadIndex,
    index: index
  };
})(window);
```

- [ ] **Step 4: Load it in both pages**

In `map-table.html` and `map-screen.html`, immediately after the `fog.js` script tag, add:

```html
<script src="assets/spellfx.js?v=20260814a"></script>
```

- [ ] **Step 5: Run the suite and watch it pass**

Reload `http://127.0.0.1:8731/map-table.html?test=1`. Expected: `PASS n/n`, 13 higher than after Task 2.

- [ ] **Step 6: Commit**

```bash
git add assets/spellfx.js map-table.html map-screen.html
git commit -m "feat: a searchable catalogue of spell effects

Both windows load it, as they load fog.js, so they cannot disagree about
where an animation comes from. A search narrows on every word across
name, category and shape; what is in the repository sorts first, because
everything else needs the network before it can be seen."
```

---

### Task 4: The 35 files, their licence, and their credit

**Files:**
- Create: `scripts/fx-fetch.py`
- Create: `assets/spell-effects/<category>/<file>.webm` (35 files, ~28 MB)
- Create: `assets/spell-effects/LICENSE`, `assets/spell-effects/CREDITS.md`
- Modify: `data/spell-effects.json` (regenerated — `bundled` becomes true for 35)
- Modify: `README.md`

**Interfaces:**
- Consumes: `data/spell-effects.json` and `scripts/fx-index.py` from Task 1.
- Produces: 35 files on disk whose paths match `assets/spell-effects/` + the index's `path`, so `SpellFx.urlFor` resolves them without a network.

- [ ] **Step 1: Write the download script**

Create `scripts/fx-fetch.py`:

```python
#!/usr/bin/env python3
"""Download the curated spell effects into assets/spell-effects/.

The pack is GPL-3.0 and 1.09 GB. These 35 are the spells this table
actually casts, each under 3 MB, about 28 MB together. Everything else is
in the index and fetched from the CDN on first use.

Run from the repository root:  python scripts/fx-fetch.py
"""
import os, sys, urllib.request

COMMIT = "436fa96d7e9e97f8e6116c19c65f495d269f8093"
BASE = f"https://cdn.jsdelivr.net/gh/jackkerouac/animated-spell-effects@{COMMIT}/spell-effects/"
OUT = os.path.join("assets", "spell-effects")

CURATED = [
    "fire/fire_explosion_CIRCLE_01.webm",          # Fireball
    "fire/fire_bolt_RAY_02.webm",                  # Fire Bolt / Scorching Ray
    "fire/fire_breath_CONE_01.webm",               # Burning Hands / dragon breath
    "fire/fire_wall_RAY_01.webm",                  # Wall of Fire
    "fire/fire_ball_rotating_CIRCLE_01.webm",      # Flaming Sphere
    "fire/fire_explosion_SQUARE_01.webm",          # Flame Strike
    "fire/fire_circle_CIRCLE_01.webm",             # Circle of flame
    "lightning/lightning_blast_RAY_02.webm",       # Lightning Bolt
    "lightning/lightning_blast_multicolour_RAY_01.webm",  # Chain Lightning
    "lightning/lightning_slam_RAY_01.webm",        # Call Lightning
    "lightning/lightning_explosion_CIRCLE_01.webm",# Thunderwave / Shatter
    "lightning/lightning_flash_SQUARE_03.webm",    # a flash over a room
    "ice/frost_CONE_01.webm",                      # Cone of Cold
    "ice/frost_beam_RAY_02.webm",                  # Ray of Frost
    "ice/ice_ball_RAY_01.webm",                    # Ice Knife
    "magic/magic_missle_RAY_06.webm",              # Magic Missile
    "energy/energy_beam_RAY_01.webm",              # Eldritch Blast
    "energy/disintegration_beam_RAY_02.webm",      # Disintegrate
    "energy/energy_explosion_CIRCLE_01.webm",      # a force burst
    "energy/energy_shield_CIRCLE_02.webm",         # Shield
    "energy/energy_throw_RAY_01.webm",             # Guiding Bolt
    "air/wind_blast_RAY_01.webm",                  # Gust of Wind
    "air/smoke_explosion_CIRCLE_01.webm",          # Fog Cloud / Stinking Cloud
    "air/dust_blast_CONE_01.webm",                 # Cloudkill
    "earth/earth-cracks_SQUARE_01.webm",           # Earthquake
    "earth/earth-hole_RECTANGLE_01.webm",          # a pit
    "magic/magic_shockwave_CIRCLE_01.webm",        # Counterspell
    "misc/runes_four_CIRCLE_01.webm",              # Teleport
    "misc/runes_CIRCLE_02.webm",                   # a summoning circle
    "misc/lathander_symbol_CIRCLE_01.webm",        # Sacred Flame
    "magic/magic_wild_CIRCLE_01.webm",             # Wild Magic
    "magic/magic_dust_SQUARE_03.webm",             # Sleep
    "magic/magic_forcefield_SQUARE_01.webm",       # Wall of Force
    "water/water_blast_RAY_01.webm",               # Tidal Wave
    "misc/skull_blast_CIRCLE_01.webm",             # Blight
]

LIMIT_KB = 3072


def main():
    total = 0
    for rel in CURATED:
        dest = os.path.join(OUT, *rel.split("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if os.path.exists(dest):
            total += os.path.getsize(dest)
            print(f"  have  {rel}")
            continue
        req = urllib.request.Request(BASE + rel, headers={"User-Agent": "wazoo-fx-fetch"})
        with urllib.request.urlopen(req) as r:
            data = r.read()
        kb = len(data) // 1024
        if kb > LIMIT_KB:
            print(f"ERROR: {rel} is {kb} KB, over the {LIMIT_KB} KB limit", file=sys.stderr)
            return 1
        with open(dest, "wb") as f:
            f.write(data)
        total += len(data)
        print(f"  got   {rel}  ({kb} KB)")
    print(f"{len(CURATED)} effects, {total // 1024 // 1024} MB in {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Write the licence and the credits first**

The licence has to be in place before the files it covers. Fetch the GPL-3.0 text:

```bash
cd press
mkdir -p assets/spell-effects
curl -sL https://www.gnu.org/licenses/gpl-3.0.txt -o assets/spell-effects/LICENSE
head -3 assets/spell-effects/LICENSE
```

Expected: the first lines of the GNU General Public License, Version 3.

Create `assets/spell-effects/CREDITS.md`:

```markdown
# Animated spell effects

These animations are **not** ours. They are from **Animated Spell Effects** by
**Jack Kerouac**:

- Source: https://github.com/jackkerouac/animated-spell-effects
- Commit: `436fa96d7e9e97f8e6116c19c65f495d269f8093`
- Licence: **GPL-3.0** — the full text is in `LICENSE`, beside this file.

35 of the pack's 376 files are copied here unmodified, so the map table works
with no internet. The rest are listed in `../../data/spell-effects.json` and
fetched from that same commit when they are first used.

`scripts/fx-fetch.py` is what put them here, and `scripts/fx-index.py` is what
wrote the index. Both name the commit above, so a future copy is the same copy.
```

- [ ] **Step 3: Download the effects**

```bash
cd press
python scripts/fx-fetch.py
```

Expected: 35 lines of `got …`, then `35 effects, 28 MB in assets/spell-effects`. If any file reports over the limit, stop and pick a smaller alternative from `data/spell-effects.json` rather than raising the limit.

- [ ] **Step 4: Re-run the index so it knows what is bundled**

```bash
python scripts/fx-index.py
python -c "import json; d=json.load(open('data/spell-effects.json')); print(sum(1 for e in d['effects'] if e['bundled']), 'bundled')"
```

Expected: `376 effects, 35 bundled`, then `35 bundled`.

- [ ] **Step 5: Credit the pack in the README**

In `README.md`, in the credits section, add:

```markdown
- **Animated spell effects** — [Animated Spell Effects](https://github.com/jackkerouac/animated-spell-effects)
  by Jack Kerouac, GPL-3.0. 35 of them are bundled under `assets/spell-effects/`
  with the licence and the credits; the rest are fetched from the pack when first cast.
```

- [ ] **Step 6: Check a bundled file actually serves**

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" \
  http://127.0.0.1:8731/assets/spell-effects/fire/fire_explosion_CIRCLE_01.webm
```

Expected: `200 video/webm 545…` — a 200, a video type, and a non-zero size.

- [ ] **Step 7: Run the suite**

Reload `http://127.0.0.1:8731/map-table.html?test=1`. Expected: still `PASS n/n`, unchanged from Task 3 — this task adds files, not behaviour.

- [ ] **Step 8: Commit**

```bash
git add scripts/fx-fetch.py assets/spell-effects data/spell-effects.json README.md
git commit -m "feat: bundle 35 spell effects, with their licence

Jack Kerouac's pack under GPL-3.0, copied unmodified at a pinned commit,
with the licence text and the credits beside the files and a line in the
README. 35 of 376, about 28 MB: the spells this table actually casts,
each small enough that a public repository can carry it.

Maps still stay out of the repository — a dungeon is a spoiler and a
fireball is not."
```

---

### Task 5: Fetching, caching, and playing one effect

**Files:**
- Modify: `assets/spellfx.js`
- Test: `map-table.html` (`runTests()`)

**Interfaces:**
- Consumes: `Fog.putFx` / `Fog.getFx` (Task 2), `SpellFx.urlFor` (Task 3).
- Produces:
  - `SpellFx.blobFor(effect) -> Promise<Blob>` — cache first, then network, storing what it fetches
  - `SpellFx.preload(effect) -> Promise<void>`
  - `SpellFx.cast(effect, rect) -> void` — `rect` is `{x0,y0,x1,y1}` in image space
  - `SpellFx.playing() -> boolean`
  - `SpellFx.live() -> array` — the live casts, for tests
  - `SpellFx.reap(list) -> array` — drops finished casts, pure
  - `SpellFx.boxOf(view, rect) -> {x,y,w,h}` — image rect to canvas box, pure
  - `SpellFx.draw(g, view) -> void`
  Tasks 6 and 7 call `preload`, `cast`, `playing` and `draw`.

- [ ] **Step 1: Write the failing tests**

In `map-table.html`, inside `runTests()`, after the catalogue block from Task 3, add:

```js
  /* ── placing and reaping a cast ───────────────────────────────────
     The video itself cannot be tested here — the suite is synchronous
     and a decode is not — so the parts that decide WHERE and FOR HOW
     LONG are pure, and those are the parts that can be wrong. */
  const fxView = {z:2, tx:30, ty:-10};
  const fxBox = SpellFx.boxOf(fxView, {x0:10, y0:20, x1:60, y1:70});
  ok("a cast is placed through the view, like everything else",
     near(fxBox.x, 50) && near(fxBox.y, 30) && near(fxBox.w, 100) && near(fxBox.h, 100),
     JSON.stringify(fxBox));
  const fxBack = SpellFx.boxOf(fxView, {x0:60, y0:70, x1:10, y1:20});
  ok("a box dragged up and to the left is the same box",
     near(fxBack.x, fxBox.x) && near(fxBack.w, fxBox.w),
     "a negative width draws nothing");

  const casts = [{done:false}, {done:true}, {done:false}];
  ok("a finished cast is dropped", SpellFx.reap(casts).length === 2);
  ok("reaping keeps the order of what is left",
     SpellFx.reap([{done:false, path:"a"}, {done:true, path:"b"}, {done:false, path:"c"}])
       .map(c => c.path).join("") === "ac");
  ok("nothing playing is not an error", SpellFx.reap([]).length === 0 &&
     SpellFx.playing() === false);
```

Note on what is deliberately not covered here: `blobFor`'s cache-before-network order is
asynchronous and the suite is not, so it cannot be asserted in this file. Task 7's step 4
checks it the only way it can be checked — cast an unbundled effect, then pull the network out
and cast it again.

- [ ] **Step 2: Run the suite and watch it fail**

Reload `http://127.0.0.1:8731/map-table.html?test=1`. Expected: `FAIL`, first failure `SpellFx.boxOf is not a function`.

- [ ] **Step 3: Write the playback half of the module**

In `assets/spellfx.js`, before the `root.SpellFx = {…}` block, add:

```js
  /* ── the bytes ────────────────────────────────────────────────────
     Cache first, then the network, and what the network gives is kept.
     The fetch is deliberate rather than handing the URL to a <video>:
     a cross-origin video drawn into a canvas taints it, and a tainted
     canvas cannot be read back — which would break the bench, the
     suite, and any future thumbnail. A blob from fetch() is same-origin
     by the time it reaches the element. */
  function blobFor(effect){
    if(effect.bundled){
      return fetch(SpellFx.urlFor(effect)).then(function(r){
        if(!r.ok) throw new Error("no such effect: " + effect.path);
        return r.blob();
      });
    }
    return Fog.getFx(effect.path).catch(function(){ return null; }).then(function(rec){
      if(rec && rec.blob) return rec.blob;
      return fetch(SpellFx.urlFor(effect)).then(function(r){
        if(!r.ok) throw new Error("the pack did not answer for " + effect.path);
        return r.blob();
      }).then(function(b){
        /* Kept, so the second cast of this effect works with the router
           unplugged. A failure to store is not a failure to cast. */
        return Fog.putFx(effect.path, b).catch(function(){}).then(function(){ return b; });
      });
    });
  }

  /* A decoded, ready-to-play element, kept by path so a spell cast twice
     in a fight is only fetched once. */
  var ready = {};
  function preload(effect){
    if(ready[effect.path]) return Promise.resolve();
    return blobFor(effect).then(function(blob){
      var url = URL.createObjectURL(blob);
      ready[effect.path] = { url: url };
    }).catch(function(){ /* an effect that will not load simply does not play */ });
  }

  /* ── the live casts ───────────────────────────────────────────────── */
  var live = [];

  /* Pure, so the rule can be tested without a video: a cast that has
     finished is gone, and the rest keep their order. */
  function reap(list){
    return (list || []).filter(function(c){ return !c.done; });
  }

  /* An image-space rectangle as a canvas box, normalised — a drag up or
     to the left is still a positive box, and a negative width draws
     nothing. The same maths as the fog rectangle's preview, for the same
     reason: it must land on the ground it was drawn over. */
  function boxOf(view, rect){
    var a = Fog.imageToCanvas(view, Math.min(rect.x0, rect.x1), Math.min(rect.y0, rect.y1));
    var b = Fog.imageToCanvas(view, Math.max(rect.x0, rect.x1), Math.max(rect.y0, rect.y1));
    return { x:a.x, y:a.y, w:b.x - a.x, h:b.y - a.y };
  }

  /* Start one. Muted because a browser will not autoplay anything else,
     and the pack is silent anyway; playsInline because iOS otherwise
     takes the video full screen, which on a projector would be a
     surprise nobody wants mid-combat. */
  function cast(effect, rect){
    var entry = { path: effect.path, rect: rect, video: null, done: false, url: null };
    live.push(entry);
    preload(effect).then(function(){
      var have = ready[effect.path];
      if(!have){ entry.done = true; return; }
      var v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.autoplay = false; v.preload = "auto";
      v.src = have.url;
      v.addEventListener("ended", function(){ entry.done = true; });
      v.addEventListener("error", function(){ entry.done = true; });
      entry.video = v;
      v.play().catch(function(){ entry.done = true; });
    });
  }

  function playing(){ return live.length > 0; }
  function liveList(){ return live; }

  /* Drawn last by both pages, above the fog and above the laser: a DM
     sets fire to ground the players cannot see at least as often as
     ground they can. */
  function draw(g, view){
    live = reap(live);
    for(var i = 0; i < live.length; i++){
      var c = live[i];
      if(!c.video || c.video.readyState < 2) continue;
      var b = boxOf(view, c.rect);
      if(b.w < 1 || b.h < 1) continue;
      g.drawImage(c.video, b.x, b.y, b.w, b.h);
    }
  }
```

Add to the export block:

```js
    blobFor: blobFor,
    preload: preload,
    cast: cast,
    reap: reap,
    boxOf: boxOf,
    draw: draw,
    playing: playing,
    live: liveList,
```

- [ ] **Step 4: Run the suite and watch it pass**

Reload `http://127.0.0.1:8731/map-table.html?test=1`. Expected: `PASS n/n`, 5 higher than after Task 4.

- [ ] **Step 5: Commit**

```bash
git add assets/spellfx.js map-table.html
git commit -m "feat: fetch, cache and play one effect

Cache before network, and a fetched blob rather than a cross-origin
video element — a cross-origin video drawn into a canvas taints it, and
a tainted canvas cannot be read back by the bench or the suite. Where a
cast lands and when it stops are pure functions, because those are the
parts that can be wrong."
```

---

### Task 6: Casting from the table

**Files:**
- Modify: `map-table.html` — toolbar, panel, arming, the cast gesture, the channel

**Interfaces:**
- Consumes: `SpellFx.loadIndex`, `SpellFx.search`, `SpellFx.preload`, `SpellFx.cast`, `SpellFx.playing`, `SpellFx.draw` (Tasks 3 and 5); the page's existing `send`, `requestPaint`, `animatePings`, `at()`, `preview`, `previewBox`, `bigEnough`.
- Produces: channel messages `{t:"preload", path}` and `{t:"cast", path, rect:{x0,y0,x1,y1}}`, which Task 7 consumes.

- [ ] **Step 1: Add the toolbar button and the panel markup**

In `map-table.html`, in `#bar`, after the `Rotate` button's group, add:

```html
  <span class="rule"></span>
  <button id="fx-open" type="button">Effects</button>
  <span id="fx-armed" class="said"></span>
```

Before `<canvas id="table">`, add the panel:

```html
<div id="fx-panel">
  <input id="fx-search" type="search" placeholder="fireball, cone, lightning&hellip;" autocomplete="off">
  <div id="fx-list"></div>
  <div id="fx-credit">Animations by Jack Kerouac &mdash; Animated Spell Effects, GPL-3.0</div>
</div>
```

In the page's `<style>`, after the `#bar` rules, add:

```css
#fx-panel{
  position:fixed;top:52px;left:14px;z-index:6;width:320px;max-height:70vh;display:none;
  flex-direction:column;gap:8px;padding:10px;
  background:rgba(11,8,5,.96);border:1px solid #3a2c1a;border-radius:3px;
  box-shadow:0 12px 34px #000c;
}
#fx-panel.on{display:flex}
#fx-search{
  font:400 15px/1.4 "EB Garamond",Georgia,serif;color:#e8d9b8;
  background:rgba(20,15,9,.8);border:1px solid #3a2c1a;border-radius:2px;padding:7px 9px;
}
#fx-list{overflow:auto;display:flex;flex-direction:column;gap:2px}
#fx-list button{
  font-family:"EB Garamond",Georgia,serif;font-size:14px;letter-spacing:0;text-transform:none;
  text-align:left;padding:6px 8px;
}
#fx-list button .far{color:#8d7a5b;font-size:11px}
#fx-credit{font:400 11px/1.4 "EB Garamond",Georgia,serif;color:#6d5a3a}
```

- [ ] **Step 2: Wire the panel, the search and arming**

In `map-table.html`, before `function wire(){`, add:

```js
/* ── the effects panel ─────────────────────────────────────────────
   376 animations, and the DM has to find one mid-combat. Type a word,
   pick a line, and the table is ARMED: the next left-drag is a cast
   rather than a rectangle of fog. The armed effect is named in the bar
   the whole time, because a mode you cannot see is a mode you forget
   you are in. */
let armed = null;

function armFx(effect){
  armed = effect;
  document.getElementById("fx-armed").textContent = effect ? "armed: " + effect.name : "";
  document.getElementById("table").style.cursor = effect ? "copy" : "crosshair";
  if(effect){
    /* Both windows warm the file up, or the projector stutters on the
       first cast of the evening while the table plays it smoothly. */
    SpellFx.preload(effect);
    send({t:"preload", path:effect.path});
  }
}

function fxList(query){
  const box = document.getElementById("fx-list");
  const idx = SpellFx.index();
  box.textContent = "";
  if(!idx){ box.textContent = "No catalogue — data/spell-effects.json did not load."; return; }
  const hits = SpellFx.search(idx.effects, query).slice(0, 60);
  hits.forEach(function(e){
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = e.name + " ";
    const tag = document.createElement("span");
    tag.className = "far";
    tag.textContent = e.category + (e.shape ? " · " + e.shape : "") +
                      (e.bundled ? "" : " · fetches");
    b.appendChild(tag);
    b.addEventListener("click", function(){ armFx(e); });
    box.appendChild(b);
  });
}

function wireFx(){
  const panel = document.getElementById("fx-panel");
  const search = document.getElementById("fx-search");
  document.getElementById("fx-open").addEventListener("click", function(){
    panel.classList.toggle("on");
    if(panel.classList.contains("on")){ fxList(search.value); search.focus(); }
  });
  search.addEventListener("input", function(){ fxList(this.value); });
  SpellFx.loadIndex().then(function(){ if(panel.classList.contains("on")) fxList(search.value); });
}
```

- [ ] **Step 3: Call it, and give Escape something to do**

In `wire()`, immediately before `wirePaint();`, add:

```js
  wireFx();
```

In `wire()`'s `keydown` listener, immediately after the `Space` block, add:

```js
    /* Escape puts the fog tools back. An armed table that has been
       forgotten about paints a fireball where the DM meant to lift the
       fog off a corridor. */
    if(e.key === "Escape"){
      armFx(null);
      document.getElementById("fx-panel").classList.remove("on");
      return;
    }
```

In the two `pick(...)` calls for `a-reveal` and `a-hide`, disarm as well:

```js
  pick("a-reveal", "a-hide", () => { reveal = true; armFx(null); });
  pick("a-hide", "a-reveal", () => { reveal = false; armFx(null); });
```

- [ ] **Step 4: Write the failing test for what a cast puts on the channel**

In `map-table.html`, inside `runTests()`, after the block added in Task 5, add:

```js
  /* What a cast puts on the channel. Image space, like every other
     rectangle here — the projector's canvas is a different size, and a
     box in this window's device pixels lands somewhere else on it. */
  const payload = castPayload({path:"fire/fire_explosion_CIRCLE_01.webm"},
                              {x:900, y:400}, {x:300, y:120});
  ok("a cast names the effect", payload.t === "cast" &&
     payload.path === "fire/fire_explosion_CIRCLE_01.webm");
  ok("a cast carries a normalised image-space rectangle",
     payload.rect.x0 === 300 && payload.rect.y0 === 120 &&
     payload.rect.x1 === 900 && payload.rect.y1 === 400, JSON.stringify(payload.rect));
  ok("a cast carries no device pixels", payload.view === undefined && payload.z === undefined,
     "z/tx/ty belong to this canvas and mean something else on the projector");
  ok("a cast survives the channel",
     JSON.parse(JSON.stringify(payload)).rect.x1 === 900, "it must be structured-clonable");
```

Then define the helper it tests, in `map-table.html` beside `armFx`:

```js
/* A drag's two corners as the message the projector will receive.
   Separate from the gesture so the shape of what crosses the channel can
   be asserted without a pointer, a map or a video. */
function castPayload(effect, a, b){
  return { t:"cast", path:effect.path,
           rect:{ x0:Math.min(a.x, b.x), y0:Math.min(a.y, b.y),
                  x1:Math.max(a.x, b.x), y1:Math.max(a.y, b.y) } };
}
```

Run `http://127.0.0.1:8731/map-table.html?test=1` before adding the helper and confirm it fails
with `castPayload is not defined`; add the helper and confirm `PASS n/n`, four higher.

- [ ] **Step 5: Make the drag cast instead of painting**

In `wirePaint()`, in the `pointerup` handler, replace the commit line:

```js
    if(bigEnough(start, p)) pushStroke(Fog.rect(start.x, start.y, p.x, p.y, reveal));
```

with:

```js
    if(bigEnough(start, p)){
      if(armed){
        /* A cast is not a stroke: no undo slot, no autosave, nothing in
           a sync. It happens and it is over. */
        const msg = castPayload(armed, start, p);
        SpellFx.cast(armed, msg.rect);
        send(msg);
        animateFx();
      }else{
        pushStroke(Fog.rect(start.x, start.y, p.x, p.y, reveal));
      }
    }
```

In the same function's `pointerdown`, make the preview say what will happen — find the line that sets the preview and leave it as is, then in `redraw()`'s preview block change the outline colour line:

```js
      g.strokeStyle = preview.reveal ? "#e8d9b8" : "#8d7a5b";
```

to:

```js
      /* An armed table previews in the colour of a spell, not of fog:
         the box is about to burn, not to be revealed. */
      g.strokeStyle = armed ? "#d0632a" : preview.reveal ? "#e8d9b8" : "#8d7a5b";
```

and guard the fill so an armed drag does not preview a reveal — change:

```js
      if(preview.reveal){
```

to:

```js
      if(armed){
        /* nothing to show inside the box: the effect is not there yet */
      }else if(preview.reveal){
```

- [ ] **Step 6: Keep frames coming while an effect plays, and draw it**

In `map-table.html`, beside `animatePings`, add:

```js
/* A playing effect needs frames nothing else is asking for — the same
   problem the ping already has. One loop for both, so two rAF chains
   cannot both think they own the frame. */
function animateFx(){ animatePings(); }
```

and change `animatePings`'s stopping condition from:

```js
    if(!pings.length){ ringing = false; requestPaint(); return; }
```

to:

```js
    if(!pings.length && !SpellFx.playing()){ ringing = false; requestPaint(); return; }
```

In `drawPointer(g, cv)`, at the very end of the function, add:

```js
  /* Above the fog and above the dot: the DM points at a thing and then
     sets fire to it. */
  SpellFx.draw(g, state.view);
```

- [ ] **Step 7: Bump the cache token and check it by hand**

```bash
cd press
sed -i 's/spellfx\.js?v=20260814a/spellfx.js?v=20260814b/; s/fog\.js?v=20260814a/fog.js?v=20260814b/; s/wazoo-build" content="20260814a"/wazoo-build" content="20260814b"/' map-table.html map-screen.html
```

Then, in a browser at `http://127.0.0.1:8731/map-table.html` with a map loaded:

1. Click **Effects** — the panel opens, the list fills, bundled effects first.
2. Type `fire` — the list narrows; every line says `fire`.
3. Click **fire explosion 01** — the bar reads `armed: fire explosion 01`, the cursor becomes a copy cursor.
4. Drag a box on the map — an explosion plays inside it once and vanishes. The fog is unchanged; **Undo** does not remove it.
5. Press **Escape** — the bar clears, the panel closes, a drag paints fog again.

- [ ] **Step 8: Run the suite**

Reload `http://127.0.0.1:8731/map-table.html?test=1`. Expected: `PASS n/n`, unchanged from Task 5 — this task is wiring, and its check is the walk-through above.

- [ ] **Step 9: Commit**

```bash
git add map-table.html map-screen.html
git commit -m "feat: cast an effect from the table

Effects opens a panel over 376 animations; a word narrows it, a click
arms the table, and the next drag casts instead of painting fog. The
armed effect is named in the bar and Escape puts the fog tools back,
because a mode you cannot see is a mode you forget you are in.

A cast is not a stroke: no undo slot, no autosave, nothing in a sync."
```

---

### Task 7: The projector plays it too

**Files:**
- Modify: `map-screen.html` — the channel handler, the draw, the animation loop

**Interfaces:**
- Consumes: `{t:"preload", path}` and `{t:"cast", path, rect}` from Task 6; `SpellFx.preload`, `SpellFx.cast`, `SpellFx.draw`, `SpellFx.playing`, `SpellFx.index`, `SpellFx.loadIndex` from Tasks 3 and 5.
- Produces: nothing — this is the end of the chain.

- [ ] **Step 1: Load the catalogue at boot**

In `map-screen.html`, just above the `Fog.open(...)` call, add:

```js
/* The projector needs the catalogue for the same reason the table does:
   a message carries a path, and only the index says whether that path is
   a file in this repository or a fetch from the pack. */
SpellFx.loadIndex();

/* The effect a path names, or null if the catalogue has not arrived or
   does not know it. */
function fxByPath(path){
  const idx = SpellFx.index();
  if(!idx) return null;
  for(let i = 0; i < idx.effects.length; i++) if(idx.effects[i].path === path) return idx.effects[i];
  return null;
}
```

- [ ] **Step 2: Handle the two messages**

In `map-screen.html`, in the channel handler, after the `ping` block, add:

```js
  /* Warm a file up before it is needed, so the first cast of the evening
     does not stutter here while the table plays it smoothly. */
  if(m.t === "preload"){
    const e = fxByPath(m.path);
    if(e) SpellFx.preload(e);
    else SpellFx.loadIndex().then(function(){
      const late = fxByPath(m.path);
      if(late) SpellFx.preload(late);
    });
    return;
  }
  if(m.t === "cast"){
    const e = fxByPath(m.path);
    if(e){ SpellFx.cast(e, m.rect); animatePings(); }
    return;
  }
```

- [ ] **Step 3: Draw them, above everything**

In `map-screen.html`'s `redraw()`, at the very end — after the laser — add:

```js
  /* Last, over the fog: an effect happens on top of the world, and the
     players should see it whether or not that ground is revealed. */
  SpellFx.draw(g, st.view);
```

and change `animatePings`'s stopping condition from:

```js
    if(!pings.length){ ringing = false; requestPaint(); return; }
```

to:

```js
    if(!pings.length && !SpellFx.playing()){ ringing = false; requestPaint(); return; }
```

- [ ] **Step 4: Check both windows together**

Serve, open `http://127.0.0.1:8731/map-table.html`, load a map, and click **Open the players' screen** so the projector is a real window. Then:

1. Arm **fire explosion 01** and drag a box on the table. The effect plays in **both** windows, in the same place on the map, and vanishes in both.
2. Zoom the table in, then cast again. The effect lands on the same ground in both windows, at each window's own scale — this is what the image-space rectangle buys.
3. Arm an effect whose line says `fetches`, and cast it. It plays after a moment's pause the first time. Cast it again: no pause.
4. Turn the network off and cast that same effect again. It still plays, from IndexedDB.
5. Cast, then immediately press **Rotate**. The map turns on both windows and nothing is left drawn crooked.

- [ ] **Step 5: Run the suite one last time**

Reload `http://127.0.0.1:8731/map-table.html?test=1`. Expected: `PASS n/n`, unchanged from Task 6.

- [ ] **Step 6: Commit**

```bash
git add map-screen.html
git commit -m "fix: the players see the spell too

The projector takes a path and a rectangle in image space, finds the
effect in the same catalogue the table used, and plays its own copy —
above the fog, because a spell happens on top of the world whether or
not that ground has been revealed."
```

---

## After the plan

The map table has no automated end-to-end coverage and never has: the suite proves the
arithmetic, and the DM proves the tool. Hand back to the user for a session at the table before
pushing, exactly as the laser and the fog rectangle were handled.

Pushing is a pull request into `main`, which deploys to GitHub Pages about a minute later. Hard
reload both windows afterwards — HTML cannot be versioned by query token.
