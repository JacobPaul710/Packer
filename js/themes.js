import { isDark } from './mode.js';
// Pixel-art scenes for trip tiles. Each scene is drawn once on a tiny canvas and scaled up.
// To add a theme later: add a draw function to SCENES and a name to THEMES.

export const THEMES = { camp: 'Camp', scout: 'Scouting', rock: 'Rock hounding', plain: 'Plain' };
const W = 96, H = 34;
const cache = {};

function rng(seed) { // small fixed random, so scenes look the same every time
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function painter() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const px = (x, y, col) => rect(x, y, 1, 1, col);
  // triangle with its point at (cx, top), widening by `slope` per row down to `base`
  const tri = (cx, top, base, slope, col) => {
    for (let y = top; y <= base; y++) { const hw = Math.round((y - top) * slope); rect(cx - hw, y, hw * 2 + 1, 1, col); }
  };
  const disc = (cx, cy, r, col) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(cx + x, cy + y, col);
  };
  const line = (x0, y0, x1, y1, col, w = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) rect(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, w, col);
  };
  return { c, g, rect, px, tri, disc, line };
}

const SCENES = {
  camp(p) {
    const r = rng(7);
    p.rect(0, 0, W, 9, '#1b2440'); p.rect(0, 9, W, 8, '#22305a'); p.rect(0, 17, W, 10, '#2c3f6e');
    for (let i = 0; i < 26; i++) p.px(Math.floor(r() * W), Math.floor(r() * 15), r() > 0.7 ? '#ffffff' : '#c9c3a4');
    [[10, 4], [44, 3], [70, 9]].forEach(([x, y]) => { p.px(x, y, '#fff7d6'); p.px(x - 1, y, '#a9a48a'); p.px(x + 1, y, '#a9a48a'); p.px(x, y - 1, '#a9a48a'); p.px(x, y + 1, '#a9a48a'); });
    p.disc(84, 6, 3, '#f1e6b8'); p.px(83, 5, '#fffbe6');
    // mountains
    p.tri(30, 6, 27, 1.35, '#3b4a72'); p.tri(30, 6, 9, 1.35, '#dfe6f0');
    p.tri(64, 9, 27, 1.15, '#34436a'); p.tri(64, 9, 11, 1.15, '#dfe6f0');
    p.tri(92, 14, 27, 1.2, '#2e3b5e'); p.tri(6, 15, 27, 1.4, '#2e3b5e');
    // ground
    p.rect(0, 26, W, 8, '#2d4a2c');
    for (let i = 0; i < 40; i++) p.px(Math.floor(r() * W), 26 + Math.floor(r() * 8), r() > 0.5 ? '#3a5c35' : '#253f25');
    // fire glow
    for (let y = -6; y <= 6; y++) for (let x = -12; x <= 12; x++) if ((x * x) / 144 + (y * y) / 36 <= 1 && r() > 0.35) p.px(62 + x, 29 + y, 'rgba(246,179,60,0.18)');
    // tent
    p.tri(30, 15, 30, 1.0, '#d9822b');
    for (let y = 15; y <= 30; y++) p.rect(31, y, Math.round((y - 15) * 1.0), 1, '#b8641d');
    p.tri(30, 21, 30, 0.55, '#3a2414');
    p.line(30, 13, 30, 15, '#5a3a1e'); p.rect(14, 30, 33, 1, '#1f331f');
    // campfire
    p.line(56, 31, 68, 29, '#6b4226', 2); p.line(56, 29, 68, 31, '#7d5030', 2);
    p.tri(62, 19, 29, 0.5, '#e8572a'); p.tri(62, 22, 29, 0.38, '#f6b33c'); p.tri(62, 25, 29, 0.25, '#fff1a8');
    p.px(59, 21, '#e8572a'); p.px(65, 20, '#f6b33c'); p.px(61, 17, '#e8572a');
  },

  rock(p) {
    const r = rng(11);
    // blue sky in bands, like the camp scene
    p.rect(0, 0, W, 7, '#5b9bd5'); p.rect(0, 7, W, 7, '#76afe0'); p.rect(0, 14, W, 11, '#9ac6ea');
    // rugged tan mountains (irregular ridges), lighter far, deeper near
    const ridge = (base, amp, seed, col, top) => {
      for (let x = 0; x < W; x++) {
        const y = Math.round(base - amp * (0.55 * Math.sin(x / 9 + seed) + 0.3 * Math.sin(x / 4.3 + seed * 2) + 0.15 * Math.sin(x / 2.1 + seed * 3)));
        p.rect(x, y, 1, 25 - y, col);
        if (top) p.px(x, y, top);
      }
    };
    ridge(12, 6, 1.3, '#e3cfa4', '#efe0bd');
    ridge(17, 5, 4.1, '#d4b583', '#e0c697');
    ridge(21, 3, 2.2, '#c39c66');
    // darker red-brown earth for contrast
    p.rect(0, 25, W, 9, '#7a4a2c'); p.rect(0, 25, W, 1, '#5e3820');
    for (let i = 0; i < 40; i++) p.px(Math.floor(r() * W), 26 + Math.floor(r() * 8), r() > 0.5 ? '#5e3820' : '#9a6440');
    // thick line with a dark outline
    const bar = (x0, y0, x1, y1, col, w, edge) => { p.line(x0 - 1, y0 - 1, x1 - 1, y1 - 1, edge, w + 2); p.line(x0, y0, x1, y1, col, w); };
    // chisel: striking end top-left, blade bottom-right
    bar(41, 9, 60, 28, '#a7aeb5', 3, '#3a3f44');
    p.line(42, 9, 59, 26, '#d4d9dd', 1);
    p.rect(37, 5, 6, 6, '#3a3f44'); p.rect(38, 6, 4, 4, '#6c737a'); p.rect(38, 6, 4, 1, '#9aa1a8');
    p.rect(61, 29, 3, 2, '#3a3f44'); p.px(62, 29, '#e9edf0');
    // hammer: grip bottom-left, head top-right
    bar(36, 29, 55, 10, '#a8743f', 3, '#4a2e16');
    p.line(37, 29, 55, 11, '#c99258', 1);
    bar(34, 28, 38, 24, '#3d6fa8', 3, '#1f3a5c');
    bar(50, 4, 61, 15, '#6c737a', 5, '#2b2f33');
    p.line(51, 4, 61, 14, '#9aa1a8', 1);
    p.rect(49, 2, 3, 3, '#2b2f33'); p.rect(61, 14, 3, 3, '#2b2f33');
    // sparkling gem on the ground
    const gx = 69, gy = 23;
    [[2, 5], [1, 7], [0, 9], [1, 7], [2, 5], [3, 3], [4, 1]].forEach(([off, w], i) => { p.rect(gx + off - 1, gy + i - 1, w + 2, 1, '#0f3d24'); p.rect(gx + off - 1, gy + i + 1, w + 2, 1, '#0f3d24'); });
    [[2, 5], [1, 7], [0, 9], [1, 7], [2, 5], [3, 3], [4, 1]].forEach(([off, w], i) => p.rect(gx + off, gy + i, w, 1, '#2fae63'));
    p.rect(gx + 2, gy, 2, 1, '#d9f7e4'); p.rect(gx + 1, gy + 1, 3, 1, '#8fe0ae'); p.rect(gx + 1, gy + 2, 2, 1, '#8fe0ae');
    p.rect(gx + 6, gy + 2, 2, 2, '#1f8049'); p.rect(gx + 5, gy + 4, 2, 1, '#176b3c'); p.px(gx + 4, gy + 5, '#176b3c');
    p.rect(gx + 1, gy + 8, 8, 1, 'rgba(60,30,10,0.35)');
    const spark = (x, y, big) => { p.px(x, y, '#ffffff'); p.px(x - 1, y, '#fff3c4'); p.px(x + 1, y, '#fff3c4'); p.px(x, y - 1, '#fff3c4'); p.px(x, y + 1, '#fff3c4');
      if (big) { p.px(x - 2, y, '#ffe9a0'); p.px(x + 2, y, '#ffe9a0'); p.px(x, y - 2, '#ffe9a0'); p.px(x, y + 2, '#ffe9a0'); } };
    spark(gx + 9, gy - 2, true); spark(gx - 2, gy + 1, false); spark(gx + 11, gy + 4, false);
  },

  plain(p) {
    p.rect(0, 0, W, H, '#cfe0d4');
    p.disc(80, 8, 4, '#f3d98b');
    for (let x = 0; x < W; x++) {
      const y1 = Math.round(20 + 4 * Math.sin(x / 11)); p.rect(x, y1, 1, H - y1, '#8fb59a');
      const y2 = Math.round(26 + 3 * Math.sin(x / 7 + 2)); p.rect(x, y2, 1, H - y2, '#5f8f6c');
    }
  },
};

