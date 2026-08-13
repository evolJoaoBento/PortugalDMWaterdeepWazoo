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

     Every word must match something — name, category, shape or path — so
     a second word narrows rather than widens: "fire cone" is a cone of
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

  /* ── the bytes ────────────────────────────────────────────────────
     Cache first, then the network, and what the network gives is kept.
     The fetch is deliberate rather than handing the URL to a <video>:
     a cross-origin video drawn into a canvas taints it, and a tainted
     canvas cannot be read back — which would break the bench, the suite
     and anything that ever wants a thumbnail. A blob from fetch() is
     same-origin by the time it reaches the element. */
  function blobFor(effect){
    if(effect.bundled){
      return fetch(urlFor(effect)).then(function(r){
        if(!r.ok) throw new Error("no such effect: " + effect.path);
        return r.blob();
      });
    }
    return Fog.getFx(effect.path).catch(function(){ return null; }).then(function(rec){
      if(rec && rec.blob) return rec.blob;
      return fetch(urlFor(effect)).then(function(r){
        if(!r.ok) throw new Error("the pack did not answer for " + effect.path);
        return r.blob();
      }).then(function(b){
        /* Kept, so the second cast of this effect works with the router
           unplugged. Failing to store is not failing to cast. */
        return Fog.putFx(effect.path, b).catch(function(){}).then(function(){ return b; });
      });
    });
  }

  /* A decoded, ready-to-play source, kept by path so a spell cast twice
     in one fight is only fetched once. */
  var ready = {};
  function preload(effect){
    if(!effect) return Promise.resolve();
    if(ready[effect.path]) return Promise.resolve();
    return blobFor(effect).then(function(blob){
      ready[effect.path] = { url: URL.createObjectURL(blob) };
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
     reason: it has to land on the ground it was drawn over, on a screen
     that is not this one. */
  function boxOf(view, rect){
    var a = Fog.imageToCanvas(view, Math.min(rect.x0, rect.x1), Math.min(rect.y0, rect.y1));
    var b = Fog.imageToCanvas(view, Math.max(rect.x0, rect.x1), Math.max(rect.y0, rect.y1));
    return { x:a.x, y:a.y, w:b.x - a.x, h:b.y - a.y };
  }

  /* ── aiming a staged effect ───────────────────────────────────────
     A cast is not fired the moment the box is drawn. It is STAGED: a
     rectangle and an angle the DM can push around until the bolt points
     down the corridor rather than across it. Everything here is pure —
     the angle, the hit test, the resize — because aiming is exactly the
     kind of geometry that is wrong by a sign and nobody notices until a
     fireball lands in the wrong room.

     The rectangle stays axis-aligned in image space and the angle is
     kept beside it, applied about the rectangle's centre when drawing.
     That way the message on the channel is the rectangle it always was,
     plus one number, and the projector turns it the same way. */
  var SNAP = Math.PI / 12;                 /* 15°, so a corridor lines up */

  function snapAngle(a, free){ return free ? a : Math.round(a / SNAP) * SNAP; }

  function centreOf(rect){
    return { x:(rect.x0 + rect.x1) / 2, y:(rect.y0 + rect.y1) / 2 };
  }

  /* A point in the box's own frame: undo the rotation about the centre.
     Every hit test happens here, because a rotated box's corners are not
     where an axis-aligned test would look for them. */
  function localPoint(px, py, cx, cy, rot){
    var dx = px - cx, dy = py - cy, c = Math.cos(-rot), s = Math.sin(-rot);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }

  /* What the pointer is on: the turning handle, a named corner, the body
     of the box, or nothing at all. `grab` is how close counts as a hit
     and `lift` is how far the handle floats above the top edge — both in
     the same units as the box, so a caller can scale them for a hidpi
     screen. */
  function handleAt(box, rot, px, py, grab, lift){
    var cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    var p = localPoint(px, py, cx, cy, rot || 0);
    var hw = box.w / 2, hh = box.h / 2;
    var g = grab || 10, l = (lift === undefined ? 28 : lift);
    if(Math.abs(p.x) <= g && Math.abs(p.y + hh + l) <= g) return "rotate";
    var corners = [["nw", -hw, -hh], ["ne", hw, -hh], ["se", hw, hh], ["sw", -hw, hh]];
    for(var i = 0; i < corners.length; i++){
      if(Math.abs(p.x - corners[i][1]) <= g && Math.abs(p.y - corners[i][2]) <= g){
        return corners[i][0];
      }
    }
    if(Math.abs(p.x) <= hw && Math.abs(p.y) <= hh) return "move";
    return null;
  }

  function opposite(corner){
    return {nw:"se", ne:"sw", se:"nw", sw:"ne"}[corner] || "se";
  }

  /* Where a named corner actually is, once the box has been turned. */
  function cornerAt(rect, corner, rot){
    var c = centreOf(rect);
    var hw = Math.abs(rect.x1 - rect.x0) / 2, hh = Math.abs(rect.y1 - rect.y0) / 2;
    var lx = (corner === "nw" || corner === "sw") ? -hw : hw;
    var ly = (corner === "nw" || corner === "ne") ? -hh : hh;
    var cs = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    return { x: c.x + lx * cs - ly * sn, y: c.y + lx * sn + ly * cs };
  }

  function moveRect(rect, dx, dy){
    return { x0:rect.x0 + dx, y0:rect.y0 + dy, x1:rect.x1 + dx, y1:rect.y1 + dy };
  }

  /* Drag a corner and the opposite one stays nailed down — which is what
     resizing looks like to anyone who has used any other tool, and is
     the reason this cannot be done by moving x0 and y0 directly once the
     box is turned. The pointer is measured in the box's own frame; the
     new centre is half that vector back from the fixed corner, turned
     into image space again. */
  function resizeFrom(fixed, rot, px, py){
    var c = Math.cos(-(rot || 0)), s = Math.sin(-(rot || 0));
    var dx = px - fixed.x, dy = py - fixed.y;
    var vx = dx * c - dy * s, vy = dx * s + dy * c;
    var w = Math.abs(vx), h = Math.abs(vy);
    var cs = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    var hx = vx / 2, hy = vy / 2;
    var cx = fixed.x + hx * cs - hy * sn, cy = fixed.y + hx * sn + hy * cs;
    return { x0:cx - w / 2, y0:cy - h / 2, x1:cx + w / 2, y1:cy + h / 2 };
  }

  /* The angle that points the box's top edge at a pointer. The handle
     sits above the box, so straight up is zero rotation, not the
     quarter-turn atan2 would report. */
  function aimAt(centre, px, py, free){
    return snapAngle(Math.atan2(py - centre.y, px - centre.x) + Math.PI / 2, free);
  }

  /* A quietly looping copy, for aiming against. It is the same file the
     cast will use, so what the DM lines up is what the players get. Null
     until it has loaded — the caller simply draws nothing that frame. */
  var ghosts = {};
  function ghost(effect){
    if(!effect) return null;
    var g = ghosts[effect.path];
    if(g) return g.video;
    ghosts[effect.path] = { video: null };
    preload(effect).then(function(){
      var have = ready[effect.path];
      if(!have) return;
      var v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.loop = true; v.src = have.url;
      v.play().catch(function(){});
      ghosts[effect.path].video = v;
    });
    return null;
  }

  /* One frame of a video into a canvas box, turned about its centre.
     Both the staged ghost and a live cast go through here, so an effect
     cannot line up one way while aiming and land another way when cast. */
  function drawFrame(g, video, box, rot, alpha){
    if(!video || video.readyState < 2) return false;
    if(box.w < 1 || box.h < 1) return false;
    g.save();
    if(alpha !== undefined) g.globalAlpha = alpha;
    g.translate(box.x + box.w / 2, box.y + box.h / 2);
    if(rot) g.rotate(rot);
    g.drawImage(video, -box.w / 2, -box.h / 2, box.w, box.h);
    g.restore();
    return true;
  }

  /* Start one. Muted because a browser will not autoplay anything else,
     and the pack is silent anyway; playsInline because the alternative on
     some browsers is taking the video full screen, which on a projector
     would be a surprise nobody wants mid-combat. */
  /* `onProblem` is how a cast that cannot play says so. Silence here
     reads as "the button is broken" at the table, which is the worst
     possible thing for the DM to be wondering about mid-combat. */
  function cast(effect, rect, rot, onProblem){
    var entry = { path: effect.path, rect: rect, rot: rot || 0, video: null, done: false };
    var fail = function(why){
      entry.done = true;
      if(onProblem) onProblem(why + " — " + effect.name);
    };
    live.push(entry);
    preload(effect).then(function(){
      var have = ready[effect.path];
      if(!have){ fail("could not load"); return; }
      var v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.autoplay = false; v.preload = "auto";
      v.src = have.url;
      v.addEventListener("ended", function(){ entry.done = true; });
      v.addEventListener("error", function(){ fail("would not decode"); });
      entry.video = v;
      v.play().catch(function(){ fail("would not play"); });
    });
    return entry;
  }

  function playing(){ return live.length > 0; }
  function liveList(){ return live; }

  /* Drop everything playing. A cast's rectangle is in the image space
     the map had when it was drawn, and a rotate replaces that space —
     the same reason the laser and its rings are dropped there. A spell
     is a second long; ending one early is better than putting it over
     the wrong room. */
  function clear(){ live = []; }

  /* Drawn last by both pages, above the fog and above the laser: a DM
     sets fire to ground the players cannot see at least as often as
     ground they can. */
  function draw(g, view){
    live = reap(live);
    for(var i = 0; i < live.length; i++){
      var c = live[i];
      drawFrame(g, c.video, boxOf(view, c.rect), c.rot);
    }
  }

  root.SpellFx = {
    PACK_COMMIT: PACK_COMMIT,
    PACK_REPO: PACK_REPO,
    BUNDLE_DIR: BUNDLE_DIR,
    INDEX_URL: INDEX_URL,
    shapeOf: shapeOf,
    search: search,
    urlFor: urlFor,
    loadIndex: loadIndex,
    index: index,
    blobFor: blobFor,
    preload: preload,
    cast: cast,
    reap: reap,
    boxOf: boxOf,
    snapAngle: snapAngle,
    centreOf: centreOf,
    localPoint: localPoint,
    handleAt: handleAt,
    opposite: opposite,
    cornerAt: cornerAt,
    moveRect: moveRect,
    resizeFrom: resizeFrom,
    aimAt: aimAt,
    ghost: ghost,
    drawFrame: drawFrame,
    draw: draw,
    playing: playing,
    live: liveList,
    clear: clear
  };
})(window);
