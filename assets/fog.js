/* ═══════════════════════════════════════════════════════════════════
   Fog — the map table's arithmetic, shared by both windows.

   Everything here is pure: no DOM beyond an offscreen canvas, no
   storage, no channel state. The DM page and the projector page both
   load it, which is how they are guaranteed to agree.

   Two things are worth knowing before changing anything:

   - Stroke coordinates are ALWAYS in image space. The two windows have
     different canvas sizes and probably different aspect ratios; only
     image space makes their masks identical.
   - The mask is an ALPHA mask, not a black-and-white picture. It is
     opaque where the map is hidden and transparent where it has been
     revealed, so it can be drawn straight over the map with no
     compositing tricks at the call site.
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var CHANNEL = 'waterdeep-table';

  /* ── view maths ───────────────────────────────────────────────────
     A view is {z, tx, ty}: scale about the origin, then translate.
     canvas = image * z + t                                            */
  function imageToCanvas(v, ix, iy){ return { x: ix * v.z + v.tx, y: iy * v.z + v.ty }; }
  function canvasToImage(v, cx, cy){ return { x: (cx - v.tx) / v.z, y: (cy - v.ty) / v.z }; }

  function fitScale(w, h, cw, ch){
    if(!w || !h) return 1;
    return Math.min(cw / w, ch / h);
  }

  function fitView(w, h, cw, ch){
    var z = fitScale(w, h, cw, ch);
    return { z: z, tx: (cw - w * z) / 2, ty: (ch - h * z) / 2 };
  }

  /* The image-space rectangle a canvas of cw × ch is currently showing.

     A view is in the DEVICE pixels of the canvas that produced it, and the
     two windows never share those: the projector opens at its own size,
     and on Windows a laptop at 150% scaling beside a projector at 100% is
     the ordinary case. Sending {z,tx,ty} across therefore crops the map.
     A rectangle of the map means the same thing on both. */
  function viewRect(v, cw, ch){
    var a = canvasToImage(v, 0, 0), b = canvasToImage(v, cw, ch);
    return { x0:a.x, y0:a.y, x1:b.x, y1:b.y };
  }

  /* How much tighter than a bare contain-fit the projector frames what
     the table sent.

     This was 1.1, and it was treating a symptom. The map looked small on
     the projector because the table was sending the whole of its own
     window — mostly empty table either side of a portrait map — and a
     tenth of overscan hid a little of that. clampRect fixed the cause:
     what crosses now is the map, so a plain fit already fills the
     projector as far as the map's shape allows.

     With the margins gone, a tenth of overscan no longer eats emptiness;
     it eats the map's own edges, which is a poor trade for a table that
     has just been shown the whole dungeon. So: 1, a faithful fit. The
     mechanism stays because the choice is worth one number — put 1.1
     back here and both windows agree about it again. */
  var SCREEN_ZOOM = 1;

  /* The part of that rectangle which is actually map.

     A view is the whole canvas, and the canvas is rarely the shape of the
     map: a 1912×940 window showing a 6800×8700 map fit to it is mostly
     empty table either side. Sent as-is, the projector dutifully frames
     that emptiness and the map lands small in the middle of it — worst
     after a rotate, which is the one moment the table deliberately fits
     the whole map and so carries the widest margins.

     Empty space is not map. What crosses the channel is the intersection
     with the picture, so the projector frames what there is to look at
     and fills its own screen with it. A view that has left the map behind
     entirely has no intersection to send, and is passed through
     unchanged rather than turned into a rectangle of nothing. */
  function clampRect(r, w, h){
    if(!w || !h) return r;
    var x0 = Math.max(0, Math.min(r.x0, r.x1)), x1 = Math.min(w, Math.max(r.x0, r.x1));
    var y0 = Math.max(0, Math.min(r.y0, r.y1)), y1 = Math.min(h, Math.max(r.y0, r.y1));
    if(!(x1 > x0) || !(y1 > y0)) return r;
    return { x0:x0, y0:y0, x1:x1, y1:y1 };
  }

  /* The view that shows that rectangle on a canvas of cw × ch, contain-
     fitted and centred. This is what lets two differently-sized,
     differently-scaled displays frame the same part of the map: whichever
     axis is tighter decides the scale, and the slack on the other axis
     falls equally either side.

     `zoom` scales that fit about the rectangle's centre — 1.1 keeps the
     same ground centred and shows a tenth less of it. Left out it is 1,
     which is the plain contain-fit the framing maths is tested against. */
  function viewFromRect(r, cw, ch, zoom){
    var rw = r.x1 - r.x0, rh = r.y1 - r.y0;
    if(!(rw > 0) || !(rh > 0)) return { z:1, tx:0, ty:0 };
    var z = Math.min(cw / rw, ch / rh) * (zoom || 1);
    return { z: z, tx: (cw - rw * z) / 2 - r.x0 * z, ty: (ch - rh * z) / 2 - r.y0 * z };
  }

  /* ── the wheel ────────────────────────────────────────────────────
     How much one wheel event should zoom.

     A fixed factor per event is the bug this replaces. A notched mouse
     sends one event per notch and looked fine; a trackpad or a precision
     wheel sends a stream of small ones, and a fixed 1.15 applied twenty
     times over is 16×, which slams into the clamp and repaints all the
     way there. That is what "zooming is laggy" was — not the drawing.

     So the factor comes from the distance actually scrolled. deltaMode
     says what the number means: 0 pixels, 1 lines, 2 pages. A line is
     about 16 px; a page is the viewport. The result is clamped per event
     so one absurd delta cannot jump the whole map. */
  var WHEEL_RATE = 0.0015;      /* a 100 px notch ≈ 1.16, the old feel */
  var WHEEL_CLAMP = 1.5;

  function wheelFactor(deltaY, deltaMode, viewportPx){
    var px = deltaY;
    if(deltaMode === 1) px = deltaY * 16;
    else if(deltaMode === 2) px = deltaY * (viewportPx || 800);
    var f = Math.exp(-px * WHEEL_RATE);
    return Math.min(WHEEL_CLAMP, Math.max(1 / WHEEL_CLAMP, f));
  }

  /* Zoom about a canvas point, keeping whatever is under it still.
     The image point under the cursor must not move, so the translation
     has to absorb the scale change. */
  function zoomAt(v, cx, cy, factor, min, max){
    var z = Math.min(max, Math.max(min, v.z * factor));
    var k = z / v.z;
    return { z: z, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
  }

  /* ── strokes ──────────────────────────────────────────────────────── */
  function line(x0,y0,x1,y1,r,reveal){
    return {k:"line", x0:x0, y0:y0, x1:x1, y1:y1, r:r, reveal:!!reveal};
  }
  function rect(x0,y0,x1,y1,reveal){
    return {k:"rect", x0:x0, y0:y0, x1:x1, y1:y1, reveal:!!reveal};
  }
  function fill(reveal){ return {k:"fill", reveal:!!reveal}; }

  /* A whole brush drag: every point it passed through, in image space,
     as a flat [x,y,x,y,…] array because that is what a channel message
     and an IndexedDB record have to carry.

     One stroke per pointermove was the alternative, and it cost on three
     counts: a drag became a thousand-entry list, every autosave rewrote
     all of it, and Ctrl-Z undid three pixels instead of the stroke the
     DM had just drawn. */
  function path(pts, r, reveal){
    return {k:"path", pts:(pts || []).slice(), r:r, reveal:!!reveal};
  }

  /* Stroke a path, or just the tail of one.

     `from` is the index of the last point ALREADY on the mask; leave it
     out to draw the path from nothing. The tail starts AT that point
     rather than after it, or a live drag gaps at every frame boundary.

     Each segment is stroked on its own, and the first point is a disc,
     which looks like more canvas calls than a single polyline needs. It
     is deliberate. `destination-out` is not idempotent: erasing a
     half-covered antialiased edge pixel twice leaves less than erasing it
     once. A live drag can only ever draw the tail it has just gained, so
     a replay has to repeat that sequence operation for operation —
     otherwise the mask restored after an undo or a reload would differ,
     along every join, from the one that was on screen. */
  function strokePath(g, pts, from, r){
    if(!pts || pts.length < 2) return;
    var n = pts.length >> 1;
    var fresh = (from === undefined || from === null);
    var i = fresh ? 0 : Math.max(0, Math.min(from | 0, n - 1));

    /* A click never grew a second point, and stroking a zero-length path
       draws nothing in every browser worth naming. Paint the cap by hand. */
    if(fresh){ g.beginPath(); g.arc(pts[0], pts[1], r, 0, Math.PI * 2); g.fill(); }

    g.lineWidth = r * 2;
    g.lineCap = "round";
    g.lineJoin = "round";
    for(var j = i; j < n - 1; j++){
      g.beginPath();
      g.moveTo(pts[j * 2], pts[j * 2 + 1]);
      g.lineTo(pts[j * 2 + 2], pts[j * 2 + 3]);
      g.stroke();
    }
  }

  /* One stroke into a mask context that is already the right size.
     Both rasterise() and applyStroke() go through here, so a replayed
     mask and an appended one cannot possibly draw a stroke differently. */
  function drawStroke(g, s, w, h, from){
    /* destination-out erases what is already there — that is a reveal.
       source-over paints opaque black back — that is a hide. */
    g.globalCompositeOperation = s.reveal ? "destination-out" : "source-over";
    g.fillStyle = "#000";
    g.strokeStyle = "#000";

    if(s.k === "fill"){ g.fillRect(0, 0, w, h); return; }

    if(s.k === "rect"){
      g.fillRect(Math.min(s.x0, s.x1), Math.min(s.y0, s.y1),
                 Math.abs(s.x1 - s.x0), Math.abs(s.y1 - s.y0));
      return;
    }

    /* `from` passes straight through: 0 is a meaningful tail index and
       undefined means draw the whole thing, so it must not be defaulted. */
    if(s.k === "path"){ strokePath(g, s.pts, from, s.r); return; }

    if(s.k === "line"){
      /* A click is a zero-length line, and stroking one draws nothing
         in every browser worth naming. Paint the cap by hand. */
      if(s.x0 === s.x1 && s.y0 === s.y1){
        g.beginPath(); g.arc(s.x0, s.y0, s.r, 0, Math.PI * 2); g.fill();
        return;
      }
      g.lineWidth = s.r * 2;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath(); g.moveTo(s.x0, s.y0); g.lineTo(s.x1, s.y1); g.stroke();
    }
  }

  /* ── how big the mask actually is ─────────────────────────────────
     The mask is drawn over the map on every single frame, and at full map
     resolution that one call is the whole cost of the frame: about 40–60 ms
     for a 6.5 megapixel map, against 4 ms for the map itself. Capping its
     long side makes a frame proportional to the screen instead of to the
     map, which is what the DM is actually looking at.

     The STROKES ARE NOT SCALED — the raster is. Every coordinate in this
     file, in both pages, in storage and on the channel stays image space;
     the mask context simply carries the scale. Getting that backwards
     would put the fog in the wrong place the moment a map got large
     enough to be capped, and small test maps would never show it. */
  var MASK_CAP = 2048;

  function maskDims(w, h, cap){
    var c = cap || MASK_CAP;
    var s = Math.min(1, c / Math.max(w || 1, h || 1));
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)), s: s };
  }

  /* ── the map, at the size the screen can actually show ────────────
     The mask was capped for this reason and the map needs it too. A
     6800×8700 map is a 59 megapixel texture, and resampling it well
     costs about 6 ms every frame before anything else is drawn — which
     is affordable at rest and is not affordable while the wheel is
     turning and each frame is thrown away in 16 ms.

     So a downscaled proxy is built once per map and drawn WHILE MOVING;
     the real thing goes back up once the gesture settles. The proxy is
     never stroked, never stored and never sent: it is a picture of the
     map and nothing else depends on it. Below the cap there is nothing
     to gain, and makeProxy says so by resolving to null. */
  var PROXY_CAP = 2048;
  var SETTLE_MS = 120;          /* how long after the last move to go sharp */

  function proxyDims(w, h){ return maskDims(w, h, PROXY_CAP); }

  function makeProxy(img, w, h){
    var d = proxyDims(w, h);
    if(d.s === 1 || typeof createImageBitmap !== "function") return Promise.resolve(null);
    return createImageBitmap(img, {resizeWidth:d.w, resizeHeight:d.h, resizeQuality:"high"})
      .catch(function(){ return null; });
  }

  /* Let go of a decoded picture.

     A 6800×8700 ImageBitmap is about 236 MB of memory, and both pages
     make one every time a map is loaded — the projector makes a fresh
     one on every sync, so a few rotates in a row can leave half a dozen
     of them alive. The garbage collector gets there eventually; the
     renderer can wedge before it does. close() is immediate. Anything
     that is not an ImageBitmap (a canvas from rotateImage, a null) is
     left alone. */
  function release(x){
    if(x && typeof x.close === "function") x.close();
    return null;
  }

  /* Which picture this frame draws, and how well to resample it. Pure,
     so the rule is testable without a map, a canvas or a gesture: while
     moving take the proxy if there is one and resample it cheaply,
     otherwise the original at full quality. */
  function sourceFor(moving, proxy, img){
    if(moving && proxy) return { img: proxy, quality: "low" };
    return { img: img, quality: moving ? "low" : "high" };
  }

  /* ── the pointer ──────────────────────────────────────────────────
     A laser dot and the ring a click drops. Both are drawn by both
     windows, so they live here: two hand-written copies of a fading
     ring are two chances for the DM and the players to be looking at
     different things.

     Sizes are CANVAS pixels, not image pixels. A laser is a fixed dot
     on the wall; one measured in map space would swell every time the
     DM zoomed in, which is not what anybody means by pointing. */
  var LASER_R = 9, PING_LIFE = 700, PING_R0 = 10, PING_R1 = 70;

  /* Where a ping is at `age` milliseconds, or null once it is over.
     The radius eases out — fast at first, slack at the end — because a
     ring that expands linearly reads as a growing circle rather than as
     something struck. */
  function pingAt(age, life){
    var L = life || PING_LIFE;
    if(!(age >= 0) || age >= L) return null;
    var t = age / L, e = 1 - Math.pow(1 - t, 3);
    return { t: t, r: PING_R0 + (PING_R1 - PING_R0) * e, alpha: 1 - t };
  }

  function drawLaser(g, x, y, k){
    var r = LASER_R * (k || 1);
    g.save();
    var glow = g.createRadialGradient(x, y, 0, x, y, r * 3);
    glow.addColorStop(0,   "rgba(255,60,40,.55)");
    glow.addColorStop(0.5, "rgba(255,40,30,.18)");
    glow.addColorStop(1,   "rgba(255,30,20,0)");
    g.fillStyle = glow;
    g.beginPath(); g.arc(x, y, r * 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ff2a1a";
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    /* A white core is what makes it read as a laser rather than a red
       sticker, and it survives being projected onto a lit table. */
    g.fillStyle = "rgba(255,235,225,.95)";
    g.beginPath(); g.arc(x, y, r * 0.42, 0, Math.PI * 2); g.fill();
    g.restore();
    return true;
  }

  /* Returns false once the ping has expired, which is how both pages
     know to drop it from their list. */
  function drawPing(g, x, y, age, k, life){
    var p = pingAt(age, life);
    if(!p) return false;
    var s = k || 1;
    g.save();
    g.globalAlpha = p.alpha;
    g.strokeStyle = "#ff3a26";
    g.lineWidth = 3 * s;
    g.beginPath(); g.arc(x, y, p.r * s, 0, Math.PI * 2); g.stroke();
    g.restore();
    return true;
  }

  /* Draw the strokes, in order, into an alpha mask of w×h.
     Starts fully fogged; a reveal erases, a hide paints back. */
  function rasterise(strokes, w, h, canvas){
    var cv = canvas || document.createElement("canvas");
    var d = maskDims(w, h);
    if(cv.width !== d.w) cv.width = d.w;
    if(cv.height !== d.h) cv.height = d.h;
    var g = cv.getContext("2d");

    g.setTransform(d.s, 0, 0, d.s, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);

    (strokes || []).forEach(function(s){ drawStroke(g, s, w, h); });

    g.globalCompositeOperation = "source-over";
    return cv;
  }

  /* One stroke onto the mask exactly as it already stands.

     Every mask operation composites over what is there, so appending a
     stroke gives the identical result to replaying the whole list — and a
     brush drag pushes one stroke per pointermove, which makes the replay
     O(n²) over a mask that may be twenty-four megapixels. The canvas is
     NEVER resized here: assigning width or height clears it, which would
     throw away the very thing being appended to. */
  function applyStroke(stroke, w, h, canvas, from){
    if(!canvas || !stroke) return canvas;
    var g = canvas.getContext("2d");
    var d = maskDims(w, h);
    g.setTransform(d.s, 0, 0, d.s, 0, 0);
    drawStroke(g, stroke, w, h, from);
    g.globalCompositeOperation = "source-over";
    return canvas;
  }

  /* Run `work` at most once per scheduled frame, however many times it is
     asked for in between.

     redraw() used to run synchronously inside every wheel tick and every
     pointermove. A 125 Hz mouse therefore asked for 125 full repaints a
     second; at tens of milliseconds each the queue never drained, and
     that backlog — not the drawing itself — is what "not smooth" was.

     `schedule` is requestAnimationFrame in both pages, and a plain list
     in the suite, which is the only reason this is testable at all. */
  function coalesce(schedule, work){
    var pending = false;
    return function(){
      if(pending) return;
      pending = true;
      schedule(function(){ pending = false; work(); });
    };
  }

  /* Rotate strokes 90° clockwise for an image that was `oldH` tall.
     Rotating the picture and leaving the fog behind is the bug this
     prevents, so both are transformed together — as dnd_map.py does. */
  function rotateStrokes(strokes, oldH){
    return (strokes || []).map(function(s){
      if(s.k === "fill") return s;
      if(s.k === "path"){
        var p = new Array(s.pts.length);
        for(var i = 0; i < s.pts.length; i += 2){
          p[i] = oldH - s.pts[i + 1];
          p[i + 1] = s.pts[i];
        }
        return {k:"path", pts:p, r:s.r, reveal:s.reveal};
      }
      var o = {k:s.k, reveal:s.reveal};
      o.x0 = oldH - s.y0; o.y0 = s.x0;
      o.x1 = oldH - s.y1; o.y1 = s.x1;
      if(s.k === "line") o.r = s.r;
      return o;
    });
  }

  /* Turn an image 90° clockwise, `times` times, into a fresh canvas.
     The stored blob is never rewritten, so the orientation has to be
     re-applied every time the map is decoded — on this page after a
     reload, and on the projector, which fetches the same blob itself.
     Rotating the strokes but not the picture is the misalignment this
     exists to prevent. */
  function rotateImage(img, times){
    var n = ((times % 4) + 4) % 4;
    if(!n) return img;
    var w = img.width, h = img.height;
    var out = img;
    for(var i = 0; i < n; i++){
      var cv = document.createElement("canvas");
      cv.width = h; cv.height = w;
      var g = cv.getContext("2d");
      g.translate(h, 0);
      g.rotate(Math.PI / 2);
      g.drawImage(out, 0, 0);
      out = cv;
      var t = w; w = h; h = t;
    }
    return out;
  }

  /* ── storage ──────────────────────────────────────────────────────
     Both pages open this same database, which is exactly why the schema
     lives here rather than being written out twice. Two upgrade handlers
     that drift apart fail in a way nobody enjoys diagnosing.

     Maps are stored once, by the table. The projector is told only an id
     and fetches the blob itself — a 15 MB image never crosses the
     channel. Rotation is stored beside the strokes, never baked into
     the blob. */
  var DB = "waterdeep-table", MAPS = "maps", FOG = "fog";

  function openDb(){
    return new Promise(function(res, rej){
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function(){
        var db = r.result;
        if(!db.objectStoreNames.contains(MAPS)) db.createObjectStore(MAPS, {keyPath:"id"});
        if(!db.objectStoreNames.contains(FOG))  db.createObjectStore(FOG,  {keyPath:"mapId"});
      };
      r.onsuccess = function(){ res(r.result); };
      r.onerror = function(){ rej(r.error); };
    });
  }

  function put(store, rec){
    return openDb().then(function(db){
      return new Promise(function(res, rej){
        var tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(rec);
        tx.oncomplete = function(){ res(); };
        tx.onerror = function(){ rej(tx.error); };
      });
    });
  }

  function get(store, key){
    return openDb().then(function(db){
      return new Promise(function(res, rej){
        var tx = db.transaction(store, "readonly");
        var rq = tx.objectStore(store).get(key);
        rq.onsuccess = function(){ res(rq.result || null); };
        rq.onerror = function(){ rej(rq.error); };
      });
    });
  }

  /* No width or height: nothing ever read them back. Both pages take the
     dimensions from the decoded, rotated image, which is the only place
     they are true anyway. */
  function putMap(id, name, blob){ return put(MAPS, {id:id, name:name, blob:blob}); }
  function getMap(id){ return get(MAPS, id); }
  function putFog(mapId, strokes, rotation){
    return put(FOG, {mapId:mapId, strokes:strokes, rotation:rotation || 0});
  }
  function getFog(mapId){ return get(FOG, mapId); }

  /* What both pages say when there is nothing to show. It lives here
     because the table asserts it and the projector displays it, and two
     copies of a string are two chances for them to disagree. */
  function emptyMessage(){ return "No map on the table"; }

  /* ── the channel ──────────────────────────────────────────────────── */
  function open(onMessage){
    if(typeof BroadcastChannel !== "function") return null;
    var ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = function(e){ onMessage(e.data); };
    return ch;
  }

  root.Fog = {
    imageToCanvas: imageToCanvas,
    canvasToImage: canvasToImage,
    fitScale: fitScale,
    fitView: fitView,
    viewRect: viewRect,
    clampRect: clampRect,
    viewFromRect: viewFromRect,
    SCREEN_ZOOM: SCREEN_ZOOM,
    zoomAt: zoomAt,
    wheelFactor: wheelFactor,
    proxyDims: proxyDims,
    makeProxy: makeProxy,
    sourceFor: sourceFor,
    release: release,
    SETTLE_MS: SETTLE_MS,
    pingAt: pingAt,
    drawLaser: drawLaser,
    drawPing: drawPing,
    PING_LIFE: PING_LIFE,
    line: line,
    rect: rect,
    fill: fill,
    path: path,
    maskDims: maskDims,
    rasterise: rasterise,
    applyStroke: applyStroke,
    coalesce: coalesce,
    emptyMessage: emptyMessage,
    rotateStrokes: rotateStrokes,
    rotateImage: rotateImage,
    openDb: openDb,
    putMap: putMap, getMap: getMap,
    putFog: putFog, getFog: getFog,
    open: open
  };
})(window);
