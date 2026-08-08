# Waterdeep — The City of Splendours

A D&D campaign site: a fantasy broadsheet, a notice board, an interactive
map, and two workshops for editing the first two from a browser.

**Live:** <https://evoljoaobento.github.io/PortugalDMWaterdeepWazoo/>

Static files on GitHub Pages. No server, no build step, no dependencies to
install — every page is HTML you can open directly.

---

## The pages

| Page | What it is |
|---|---|
| `index.html` | The street. The city from the sea, then a shop sign for every door. |
| `press-room.html` | The Waterdeep Wazoo — current issue and back numbers. |
| `cartographer.html` | The aidedd.org atlas of Waterdeep, full-bleed. |
| `The-Notice-Board.html` | Postings nailed to a plank board; click one to read it. |
| `The-Waterdeep-Wazoo-<month>-<day>-<year>.html` | A published issue. |

The press room builds its archive from the repository itself through the
GitHub contents API, so committing a new issue is enough to list it — no
page needs editing to publish.

---

## The workshops

Both are public pages, because every file in a public repository is. Neither
is protected by being hard to find, and neither could be: a password checked
in JavaScript sits in source anyone can read.

**The lock is a GitHub token, and GitHub checks it.** Without one these pages
read and preview and change nothing. With one they commit to this repository
and GitHub decides whether that is allowed. The ward on the door is courtesy
— it stops someone wandering in and concluding the site is broken. It is not
armour, and it says so itself.

| Workshop | Edits |
|---|---|
| `scriptorium.html` — **Guild** | The notice board: create, edit, reorder, delete postings. |
| `editor.html` — **Penny Press** | Broadsheets: write, style, place pictures, publish, reopen. |

### Getting in

1. Make a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
2. Scope it to **this repository only**, permission **Contents: Read and write**, nothing else
3. Open either workshop and give it to the ward

The token is kept in that browser's `localStorage`, never in the page or the
repository, and there is a *Forget the key* button. It is re-checked against
GitHub on every load, so an expired token is caught at the door rather than
halfway through publishing.

Publishing commits to the repository, so every edit is dated, attributed and
revertable — that is the undo history. Changes are live about a minute later,
once Pages rebuilds.

---

## How the content is stored

```
data/notices.json                  the notice board's postings
data/issues/<stem>.json            an issue's source, so it can be reopened
assets/issues/<stem>/NN.webp       that issue's pictures, one file each
<stem>.html                        the published issue
<stem>.json                        its front-page card in the press room
```

Issues also **carry their own source**, embedded in the page as
`<script type="application/json" id="penny-source">`. That is what lets any
published broadsheet be reopened for editing, not only the ones whose source
file happens to exist. Picture placements travel with it.

### Pictures are separate files, deliberately

The first issue was 35.8 MB, of which the newspaper — every word and all the
CSS — was 0.02 MB. The rest was six pictures inlined as data URIs, four of
them animated GIFs.

Publishing now writes each picture as its own file and points the HTML at it.
That issue is 19.6 KB with 8.5 MB of media beside it, and readers no longer
download a film on mobile data. It is also small enough for a link crawler to
read, which is what link previews need.

A browser can re-encode a still image to WebP through a canvas but cannot
encode an animated one — there is no API for it. The forge converts stills,
publishes animations untouched, and prints their size in the log rather than
letting it be a surprise.

---

## Dates

Issues carry a Harptos date both as prose and as numbers:

```json
{ "calendar": "harptos", "year": 1492, "month": 7, "monthName": "Flamerule",
  "day": 8, "festival": null, "dayOfYear": 190, "shieldmeetYear": true,
  "text": "Flamerule 8, 1492 DR" }
```

Twelve months of thirty days with five festivals standing *between* certain
months rather than inside any of them, which is why the year is 365 and not
360. Shieldmeet follows Midsummer in years divisible by four. Festivals have
no day number, so `day` is null and `festival` names it.

"Flamerule 8, 1492 DR" reads well and cannot be sorted or filtered; the
numbers are there so later work has something to compute with.

---

## Working on it locally

Any static server will do. GitHub Pages serves everything with
`cache-control: max-age=600`, which matters twice:

**Shared assets** carry `?v=` in their URLs. **Bump that token in every page
when you change `assets/wazoo.css`, `keyring.js`, `gate.js` or
`backdrop.js`** — a different query is a different resource, so the change is
picked up on the next load instead of whenever the cache lapses.

**The HTML pages cannot be versioned that way**, since their URL is the thing
you navigate to. A page you have visited in the last ten minutes will serve
from cache after a deploy, and `editor.html` keeps all its CSS and script
inline — so a stale page is a stale tool, not just stale styling. Hard-reload
(Ctrl-Shift-R) after publishing a change to a page, or wait it out. Checking
the deploy landed by fetching the URL is not enough; that proves the server
has it, not the browser.

```
python -m http.server 8731 --bind 127.0.0.1
```

The Penny Press has its own test suite: **`editor.html?test=1`**. Run it after
touching the forge.

---

## Credits

- Atlas of Waterdeep by [aidedd.org](https://www.aidedd.org/atlas/waterdeep), embedded from their site
- Forgotten Realms and Waterdeep are Wizards of the Coast's; this is a
  personal campaign site and claims none of it
- The panorama on the front page carries an artist's signature and is not yet
  credited — **if you know who painted it, add them here**
