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
2. Scope it to **this repository only**, permission **Contents: Read and write**, nothing else.
   *Read-only is the usual mistake:* reading, listing and opening all work with it, and the
   first sign anything is wrong is a 403 when you publish.
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
assets/issues/<stem>/cover.webp    a picture of the paper's own top
<stem>.html                        the published issue
<stem>.json                        its front-page card in the press room
```

### The cover is painted, not screenshotted

The card in the press room shows the top of the paper — masthead, dateline,
rules and the first columns. Chrome will not let a page screenshot itself: the
usual trick, drawing the DOM through an SVG `<foreignObject>`, taints the
canvas so its bytes can never be read back.

So publishing repaints the paper's top with the operations that stay clean —
`fillText`, `drawImage`, `ctx.filter`. Nothing is laid out twice: every
position, font and colour is measured off the live preview, so the cover
follows the design instead of imitating it. Pseudo-element decoration is the
exception: flat tints survive, gradient fog and glows do not.

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

### AI Manifesto
Hello, my name is João Bento,

I started making this website as a centralized place to keep everything about the D&D Sessions I'm running in Waterdeep. For this I used a lot of AI, both in the development of the site and the image creation. I know that this is very controversial to use in the hobby, and I agree that It takes away from the authenticity and human connection that is at the core of playing games like these. However i chose to do it because i would not be able to do it otherwise. There was a vision of what i wanted to do and i do not have the means to commission artists to cover the art i needed to materialize it. I am by trade a programmer and was for a short time a bad one at that (but arrogant enough to think i wasn't) before AI came along and became much better then I ever was and had to start thinking what as the purpose of what i was doing with my career. The reason I went to university for Computer Science in the first place was to get more tools which i could use to create, at the time in the game development industry, and with time i forgot that. The core of what I wanted to do was create and when I got the tools to create i no longer had the time to do it and then suddenly i didn't even have the skills to compete and be able to fill accomplished in what i was doing. The soul of what i did was fading away. Instead of continuing to pursue professional goals I came back to the root of what i wanted to do. Create. I started using AI to fulfill my ideas. Filling in the gaps of what i wanted to do without deviating from what i wanted to do. The result are a dozen or so projects that come closer to materializing my ideas then ever before. Selfishly this makes me proud but I know that is not the full story.
Even if my ideas and projects are working the way I got there is not sustainable in a holistic sense. People need to make a living and if my ideas that are human centered arrive there by taking humans out of the loop and it becomes the case that they are more used/paid for than the ones by humans than i have achieved nothing. Worse I took away the very thing i was trying to create. 
On one side i do not have the means these things without AI, and on the other side if I use AI i will be killing the purpose of the things in the first place.
I have thought about this a bit and arrived at a decision. I'm not sure about this decision so i might change it in the future.
The only way this hurts other creators is if this becomes popular. And popularity is not a binary thing. It grows in popularity. And any money that comes from popularity, that would in essence be being taken away from creators, would only be so if they were not invested on creators. So my answer is this: All money that is earned through these projects will be reinvested in replacing the AI generated parts with genuine art by creators until all AI created parts are replaced.
I'm still on the fence about the way my effort in maintaining these ideas come into part, because its genuine effort. but ill figure that out on a later date.

Signed João Bento, the Creator.

---

## Credits

- Atlas of Waterdeep by [aidedd.org](https://www.aidedd.org/atlas/waterdeep), embedded from their site
- Animated spell effects by Jack Kerouac —
  [animated-spell-effects](https://github.com/jackkerouac/animated-spell-effects), **GPL-3.0**.
  35 of them are bundled under `assets/spell-effects/` with the licence and the credits beside
  them; the rest of the pack is indexed in `data/spell-effects.json` and fetched when first cast
- Forgotten Realms and Waterdeep are Wizards of the Coast's; this is a
  personal campaign site and claims none of it
- The panorama on the front page carries an artist's signature and is not yet
  credited — **if you know who painted it, add them here**
