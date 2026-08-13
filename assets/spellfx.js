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

  /* Start one. Muted because a browser will not autoplay anything else,
     and the pack is silent anyway; playsInline because the alternative on
     some browsers is taking the video full screen, which on a projector
     would be a surprise nobody wants mid-combat. */
  function cast(effect, rect){
    var entry = { path: effect.path, rect: rect, video: null, done: false };
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
    return entry;
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
    draw: draw,
    playing: playing,
    live: liveList
  };
})(window);
