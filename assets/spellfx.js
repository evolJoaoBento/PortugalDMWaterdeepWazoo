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
