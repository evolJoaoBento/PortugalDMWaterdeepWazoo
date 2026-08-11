# The map table — design

Date: 2026-08-11
Status: approved, not yet implemented

## What this is

A browser replacement for `dnd_map.py`, brought into the Waterdeep site: a DM page that
paints fog of war over a map, and a clean player page for the projector. Both windows lock to
the same view, exactly as the Python tool does.

This is **cycle 1 of three**. The DM console that gathers the map, the sheet wall, the notice
board and initiative is cycle 2; an initiative tracker is cycle 3. Each gets its own spec,
plan and build, so each ships working rather than all three half-done.

## Play model, and what it rules out

**In-person only.** The DM's laptop drives a second screen or projector. Both pages run in the
same browser, on the same machine, at the same origin.

That single fact removes the entire hard problem. GitHub Pages serves bytes and nothing else —
no server, no WebSocket, no database — so a *remote* player view would need WebRTC, a pub/sub
service, or a Cloudflare Worker, and would have to ship a 15 MB map to every player. None of
that applies here. Two windows on one machine talk over `BroadcastChannel`, and the map never
leaves the disk it is on.

## Decisions

Each of these was chosen deliberately; the rejected option is recorded so it is not silently
revisited.

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Map source | Loaded from disk, kept in IndexedDB | Committing maps to the repo — it is public, so players could open the dungeon they have not reached, and 15 MB files bloat a repo the README already worries about |
| View sync | Locked together, both windows identical | An independent player view with a *push view* button — more flexible, but the Python tool's behaviour is proven in actual play and this is what the DM asked for |
| Fog storage | Strokes, rasterised on both ends | A full-resolution bitmap like `dnd_map.py`'s `L` mask — simpler, but gives no undo and saves badly |
| Tools | Brush, rectangle, reveal/hide, fill, clear, rotate — **plus undo** | Polygon/lasso reveal and soft fog edges, both deferred as YAGNI |
| Ward | **None** on either page | Consistency with the other DM tools — see below |

### Why no ward

`scriptorium.html`, `editor.html` and `guild-master.html` all sit behind `gate.js`, so the
obvious move is to ward this too. It would be wrong here.

The ward verifies a GitHub token. The map table writes nothing to the repository — every byte
it touches is local. Warding it therefore protects nothing, and introduces a genuine failure
mode: a forgotten or expired token leaves the DM with no map *at the table, mid-session*. The
player screen cannot be warded either — a token prompt on a projector is absurd.

Both pages are added to `HIDDEN` in `press-room.html` instead, so they are not published in
the public archive. The map table is reachable from `guild-master.html`, which is already the
DM's door.

## Architecture

```
map-table.html          DM: toolbar, canvas, fog painting, map loading
map-screen.html         projector: canvas only, no chrome
assets/fog.js           shared: stroke model, rasteriser, view maths, channel protocol
press-room.html         HIDDEN gains both pages
guild-master.html       gains a link to the map table
```

`assets/fog.js` is new and referenced only by these two pages, so adding it does not drag the
rest of the site into a `?v=` bump — the same reasoning that produced `assets/company.js`.

### The pages share IndexedDB, so the map never travels

Both pages are same-origin, so they see the same IndexedDB. The DM stores the map once and
broadcasts only its id; the player page loads the blob itself. A 15 MB image is never
serialised, never posted, never copied.

```
db: waterdeep-table
  store maps  { id, name, blob, w, h }
  store fog   { mapId, strokes[], rotation }
```

Fog autosaves debounced, keyed by map, so switching maps and switching back keeps each map's
reveals.

### The channel

`new BroadcastChannel("waterdeep-table")`. Messages are small and JSON-serialisable:

| Message | Sent when | Payload |
|---|---|---|
| `view` | pan or zoom, throttled to one per animation frame | `{z, tx, ty}` |
| `stroke` | a stroke completes | the stroke object |
| `map` | the loaded map changes | `{id}` |
| `undo` | undo or redo | `{strokes}` — the authoritative list, since replaying a pop is fiddlier than resending |
| `hello` | a player screen loads | — |
| `sync` | DM answers a `hello` | `{mapId, view, strokes, rotation}` |

**The `hello`/`sync` handshake is the part that is easy to omit and painful to lack.** A
projector window opened after the session started — or reloaded when someone knocks the
cable — must catch up. Without it, that window shows an empty map while the DM's shows half
the city revealed, and the failure looks like the tool is broken rather than late.

If `BroadcastChannel` is unavailable, both pages say so plainly rather than silently failing
to sync.

## The fog model

Strokes, in image-space coordinates, always:

```js
{k:"line", x0,y0,x1,y1, r, reveal}
{k:"rect", x0,y0,x1,y1, reveal}
{k:"fill", reveal}
```

Image space is what makes the two windows agree. The DM's canvas and the projector's are
different sizes and probably different aspect ratios; rasterising from image coordinates means
both produce the same mask regardless.

`rasterise(strokes, w, h)` draws them in order into an offscreen mask canvas — white where
revealed, black where hidden. Undo pops the last stroke and rasterises from zero. That is O(n)
in strokes rather than incremental, which for a few hundred canvas operations is imperceptible
and much easier to get right than maintaining an undo stack of mask deltas.

Rendering follows `dnd_map.py` exactly: the DM draws fog at **0.78 alpha** (`EDITOR_FOG_ALPHA`
in the original) so hidden ground is still visible to the DM; the player screen draws it fully
opaque.

## Error handling

- **No map loaded** — the projector says *"No map on the table"*, not a black rectangle. A
  black rectangle is indistinguishable from a bug, and from fog.
- **A player screen with no DM** — says it is waiting for the table rather than appearing
  broken. It re-sends `hello` when the window regains visibility.
- **IndexedDB unavailable** — caught at load and stated. Some browsers block it on `file://`,
  so the message names the cause: this tool needs a served origin, not a double-clicked file.
- **Popup blocked** when opening the player screen — reported like *Deal the table* does, with
  the count and what to allow, rather than nothing happening.
- **A map that fails to decode** — named, with the file name, rather than leaving a blank canvas.

## Testing

In-page suites at `?test=1`, the convention `editor.html` established and the roster pages
follow. Pure functions only; two-window sync gets a manual pass because it cannot be
meaningfully unit-tested.

- `rasterise()` on a small canvas: a reveal shows, a hide covers, later strokes win over
  earlier ones, `fill` resets everything.
- Undo returns exactly the mask that preceded the last stroke.
- `imageToCanvas` / `canvasToImage` round-trip under zoom and pan.
- Message encode/decode, including that a `sync` payload restores a mask identical to the
  DM's.

Manual pass: open both windows, load a map, paint, confirm the projector matches; reload the
projector mid-session and confirm `hello`/`sync` restores it.

## Out of scope

- **Pins, wards, categories and notes from `map.html`.** They belong to the console cycle or a
  later merge, not here.
- **The DM console shell** — cycle 2.
- **Initiative** — cycle 3.
- **Remote players.** Ruled out by the play model above; revisiting it means revisiting the
  transport, not extending this design.
- **Committing maps to the repository.** Decided against; see the table.
