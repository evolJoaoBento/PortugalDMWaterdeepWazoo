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

  /* Draw the strokes, in order, into an alpha mask of w×h.
     Starts fully fogged; a reveal erases, a hide paints back. */
  function rasterise(strokes, w, h, canvas){
    var cv = canvas || document.createElement("canvas");
    if(cv.width !== w) cv.width = w;
    if(cv.height !== h) cv.height = h;
    var g = cv.getContext("2d");

    g.setTransform(1,0,0,1,0,0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);

    (strokes || []).forEach(function(s){
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
    });

    g.globalCompositeOperation = "source-over";
    return cv;
  }

  /* Rotate strokes 90° clockwise for an image that was `oldH` tall.
     Rotating the picture and leaving the fog behind is the bug this
     prevents, so both are transformed together — as dnd_map.py does. */
  function rotateStrokes(strokes, oldH){
    return (strokes || []).map(function(s){
      if(s.k === "fill") return s;
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

  function putMap(id, name, blob, w, h){ return put(MAPS, {id:id, name:name, blob:blob, w:w, h:h}); }
  function getMap(id){ return get(MAPS, id); }
  function putFog(mapId, strokes, rotation){
    return put(FOG, {mapId:mapId, strokes:strokes, rotation:rotation || 0});
  }
  function getFog(mapId){ return get(FOG, mapId); }

  /* ── the channel ──────────────────────────────────────────────────── */
  function open(onMessage){
    if(typeof BroadcastChannel !== "function") return null;
    var ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = function(e){ onMessage(e.data); };
    return ch;
  }

  root.Fog = {
    channelName: CHANNEL,
    imageToCanvas: imageToCanvas,
    canvasToImage: canvasToImage,
    fitScale: fitScale,
    fitView: fitView,
    zoomAt: zoomAt,
    line: line,
    rect: rect,
    fill: fill,
    rasterise: rasterise,
    rotateStrokes: rotateStrokes,
    rotateImage: rotateImage,
    openDb: openDb,
    putMap: putMap, getMap: getMap,
    putFog: putFog, getFog: getFog,
    open: open
  };
})(window);
