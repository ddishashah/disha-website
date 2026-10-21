// Firefly vectors from Figma (X Mockups — Oct): 1402:21135 (large, side view) and
// 1402:21192 (small, top-down). Paths are untouched; they are only regrouped into
// wings / body / light so each part can move on its own.
(() => {
const NS = 'http://www.w3.org/2000/svg';

// Filters reuse Figma's local-space regions, so they work on every clone.
// Soft glows are radial gradients, not wide blur filters: a Gaussian blur of a disc
// is close to a Gaussian falloff, and gradients never leave seams on moving layers.
// Stops sample exp(-x²/2) for x = 0…3, so a gradient circle of radius r ≈ 3σ.
const FALLOFF = [1, .956, .835, .667, .487, .325, .198, .11, .056, .026, 0];
const gradient = (id, color) => `<radialGradient id="${id}">${FALLOFF.map((a, i) =>
  `<stop offset="${i / 10}" stop-color="${color}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;

const FIREFLY_DEFS = `
  ${gradient('glow-white', '#FFFFFF')}
  ${gradient('glow-yellow', '#FFF86F')}
  ${gradient('glow-lemon', '#FFF151')}
  <filter id="ffL-ray1" x="0" y="13" width="25" height="9.5" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="ffL-ray2" x="15.84" y="15" width="9.49" height="25.01" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="ffL-ray3" x="2.21" y="5.33" width="23.95" height="15.12" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2"/></filter>
`;

// Figma blur → gradient: a disc of radius R blurred by σ peaks at 1 − e^(−R²/2σ²)
// and spreads like σ' = √(σ² + R²/4). Gradient radius = 3σ'.
function blurredDisc(R, sigma) {
  return { peak: 1 - Math.exp(-(R * R) / (2 * sigma * sigma)), r: 3 * Math.sqrt(sigma * sigma + R * R / 4) };
}
const GLOW = blurredDisc(6, 6);       // white glow behind the lantern
const HALO = blurredDisc(19.5, 40);   // soft world glow around each firefly
const glowCircle = (cx, cy, { peak, r }, fill) =>
  `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="url(#${fill})" fill-opacity="${peak.toFixed(3)}"/>`;

const LANTERN_L = 'M25.5007 12L28.0001 11.5C27.2006 16.3 29.9999 19.5 31.4995 20.5L28.5001 21C25.7001 19.8 25.334 14.5 25.5007 12Z';
const LANTERN_S = 'M19.3366 14.6683C17.2031 17.3353 13.5582 20.0023 12.0025 20.669C12.0025 21.2024 12.6692 22.6692 13.336 22.6692C16.6697 22.0025 21.3369 17.3353 20.6701 16.0018C20.1367 14.935 19.5589 14.8906 19.3366 14.6683Z';

const TYPES = {
  // Side view: two stacked wings hinge at the thorax and rock upward.
  large: {
    light: [20.5, 18],
    markup: `
      <g class="ff-light">
        ${glowCircle(20.5, 18, GLOW, 'glow-white')}
      </g>
      <path d="${LANTERN_L}" fill="#FFED4B"/>
      <path class="ff-lantern-hot" d="${LANTERN_L}" fill="#FFFBD6"/>
      <path d="M31.0001 20.5C28.2001 18.9 27.5001 13.8333 27.5001 11.5L30.0001 11L32.5001 11.5L35.5001 17C34.7001 19 32.1667 20.1667 31.0001 20.5Z" fill="black"/>
      <path d="M28.5073 21C26.0073 19 25.5674 14.2162 25.5674 12C24.5001 12 21.912 12.3856 22.4999 17.5C22.9703 21.5915 26.7434 21.6819 28.5073 21Z" fill="black"/>
      <circle cx="37.5001" cy="13" r="5" fill="black"/>
      <g class="ff-wing ff-wing-a" style="transform-origin:33.5px 10px">
        <path opacity="0.4" d="M17.1656 1.6824C22.6643 -1.31788 31.3336 5.66669 34.5003 9.00002L33 10.5C25.5 3.50002 10.3518 5.40021 17.1656 1.6824Z" fill="black"/>
      </g>
      <g class="ff-wing ff-wing-b" style="transform-origin:33px 11px">
        <path opacity="0.4" d="M17.0002 4.99986C21.1315 3.00008 29.8333 7.16668 33 10.5L32.5001 12.0001C24.5002 8.00006 10.0136 8.38177 17.0002 4.99986Z" fill="black"/>
      </g>
      <path d="M40.0001 3.50004C38.8001 5.10004 38.5001 7.16669 38.5001 8.00002L39.5001 8.50002C40.3001 2.90002 44.3334 3.16669 46.5001 4.00002V2.00004C44.8334 1.83338 41.2001 1.90004 40.0001 3.50004Z" fill="black"/>
      <path d="M41.0001 6.5623C39.8001 8.1623 39.5001 10.2289 39.5001 11.0623L40.5001 11.5623C41.3001 5.96227 45.3334 6.22894 47.5001 7.06227V5.0623C45.8334 4.89563 42.2001 4.9623 41.0001 6.5623Z" fill="black"/>
      <g class="ff-light ff-rays">
        <g filter="url(#ffL-ray1)"><path d="M4 17.5L21 17L20.5 18.5L4 17.5Z" fill="white"/></g>
        <g filter="url(#ffL-ray2)"><path d="M19.9999 36.0067L19.8413 19.0001L21.3309 19.5301L19.9999 36.0067Z" fill="white"/></g>
        <g filter="url(#ffL-ray3)"><path d="M6.21482 9.33046L22.1614 15.2427L21.1354 16.4457L6.21482 9.33046Z" fill="white"/></g>
      </g>`,
  },
  // Top-down: a wing on each side of the body opens outward from the shoulders.
  small: {
    light: [18.6699, 20.669],
    markup: `
      <g class="ff-light">
        ${glowCircle(18.6699, 20.669, blurredDisc(6.67, 6), 'glow-white')}
      </g>
      <path d="M10.0022 7.33417C9.55766 5.77844 9.06871 2.13358 10.6689 0C10.4988 2.38224 10.3547 6.43205 10.7753 7.72071L11.3357 8.00091C11.0857 8.25093 10.904 8.11519 10.7753 7.72071L10.0022 7.33417Z" fill="#001A24"/>
      <path d="M7.38165 10.0521C6.04445 9.14116 2.73797 7.53143 0.209583 8.37994C2.52457 8.96716 6.41444 10.1032 7.50561 10.9075L7.59546 11.5276C7.9114 11.3689 7.83963 11.1538 7.50561 10.9075L7.38165 10.0521Z" fill="#001A24"/>
      <g class="ff-wing ff-wing-l" style="transform-origin:9.6px 14.1px">
        <path opacity="0.36" d="M6.90925 21.4129C7.27196 17.5467 8.42845 15.0244 8.96136 14.2465L10.2711 14.0017C8.75185 20.3902 10.671 23.423 9.73175 25.6334C9.36299 26.5012 6.45587 26.2456 6.90925 21.4129Z" fill="#001A24"/>
      </g>
      <g class="ff-wing ff-wing-r" style="transform-origin:12.3px 11.3px">
        <path opacity="0.36" d="M19.9832 10.3446C16.136 9.81738 13.4166 10.3691 12.5378 10.7109L12.0012 11.9304C18.5679 11.9059 21.0839 14.4653 23.4501 14.0541C24.3791 13.8926 24.7922 11.0037 19.9832 10.3446Z" fill="#001A24"/>
      </g>
      <path d="M16.0033 24.0027C11.2027 22.9359 10.8916 17.7798 11.3361 15.3351C14.5367 14.2683 14.2252 12.6681 14.0027 12.0014C26.0041 15.3351 22.0039 25.3362 16.0033 24.0027Z" fill="#001A24"/>
      <circle cx="10.669" cy="11.3346" r="4.00046" fill="#001A24"/>
      <path d="${LANTERN_S}" fill="#FFED4B"/>
      <path class="ff-lantern-hot" d="${LANTERN_S}" fill="#FFFBD6"/>`,
  },
};

/**
 * Build one firefly. Its origin is the centre of its light, so `x`/`y` place the
 * light and `rot` turns the insect around it (degrees, Figma's rotation).
 *   halo:  { dx, dy, color: 'yellow' | 'lemon' } — soft world glow (Figma: 39px disc, blur 80)
 *   pulse: seconds per blink cycle; delay: seconds offset (keeps them out of sync)
 */
function createFirefly({ type, x = 0, y = 0, rot = 0, mirror = false, scale = 1, halo, pulse = 3.2, delay = 0, flap = 0.11 }) {
  const t = TYPES[type];
  const root = document.createElementNS(NS, 'g');
  root.classList.add('firefly', `firefly--${type}`);
  root.setAttribute('transform', `translate(${x} ${y})`);
  root.style.setProperty('--pulse', `${pulse}s`);
  root.style.setProperty('--pulse-delay', `${-delay}s`);
  root.style.setProperty('--flap', `${flap}s`);
  root.style.setProperty('--flap-delay', `${-(delay % flap)}s`);
  // Buzz: a slow looping hover plus a fine jitter, each firefly on its own clock.
  root.style.setProperty('--amp', `${scale}px`);
  root.style.setProperty('--hover', `${(2.1 + (delay * 0.37) % 1.4).toFixed(2)}s`);
  root.style.setProperty('--hover-delay', `${-(delay * 1.3).toFixed(2)}s`);
  root.style.setProperty('--hover-dir', delay % 2 < 1 ? 'normal' : 'reverse');

  const haloMarkup = halo
    ? `<g class="ff-halo">${glowCircle(halo.dx || 0, halo.dy || 0, HALO, `glow-${halo.color || 'yellow'}`)}</g>`
    : '';
  const [lx, ly] = t.light;
  root.innerHTML = `<g class="ff-hover"><g class="ff-jitter">${haloMarkup}
    <g class="ff-pose" transform="rotate(${rot}) scale(${mirror ? -scale : scale} ${scale})">
      <g class="ff-body" transform="translate(${-lx} ${-ly})">${t.markup}</g>
    </g></g></g>`;
  return root;
}

function injectDefs(svg) {
  let defs = svg.querySelector('defs');
  if (!defs) defs = svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);
  defs.insertAdjacentHTML('beforeend', FIREFLY_DEFS);
}

// Plain script (not a module) so the page also works when opened straight from disk.
window.Firefly = { FIREFLY_DEFS, createFirefly, injectDefs, blurredDisc };
})();
