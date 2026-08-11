# The Adventurers' Company — design

Date: 2026-08-11
Status: approved, not yet implemented

## What this is

Two new pages for the Waterdeep campaign site:

- **`adventurers.html`** — a public roster of the campaign's player characters, in the
  same idiom as the rest of the street.
- **`guild-master.html`** — a DM-only wall of live D&D Beyond character sheets, laid out
  as tablets, reached by a *Guild Master* button at the foot of the roster.

Both read one hand-maintained file, `data/adventurers.json`, the way
`The-Notice-Board.html` reads `data/notices.json`.

## Findings that constrain the design

These were established empirically before designing, not assumed.

**1. D&D Beyond character sheets can be framed.**
`https://www.dndbeyond.com/characters/<id>` sends no `X-Frame-Options` and no
`frame-ancestors`, so it loads inside a cross-site iframe. (The main site does block
framing — `https://www.dndbeyond.com/campaigns/<id>` returns `X-Frame-Options:
SAMEORIGIN` and a `frame-src` CSP, and redirects anonymous callers to `/login`.)

**2. Inside a frame, the viewer is always logged out.**
Loading two of the campaign's sheets in a cross-site iframe rendered D&D Beyond's own
403 page — *"the sigil reads 'Private'"* — while the same URL opened top-level in the
same browser rendered the full sheet for the logged-in DM. Chrome does not send the
`dndbeyond.com` session cookie to a cross-site frame.

Consequence: DDB's suggestion of *"Campaign Only or Public"* is misleading here. Campaign
Only requires an authenticated campaign member, which a frame can never be. **Only sheets
set to Public will embed.**

**3. There is no metadata API to lean on.**
`character-service.dndbeyond.com/character/v5/character/<id>` returns `403` with no CORS
headers for these characters. Names, portraits, classes and levels cannot be fetched by
the page; the roster is hand-maintained.

**4. A frame's failure cannot be detected.**
A cross-origin iframe is opaque: the page cannot read its title, inspect its document,
or catch its errors, and `onload` fires whether DDB served a sheet or the 403 dragon.
So the roster must be *told* which characters are public. Hence the `public` flag below.

## Files

```
data/adventurers.json              the roster
assets/adventurers/<id>.webp       portraits
adventurers.html                   public  — The Adventurers' Company
guild-master.html                  warded  — the sheet wall
index.html                         gains a shop sign pointing at adventurers.html
```

Naming note: the footer link labelled *Guild* already points at `scriptorium.html`, and
stays that way. The new roster is deliberately named `adventurers.html` to avoid two
different things called Guild in one nav. Only the DM page uses the word, as the *Guild
Master* button and page title.

## Data

`data/adventurers.json`:

```json
{
  "_comment": "The Adventurers' Company. Hand-edited; portraits in assets/adventurers/.",
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
      "blurb": "Came down from the Spine of the World owing money to three temples.",
      "public": false
    }
  ]
}
```

- `id` — slug, also the portrait filename.
- `ddbId` — the D&D Beyond character id. Sheet URLs are **derived**
  (`https://www.dndbeyond.com/characters/<ddbId>`), never stored, so there is one source
  of truth.
- `public` — whether that player has set their sheet privacy to Public. Drives embed vs.
  fallback on the DM page. Defaults to `false` when absent: the fallback always works,
  a broken embed does not.
- Player real names and D&D Beyond handles are **not** stored. The repository is public.

The roster, read from the four sheets in the DM's logged-in browser:

| ddbId | name | race | class | level |
|---|---|---|---|---|
| 168950625 | Ganja | Goliath | Barbarian | 5 |
| 168938738 | Jacinto Pinto | Half-Elf | Wizard | 5 |
| 168947295 | Quim das Bolas de Fogo | Human | Barbarian | 5 |
| 169493126 | Violet Rarnoz | Half-Elf | Warlock | 5 |

Portraits live at `https://www.dndbeyond.com/avatars/<a>/<b>/<ts>-<ddbId>.jpeg` and fetch
anonymously (checked: all four return `200 image/jpeg`, 0.3–1.5 MB). They are copied into
`assets/adventurers/` rather than hotlinked, and re-encoded to WebP first — 3.5 MB of JPEG
for four cards would repeat the mistake the Penny Press was rebuilt to avoid.

Blurbs are not written yet. Cards render without one until the DM supplies them.

## adventurers.html

Public. Follows the existing page conventions: Cinzel + EB Garamond from Google Fonts,
`assets/wazoo.css?v=20260808n`, `assets/backdrop.js?v=20260808n`, the shared backdrop and
footer.

Each member renders as a card: portrait, name, a line reading `Goliath Barbarian 5`, the
blurb, and a `View sheet ↗` link to their DDB sheet.

Below the roster, a single **Guild Master** button links to `guild-master.html` with
`rel="nofollow"`.

A stranger clicking `View sheet ↗` for a private character reaches DDB's 403 page. That is
DDB's message on DDB's domain, and is left alone.

## guild-master.html

Loads `assets/keyring.js` and `assets/gate.js` exactly as the workshops do, and builds the
wall on the `ward:open` event rather than at load — the same ordering `editor.html` uses
for `listIssues()`.

The ward here is consistent with the site's other DM tools. It is worth being plain in the
page itself, as `gate.js` already is: this is a courtesy door, not protection. It gates a
read-only page, and any sheet marked Public is world-readable by URL regardless.

The wall lays members out as tablet-shaped frames with a 2-up / 4-up grid toggle:

- `public: true` → `<iframe src="https://www.dndbeyond.com/characters/<ddbId>">`, the live
  sheet with real HP and AC.
- `public: false` → a tile with the portrait, the name, *"Sheet is private"*, and an
  `Open in tab ↗` link. That works, because top-level the DM is logged in.

One line above the wall states the rule that will otherwise bite later: frames are always
logged out, so only Public sheets embed.

## Error handling

- A failed `adventurers.json` fetch says so on the page rather than rendering an empty
  roster silently — the behaviour `The-Notice-Board.html` already has.
- A missing portrait renders a drawn sigil placeholder, not a broken image icon.
- A member with no `ddbId` renders its card without a sheet link rather than a dead one.

## Testing

The repository has no CLI test runner; `editor.html?test=1` is in-page and specific to the
forge. Verification here is manual, against a local server:

```
python -m http.server 8731 --bind 127.0.0.1
```

1. `adventurers.html` — every member renders; a deliberately broken portrait path shows
   the placeholder; a deliberately broken JSON path shows the error, not an empty page.
2. `guild-master.html` — the ward appears; the wall builds only after the key is accepted;
   the grid toggle works; a `public: false` tile opens the sheet in a new tab.
3. The embed path — see the gap below.

**Known gap:** all four sheets are currently Private, so the `public: true` branch cannot
be verified end-to-end until at least one sheet is set Public. The DM's account shows a
`MANAGE` chip on Ganja's sheet and may be able to change that privacy directly; otherwise
it takes a message to one player. Until then only the fallback path is proven, and the
spec should not claim otherwise.

## Out of scope

- A workshop page for editing the roster. `data/adventurers.json` is hand-edited, matching
  how `notices.json` began. Add one later if the roster starts changing often.
- Rendering sheet data ourselves (HP, AC, spell slots) — blocked by finding 3, and it would
  duplicate DDB's own sheet for no gain.
- Any change to the existing *Guild* footer links.