// ---------- smooth (vector) scenes, 960 x 340 ----------
const smooth = (pts) => { // closed smooth path through points
  const n = pts.length; let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
};

function contours(cx, cy, max, seed) {
  let out = '';
  for (let i = 1; i * 50 <= max; i++) {
    const rx = i * 50, ry = i * 32, pts = [];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const wob = 1 + 0.12 * Math.sin(3 * a + i + seed) + 0.06 * Math.sin(5 * a - seed);
      pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
    }
    const index = i % 4 === 0;
    out += `<path d="${smooth(pts)}" fill="none" stroke="${index ? '#b9a272' : '#d3c39b'}" stroke-width="${index ? 5 : 3}"/>`;
  }
  return out;
}

const VECTOR = {
  notes: () => {
    let planks = '';
    for (let y = 0; y < 340; y += 68) planks += `<rect y="${y}" width="960" height="66" fill="${(y / 68) % 2 ? '#b98a5c' : '#c29467'}"/><rect y="${y + 66}" width="960" height="2" fill="#93673f"/>`;
    const grain = [[80, 30, 140], [600, 100, 180], [250, 170, 120], [760, 240, 150], [120, 300, 160]]
      .map(([x, y, w]) => `<path d="M${x},${y} q${w / 2},-8 ${w},0" stroke="#a87a4e" stroke-width="3" fill="none"/>`).join('');
    let lines = '';
    for (let y = 104; y < 300; y += 26) lines += `<line x1="352" y1="${y}" x2="618" y2="${y}" stroke="#c9d8e8" stroke-width="3"/>`;
    let rings = '';
    for (let x = 372; x <= 600; x += 32) rings += `<rect x="${x}" y="22" width="12" height="34" rx="6" fill="#6c737a"/><rect x="${x + 3}" y="24" width="4" height="30" rx="2" fill="#a7aeb5"/>`;
    return `${planks}${grain}
    <rect x="356" y="44" width="280" height="282" rx="10" fill="rgba(60,35,15,0.30)"/>
    <rect x="340" y="34" width="280" height="282" rx="10" fill="#fbf3d5"/>
    <path d="M340,44 a10,10 0 0 1 10,-10 h260 a10,10 0 0 1 10,10 v32 h-280 Z" fill="#e8c86a"/>
    ${lines}${rings}
    <line x1="390" y1="84" x2="390" y2="312" stroke="#e6a3a3" stroke-width="3"/>
    <g stroke="#4a4a4a" stroke-width="5" stroke-linecap="round">
      <line x1="408" y1="122" x2="560" y2="122"/><line x1="408" y1="148" x2="520" y2="148"/>
      <line x1="408" y1="174" x2="590" y2="174"/><line x1="408" y1="200" x2="490" y2="200"/>
    </g>
    <g transform="translate(700,300) rotate(-55)">
      <rect x="6" y="6" width="230" height="30" rx="4" fill="rgba(60,35,15,0.30)"/>
      <path d="M0,15 L34,0 L34,30 Z" fill="#f5d7a8"/><path d="M0,15 L12,10 L12,20 Z" fill="#3a2414"/>
      <rect x="34" y="0" width="160" height="30" fill="#f2b632"/>
      <rect x="34" y="0" width="160" height="10" fill="#f7c95a"/><rect x="34" y="20" width="160" height="10" fill="#d9991f"/>
      <rect x="194" y="-2" width="22" height="34" fill="#a7aeb5"/><rect x="216" y="0" width="22" height="30" rx="6" fill="#e98a9a"/>
    </g>`;
  },
  scout: () => `
    <rect width="960" height="340" fill="#ece2c6"/>
    ${contours(640, 140, 450, 1)}${contours(120, 300, 200, 4)}
    <path d="M50,300 C300,340 400,60 790,130" fill="none" stroke="#c2462a" stroke-width="12" stroke-linecap="round" stroke-dasharray="24 22"/>
    <circle cx="50" cy="300" r="20" fill="#2f6b4f"/><circle cx="50" cy="300" r="8" fill="#e3eee7"/>
    <ellipse cx="800" cy="162" rx="34" ry="8" fill="rgba(60,40,20,0.22)"/>
    <path d="M800,160 C780,120 755,100 755,72 A45,45 0 1 1 845,72 C845,100 820,120 800,160 Z" fill="#d6402a" stroke="#8f2a1b" stroke-width="6"/>
    <circle cx="800" cy="70" r="16" fill="#fff"/>`,

};

