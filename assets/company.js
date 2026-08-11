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
