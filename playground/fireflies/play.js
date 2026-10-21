// Everything the visitor does: the cursor's light, the glow it brings to the word,
// and saying hi to / dragging / dizzying the fireflies.
(() => {
const NS = 'http://www.w3.org/2000/svg';
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const PLAY = {
  patience: 900,        // frame px of dragging before a firefly gets dizzy (per-mood override)
  clicks: 3,            // clicks within `clickWindow` that make it dizzy (per-mood override)
  clickWindow: 1.6,     // seconds
  // Hover by distance (frame px, at the firefly's normal size). It takes getting close to
  // start a hover, and moving clearly away to end it, so small drifts never flicker it.
  hoverIn: 30,
  hoverOut: 62,
  cursorGlow: [60, 40], // the cursor's glow in the word: a 120px disc, blur 80
  glowReach: 180,       // frame px from the word at which the cursor's glow starts to show
};

const DEFAULT_LINES = { hi: ['Hiiii..'], drag: ['Wheee!'], dizzy: ['I’m dizzy..'], phew: 'Phew..' };

function start({ stage, svg, glow, word, swarm }) {
  const { blurredDisc } = window.Firefly;
  const { flies, cursor, onFrame, now } = swarm;

  // ---- Tooltip (Figma 1408:21352) --------------------------------------------------
  const tip = document.createElement('div');
  tip.className = 'ff-tooltip';
  tip.setAttribute('role', 'status');
  tip.innerHTML = `<div class="ff-tooltip__pop"><div class="ff-tooltip__body"></div>
    <svg class="ff-tooltip__arrow" viewBox="13 0 14 8.51" width="14" height="8.51" aria-hidden="true">
      <path d="M26.07 0C26.96 0 27.41 1.08 26.78 1.71L20.71 7.78C20.32 8.17 19.68 8.17 19.29 7.78L13.22 1.71C12.59 1.08 13.04 0 13.93 0Z" fill="#0A0A0A"/>
    </svg></div>`;
  document.body.append(tip);
  const tipBody = tip.querySelector('.ff-tooltip__body');
  let tipFly = null, tipUntil = Infinity;

  function say(fly, text, seconds = Infinity) {
    const changed = tipFly !== fly || tipBody.textContent !== text;
    tipFly = fly; tipUntil = now() + seconds;
    tipBody.textContent = text;
    if (changed) { tip.classList.remove('is-shown'); void tip.offsetWidth; }   // replay the pop
    tip.classList.add('is-shown');
  }
  function hush(fly) {
    if (fly && fly !== tipFly) return;
    tipFly = null;
    tip.classList.remove('is-shown');
  }
  const lines = (fly) => ({ ...DEFAULT_LINES, ...(fly.mood.lines || {}) });

  // ---- Frame ↔ screen ---------------------------------------------------------------
  const toFrame = (cx, cy) => {
    const p = new DOMPoint(cx, cy).matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  };
  const toScreen = (x, y) => {
    const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    return [p.x, p.y];
  };

  // ---- The cursor itself ---------------------------------------------------------------
  // The system cursor, carried by a still shield over the whole scene. It changes only
  // when a hover starts or ends: arrow → open hand → closed hand while dragging.
  const shield = document.createElement('div');
  shield.className = 'cursor-shield';
  stage.append(shield);
  let penState = 'arrow';
  const setPen = (state) => {
    if (penState === state) return;
    penState = state;
    stage.classList.toggle('is-over', state === 'grab');
    stage.classList.toggle('is-holding', state === 'grabbing');
  };

  // ---- The cursor's light ------------------------------------------------------------
  // A tiny firefly spark that trails just below the pointer, shedding specks as it moves…
  const light = document.createElement('div');
  light.className = 'cursor-light';
  stage.append(light);
  let lastSpeck = 0;
  function speck(x, y) {
    if (stage.querySelectorAll('.cursor-speck').length > 18) return;
    const el = document.createElement('div');
    el.className = 'cursor-speck';
    const dx = (Math.random() - 0.5) * 14, dy = -6 - Math.random() * 12;
    el.style.cssText = `left:${x}px;top:${y}px;--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--s:${(0.6 + Math.random() * 0.6).toFixed(2)}`;
    el.addEventListener('animationend', () => el.remove());
    stage.append(el);
  }
  // …and a glow inside the word wherever the pointer goes near it.
  const { peak, r } = blurredDisc(...PLAY.cursorGlow);
  const cursorSpot = document.createElementNS(NS, 'g');
  cursorSpot.classList.add('cursor-spot');
  cursorSpot.innerHTML = `<circle r="${r.toFixed(1)}" fill="url(#glow-yellow)" fill-opacity="${Math.min(0.9, peak * 1.3).toFixed(3)}"/>`;
  glow.append(cursorSpot);

  const pointer = { cx: -999, cy: -999, lx: -999, ly: -999, gx: 0, gy: 0, seen: false, moved: -99, glow: 0, mouse: true };
  let held = null, hovered = null;
  const vel = { x: 0, y: 0 };

  addEventListener('pointermove', (e) => {
    const [x, y] = toFrame(e.clientX, e.clientY);
    if (held) {
      const step = Math.hypot(x - cursor.x, y - cursor.y);
      held.dragged += step;
      if (!held.dizzyHeld && held.dragged > (held.mood.patience || PLAY.patience)) {
        held.dizzyHeld = true;
        held.setMode('held', now(), { dizzyHeld: true });
        say(held, pick(lines(held).dizzy));
      }
    }
    const dt = Math.max(1 / 240, (e.timeStamp - (pointer.t || e.timeStamp - 16)) / 1000);
    vel.x += ((x - cursor.x) / dt - vel.x) * 0.35;
    vel.y += ((y - cursor.y) / dt - vel.y) * 0.35;
    pointer.t = e.timeStamp;

    Object.assign(cursor, { x, y, active: true });
    pointer.cx = e.clientX; pointer.cy = e.clientY;
    pointer.mouse = e.pointerType === 'mouse';
    if (!pointer.seen) { pointer.lx = e.clientX; pointer.ly = e.clientY; pointer.gx = x; pointer.gy = y; pointer.seen = true; }
    pointer.moved = now();
    // Specks drift off the spark while the mouse moves (not on touch, not mid-drag).
    if (pointer.mouse && !held && e.timeStamp - lastSpeck > 55 && Math.hypot(vel.x, vel.y) > 120) {
      lastSpeck = e.timeStamp;
      speck(pointer.lx + 14, pointer.ly + 22);
    }
  });
  document.documentElement.addEventListener('pointerleave', () => {
    cursor.active = false; pointer.seen = false;
  });

  // ---- Hover: grow and say hi --------------------------------------------------------
  // Checked every frame by distance, not by pointer events: a firefly drifting a little
  // under a still pointer must not switch the hover (or the cursor) on and off.
  const reach = (fly, r) => r * Swarm.TUNING.size * (fly === hovered ? Swarm.TUNING.hoverScale : 1);
  function nearestFly(radius) {
    let best = null, bestD = Infinity;
    for (const f of flies) {
      const d = Math.hypot(f.x - cursor.x, f.y - cursor.y);
      if (d < reach(f, radius) && d < bestD) { best = f; bestD = d; }
    }
    return best;
  }
  function setHovered(fly) {
    if (fly === hovered) return;
    const prev = hovered;
    hovered = fly;
    if (prev && prev !== held) {
      if (prev.mode === 'hover') prev.setMode('free', now());
      if (prev.mode !== 'dizzy') hush(prev);
    }
    if (!fly) return;
    if (fly.mode === 'dizzy') return say(fly, pick(lines(fly).dizzy));
    fly.setMode('hover', now());
    say(fly, pick(lines(fly).hi));
  }
  function updateHover() {
    if (held) return;
    if (!cursor.active || !pointer.mouse) return setHovered(null);
    const stay = hovered && Math.hypot(hovered.x - cursor.x, hovered.y - cursor.y) < reach(hovered, PLAY.hoverOut);
    setHovered(stay ? hovered : nearestFly(PLAY.hoverIn));
  }

  // ---- Click and drag ------------------------------------------------------------------
  stage.addEventListener('pointerdown', (e) => {
    // Grab whatever the cursor says it's over; on touch, the nearest firefly to the finger.
    const [x, y] = toFrame(e.clientX, e.clientY);
    Object.assign(cursor, { x, y, active: true });
    const fly = pointer.mouse && e.pointerType === 'mouse' ? hovered : nearestFly(PLAY.hoverIn * 1.6);
    if (!fly) return;
    e.preventDefault();
    const t = now();

    // A dizzy firefly can still be picked up — it just stays dizzy while you carry it,
    // and gets a fresh dose when you let go.
    const wasDizzy = fly.mode === 'dizzy';

    // Too many pokes in a row → dizzy.
    if (!wasDizzy) {
      fly.pokes = (fly.pokes || []).filter((p) => t - p < PLAY.clickWindow).concat(t);
      if (fly.pokes.length >= (fly.mood.clicks || PLAY.clicks)) {
        fly.pokes = [];
        fly.setMode('dizzy', t);
        return say(fly, pick(lines(fly).dizzy));
      }
    }

    held = fly;
    fly.dragged = 0; fly.dizzyHeld = wasDizzy;
    vel.x = vel.y = 0;
    fly.setMode('held', t, { dizzyHeld: wasDizzy });
    stage.setPointerCapture?.(e.pointerId);
    say(fly, pick(wasDizzy ? lines(fly).dizzy : lines(fly).drag));
  });

  const release = () => {
    if (!held) return;
    const fly = held, t = now();
    held = null;
    if (fly.dizzyHeld) {
      fly.dizzyHeld = false;
      fly.setMode('dizzy', t);
      say(fly, pick(lines(fly).dizzy));
    } else if (fly.dragged < 6 && fly === hovered) {
      fly.setMode('hover', t);                     // just a click: back to saying hi
      say(fly, pick(lines(fly).hi));
    } else {
      fly.setMode('free', t, { throw: [vel.x, vel.y] });
      if (fly === hovered) hovered = null;
      hush(fly);
    }
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);

  // A dizzy firefly that has come round says so, briefly.
  for (const fly of flies) fly.onRecover = (f) => {
    if (f === hovered) { f.setMode('hover', now()); say(f, pick(lines(f).hi)); }
    else say(f, lines(f).phew, 1.1);
  };

  // ---- Every frame ------------------------------------------------------------------------
  onFrame((dt, t) => {
    updateHover();
    setPen(held ? 'grabbing' : hovered ? 'grab' : 'arrow');

    // Light below the pointer, a beat behind it.
    const k = ease(14, dt);
    pointer.lx += (pointer.cx - pointer.lx) * k;
    pointer.ly += (pointer.cy - pointer.ly) * k;
    light.style.transform = `translate(${pointer.lx.toFixed(1)}px, ${pointer.ly.toFixed(1)}px)`;
    light.classList.toggle('is-on', cursor.active && pointer.mouse);

    // Glow in the word: strongest on the letters, fading out as you move away;
    // dims a little when the pointer rests.
    const g = ease(8, dt);
    pointer.gx += (cursor.x - pointer.gx) * g;
    pointer.gy += (cursor.y - pointer.gy) * g;
    const dx = Math.max(word.x0 - pointer.gx, 0, pointer.gx - word.x1);
    const dy = Math.max(word.y0 - pointer.gy, 0, pointer.gy - word.y1);
    const near = Math.max(0, 1 - Math.hypot(dx, dy) / PLAY.glowReach);
    const awake = t - pointer.moved < 1.5 ? 1 : 0.45;
    const want = cursor.active && !held ? near * awake : 0;
    pointer.glow += (want - pointer.glow) * ease(5, dt);
    cursorSpot.setAttribute('transform', `translate(${pointer.gx.toFixed(1)} ${pointer.gy.toFixed(1)})`);
    cursorSpot.setAttribute('opacity', pointer.glow.toFixed(3));

    // Tooltip rides above whoever is talking.
    if (tipFly) {
      if (t > tipUntil) hush();
      else {
        const { x, y } = tipFly.top;
        const [sx, sy] = toScreen(x, y);
        tip.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      }
    }
  });
}

window.Play = { start, PLAY };
})();
