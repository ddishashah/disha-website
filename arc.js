/* Shared rising-panel menu and page transitions. No dependencies. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ss; try { ss = window.sessionStorage; } catch (e) {}
  var DARK = '#140700';

  var style = document.createElement('style');
  style.textContent =
    '.arc-cover{position:fixed;inset:0;z-index:9999;background:' + DARK + ';pointer-events:none;visibility:visible;transform:translate3d(0,100%,0);will-change:transform}' +
    '.menu{clip-path:none;transform:translate3d(0,100%,0);will-change:transform}' +
    '.menu .menu__item{opacity:0;transform:translate3d(0,32px,0);transform-origin:center bottom}' +
    '.menu.is-open .menu__item{opacity:1;transform:none;transition:opacity .7s ease,transform 1.05s cubic-bezier(.19,1,.22,1);transition-delay:calc(.22s + var(--i,0)*.07s)}' +
    '@media(prefers-reduced-motion:reduce){.menu.is-open .menu__item{transition:none}}' +
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

  function rise(el, p) { el.style.transform = 'translate3d(0,' + ((1 - p) * 100) + '%,0)'; }
  function leaveUp(el, p) { el.style.transform = 'translate3d(0,' + (-p * 100) + '%,0)'; }

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
    tween(0, 1, 0.9, function (p) { rise(c, p); }, jump);
  }
  window.arcGo = go;

  // Arriving through a transition: lift the cover to reveal the new page.
  if (root.classList.contains('arc-pending')) {
    var cover = makeCover();
    rise(cover, 1);
    root.classList.remove('arc-pending');
    window.__arcDelay = 0.45;            // let the page's own intro wait for the reveal
    tween(0, 1, 0.95, function (p) { leaveUp(cover, p); }, function () { cover.remove(); });
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
    rise(menu, p);
    inner.style.transform = 'translate3d(0,' + ((1 - p) * 36) + 'px,0)';
    if (page) page.style.transform = 'translate3d(0,' + (-18 * p) + 'px,0) scale(' + (1 - 0.015 * p) + ')';
  }
  function setExpanded(v) { openBtns.forEach(function (b) { b.setAttribute('aria-expanded', String(v)); }); }

  function open() {
    if (isOpen || busy) return;
    isOpen = busy = true;
    lastFocus = document.activeElement;
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
      if (page) page.style.transform = '';
      target.scrollIntoView();
    }
    render(1);
    menu.classList.remove('is-open');
    setExpanded(false);
    tween(1, 0, 1.1, render, function () {
      menu.classList.remove('is-active');
      menu.style.transform = ''; inner.style.transform = '';
      if (page) { page.style.transform = ''; page.style.willChange = ''; }
      menu.setAttribute('inert', ''); menu.setAttribute('aria-hidden', 'true');
      root.classList.remove('menu-open');
      busy = false;
      if (!target && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    });
  }

  // Hover picture: one image per link, beside the link column (never on top of the text), at its own ratio
  var trail = menu.querySelector('[data-menu-trail]');
  var PIC = { home: 'img/menu-northside.webp', about: 'img/me.webp', work: 'img/cover-hotplate.png', contact: 'img/menu-coin.webp' };
  var SIDE = { home: 1, about: -1, work: 1, contact: -1 };
  if (trail && !reduce && window.matchMedia('(hover: hover) and (min-width: 768px)').matches) {
    var cur = null;
    Object.keys(PIC).forEach(function (k) { var im = new Image(); im.src = PIC[k]; });
    var hidePic = function () {
      if (!cur) return;
      var im = cur; cur = null;
      im.classList.remove('is-on'); im.classList.add('is-off');
      setTimeout(function () { im.remove(); }, 600);
    };
    var showPic = function (a) {
      hidePic();
      var key = a.getAttribute('data-trail'); if (!PIC[key]) return;
      var mr = menu.getBoundingClientRect(), lr = a.getBoundingClientRect();
      var im = document.createElement('img');
      im.src = PIC[key]; im.alt = '';
      im.style.width = '230px';
      im.style.left = Math.round(mr.width / 2 + SIDE[key] * 300) + 'px';
      im.style.top = Math.round(lr.top - mr.top + lr.height / 2) + 'px';
      im.style.setProperty('--r', (SIDE[key] * -3) + 'deg');
      trail.appendChild(im); cur = im;
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (cur === im) im.classList.add('is-on'); }); });
    };
    menu.querySelectorAll('[data-trail]').forEach(function (a) {
      a.addEventListener('pointerenter', function () { showPic(a); });
      a.addEventListener('pointerleave', hidePic);
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
