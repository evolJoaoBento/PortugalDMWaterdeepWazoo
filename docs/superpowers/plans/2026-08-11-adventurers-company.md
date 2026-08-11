# The Adventurers' Company Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public roster of the campaign's player characters, and a ward-gated DM page that shows their D&D Beyond sheets as a wall of tablets.

**Architecture:** Two new self-contained HTML pages read one hand-maintained `data/adventurers.json`, exactly as `The-Notice-Board.html` reads `data/notices.json`. The public page renders cards; the DM page renders an iframe per character whose sheet is Public and a click-through tile for the rest. Both pages carry their own in-page test suite at `?test=1`, the convention `editor.html` already established.

**Tech Stack:** Plain HTML/CSS/ES5-flavoured JS, no build step, no dependencies. Python + Pillow 11.3.0 is used once, offline, to convert portraits to WebP.

**Spec:** `docs/superpowers/specs/2026-08-11-adventurers-company-design.md`

## Global Constraints

- **No build step, no package manager, no CLI test runner.** Tests run in a browser at `?test=1`. Serve with `python -m http.server 8731 --bind 127.0.0.1`.
- **Page CSS stays inline in the page.** Do not add to `assets/wazoo.css` — changing a shared asset forces bumping `?v=` in all six existing pages. New pages reference the current token `?v=20260808n` unchanged.
- **Shared JS for the two new pages lives in `assets/company.js`**, a new file. Because no existing page references it, adding it does not trigger the bump-everywhere rule — that rule bites only when an already-shared asset changes. It carries `esc`, `sheetUrl`, `memberLine` and `isPublic`; page-specific rendering stays in the page.
- **The repository is public.** No player real names, no D&D Beyond handles, no credentials in any committed file.
- **A cross-origin iframe is opaque.** Never write code that tries to read an embedded sheet's contents, title, or load result. The `public` flag in the JSON is the only signal.
- **Warded pages build after the ward lifts.** Listen for `ward:open` on `document`; do not render sheet frames at load.
- Character sheet URLs are always derived: `https://www.dndbeyond.com/characters/<ddbId>`.
- Both new pages must be added to `HIDDEN` in `press-room.html` or they will be published in the public archive as reading matter.

---

### Task 1: The roster data and portraits

**Files:**
- Create: `data/adventurers.json`
- Create: `assets/adventurers/ganja.webp`, `jacinto-pinto.webp`, `quim-das-bolas-de-fogo.webp`, `violet-rarnoz.webp`
- Create (throwaway, not committed): `scripts/fetch-portraits.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `data/adventurers.json` with the member shape used by every later task —
  `{id, ddbId, name, race, class, level, portrait, blurb, public}` where `level` is a
  number, `public` is a boolean, and `portrait` is a repo-relative path.

- [ ] **Step 1: Write the portrait fetch-and-convert script**

Create `scripts/fetch-portraits.py`:

```python
"""One-shot: pull the four DDB portraits and re-encode them to WebP.

The originals are 0.3-1.5 MB of JPEG each. Four of those on one page would
repeat the mistake the Penny Press was rebuilt to avoid, so they are resized
to fit a card and saved as WebP.
"""
import io, pathlib, urllib.request
from PIL import Image

SRC = {
    "ganja":                  "https://www.dndbeyond.com/avatars/58001/799/1581111423-168950625.jpeg",
    "jacinto-pinto":          "https://www.dndbeyond.com/avatars/57998/75/1581111423-168938738.jpeg",
    "quim-das-bolas-de-fogo": "https://www.dndbeyond.com/avatars/58000/687/1581111423-168947295.jpeg",
    "violet-rarnoz":          "https://www.dndbeyond.com/avatars/58229/960/1581111423-169493126.jpeg",
}

out = pathlib.Path("assets/adventurers")
out.mkdir(parents=True, exist_ok=True)

for slug, url in SRC.items():
    raw = urllib.request.urlopen(url, timeout=30).read()
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    im.thumbnail((640, 640))
    dest = out / (slug + ".webp")
    im.save(dest, "WEBP", quality=82, method=6)
    print(f"{slug}: {len(raw)//1024} KB JPEG -> {dest.stat().st_size//1024} KB WebP")
