// Applies the saved theme: duotone colours, glow strength, display font and effect toggles.

export const FONTS = {
  grotesk: { family: "'Space Grotesk'", q: 'Space+Grotesk:wght@500;700', w: 700, label: 'Space Grotesk (clean, techy)' },
  syne: { family: "'Syne'", q: 'Syne:wght@600;800', w: 800, label: 'Syne (artsy, editorial)' },
  unbounded: { family: "'Unbounded'", q: 'Unbounded:wght@500;700', w: 700, label: 'Unbounded (bold, wide)' },
  orbitron: { family: "'Orbitron'", q: 'Orbitron:wght@600;800', w: 800, label: 'Orbitron (sci-fi HUD)' },
  bebas: { family: "'Bebas Neue'", q: 'Bebas+Neue', w: 400, label: 'Bebas Neue (cinematic poster)' },
};

export const DEFAULT_THEME = {
  a: '#00e5ff', b: '#ff2bd6', bg: '#07070d', glow: 1, font: 'grotesk',
  duotone: true, grain: true, grid: true, cursorGlow: true,
};

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');

export function luminance(hex) {
  if (!isHex(hex)) return 0;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Inline style for a block that has its own colour pair; empty string = use the global pair.
export const pairVars = (colors) =>
  colors && isHex(colors.a) && isHex(colors.b) ? `--a:${colors.a};--b:${colors.b};` : '';

export function applyTheme(theme = {}) {
  const t = { ...DEFAULT_THEME, ...theme };
  if (!isHex(t.a)) t.a = DEFAULT_THEME.a;
  if (!isHex(t.b)) t.b = DEFAULT_THEME.b;
  if (!isHex(t.bg)) t.bg = DEFAULT_THEME.bg;
  const root = document.documentElement;
  const s = root.style;
  s.setProperty('--a', t.a);
  s.setProperty('--b', t.b);
  s.setProperty('--bg', t.bg);
  s.setProperty('--glow', String(Math.max(0, Math.min(2, Number(t.glow) || 0))));

  const light = luminance(t.bg) > 0.4;
  s.setProperty('--text', light ? '#12121a' : '#eef0fb');
  root.classList.toggle('theme-light', light);
  s.setProperty('--on-ab', (luminance(t.a) + luminance(t.b)) / 2 > 0.22 ? '#06060a' : '#ffffff');

  const f = FONTS[t.font] || FONTS.grotesk;
  s.setProperty('--font-display', `${f.family}, system-ui, sans-serif`);
  s.setProperty('--dw', String(f.w));
  const link = document.getElementById('font-link');
  const href = `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=${f.q}&display=swap`;
  if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);

  const cl = document.body.classList;
  cl.toggle('duo-on', !!t.duotone);
  cl.toggle('grain-on', !!t.grain);
  cl.toggle('grid-on', !!t.grid);
  cl.toggle('cursor-on', !!t.cursorGlow);

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  setFavicon(t.a, t.b);
}

function setFavicon(a, b) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect x="6" y="6" width="52" height="52" rx="16" fill="url(#g)"/><circle cx="32" cy="32" r="9" fill="#07070d"/></svg>`;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.append(link);
  }
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
