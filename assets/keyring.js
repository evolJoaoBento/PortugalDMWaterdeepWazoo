/* ═══════════════════════════════════════════════════════════════════
   Keyring — the one place that knows how to write to the city.

   Shared by the Scriptorium (the notice board) and the Penny Press
   (the broadsheets), so the token is entered once and the commit
   mechanics live in one file rather than two.

   The mechanics that are easy to get wrong, in one place:

   - Overwriting a file needs its current blob sha. Always GET, keep
     the sha, then PUT it back. A stale sha earns a 409, which means
     somebody else changed the file; the honest answer is to re-read,
     not to force it through.
   - Content must be base64, and btoa() works a byte at a time — it
     throws on anything above U+00FF, which is every curly quote and
     em dash on the site. Encode to UTF-8 bytes first.
   - GitHub's API allows authenticated writes from a browser origin
     (Access-Control-Allow-Origin: *, and Authorization is on its
     allowed-headers list), which is the only reason any of this works
     without a server.
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var REPO   = 'evolJoaoBento/PortugalDMWaterdeepWazoo';
  var BRANCH = 'main';
  var LS_TOK = 'wazoo-scriptorium-token';   // shared with the Scriptorium

  /* ── the key ──────────────────────────────────────────────────── */
  var Keyring = {
    get: function () {
      try { return localStorage.getItem(LS_TOK) || ''; } catch (e) { return ''; }
    },
    set: function (t) {
      try { localStorage.setItem(LS_TOK, t || ''); } catch (e) {}
    },
    clear: function () {
      try { localStorage.removeItem(LS_TOK); } catch (e) {}
    },
    has: function () { return !!Keyring.get(); }
  };

  /* ── bytes ────────────────────────────────────────────────────── */
  function utf8(str) { return new TextEncoder().encode(str); }

  function toBase64(bytes) {
    if (typeof bytes === 'string') bytes = utf8(bytes);
    var bin = '', CHUNK = 0x8000;          // argument limits bite on big files
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  /* ── the city ─────────────────────────────────────────────────── */
  function headers() {
    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + Keyring.get(),
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };
  }
  function api(path) {
    return 'https://api.github.com/repos/' + REPO + '/contents/' +
           path.split('/').map(encodeURIComponent).join('/');
  }

  var City = {
    repo: REPO,
    branch: BRANCH,

    /* Public URL of a published file, for building hrefs. */
    url: function (path) { return path; },

    /* The blob sha of a path, or null when it does not exist yet. */
    shaOf: async function (path) {
      var r = await fetch(api(path) + '?ref=' + BRANCH, { headers: headers() });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('read ' + r.status + ' — ' + (await r.text()).slice(0, 160));
      return (await r.json()).sha;
    },

    /* What is in a directory. Empty array when there is nothing there. */
    list: async function (dir) {
      var r = await fetch(api(dir) + '?ref=' + BRANCH, { headers: headers() });
      if (r.status === 404) return [];
      if (!r.ok) throw new Error('list ' + r.status);
      var j = await r.json();
      return Array.isArray(j) ? j : [];
    },

    /* Write a file. `content` may be a string or a Uint8Array. */
    write: async function (path, content, message) {
      var sha = await City.shaOf(path);
      var body = {
        message: message || ('update ' + path),
        content: toBase64(content),
        branch: BRANCH
      };
      if (sha) body.sha = sha;

      var r = await fetch(api(path), {
        method: 'PUT', headers: headers(), body: JSON.stringify(body)
      });
      if (r.status === 409 || r.status === 422) {
        throw new Error(path + ' changed under us (' + r.status +
                        ') — reload and redo the edit');
      }
      if (!r.ok) throw new Error('write ' + r.status + ' — ' + (await r.text()).slice(0, 200));
      return r.json();
    },

    /* Remove a file. */
    remove: async function (path, message) {
      var sha = await City.shaOf(path);
      if (!sha) return null;
      var r = await fetch(api(path), {
        method: 'DELETE',
        headers: headers(),
        body: JSON.stringify({ message: message || ('remove ' + path), sha: sha, branch: BRANCH })
      });
      if (!r.ok) throw new Error('delete ' + r.status);
      return r.json();
    },

    /* The press room caches the repo listing; after publishing, the
       author's own browser would otherwise show yesterday's archive. */
    forgetCaches: function () {
      try {
        sessionStorage.removeItem('wazoo-files-v3');
        sessionStorage.removeItem('wazoo-files-v2');
      } catch (e) {}
    },

    toBase64: toBase64
  };

  root.Keyring = Keyring;
  root.City = City;
})(window);
