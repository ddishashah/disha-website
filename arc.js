/* Arc reveal — slanted-polygon wipe, as used on exoape.com (values measured there):
   clip-path polygon(0 0, 100% 0, 100% p*110vh, 0 p*100vh), ~1.1s, quartic in-out.
   Drives: the full-screen menu, the page-to-page transition, and rolling button labels.
   No dependencies. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ss; try { ss = window.sessionStorage; } catch (e) {}
  var DARK = '#140700';

  var style = document.createElement('style');
  style.textContent =
    '.arc-cover{position:fixed;inset:0;z-index:9999;background:' + DARK + ';pointer-events:none;visibility:visible;clip-path:polygon(0 0,100% 0,100% 0,0 0)}' +
    '.roll{display:inline-block;vertical-align:top;overflow:hidden;height:1.25em;line-height:1.25}' +
    '.roll__in{display:flex;flex-direction:column;transition:transform .6s cubic-bezier(.19,1,.22,1)}' +
    '.roll__in>span{display:block;height:1.25em;white-space:nowrap}' +
    'a:hover .roll__in,button:hover .roll__in,a:focus-visible .roll__in,button:focus-visible .roll__in{transform:translateY(-50%)}';
  document.head.appendChild(style);

  function ease(t) { return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; }

  // Tween with a timeout fallback so a throttled/hidden tab never gets stuck mid-transition
  function tween(from, to, dur, onUpdate, done) {
    var finished = false;
    function end() { if (finished) return; finished = true; onUpdate(to); if (done) done(); }
    if (reduce) return end();
    var start = performance.now();
    (function frame(now) {
      if (finished) return;
      var t = Math.min(1, (now - start) / (dur * 1000));
      onUpdate(from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(frame); else end();
    })(start);
    setTimeout(end, dur * 1000 + 400);
  }

  function wipe(el, p) {
    var h = window.innerHeight;
    el.style.clipPath = 'polygon(0 0,100% 0,100% ' + (p * h * 1.1) + 'px,0 ' + (p * h) + 'px)';
  }

  /* ---------- Page transition ---------- */
  var navigating = false;
  function makeCover() {
    var c = document.createElement('div');
    c.className = 'arc-cover';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    return c;
  }
  function go(url) {
    if (navigating) return;
    navigating = true;
    try { if (ss) ss.setItem('arc', '1'); } catch (e) {}
    var c = makeCover();
    var jump = function () { window.location.href = url; };
    tween(0, 1, 0.9, function (p) { wipe(c, p); }, jump);
  }
  window.arcGo = go;

  // Arriving through a transition: the cover is already up (head snippet), wipe it away
  if (root.classList.contains('arc-pending')) {
    var cover = makeCover();
    wipe(cover, 1);
    root.classList.remove('arc-pending');
    window.__arcDelay = 0.45;            // let the page's own intro wait for the reveal
    tween(1, 0, 1, function (p) { wipe(cover, p); }, function () { cover.remove(); });
  }
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    navigating = false;
    document.querySelectorAll('.arc-cover').forEach(function (c) { c.remove(); });
  });

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.closest('[data-menu]')) return;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;
    if (u.pathname === location.pathname && u.search === location.search) return;   // same page / hash only
    e.preventDefault();
    go(u.href);
  });

  /* ---------- Rolling labels ---------- */
  document.querySelectorAll('.nav__cta,.btn-ghost,.footer__nav a,.menu__link,.menu__sub').forEach(function (el) {
    if (el.children.length || el.dataset.roll === 'off') return;
    var t = el.textContent.trim();
    if (!t) return;
    el.setAttribute('aria-label', t);
    el.textContent = '';
    var w = document.createElement('span'); w.className = 'roll';
    var inner = document.createElement('span'); inner.className = 'roll__in';
    var a = document.createElement('span'); a.textContent = t;
    var b = document.createElement('span'); b.textContent = t; b.setAttribute('aria-hidden', 'true');
    inner.appendChild(a); inner.appendChild(b); w.appendChild(inner); el.appendChild(w);
  });

  /* ---------- Menu ---------- */
  var menu = document.querySelector('[data-menu]');
  if (!menu) return;
  var page = document.querySelector('[data-page]');
  var inner = menu.querySelector('.menu__inner');
  var openBtns = document.querySelectorAll('[data-menu-open]');
  var isOpen = false, busy = false, lastFocus = null;

  function render(p) {
    wipe(menu, p);
    // content settles from 130% / -7deg, the page behind scales and tilts the other way
    inner.style.transform = 'scale(' + (1.3 - 0.3 * p) + ') rotate(' + (-7 * (1 - p)) + 'deg)';
    if (page) page.style.transform = 'scale(' + (1 + 0.29 * p) + ') rotate(' + (7 * p) + 'deg)';
  }
  function origin() {
    if (page) page.style.transformOrigin = (window.innerWidth / 2) + 'px ' + (window.scrollY + window.innerHeight / 2) + 'px';
  }
  function setExpanded(v) { openBtns.forEach(function (b) { b.setAttribute('aria-expanded', String(v)); }); }

  function open() {
    if (isOpen || busy) return;
    isOpen = busy = true;
    lastFocus = document.activeElement;
    origin();
    if (page) page.style.willChange = 'transform';
    root.classList.add('menu-open');
    menu.removeAttribute('inert'); menu.setAttribute('aria-hidden', 'false');
    menu.classList.add('is-active', 'is-open');
    setExpanded(true);
    tween(0, 1, 1.1, render, function () {
      busy = false;
      var c = menu.querySelector('.menu__close'); if (c) c.focus({ preventScroll: true });
    });
  }
  function close(target) {
    if (!isOpen || busy) return;
    isOpen = false; busy = true;
    if (target) {                                 // jump behind the menu so the reveal lands on the section
      if (page) page.style.transform = '';        // measure without the 1.29x scale
      target.scrollIntoView();
    }
    origin();
    render(1);
    menu.classList.remove('is-open');
    setExpanded(false);
    tween(1, 0, 1.1, render, function () {
      menu.classList.remove('is-active');
      menu.style.clipPath = ''; inner.style.transform = '';
      if (page) { page.style.transform = ''; page.style.willChange = ''; page.style.transformOrigin = ''; }
      menu.setAttribute('inert', ''); menu.setAttribute('aria-hidden', 'true');
      root.classList.remove('menu-open');
      busy = false;
      if (!target && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    });
  }

  // Hover trail: images appear one after another behind the pointer while it moves over a link
  var trail = menu.querySelector('[data-menu-trail]');
  var SETS = {
    work: ['img/cover-hotplate.png', 'img/cover-eds.png', 'img/cover-complaints.png', 'img/cover-bull-and-wolf.webp', 'img/cover-shweta-labs.webp', 'img/menu-northside.webp'],
    home: ['img/menu-hotplate.webp', 'img/menu-coin.webp', 'img/menu-wax.webp', 'img/menu-arch.webp'],
    about: ['img/me.webp', 'img/menu-arch.webp', 'img/menu-northside.webp', 'img/menu-coin.webp'],
    contact: ['img/menu-coin.webp', 'img/menu-wax.webp']
  };
  if (trail && !reduce && window.matchMedia('(hover: hover) and (min-width: 768px)').matches) {
    var set = null, idx = 0, lx = -999, ly = -999, z = 1, pool = [];
    Object.keys(SETS).forEach(function (k) { SETS[k].forEach(function (src) { var im = new Image(); im.src = src; pool.push(im); }); });
    var spawn = function (x, y) {
      var im = document.createElement('img');
      im.src = SETS[set][idx++ % SETS[set].length]; im.alt = '';
      // images appear to the sides of the link column, never on top of the links
      var mw = menu.getBoundingClientRect().width, side = (idx % 2 ? 1 : -1), off = 230 + Math.random() * 150;
      var px = Math.max(110, Math.min(mw - 110, mw / 2 + side * off));
      im.style.width = Math.round(150 + Math.random() * 100) + 'px';   // unequal sizes, each at its own ratio
      im.style.left = px + 'px'; im.style.top = (y + (Math.random() * 70 - 35)) + 'px'; im.style.zIndex = z++;
      im.style.setProperty('--r', (Math.random() * 10 - 5).toFixed(1) + 'deg');
      trail.appendChild(im);
      requestAnimationFrame(function () { requestAnimationFrame(function () { im.classList.add('is-on'); }); });
      setTimeout(function () { im.classList.remove('is-on'); im.classList.add('is-off'); setTimeout(function () { im.remove(); }, 600); }, 1300);
    };
    menu.querySelectorAll('[data-trail]').forEach(function (a) {
      a.addEventListener('pointerenter', function (e) {
        set = a.getAttribute('data-trail'); idx = 0;
        var r = menu.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        lx = x; ly = y; spawn(x, y);                       // the first image appears the moment you land on a link
      });
      a.addEventListener('pointerleave', function () { set = null; });
      a.addEventListener('pointermove', function (e) {
        if (!set) return;
        var r = menu.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (Math.hypot(x - lx, y - ly) < 40) return;
        lx = x; ly = y; spawn(x, y);
      });
    });
  }

  openBtns.forEach(function (b) { b.addEventListener('click', open); });
  menu.querySelectorAll('[data-menu-close]').forEach(function (b) { b.addEventListener('click', function () { close(); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  menu.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;                      // external: open normally
    e.preventDefault();
    if (u.pathname === location.pathname) {                        // same page: close, landing on the section (or the top)
      var t = u.hash.length > 1 ? document.querySelector(u.hash) : document.body;
      if (history.replaceState) history.replaceState(null, '', u.hash || location.pathname);
      close(t || null);
    } else {
      go(u.href);                                                  // other page: arc transition
    }
  });
})();
