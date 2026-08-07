/* ═══════════════════════════════════════════════════════════════════
   The Warded Door — the gate on both workshop pages.

   Draws the same banner and the same locked door on the Penny Press
   and the Scriptorium, so there is one of these to maintain rather
   than two.

   What this is, and what it is not.

   It is a door: it tells a visitor plainly that they have walked into
   the workings of the site, and it keeps the controls out of reach
   until a key is produced and GitHub agrees the key is live.

   It is not a lock on anything. The page is public and its source is
   readable; anyone determined can step past this in a console. That
   costs them nothing and gains them nothing, because the actual lock
   is on GitHub's side: no token, no write, no matter what any of this
   code says. The door is here so nobody wanders in by accident and
   thinks the site is broken — not to pretend a static page can keep
   secrets.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CSS = `
  .ward-banner{
    position:relative;z-index:70;
    display:flex;flex-wrap:wrap;gap:8px 18px;align-items:baseline;
    padding:11px 20px;
    font-family:"Cinzel",Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;
    color:#f6dcc0;
    background:repeating-linear-gradient(135deg,#5a1f14 0 14px,#4a190f 14px 28px);
    border-bottom:2px solid #2a0c06;
    box-shadow:0 3px 14px rgba(0,0,0,.5);
  }
  .ward-banner b{color:#ffd9a8;font-weight:700}
  .ward-banner span{text-transform:none;letter-spacing:0;font-family:"EB Garamond",Georgia,serif;
    font-size:15px;color:#e8c3a6;flex:1 1 320px}
  .ward-banner button{
    font-family:"Cinzel",serif;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;
    color:#f6dcc0;background:rgba(0,0,0,.3);border:1px solid #8a3b28;border-radius:2px;
    padding:6px 11px;cursor:pointer;
  }
  .ward-banner button:hover{background:rgba(0,0,0,.5);border-color:#c2432c}
  .ward-banner a{color:#ffd9a8}

  .ward{
    position:fixed;inset:0;z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:22px;
    background:radial-gradient(120% 90% at 50% 0%,rgba(40,16,8,.86),rgba(6,4,2,.96));
    backdrop-filter:blur(3px);
  }
  .ward[hidden]{display:none}
  .ward-door{
    width:min(560px,100%);max-height:92vh;overflow:auto;position:relative;
    padding:clamp(26px,4vw,42px) clamp(22px,3.6vw,40px) clamp(22px,3vw,34px);
    color:#2a2114;text-align:center;
    background:
      radial-gradient(120% 70% at 15% 0%,rgba(255,255,255,.5),transparent 55%),
      linear-gradient(172deg,#f3e9cf,#e2d0aa 60%,#d2bd90);
    border:1px solid #6b5427;
    box-shadow:0 30px 70px rgba(0,0,0,.75), inset 0 0 60px rgba(120,88,40,.22);
  }
  .ward-door::before{
    content:"";position:absolute;inset:0;pointer-events:none;opacity:.28;mix-blend-mode:multiply;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='.5'/></svg>");
  }
  .ward-door>*{position:relative}
  .ward-sigil{width:64px;height:64px;margin:0 auto 14px;display:block;color:#8a2f1d}
  .ward-door h2{
    font-family:"IM Fell English",Georgia,serif;font-size:clamp(25px,4.4vw,36px);
    line-height:1.1;margin:0 0 6px;color:#1c1408;
  }
  .ward-door .whence{
    font-family:"Cinzel",serif;font-size:9.5px;letter-spacing:.24em;text-transform:uppercase;
    color:#8a2f1d;margin:0 0 16px;
  }
  .ward-door p{margin:0 0 13px;font:16px/1.62 "EB Garamond",Georgia,serif;color:#3d3221;text-align:left}
  .ward-door p.plain{
    font-size:14.5px;color:#5c4b30;border-top:1px solid rgba(107,84,39,.35);padding-top:13px;
  }
  .ward-door code{font-family:ui-monospace,Consolas,monospace;font-size:13px;color:#6d5216}
  .ward-door label{
    display:block;text-align:left;font-family:"Cinzel",serif;font-size:9.5px;letter-spacing:.18em;
    text-transform:uppercase;color:#6d5a3d;margin:16px 0 5px;
  }
  .ward-door input{
    width:100%;font:16px "EB Garamond",Georgia,serif;color:#241a0e;
    background:rgba(255,252,244,.75);border:1px solid #6b5427;border-radius:2px;padding:10px 12px;
  }
  .ward-door input:focus{outline:none;border-color:#8a6a24;box-shadow:0 0 0 3px rgba(138,106,36,.22)}
  .ward-acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:16px 0 0}
  .ward-door button{
    font-family:"Cinzel",serif;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;
    padding:11px 18px;border-radius:2px;cursor:pointer;
    color:#f3efe4;background:linear-gradient(180deg,#8a6038,#4a2e18);border:1px solid #241608;
  }
  .ward-door button:hover{background:linear-gradient(180deg,#9c6d40,#5b3a20)}
  .ward-door button.away{background:none;color:#6d5216;border-color:rgba(107,84,39,.5)}
  .ward-door button.away:hover{background:rgba(138,106,36,.12)}
  .ward-door button[disabled]{opacity:.5;cursor:progress}
  .ward-why{
    margin:14px 0 0;font-family:"Cinzel",serif;font-size:10px;letter-spacing:.1em;
    text-transform:uppercase;min-height:1.2em;
  }
  .ward-why.bad{color:#8c2f1d}
  .ward-why.good{color:#4d6b2e}
  `;

  var SIGIL =
    '<svg class="ward-sigil" viewBox="0 0 64 64" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M32 3l25 11v18c0 15-11 25-25 29C18 57 7 47 7 32V14z"/>' +
    '<path d="M32 12v10M32 42v10M13 32h10M41 32h10" opacity=".55"/>' +
    '<circle cx="32" cy="32" r="10"/><path d="M32 27v5l4 3"/></svg>';

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var banner = el(
      '<div class="ward-banner" role="alert">' +
        '<b>Workshop &mdash; not part of the city</b>' +
        '<span>You have walked in behind the scenes. This page edits the website itself. ' +
        'Nothing here can be changed without a GitHub key, so there is no point trying.</span>' +
        '<a href="./">Back to Waterdeep &#8599;</a>' +
        '<button type="button" id="ward-forget">Forget the key</button>' +
      '</div>');
    document.body.insertBefore(banner, document.body.firstChild);

    var ward = el(
      '<div class="ward" id="ward" role="dialog" aria-modal="true" aria-labelledby="ward-title">' +
        '<div class="ward-door">' + SIGIL +
          '<p class="whence">A ward stands upon this door</p>' +
          '<h2 id="ward-title">You Are Behind the Press</h2>' +
          '<p>This is not a page of the city. It is the workshop where the broadsheet is set ' +
          'and the notice board is written, and it belongs to the keeper of the site.</p>' +
          '<p>If you were only looking for Waterdeep, the door out is below and nothing is amiss.</p>' +
          '<p class="plain"><b>Plainly:</b> the ward is courtesy, not armour. This page is public ' +
          'and you could step past it if you wished &mdash; and gain nothing, because the real lock ' +
          'is at GitHub. Without a token with write access to <code>PortugalDMWaterdeepWazoo</code>, ' +
          'every attempt to change anything is refused at the far end, whatever this page allows.</p>' +
          '<label for="ward-key">Show your key</label>' +
          '<input type="password" id="ward-key" placeholder="github_pat_&hellip;" autocomplete="off" spellcheck="false">' +
          '<div class="ward-acts">' +
            '<button type="button" id="ward-try">Turn the key</button>' +
            '<button type="button" class="away" id="ward-away">Leave, I took a wrong turn</button>' +
          '</div>' +
          '<p class="ward-why" id="ward-why"></p>' +
        '</div>' +
      '</div>');
    document.body.appendChild(ward);
    return { banner: banner, ward: ward };
  }

  function start() {
    if (!window.Keyring) {
      console.warn('gate.js needs keyring.js loaded first');
      return;
    }
    var parts = build();
    var ward  = parts.ward;
    var why   = document.getElementById('ward-why');
    var key   = document.getElementById('ward-key');

    function open()  { ward.hidden = false; setTimeout(function () { key.focus(); }, 60); }
    function shut()  { ward.hidden = true; document.dispatchEvent(new CustomEvent('ward:open')); }

    function say(msg, good) {
      why.textContent = msg || '';
      why.className = 'ward-why' + (msg ? (good ? ' good' : ' bad') : '');
    }

    async function tryKey(tok, quiet) {
      var btn = document.getElementById('ward-try');
      if (btn) { btn.disabled = true; }
      if (!quiet) say('Trying the ward…', true);
      var res = await Keyring.verify(tok);
      if (btn) { btn.disabled = false; }

      if (res.ok) {
        Keyring.set((tok || Keyring.get()).trim());
        say('', true);
        shut();
        return true;
      }
      Keyring.clear();
      say(res.why, false);
      open();
      return false;
    }

    document.getElementById('ward-try').addEventListener('click', function () {
      tryKey(key.value);
    });
    key.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); tryKey(key.value); }
    });
    document.getElementById('ward-away').addEventListener('click', function () {
      location.href = './';
    });
    document.getElementById('ward-forget').addEventListener('click', function () {
      Keyring.clear();
      key.value = '';
      say('The key is forgotten.', false);
      open();
    });

    // A key already in this browser still has to prove it is live —
    // tokens expire, and finding out at publish time is worse.
    if (Keyring.has()) {
      ward.hidden = false;
      say('Trying the ward…', true);
      tryKey(Keyring.get(), true);
    } else {
      open();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
