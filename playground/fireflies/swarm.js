// Flight for the fireflies, plus the glow each one casts inside the word.
// All units are Figma frame px (1920 × 1317); the SVG handles scaling.
//
// Each firefly is in one of four modes:
//   free  — wandering around the word, reacting to the cursor in its own way
//   hover — the cursor is on it: it stops, grows (Figma 1407:21231) and says hi
//   held  — being dragged; it follows the pointer and gets thrown on release
//   dizzy — dragged too far or clicked too often (Figma 1408:21358): woozy, stars
(() => {
const NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
const wrap = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const rand = (a, b) => a + Math.random() * (b - a);
const deg = (r) => (r * 180) / Math.PI;
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

// The small (top-down) art has its head at −130.7° from its light.
const SMALL_HEAD = -130.7;
// Glow inside the word, as Figma drew it: 99px discs (72px for the small ones), blur 80.
const SPOT = { large: [49.5, 40], small: [36, 40] };

const TUNING = {
  speed: { large: 62, small: 46 },   // cruising speed, frame px / s
  edge: 90,                          // start turning back this far from the visible edge
  // Where they meander: an area around the word (frame px beyond its outline), reaching
  // well above it. `roam: true` fireflies range a quarter wider.
  zone: { x: 380, top: 480, bottom: 220 },
  homing: 0.6,                       // how firmly the others keep to their loop around the word
  // Every so often each one flies over to a spot on the letters, lingers, then drifts off.
  visit: { every: [6, 15], stay: [2.5, 5], pull: 1.2, max: 5 },   // at most `max` at once
  glowLag: 5,                        // how quickly the glow catches up (higher = tighter)
  glowBoost: 1.35,                   // glow in the word a touch stronger than the static frame
  size: 1.35,                        // base size of every firefly (1 = Figma)
  hoverScale: 1.6,                   // Figma: 43.5 → 69.6 px wide on hover (on top of `size`)
  notice: 260,                       // how close the cursor must be before a firefly reacts
  dizzyFor: 3.2,                     // seconds a dizzy firefly needs to recover
};

// On small screens the 1920-px frame is scaled down hard (a phone sees it at ~0.2×), which shrinks
// the fireflies to specks. VIEW lifts their on-screen size back to a comfortable minimum, and makes
// a grabbed firefly grow a lot more so it can be seen under the finger.
const VIEW = { boost: 1, held: 1, hover: 1, spread: false, edge: 90 };
function updateView(svg) {
  const w = svg.clientWidth || 1920, h = svg.clientHeight || 1317;
  const k = Math.min(w / 1920, h / 1317);                 // css px per frame px
  const restPx = 58.7 * k;                                // a resting firefly's width today
  VIEW.boost = Math.min(3.4, Math.max(1, 26 / restPx));   // aim for ~26 css px at rest
  const small = VIEW.boost > 1.15;
  VIEW.hover = small ? 1.25 : 1;                          // touch / hover: bigger again
  VIEW.held = small ? 2.1 : 1;                            // while dragged: much bigger
  VIEW.spread = w < 500;                                  // phones: roam the whole screen, away from the word
  VIEW.edge = Math.max(TUNING.edge, 44 / k);              // keep a whole firefly (even a grabbed one) inside the sides
}

// Four-point sparkles that circle a dizzy firefly's head.
let visitors = 0;                    // how many fireflies are visiting the word right now

const STAR = 'M0 -4.2C.5 -.9 .9 -.5 4.2 0C.9 .5 .5 .9 0 4.2C-.5 .9 -.9 .5 -4.2 0C-.9 -.5 -.5 -.9 0 -4.2Z';

class Fly {
  constructor(cfg, el, spot) {
    Object.assign(this, { cfg, el, spot, type: cfg.type, x: cfg.x, y: cfg.y, gx: cfg.x, gy: cfg.y });
    this.mood = cfg.mood || {};
    this.pose = el.querySelector('.ff-pose');
    const r = (cfg.rot * Math.PI) / 180;
    this.h = cfg.type === 'small' ? r + (SMALL_HEAD * Math.PI) / 180 : cfg.mirror ? Math.PI + r : r;
    this.v = 0;
    this.cruise = TUNING.speed[cfg.type] * rand(0.85, 1.15) * (this.mood.speed || 1);
    this.seed = [rand(0, TAU), rand(0, TAU), rand(0, TAU)];
    this.nextHover = rand(2, 7);
    this.hoverUntil = rand(0.4, 1.4); // start by hovering in their Figma spots
    // Side-view pose: which way it faces, a smoothed flip, and its tilt.
    this.faceRight = !cfg.mirror;
    this.sx = this.faceRight ? 1 : -1;
    this.tilt = cfg.type === 'large' ? r : 0;
    this.rot = cfg.rot;
    this.wide = cfg.roam ? 1.25 : 1;
    // Each firefly leans towards its own spot in the area, which slowly slides around,
    // so they spread out instead of bunching up.
    this.drift = [rand(0.04, 0.09), rand(0.05, 0.11)];
    this.visit = null;
    this.nextVisit = rand(1, 14);      // staggered, so a few are at the word at any moment

    this.mode = 'free';
    this.s = 1; this.sv = 0;           // size, on a spring so hover pops with a little bounce
    this.wobble = 0;                   // dizzy sway, radians
    this.fleeUntil = 0;                // playful ones dart off after getting close
    this.stars = el.querySelector('.ff-stars');
  }

  // Called by play.js.
  setMode(mode, t, extra = {}) {
    if (mode === 'dizzy') {
      this.dizzyUntil = t + TUNING.dizzyFor;
      this.cx = this.x; this.cy = this.y;
    }
    if (mode === 'free' && extra.throw) {
      const [vx, vy] = extra.throw;
      const speed = Math.min(420, Math.hypot(vx, vy));
      if (speed > 20) { this.h = Math.atan2(vy, vx); this.v = speed; }
      this.hoverUntil = 0;
    }
    this.mode = mode;
    this.el.classList.toggle('is-hovered', mode === 'hover');
    this.el.classList.toggle('is-held', mode === 'held');
    this.el.classList.toggle('is-dizzy', mode === 'dizzy' || !!extra.dizzyHeld);
  }

  update(dt, t, b, word, cursor) {
    if (this.mode === 'held') this.followPointer(dt, cursor);
    else if (this.mode === 'dizzy') this.reel(dt, t);
    else this.fly(dt, t, b, word, cursor);

    // Size spring: grows when you touch it, settles back afterwards.
    const target = this.mode === 'free' ? 1 : this.mode === 'held' ? TUNING.hoverScale * VIEW.held : TUNING.hoverScale * VIEW.hover;
    this.sv += (target - this.s) * 220 * dt;
    this.sv *= Math.exp(-16 * dt);
    this.s += this.sv * dt;

    // The glow inside the word trails a little behind, like light spreading.
    const k = ease(TUNING.glowLag, dt);
    this.gx += (this.x - this.gx) * k;
    this.gy += (this.y - this.gy) * k;

    this.render(dt, t);
  }

  fly(dt, t, b, word, cursor) {
    const [a1, a2, a3] = this.seed;

    // Wander: layered slow sines make a heading that drifts and loops, never jerks.
    this.h += (1.1 * Math.sin(t * 0.53 + a1) + 0.7 * Math.sin(t * 1.37 + a2) + 0.35 * Math.sin(t * 2.9 + a3)) * dt;

    // Stay in view.
    let sx = 0, sy = 0;
    const m = VIEW.edge;
    if (this.x < b.x0 + m) sx += (b.x0 + m - this.x) / m;
    if (this.x > b.x1 - m) sx -= (this.x - (b.x1 - m)) / m;
    if (this.y < b.y0 + m) sy += (b.y0 + m - this.y) / m;
    if (this.y > b.y1 - m) sy -= (this.y - (b.y1 - m)) / m;

    // Stay in the meander area around the word; the further out, the firmer the turn back.
    const z = TUNING.zone, w = this.wide;
    let zx0 = word.x0 - z.x * w, zx1 = word.x1 + z.x * w, zy0 = word.y0 - z.top * w, zy1 = word.y1 + z.bottom * w;
    if (VIEW.spread) { zx0 = b.x0 + m; zx1 = b.x1 - m; zy0 = b.y0 + m; zy1 = b.y1 - m; }
    if (this.x < zx0) sx += Math.min(1.5, (zx0 - this.x) / 120);
    if (this.x > zx1) sx -= Math.min(1.5, (this.x - zx1) / 120);
    if (this.y < zy0) sy += Math.min(1.5, (zy0 - this.y) / 120);
    if (this.y > zy1) sy -= Math.min(1.5, (this.y - zy1) / 120);

    // Visiting the word: fly to a spot on the letters, linger around it, then wander off.
    const V = TUNING.visit;
    if (!this.visit && t > this.nextVisit) {
      if (visitors < (VIEW.spread ? 1 : V.max)) {
        visitors++;
        this.visit = { x: rand(word.x0 + 40, word.x1 - 40), y: rand(word.y0 + 70, word.y1 - 30), until: 0, giveUp: t + 12 };
      } else this.nextVisit = t + rand(2, 5);          // the word is busy; try again soon
    }
    let ax, ay, lean = TUNING.homing;
    if (this.visit) {
      ax = this.visit.x; ay = this.visit.y;
      const there = Math.hypot(ax - this.x, ay - this.y) < 110;
      if (there && !this.visit.until) this.visit.until = t + rand(...V.stay);
      lean = this.visit.until ? 0.6 : V.pull;           // circle about once it's arrived
      if ((this.visit.until && t > this.visit.until) || t > this.visit.giveUp) {
        this.visit = null; visitors--;
        this.nextVisit = t + rand(...V.every);
        this.leaveUntil = t + 4;                         // then head back out to the loop
      }
    } else {
      // Otherwise lean towards its own spot on a slow loop around the word (not across it).
      const [w1, w2] = this.drift;
      const cx = VIEW.spread ? (b.x0 + b.x1) / 2 : (word.x0 + word.x1) / 2, cy = VIEW.spread ? (b.y0 + b.y1) / 2 : (word.y0 + word.y1) / 2;
      const rx = VIEW.spread ? (b.x1 - b.x0) / 2 - m : (word.x1 - word.x0) / 2 + z.x * 0.6 * w, ry = VIEW.spread ? (b.y1 - b.y0) / 2 - m : (word.y1 - word.y0) / 2 + z.top * 0.55 * w;
      const a = t * w1 * 1.4 + a1;
      ax = Math.min(zx1, Math.max(zx0, cx + Math.cos(a) * rx));
      ay = Math.min(zy1, Math.max(zy0, cy + Math.sin(a) * ry * (0.85 + 0.15 * Math.sin(t * w2 + a3))));
    }
    // Phones: keep clear of the letters (unless visiting) by sliding out of the word's box
    if (VIEW.spread && !this.visit) {
      const bx0 = word.x0 - 60, bx1 = word.x1 + 60, by0 = word.y0 - 110, by1 = word.y1 + 70;
      if (this.x > bx0 && this.x < bx1 && this.y > by0 && this.y < by1) {
        const dl = this.x - bx0, dr = bx1 - this.x, dt2 = this.y - by0, db = by1 - this.y, mn = Math.min(dl, dr, dt2, db);
        const push = 2.2;
        if (mn === dt2) sy -= push; else if (mn === db) sy += push; else if (mn === dl) sx -= push; else sx += push;
      }
    }
    if (!this.visit && t < (this.leaveUntil || 0)) lean = 1;
    const d = Math.hypot(ax - this.x, ay - this.y);
    if (d > 50) { sx += ((ax - this.x) / d) * lean; sy += ((ay - this.y) / d) * lean; }

    // Personality: how it reacts when the cursor comes close.
    let rush = 1;
    if (cursor.active) {
      const cx = cursor.x - this.x, cy = cursor.y - this.y, cd = Math.hypot(cx, cy) || 1;
      if (cd < TUNING.notice) {
        const near = 1 - cd / TUNING.notice;
        const toward = [cx / cd, cy / cd];
        switch (this.mood.cursor) {
          case 'curious':   // comes over for a look, then hangs back a little
            if (cd > 90) { sx += toward[0] * near * 1.4; sy += toward[1] * near * 1.4; }
            break;
          case 'shy':       // backs off, quicker the closer you get
            sx -= toward[0] * near * 2.2; sy -= toward[1] * near * 2.2; rush = 1 + near * 1.6;
            break;
          case 'playful':   // creeps up, then darts away
            if (t < this.fleeUntil) { sx -= toward[0] * 2.5; sy -= toward[1] * 2.5; rush = 2.4; }
            else if (cd < 110) this.fleeUntil = t + 1.2;
            else { sx += toward[0] * near * 1.6; sy += toward[1] * near * 1.6; }
            break;
        }
      }
    }

    const pull = Math.hypot(sx, sy);
    if (pull > 0) this.h += wrap(Math.atan2(sy, sx) - this.h) * Math.min(1, pull * 2.2 * dt);

    // Now and then, stop and hover for a moment (sleepy ones more often, for longer).
    if (t > this.nextHover) {
      const lazy = this.mood.lazy || 1;
      this.hoverUntil = t + rand(0.9, 2.3) * lazy;
      this.nextHover = this.hoverUntil + rand(4, 10) / lazy;
    }
    const lingering = this.visit?.until ? 0.65 : 1;     // slows down to enjoy the letters
    let target = t < this.hoverUntil && rush === 1 ? 4 : this.cruise * rush * lingering * (0.8 + 0.25 * Math.sin(t * 0.8 + a2));
    if (this.mode === 'hover') target = 0;
    this.v += (target - this.v) * Math.min(1, dt * (this.mode === 'hover' ? 8 : 1.8));

    this.x += Math.cos(this.h) * this.v * dt;
    this.y += Math.sin(this.h) * this.v * dt;
  }

  followPointer(dt, cursor) {
    const k = ease(14, dt);
    const nx = this.x + (cursor.x - this.x) * k, ny = this.y + (cursor.y - this.y) * k;
    const vx = (nx - this.x) / dt, vy = (ny - this.y) / dt;
    if (Math.hypot(vx, vy) > 30) this.h += wrap(Math.atan2(vy, vx) - this.h) * ease(10, dt);
    this.x = nx; this.y = ny;
  }

  // Dizzy: drifts in a lopsided little loop and sways, then shakes it off.
  reel(dt, t) {
    const p = t * 2.4;
    const tx = this.cx + Math.cos(p) * 16, ty = this.cy + Math.sin(p * 1.3) * 9;
    this.x += (tx - this.x) * ease(4, dt);
    this.y += (ty - this.y) * ease(4, dt);
    this.wobble = Math.sin(t * 7) * 0.35;
    if (t > this.dizzyUntil) { this.wobble = 0; this.setMode('free', t); this.onRecover?.(this); }
  }

  render(dt, t) {
    let pose;
    if (this.type === 'large') {
      // Side view stays upright: flip to face the way it flies, tilt up to ±28°.
      const c = Math.cos(this.h);
      if (c > 0.2) this.faceRight = true;
      else if (c < -0.2) this.faceRight = false;
      const want = this.faceRight ? wrap(this.h) : wrap(this.h - Math.PI);
      const tilt = Math.max(-0.5, Math.min(0.5, want)) + this.wobble;
      this.tilt += (tilt - this.tilt) * Math.min(1, dt * 5);
      this.sx += ((this.faceRight ? 1 : -1) - this.sx) * Math.min(1, dt * 9);
      pose = `rotate(${deg(this.tilt).toFixed(2)}) scale(${this.sx.toFixed(3)} 1)`;
    } else {
      // Top-down turns freely to point its head along the flight path.
      const want = deg(this.h) - SMALL_HEAD + deg(this.wobble);
      this.rot += wrap(((want - this.rot) * Math.PI) / 180) * (180 / Math.PI) * Math.min(1, dt * 6);
      pose = `rotate(${this.rot.toFixed(2)})`;
    }
    const s = this.s.toFixed(3);
    this.el.setAttribute('transform', `translate(${this.x.toFixed(1)} ${this.y.toFixed(1)}) scale(${(this.s * TUNING.size * VIEW.boost).toFixed(3)})`);
    this.pose.setAttribute('transform', pose);
    this.spot.setAttribute('transform', `translate(${this.gx.toFixed(1)} ${this.gy.toFixed(1)}) scale(${s})`);

    // Stars orbit above the head on a flat ellipse while it's dizzy.
    if (this.el.classList.contains('is-dizzy')) {
      const hx = this.type === 'large' ? 9 * this.sx : 0, hy = this.type === 'large' ? -31 : -27;
      [...this.stars.children].forEach((star, i) => {
        const a = t * 5 + (i * TAU) / 3;
        const z = Math.sin(a);                     // front of the orbit is bigger and brighter
        star.setAttribute('transform', `translate(${(hx + Math.cos(a) * 16).toFixed(1)} ${(hy + z * 4).toFixed(1)}) scale(${(0.8 + z * 0.25).toFixed(2)})`);
        star.setAttribute('opacity', (0.7 + z * 0.3).toFixed(2));
      });
    }
  }

  // Top of the firefly in frame px — where the tooltip points (above the stars when dizzy).
  get top() { return { x: this.x, y: this.y - (this.el.classList.contains('is-dizzy') ? 38 : 22) * this.s * TUNING.size * VIEW.boost }; }
}

// The window in frame coordinates. The frame is fitted inside the window, so this
// can reach past 0…1920 / 0…1317 on wide or tall screens.
function visibleBounds(svg) {
  const w = svg.clientWidth || 1920, h = svg.clientHeight || 1317;
  const k = Math.min(w / 1920, h / 1317);
  const vw = w / k, vh = h / k;
  // Embedded previews pin the scene to the bottom edge (xMidYMax); standalone centres it
  if (document.documentElement.classList.contains('is-embedded')) return { x0: (1920 - vw) / 2, y0: 1317 - vh, x1: (1920 + vw) / 2, y1: 1317 };
  return { x0: (1920 - vw) / 2, y0: (1317 - vh) / 2, x1: (1920 + vw) / 2, y1: (1317 + vh) / 2 };
}

function start({ svg, swarm, glow, word, fireflies }) {
  const { createFirefly, injectDefs, blurredDisc } = window.Firefly;
  injectDefs(svg);
  updateView(svg);

  const flies = fireflies.map((cfg) => {
    const el = createFirefly({ ...cfg, rot: 0, halo: { color: cfg.halo }, flap: cfg.type === 'small' ? 0.09 : 0.11 });
    el.dataset.figma = cfg.figma;
    el.insertAdjacentHTML('beforeend', `<g class="ff-stars">${[0, 1, 2].map(() => `<path d="${STAR}" fill="#FFF151"/>`).join('')}</g>`);
    swarm.append(el);

    const { peak, r } = blurredDisc(...SPOT[cfg.type]);
    const spot = document.createElementNS(NS, 'g');
    spot.classList.add('glow-spot');
    spot.innerHTML = `<circle r="${r.toFixed(1)}" fill="url(#glow-${cfg.halo})" fill-opacity="${Math.min(0.85, peak * TUNING.glowBoost).toFixed(3)}"/>`;
    spot.style.setProperty('--pulse', `${cfg.pulse}s`);
    spot.style.setProperty('--pulse-delay', `${-cfg.delay}s`);
    glow.append(spot);

    const fly = new Fly(cfg, el, spot);
    el.fly = fly;
    fly.render(1, 0);
    return fly;
  });

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cursor = { x: 0, y: 0, active: false };
  const hooks = [];
  let bounds = visibleBounds(svg);
  addEventListener('resize', () => { bounds = visibleBounds(svg); updateView(svg); });

  let last = performance.now(), t = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);   // a backgrounded tab won't teleport them
    last = now; t += dt;
    // Reduced motion: free fireflies hold their Figma spots; touching them still works.
    for (const f of flies) {
      if (still && f.mode === 'free') { f.s += (1 - f.s) * ease(10, dt); f.render(dt, t); }
      else f.update(dt, t, bounds, word, cursor);
    }
    for (const hook of hooks) hook(dt, t);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return { flies, cursor, onFrame: (fn) => hooks.push(fn), now: () => t, still };
}

window.Swarm = { start, TUNING };
})();
