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
  /* ── the banner ───────────────────────────────────────────────── */
  .ward-banner{
    position:relative;z-index:70;
    display:flex;flex-wrap:wrap;gap:8px 18px;align-items:baseline;
    padding:11px 20px;
    font-family:"Cinzel",Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;
    color:#6fe6da;
    background:
      linear-gradient(180deg,rgba(24,70,92,.55),rgba(8,26,38,.75)),
      repeating-linear-gradient(135deg,#0d2f42 0 14px,#0a2434 14px 28px);
    border-bottom:1px solid #2ad6c8;
    box-shadow:0 0 22px rgba(42,214,200,.28), 0 3px 16px rgba(0,0,0,.55),
               inset 0 -1px 0 rgba(120,246,236,.35);
    text-shadow:0 0 10px rgba(60,230,216,.55);
  }
  .ward-banner b{color:#a6fff4;font-weight:700;text-shadow:0 0 14px rgba(80,240,226,.75)}
  .ward-banner span{
    text-transform:none;letter-spacing:0;font-family:"EB Garamond",Georgia,serif;
    font-size:15px;color:#9fe8e0;flex:1 1 320px;text-shadow:0 0 9px rgba(60,220,208,.4);
  }
  .ward-banner button{
    font-family:"Cinzel",serif;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;
    color:#a6fff4;background:rgba(6,26,36,.6);border:1px solid #2ad6c8;border-radius:2px;
    padding:6px 11px;cursor:pointer;text-shadow:0 0 8px rgba(80,240,226,.6);
    box-shadow:0 0 12px rgba(42,214,200,.22);
  }
  .ward-banner button:hover{background:rgba(20,70,88,.7);box-shadow:0 0 18px rgba(42,214,200,.45)}
  .ward-banner a{color:#a6fff4;text-shadow:0 0 10px rgba(80,240,226,.6)}

  /* ── the ward itself ──────────────────────────────────────────── */
  .ward{
    position:fixed;inset:0;z-index:9999;overflow:hidden;
    display:flex;align-items:center;justify-content:center;padding:22px;
    background:
      radial-gradient(120% 90% at 50% 0%,rgba(14,58,80,.82),rgba(3,10,16,.96));
    backdrop-filter:blur(4px) saturate(1.25) hue-rotate(-18deg);
    -webkit-backdrop-filter:blur(4px) saturate(1.25) hue-rotate(-18deg);
  }
  .ward[hidden]{display:none}

  /* Smoke: a few very large, very soft blooms drifting across, plus one
     fibrous turbulence sheet over them for grain. They are painted with
     screen blending so they read as light in the air rather than as
     grey paint, and only transform is animated — moving a blurred layer
     by transform stays on the compositor, animating its filter would
     repaint every frame. */
  .ward-smoke{position:absolute;inset:-20%;pointer-events:none;z-index:0}
  .ward-smoke span{
    position:absolute;display:block;border-radius:50%;
    mix-blend-mode:screen;filter:blur(58px);will-change:transform;
  }
  .ward-smoke span:nth-child(1){
    width:62vw;height:52vw;left:-12vw;top:2vh;
    background:radial-gradient(circle at 40% 40%,rgba(64,196,214,.42),rgba(28,110,150,.16) 45%,transparent 70%);
    animation:ward-drift-a 46s ease-in-out infinite alternate;
  }
  .ward-smoke span:nth-child(2){
    width:70vw;height:46vw;right:-16vw;top:26vh;
    background:radial-gradient(circle at 55% 50%,rgba(38,214,200,.34),rgba(20,90,130,.14) 48%,transparent 72%);
    animation:ward-drift-b 61s ease-in-out infinite alternate;
  }
  .ward-smoke span:nth-child(3){
    width:54vw;height:54vw;left:18vw;bottom:-18vh;
    background:radial-gradient(circle at 50% 45%,rgba(84,166,236,.30),rgba(18,70,110,.12) 50%,transparent 74%);
    animation:ward-drift-c 53s ease-in-out infinite alternate;
  }
  .ward-smoke span:nth-child(4){
    width:40vw;height:34vw;right:8vw;bottom:4vh;
    background:radial-gradient(circle at 45% 55%,rgba(120,246,236,.24),transparent 68%);
    animation:ward-drift-a 39s ease-in-out infinite alternate-reverse;
  }
  /* the fibrous sheet */
  .ward-smoke::after{
    content:"";position:absolute;inset:-10%;
    opacity:.22;mix-blend-mode:screen;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='700' height='700'><filter id='s'><feTurbulence type='fractalNoise' baseFrequency='.006 .011' numOctaves='5' seed='7'/><feColorMatrix type='matrix' values='0 0 0 0 0.25  0 0 0 0 0.82  0 0 0 0 0.86  0 0 0 -1.1 1'/></filter><rect width='700' height='700' filter='url(%23s)'/></svg>");
    background-size:1400px 1400px;
    animation:ward-creep 90s linear infinite;
  }
  @keyframes ward-drift-a{
    from{transform:translate3d(0,0,0) scale(1)}
    to  {transform:translate3d(9vw,-6vh,0) scale(1.22)}
  }
  @keyframes ward-drift-b{
    from{transform:translate3d(0,0,0) scale(1.1)}
    to  {transform:translate3d(-11vw,7vh,0) scale(.92)}
  }
  @keyframes ward-drift-c{
    from{transform:translate3d(0,0,0) scale(.95)}
    to  {transform:translate3d(7vw,-9vh,0) scale(1.25)}
  }
  @keyframes ward-creep{
    from{background-position:0 0}
    to  {background-position:1400px -700px}
  }
  @media(prefers-reduced-motion:reduce){
    .ward-smoke span,.ward-smoke::after{animation:none}
  }

  /* ── the door ─────────────────────────────────────────────────── */
  .ward-door{
    width:min(560px,100%);max-height:92vh;overflow:auto;position:relative;z-index:1;
    padding:clamp(26px,4vw,42px) clamp(22px,3.6vw,40px) clamp(22px,3vw,34px);
    color:#9fe8e0;text-align:center;
    background:
      radial-gradient(130% 80% at 50% 0%,rgba(28,92,118,.55),transparent 62%),
      linear-gradient(172deg,rgba(9,30,42,.94),rgba(4,14,22,.96));
    border:1px solid #2ad6c8;
    box-shadow:
      0 0 40px rgba(42,214,200,.30),
      0 30px 70px rgba(0,0,0,.75),
      inset 0 0 70px rgba(30,120,150,.20);
    backdrop-filter:blur(2px);
  }
  .ward-door>*{position:relative}
  .ward-sigil{
    width:64px;height:64px;margin:0 auto 14px;display:block;color:#4fe0d0;
    filter:drop-shadow(0 0 12px rgba(79,224,208,.85)) drop-shadow(0 0 26px rgba(60,180,220,.5));
  }
  .ward-door h2{
    font-family:"IM Fell English",Georgia,serif;font-size:clamp(25px,4.4vw,36px);
    line-height:1.1;margin:0 0 6px;color:#c9fff8;
    text-shadow:0 0 16px rgba(80,240,226,.7),0 0 38px rgba(50,170,210,.45);
  }
  .ward-door .whence{
    font-family:"Cinzel",serif;font-size:9.5px;letter-spacing:.24em;text-transform:uppercase;
    color:#5fd8ea;margin:0 0 16px;text-shadow:0 0 12px rgba(95,216,234,.75);
  }
  .ward-door p{
    margin:0 0 13px;font:16px/1.62 "EB Garamond",Georgia,serif;
    color:#a8ece4;text-align:left;text-shadow:0 0 8px rgba(60,210,200,.32);
  }
  .ward-door p.plain{
    font-size:14.5px;color:#8fd8d4;border-top:1px solid rgba(42,214,200,.3);padding-top:13px;
  }
  .ward-door p b{color:#c9fff8;text-shadow:0 0 12px rgba(80,240,226,.6)}
  .ward-door code{
    font-family:ui-monospace,Consolas,monospace;font-size:13px;color:#7fe3ff;
    text-shadow:0 0 10px rgba(127,227,255,.6);
  }
  .ward-door label{
    display:block;text-align:left;font-family:"Cinzel",serif;font-size:9.5px;letter-spacing:.18em;
    text-transform:uppercase;color:#5fd8ea;margin:16px 0 5px;
    text-shadow:0 0 10px rgba(95,216,234,.6);
  }
  .ward-door input{
    width:100%;font:16px "EB Garamond",Georgia,serif;color:#c9fff8;
    background:rgba(4,18,26,.75);border:1px solid rgba(42,214,200,.55);border-radius:2px;
    padding:10px 12px;text-shadow:0 0 8px rgba(80,240,226,.45);
  }
  .ward-door input::placeholder{color:rgba(120,200,200,.5)}
  .ward-door input:focus{
    outline:none;border-color:#4fe0d0;
    box-shadow:0 0 0 3px rgba(42,214,200,.22),0 0 22px rgba(42,214,200,.35);
  }
  .ward-acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:16px 0 0}
  .ward-door button{
    font-family:"Cinzel",serif;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;
    padding:11px 18px;border-radius:2px;cursor:pointer;
    color:#c9fff8;background:linear-gradient(180deg,rgba(30,110,138,.85),rgba(9,40,56,.9));
    border:1px solid #2ad6c8;
    text-shadow:0 0 10px rgba(80,240,226,.6);
    box-shadow:0 0 16px rgba(42,214,200,.25);
  }
  .ward-door button:hover{
    background:linear-gradient(180deg,rgba(44,140,170,.9),rgba(14,56,76,.95));
    box-shadow:0 0 26px rgba(42,214,200,.45);
  }
  .ward-door button.away{
    background:none;color:#6fd6d8;border-color:rgba(42,214,200,.4);box-shadow:none;
  }
  .ward-door button.away:hover{background:rgba(42,214,200,.12);box-shadow:0 0 16px rgba(42,214,200,.25)}
  .ward-door button[disabled]{opacity:.5;cursor:progress}
  .ward-why{
    margin:14px 0 0;font-family:"Cinzel",serif;font-size:10px;letter-spacing:.1em;
    text-transform:uppercase;min-height:1.2em;
  }
  /* Even the refusal is teal — a red here would be the one warm thing
     left on the page, and it reads as a browser error rather than as
     part of the ward. Brightness carries the alarm instead. */
  .ward-why.bad{color:#7fe3ff;text-shadow:0 0 14px rgba(127,227,255,.8)}
  .ward-why.good{color:#4fe0d0;text-shadow:0 0 14px rgba(79,224,208,.7)}
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
        '<div class="ward-smoke" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
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