```

- [ ] **Step 2: Run it**

Run: `python scripts/fetch-portraits.py`
Expected: four lines, each showing the WebP well under the JPEG. All four files exist in `assets/adventurers/`.

If any URL 404s, the portrait was changed on D&D Beyond since the spec was written. Re-read that character's sheet for the current avatar URL rather than guessing.

- [ ] **Step 3: Write the roster**

Create `data/adventurers.json`:

```json
{
  "_comment": "The Adventurers' Company. Hand-edited. Portraits in assets/adventurers/. `public` means that player has set their D&D Beyond sheet privacy to Public — only then can it be embedded, because an iframe is always logged out.",
  "updated": "1492-07-08",
  "members": [
    {
      "id": "ganja",
      "ddbId": "168950625",
      "name": "Ganja",
      "race": "Goliath",
      "class": "Barbarian",
      "level": 5,
      "portrait": "assets/adventurers/ganja.webp",
      "blurb": "",
      "public": false
    },
    {
      "id": "jacinto-pinto",
      "ddbId": "168938738",
      "name": "Jacinto Pinto",
      "race": "Half-Elf",
      "class": "Wizard",
      "level": 5,
      "portrait": "assets/adventurers/jacinto-pinto.webp",
      "blurb": "",
      "public": false
    },
    {
      "id": "quim-das-bolas-de-fogo",
      "ddbId": "168947295",
      "name": "Quim das Bolas de Fogo",
      "race": "Human",
      "class": "Barbarian",
      "level": 5,
      "portrait": "assets/adventurers/quim-das-bolas-de-fogo.webp",
      "blurb": "",
      "public": false
    },
    {
      "id": "violet-rarnoz",
      "ddbId": "169493126",
      "name": "Violet Rarnoz",
      "race": "Half-Elf",
      "class": "Warlock",
      "level": 5,
      "portrait": "assets/adventurers/violet-rarnoz.webp",
      "blurb": "",
      "public": false
    }
  ]
}
```

- [ ] **Step 4: Verify it parses and every portrait exists**

Run:

```bash
python -c "
import json, pathlib
d = json.load(open('data/adventurers.json', encoding='utf-8'))
assert len(d['members']) == 4, d
for m in d['members']:
    assert pathlib.Path(m['portrait']).is_file(), m['portrait']
    assert isinstance(m['level'], int) and isinstance(m['public'], bool), m
print('roster ok')
"
```

Expected: `roster ok`

- [ ] **Step 5: Commit**

```bash
git add data/adventurers.json assets/adventurers/
git commit -m "feat: the roster of the Adventurers' Company

Four characters, their portraits re-encoded to WebP. Every sheet is
Private today, so `public` is false throughout; flipping one to true is
what turns its tile into a live embed."
```

Do **not** commit `scripts/fetch-portraits.py` — it is a one-shot. Leave it untracked or delete it.

---

### Task 2: adventurers.html — the pure functions, tested first

**Files:**
- Create: `assets/company.js`
- Create: `adventurers.html`

**Interfaces:**
- Consumes: the member shape from Task 1.
- Produces, on `window`, for both new pages and their tests:
  - In `assets/company.js`, shared by `adventurers.html` and `guild-master.html`:
    - `esc(s) -> string` — HTML-escapes `& < > "`
    - `sheetUrl(m) -> string` — `https://www.dndbeyond.com/characters/<ddbId>`, or `""` when `ddbId` is missing
    - `memberLine(m) -> string` — e.g. `"Goliath Barbarian 5"`, skipping absent parts
    - `isPublic(m) -> boolean` — true only when `m.public === true`
  - In `adventurers.html` itself, because only that page renders cards:
    - `cardHTML(m) -> string` — one `<article class="member">…</article>`

- [ ] **Step 1: Write the page shell with a failing test suite**