// ---------- faint background patterns for list screens ----------
function pixelPattern(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')); return c.toDataURL('image/png');
}
const PATTERNS = {
  rock: () => pixelPattern(64, 40, (g) => {
    const r = rng(9);
    g.fillStyle = 'rgba(150,100,60,0.40)';
    [6, 18, 30].forEach((y0, j) => { for (let x = 0; x < 64; x++) g.fillRect(x, y0 + Math.round(1.5 * Math.sin((x / 64) * Math.PI * 2 * (j + 1))), 1, 1); });
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 63), Math.floor(r() * 39), 2, 1);
  }),
};
const patternCache = {};
/** Faint repeating pattern for a theme's list screen, or null. */
export function patternURL(theme) {
  if (!PATTERNS[theme]) return null;
  return (patternCache[theme] ||= PATTERNS[theme]());
}
export const patternIsPixel = () => true;

// ---------- full-screen wallpapers (one image, no repeats) ----------
const WALL = {
  // random pixel stars across the whole screen, drawn at 1/3 size and scaled up
  camp(w, h) {
    const s = 3, cw = Math.ceil(w / s), ch = Math.ceil(h / s);
    return pixelPattern(cw, ch, (g) => {
      const r = rng(21), n = Math.round((cw * ch) / 260);
      const rgb = isDark() ? '255,250,232' : '214,160,40'; // white stars at night, gold stars by day
      for (let i = 0; i < n; i++) {
        const x = Math.floor(r() * cw), y = Math.floor(r() * ch), k = r();
        g.fillStyle = `rgba(${rgb},${(0.3 + r() * 0.3).toFixed(2)})`;
        if (k > 0.94) { g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); }
        else if (k > 0.85) g.fillRect(x, y, 2, 1);
        else g.fillRect(x, y, 1, 1);
      }
    });
  },
  // a real contour map: smooth hills and valleys, lines traced with marching squares
  scout(w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.lineJoin = 'round'; g.lineCap = 'round';
    const r = rng(33), hills = [];
    const count = Math.max(4, Math.round((w * h) / 160000));
    for (let i = 0; i < count; i++) hills.push({ x: -100 + r() * (w + 200), y: -100 + r() * (h + 200), s: 170 + r() * 190, a: (r() > 0.25 ? 1 : -0.7) * (0.6 + r() * 0.8) });
    const f = (x, y) => { let v = 0; for (const k of hills) { const dx = x - k.x, dy = y - k.y; v += k.a * Math.exp(-(dx * dx + dy * dy) / (2 * k.s * k.s)); } return v; };
    const cell = 8, nx = Math.ceil(w / cell) + 1, ny = Math.ceil(h / cell) + 1, grid = new Float32Array(nx * ny);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = f(i * cell, j * cell); grid[j * nx + i] = v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const step = 0.17;
    for (let L = Math.ceil(lo / step) * step, n = Math.ceil(lo / step); L < hi; L += step, n++) {
      const major = n % 4 === 0;
      g.strokeStyle = major ? 'rgba(150,128,86,0.45)' : 'rgba(150,128,86,0.28)';
      g.lineWidth = major ? 2 : 1.2;
      g.beginPath();
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = grid[j * nx + i], b = grid[j * nx + i + 1], cc = grid[(j + 1) * nx + i + 1], d = grid[(j + 1) * nx + i];
        const idx = (a > L) | ((b > L) << 1) | ((cc > L) << 2) | ((d > L) << 3);
        if (idx === 0 || idx === 15) continue;
        const x = i * cell, y = j * cell, t = (p, q) => (L - p) / (q - p);
        const top = [x + cell * t(a, b), y], right = [x + cell, y + cell * t(b, cc)];
        const bottom = [x + cell * t(d, cc), y + cell], left = [x, y + cell * t(a, d)];
        const segs = {
          1: [[left, top]], 2: [[top, right]], 3: [[left, right]], 4: [[right, bottom]], 5: [[left, top], [right, bottom]],
          6: [[top, bottom]], 7: [[left, bottom]], 8: [[bottom, left]], 9: [[bottom, top]], 10: [[top, right], [bottom, left]],
          11: [[bottom, right]], 12: [[right, left]], 13: [[right, top]], 14: [[top, left]],
        }[idx];
        for (const [p, q] of segs) { g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
      }
      g.stroke();
    }
    return c.toDataURL('image/png');
  },
};
const wallCache = {};
/** One image covering the whole screen for a theme, or null if the theme uses a repeating pattern. */
export function wallpaperURL(theme, w, h) {
  if (!WALL[theme]) return null;
  const key = `${theme}:${Math.round(w / 50)}:${Math.round(h / 50)}:${isDark()}`;
  return (wallCache[key] ||= WALL[theme](Math.ceil(w / 50) * 50, Math.ceil(h / 50) * 50));
}
export const wallpaperIsPixel = (theme) => theme === 'camp';

/** True if the theme is pixel art (scaled with sharp edges). */
export const isPixel = (theme) => !VECTOR[theme];

/** Returns an image URL for a theme's scene. */
export function sceneURL(theme) {
  const key = VECTOR[theme] || SCENES[theme] ? theme : 'plain';
  if (!cache[key]) {
    if (VECTOR[key]) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 340">${VECTOR[key]()}</svg>`;
      cache[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } else { const p = painter(); SCENES[key](p); cache[key] = p.c.toDataURL('image/png'); }
  }
  return cache[key];
}