Create `adventurers.html`. Follow the head convention of the other public pages (`press-room.html`), but note this page is public and indexable, so it gets **no** `noindex` meta.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="wazoo-build" content="20260808n">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Adventurers&rsquo; Company &mdash; Waterdeep</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/wazoo.css?v=20260808n">

<style>
/* The register itself. Page-owned, so changing it never forces a ?v= bump
   across the other six pages. */
.roster{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));margin:26px 0 0}
.member{
  display:flex;flex-direction:column;
  background:linear-gradient(180deg,rgba(28,22,14,.86),rgba(14,11,7,.92));
  border:1px solid #3a2c1a;border-radius:3px;overflow:hidden;
  box-shadow:0 8px 26px rgba(0,0,0,.45);
}
.member img,.member .sigil{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:#160f09}
.member .sigil{display:grid;place-items:center;color:#5b4326;font:600 42px/1 "Cinzel",serif}
.member .body{padding:13px 14px 15px}
.member h3{margin:0;font:600 18px/1.25 "Cinzel",serif;color:#e8d9b8;letter-spacing:.02em}
.member .kind{margin:4px 0 0;font:400 13px/1.4 "EB Garamond",Georgia,serif;color:#a28f6d;letter-spacing:.04em}
.member .blurb{margin:9px 0 0;font:400 15px/1.5 "EB Garamond",Georgia,serif;color:#c8b795}
.member .go{margin:11px 0 0;display:inline-block;font:500 10.5px/1 "Cinzel",serif;letter-spacing:.16em;text-transform:uppercase;color:#c8a86a;text-decoration:none}
.roster-error{margin:26px 0;padding:14px 16px;border:1px solid #6d3a32;border-radius:3px;background:rgba(60,20,16,.35);color:#e2a89f;font:400 15px/1.5 "EB Garamond",Georgia,serif}
.masterway{margin:34px 0 0;text-align:center}
#tests{display:none;white-space:pre-wrap;font:12.5px/1.7 ui-monospace,Menlo,Consolas,monospace;color:#a89070;background:#0b0805;padding:16px}
</style>
<script src="assets/company.js?v=20260808n"></script>
</head>
<body>

<div class="wrap">
  <h1>The Adventurers&rsquo; Company</h1>
  <div id="roster" class="roster"></div>
  <div class="masterway"><a class="go" href="guild-master.html" rel="nofollow">Guild Master &rarr;</a></div>
</div>

<pre id="tests"></pre>

<script src="assets/backdrop.js?v=20260808n"></script>
<script>
/* =========================================================================
   Self-tests:  adventurers.html?test=1
   ========================================================================= */
function runTests(){
  const out=[]; let pass=0, fail=0;
  const ok=(name,cond,extra)=>{ if(cond){pass++; out.push("PASS  "+name);} else {fail++; out.push("FAIL  "+name+(extra?"\n      "+extra:""));} };

  const m = {id:"ganja", ddbId:"168950625", name:"Ganja", race:"Goliath",
             class:"Barbarian", level:5, portrait:"assets/adventurers/ganja.webp",
             blurb:"Owes three temples.", public:false};

  ok("escapes angle brackets", esc("<b>") === "&lt;b&gt;", esc("<b>"));
  ok("escapes quotes", esc('a"b').indexOf("&quot;") > -1, esc('a"b'));

  ok("sheet url", sheetUrl(m) === "https://www.dndbeyond.com/characters/168950625", sheetUrl(m));
  ok("no id, no url", sheetUrl({name:"x"}) === "", sheetUrl({name:"x"}));

  ok("member line", memberLine(m) === "Goliath Barbarian 5", memberLine(m));
  ok("member line skips gaps", memberLine({class:"Bard"}) === "Bard", memberLine({class:"Bard"}));

  ok("public is strict", isPublic(m) === false && isPublic({public:true}) === true);
  ok("absent public is false", isPublic({}) === false);

  const card = cardHTML(m);
  ok("card shows the name", card.indexOf("Ganja") > -1, card);
  ok("card shows the line", card.indexOf("Goliath Barbarian 5") > -1, card);
  ok("card links the sheet", card.indexOf("/characters/168950625") > -1, card);
  ok("card escapes a hostile name",
     cardHTML(Object.assign({}, m, {name:"<script>x</scr"+"ipt>"})).indexOf("&lt;script&gt;") > -1);
  ok("no portrait gives a sigil",
     cardHTML(Object.assign({}, m, {portrait:""})).indexOf('class="sigil"') > -1);
  ok("empty blurb prints nothing",
     cardHTML(Object.assign({}, m, {blurb:""})).indexOf('class="blurb"') === -1);

  const el=document.getElementById("tests");
  el.style.display="block";
  el.textContent = "Adventurers' Company self-tests\n"+"=".repeat(46)+"\n"+out.join("\n")+
    "\n"+"=".repeat(46)+"\n"+pass+" passed, "+fail+" failed\n";
  document.title = (fail? "FAIL " : "PASS ")+pass+"/"+(pass+fail)+" — Company tests";
}

(function boot(){
  if(/[?&]test=1/.test(location.search)){ runTests(); return; }
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Run the tests and watch them fail**

Run `python -m http.server 8731 --bind 127.0.0.1`, open `http://127.0.0.1:8731/adventurers.html?test=1`.
Expected: the page throws `esc is not defined` — nothing is implemented yet. Confirm the failure is that, not a syntax error in the test block.

- [ ] **Step 3a: Write the shared file**

Create `assets/company.js`. It is loaded by this page and by `guild-master.html` in Task 4, so nothing page-specific belongs in it.

```javascript
/* ═══════════════════════════════════════════════════════════════════
   The Company — what the roster pages both need.

   Two pages read data/adventurers.json: the public register and the
   Guild Master's wall. This is the part they share. Card and tile
   markup stays in the page that draws it.

   New file, referenced by those two pages only — so it does not drag
   the rest of the site into a ?v= bump the way editing wazoo.css or
   keyring.js would.
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c];
    });
  }

  function sheetUrl(m){
    return m && m.ddbId ? "https://www.dndbeyond.com/characters/" + encodeURIComponent(m.ddbId) : "";
  }

  /* "Goliath Barbarian 5" — and whatever subset of that actually exists. */
  function memberLine(m){
    return [m.race, m.class, m.level].filter(function(x){
      return x !== null && x !== undefined && x !== "";
    }).join(" ");
  }

  /* Only an explicit true. A missing flag must mean "not public": the
     fallback tile always works, a broken embed does not. */
  function isPublic(m){ return !!m && m.public === true; }

  root.esc = esc;
  root.sheetUrl = sheetUrl;
  root.memberLine = memberLine;
  root.isPublic = isPublic;
})(window);
```

- [ ] **Step 3b: Implement the card**

Insert above `runTests()` in `adventurers.html`:

```javascript
function cardHTML(m){
  var url  = sheetUrl(m);
  var line = memberLine(m);
  var face = m.portrait
    ? '<img src="' + esc(m.portrait) + '" alt="" loading="lazy">'
    : '<div class="sigil" aria-hidden="true">' + esc((m.name || "?").charAt(0)) + '</div>';
  return '<article class="member">' + face +
    '<div class="body">' +
      '<h3>' + esc(m.name) + '</h3>' +
      (line ? '<p class="kind">' + esc(line) + '</p>' : '') +
      (m.blurb ? '<p class="blurb">' + esc(m.blurb) + '</p>' : '') +
      (url ? '<a class="go" href="' + esc(url) + '" target="_blank" rel="noopener">View sheet &#8599;</a>' : '') +
    '</div></article>';
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Reload `http://127.0.0.1:8731/adventurers.html?test=1`.
Expected: `14 passed, 0 failed`, and the tab title reads `PASS 14/14`.

- [ ] **Step 5: Commit**

```bash
git add assets/company.js adventurers.html
git commit -m "feat: the Adventurers' Company page, register functions

Card rendering with its own suite at adventurers.html?test=1, following
the Penny Press convention. The parts the Guild Master's wall will also
need live in assets/company.js. Nothing is fetched yet."
```

---

### Task 3: adventurers.html — render the roster

**Files:**
- Modify: `adventurers.html` (the boot block, and one added function)

**Interfaces:**
- Consumes: `cardHTML` from Task 2, `data/adventurers.json` from Task 1.
- Produces: nothing further; this completes the public page.

- [ ] **Step 1: Add a failing test for the empty and error states**

Add to `runTests()`, before the summary block:

```javascript
  ok("no members says so", rosterHTML([]).indexOf("No one has signed") > -1, rosterHTML([]));
  ok("members render in order",
     rosterHTML([m, Object.assign({}, m, {id:"v", name:"Violet"})]).indexOf("Ganja") <
     rosterHTML([m, Object.assign({}, m, {id:"v", name:"Violet"})]).indexOf("Violet"));
```

- [ ] **Step 2: Run and watch it fail**

Reload `adventurers.html?test=1`.
Expected: `rosterHTML is not defined`.

- [ ] **Step 3: Implement rendering and loading**

Add after `cardHTML`:

```javascript
function rosterHTML(members){
  if(!members || !members.length){
    return '<p class="roster-error">No one has signed the register yet.</p>';
  }
  return members.map(cardHTML).join("");
}

/* A failure has to be visible. An empty roster and a roster that failed to
   load look identical otherwise, and the second one is a bug. */
function showError(msg){
  document.getElementById("roster").innerHTML =
    '<p class="roster-error">The register could not be read &mdash; ' + esc(msg) + '</p>';
}

async function loadRoster(){
  try{
    var res = await fetch("data/adventurers.json", { cache: "no-cache" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    var data = await res.json();
    document.getElementById("roster").innerHTML = rosterHTML(data.members || []);
  }catch(e){
    showError(e.message);
  }
}
```

Then replace the boot block:

```javascript
(function boot(){
  if(/[?&]test=1/.test(location.search)){ runTests(); return; }
  loadRoster();
})();
```

- [ ] **Step 4: Run the tests and the page**

Reload `adventurers.html?test=1` → expected `16 passed, 0 failed`.
Open `http://127.0.0.1:8731/adventurers.html` → four cards with portraits, names and `Goliath Barbarian 5`-style lines, and a *Guild Master →* link below.

- [ ] **Step 5: Prove the error path, then undo it**

Temporarily change the fetch path to `data/adventurers-nope.json`, reload the page, and confirm you get *"The register could not be read — HTTP 404"* rather than a blank page. Change it back.

- [ ] **Step 6: Commit**

```bash
git add adventurers.html
git commit -m "feat: render the roster from data/adventurers.json

A failed read says so on the page; an empty register and a broken one
must not look the same."
```

---

### Task 4: guild-master.html — the sheet wall

**Files:**
- Create: `guild-master.html`

**Interfaces:**
- Consumes: the member shape from Task 1; `esc`, `sheetUrl` and `isPublic` from `assets/company.js` (Task 2) — do **not** redefine them here; `Keyring` from `assets/keyring.js`; the `ward:open` event from `assets/gate.js`.
- Produces: nothing later depends on it.

- [ ] **Step 1: Write the page with a failing test suite**

Create `guild-master.html`. This one is a DM tool, so it takes `noindex, nofollow` and both ward scripts, exactly as `scriptorium.html` does.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="wazoo-build" content="20260808n">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>The Guild Master &mdash; Waterdeep</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/wazoo.css?v=20260808n">

<style>
.wall{display:grid;gap:14px;padding:14px}
.wall.two{grid-template-columns:repeat(2,1fr)}
.wall.four{grid-template-columns:repeat(4,1fr)}
.tablet{position:relative;height:78vh;border:2px solid #2b2014;border-radius:10px;overflow:hidden;background:#0b0805}
.tablet > b{display:block;padding:5px 9px;background:#1a1309;font:500 10.5px/1.5 "Cinzel",serif;letter-spacing:.13em;text-transform:uppercase;color:#a89070}
.tablet iframe{width:100%;height:calc(100% - 25px);border:0;background:#fff;display:block}
.shut{height:calc(100% - 25px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;text-align:center;padding:18px}
.shut img{width:104px;height:104px;object-fit:cover;border-radius:50%;border:1px solid #3a2c1a}
.shut p{margin:0;font:400 15px/1.5 "EB Garamond",Georgia,serif;color:#a28f6d}
.note{margin:0;padding:12px 16px;font:400 14.5px/1.5 "EB Garamond",Georgia,serif;color:#a28f6d;border-bottom:1px solid #2b2014}
.bar{display:flex;gap:9px;align-items:center;padding:11px 16px}
#tests{display:none;white-space:pre-wrap;font:12.5px/1.7 ui-monospace,Menlo,Consolas,monospace;color:#a89070;background:#0b0805;padding:16px}
</style>
<script src="assets/company.js?v=20260808n"></script>
<script src="assets/keyring.js?v=20260808n"></script>
<script src="assets/gate.js?v=20260808n"></script>
</head>
<body>

<p class="note">A frame is always a logged-out visitor, whoever you are. Only a sheet whose
privacy is set to <b>Public</b> will show here &mdash; the rest open in their own tab, where
your own login counts.</p>

<div class="bar">
  <button id="grid-2" type="button">2 up</button>
  <button id="grid-4" type="button">4 up</button>
</div>

<div id="wall" class="wall two"></div>
<pre id="tests"></pre>

<script>
/* =========================================================================
   Self-tests:  guild-master.html?test=1
   ========================================================================= */
function runTests(){
  const out=[]; let pass=0, fail=0;
  const ok=(name,cond,extra)=>{ if(cond){pass++; out.push("PASS  "+name);} else {fail++; out.push("FAIL  "+name+(extra?"\n      "+extra:""));} };

  const shut = {id:"ganja", ddbId:"168950625", name:"Ganja", race:"Goliath", class:"Barbarian",
                level:5, portrait:"assets/adventurers/ganja.webp", public:false};
  const open = Object.assign({}, shut, {public:true});

  ok("public gets an iframe", tileHTML(open).indexOf("<iframe") > -1, tileHTML(open));
  ok("iframe points at the sheet",
     tileHTML(open).indexOf("dndbeyond.com/characters/168950625") > -1, tileHTML(open));
  ok("private gets no iframe", tileHTML(shut).indexOf("<iframe") === -1, tileHTML(shut));
  ok("private says why", tileHTML(shut).indexOf("Private") > -1, tileHTML(shut));
  ok("private offers a tab", tileHTML(shut).indexOf('target="_blank"') > -1, tileHTML(shut));
  ok("both label the name", tileHTML(open).indexOf("Ganja") > -1 && tileHTML(shut).indexOf("Ganja") > -1);
  ok("hostile name escaped",
     tileHTML(Object.assign({}, shut, {name:"<b>x</b>"})).indexOf("&lt;b&gt;") > -1);
  ok("no ddbId cannot embed",
     tileHTML({name:"Nobody", public:true}).indexOf("<iframe") === -1);

  ok("wall renders one tile per member", (wallHTML([shut, open]).match(/class="tablet"/g)||[]).length === 2);
  ok("empty wall says so", wallHTML([]).indexOf("No one has signed") > -1, wallHTML([]));

  const el=document.getElementById("tests");
  el.style.display="block";
  el.textContent = "Guild Master self-tests\n"+"=".repeat(46)+"\n"+out.join("\n")+
    "\n"+"=".repeat(46)+"\n"+pass+" passed, "+fail+" failed\n";
  document.title = (fail? "FAIL " : "PASS ")+pass+"/"+(pass+fail)+" — Guild Master tests";
}
</script>
</body>
</html>
```

- [ ] **Step 2: Run and watch it fail**

Open `http://127.0.0.1:8731/guild-master.html?test=1`.

The ward covers the screen at `z-index:9999`, so the `#tests` block is behind it. **Read the result in the browser tab title** — that is exactly why `runTests` sets it, and it works with the ward up. You can also dismiss the ward or pass it to see the full list.

Expected: the title does not change, and the console shows `tileHTML is not defined`.

- [ ] **Step 3: Implement the wall**

Insert above `runTests()`:

```javascript
/* =========================================================================
   The wall. One tablet per member.

   A cross-origin frame is opaque — this page cannot read whether D&D
   Beyond served a sheet or its 403 dragon, cannot see the frame's title,
   and onload fires either way. So the roster is asked, not the frame.

   esc, sheetUrl and isPublic come from assets/company.js — this page and
   the public register share them. Do not redefine them here.
   ========================================================================= */
function tileHTML(m){
  var url = sheetUrl(m);
  var head = '<b>' + esc(m.name) + '</b>';
  if(isPublic(m) && url){
    return '<div class="tablet">' + head +
      '<iframe src="' + esc(url) + '" loading="lazy" title="' + esc(m.name) + '"></iframe></div>';
  }
  var face = m.portrait ? '<img src="' + esc(m.portrait) + '" alt="">' : '';
  var door = url
    ? '<a class="go" href="' + esc(url) + '" target="_blank" rel="noopener">Open in tab &#8599;</a>'
    : '';
  return '<div class="tablet">' + head +
    '<div class="shut">' + face + '<p>Sheet is Private</p>' + door + '</div></div>';
}

function wallHTML(members){
  if(!members || !members.length){
    return '<p class="note">No one has signed the register yet.</p>';
  }
  return members.map(tileHTML).join("");
}

async function loadWall(){
  var wall = document.getElementById("wall");
  try{
    var res = await fetch("data/adventurers.json", { cache: "no-cache" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    var data = await res.json();
    wall.innerHTML = wallHTML(data.members || []);
  }catch(e){
    wall.innerHTML = '<p class="note">The register could not be read &mdash; ' + esc(e.message) + '</p>';
  }
}

function wire(){
  document.getElementById("grid-2").addEventListener("click", function(){
    document.getElementById("wall").className = "wall two";
  });
  document.getElementById("grid-4").addEventListener("click", function(){
    document.getElementById("wall").className = "wall four";
  });
}

(function boot(){
  if(/[?&]test=1/.test(location.search)){ runTests(); return; }
  wire();
  /* The ward lifts once the key is accepted. Building before that would
     put four frames behind the door for nobody to see. */
  document.addEventListener("ward:open", loadWall);
})();
```

- [ ] **Step 4: Run the tests**

Reload `guild-master.html?test=1` → the tab title reads `PASS 10/10 — Guild Master tests`. Dismiss the ward to read the full list; expected `10 passed, 0 failed`.

- [ ] **Step 5: Run the page**

Open `http://127.0.0.1:8731/guild-master.html`, give the ward a valid token.
Expected: four tiles, each showing the portrait, the name, *Sheet is Private*, and an *Open in tab ↗* link that opens the real sheet in a new tab where you are logged in. The 2-up / 4-up buttons re-flow the grid.

- [ ] **Step 6: Commit**

```bash
git add guild-master.html
git commit -m "feat: the Guild Master's wall of character sheets

One tablet per member, built after the ward lifts. A public sheet embeds;
a private one shows a tile that opens in a tab, where the DM's own login
counts. The frame is never asked whether it worked, because it cannot be."
```

---

### Task 5: Wire the pages into the site

**Files:**
- Modify: `index.html` (the sprite, around line 58-90; the shop list, around line 117-170)
- Modify: `press-room.html:211` (the `HIDDEN` array)

**Interfaces:**
- Consumes: `adventurers.html` from Task 3.
- Produces: nothing.

- [ ] **Step 1: Hide both pages from the public archive**

In `press-room.html`, extend `HIDDEN`:

```javascript
  var HIDDEN = ['index.html', 'press-room.html', 'cartographer.html',
                'scriptorium.html', 'editor.html', 'job-board-ddb.html',
                'adventurers.html', 'guild-master.html'];
```

This is not cosmetic. The archive lists every root `.html` that is not in this array, which is how `The-Notice-Board.html` comes to be listed as reading matter. Without it, the DM's sheet wall is advertised on the public press room.

- [ ] **Step 2: Verify the archive no longer lists them**

Open `http://127.0.0.1:8731/press-room.html`, then in the console run `sessionStorage.clear()` and reload.

The clear matters: that listing is cached under `wazoo-files-v3`, so without it you may be reading a pre-change answer and conclude the fix worked when it did not — or that it failed when it did.

Expected: neither `adventurers` nor `guild-master` appears in the archive.

- [ ] **Step 3: Add an icon to the sprite**

In `index.html`, inside the `<svg class="sprite">` block beside the other `<symbol>` elements, add:

```html
  <symbol id="i-company" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M24 6l4 7h-8l4-7z"/>
    <path d="M24 13v22"/>
    <path d="M15 20l-5 5 5 5"/>
    <path d="M33 20l5 5-5 5"/>
    <path d="M13 41h22"/>
  </symbol>
```

- [ ] **Step 4: Add the shop sign**

In the `<nav class="shops">` list, after the notice-board entry, add:

```html
      <a class="shop" href="adventurers.html">
        <span class="beam"></span><span class="ring l"></span><span class="ring r"></span>
        <svg class="logo" aria-hidden="true"><use href="#i-company"/></svg>
        <span class="trade">The Guild Hall</span>
        <h2>The Adventurers&rsquo; Company</h2>
        <p>Who walks these streets on your behalf, and what they answer to.</p>
        <span class="go"><span>Read the register &rarr;</span></span>
      </a>
```

- [ ] **Step 5: Check the street**

Open `http://127.0.0.1:8731/index.html`.
Expected: a new shop sign matching the others — icon drawn, hover beam working — that leads to the roster.

- [ ] **Step 6: Commit**

```bash
git add index.html press-room.html
git commit -m "feat: a door to the Company, and keep both new pages out of the archive

press-room lists every root .html not named in HIDDEN, so the roster and
the DM's wall would otherwise be published as reading matter."
```

---

### Task 6: Prove the embed path

**Files:** none — this is verification, and it needs one thing from outside the repository.

- [ ] **Step 1: Get one sheet set to Public**

Every character is Private today, so only the fallback tile has ever been exercised. The DM's account shows a `MANAGE` chip on these sheets and may be able to change privacy directly; otherwise this is one message to one player. Sheet privacy lives in the character's own settings: **Public**, not Campaign Only — a frame can never be a campaign member.

- [ ] **Step 2: Flip that character's flag**

In `data/adventurers.json`, set `"public": true` on that member only.

- [ ] **Step 3: Look at the wall**

Reload `guild-master.html`, pass the ward.
Expected: that member's tablet shows the live sheet — real HP, AC, actions — while the other three still show their *Sheet is Private* tiles. If it shows the 403 dragon instead, the sheet is set to Campaign Only rather than Public.

- [ ] **Step 4: Commit**

```bash
git add data/adventurers.json
git commit -m "feat: <name>'s sheet is public, so it embeds"
```

- [ ] **Step 5: Deploy and re-check**

```bash
git push
```

Wait about a minute for Pages, then open the live URLs. Hard-reload (Ctrl-Shift-R): these are new pages, but `index.html` and `press-room.html` were modified, and a page you visited in the last ten minutes serves from cache. Confirm the street shows the new sign and the archive does not list the two new pages.

---

## Notes for whoever runs this

- **Blurbs are empty on purpose.** `cardHTML` omits the paragraph when `blurb` is `""`, so the cards are correct without them. Fill them in whenever the DM supplies them; no code changes.
- **Quim's race** was read as `Human` from a summary that parsed as `["M", "Human", "Barbarian 5"]`, where `M` appears to be a gender marker. If the DM says otherwise, it is a one-word edit in the JSON.
- **Do not add a "check if the embed worked" feature.** It is not possible from JavaScript, and an attempt that appears to work is worse than none.
