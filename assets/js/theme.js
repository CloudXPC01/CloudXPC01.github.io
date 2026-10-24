// Applies the saved theme: safelight / fixer colours, ground, glow strength, display font and effect toggles.

// w = heading weight in the admin; lw = weight for the big display type on the public site.
export const FONTS = {
  newsreader: { family: "'Newsreader'", q: 'Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600', w: 500, lw: 300, italic: true, label: 'Newsreader (italic serif, darkroom)' },
  grotesk: { family: "'Space Grotesk'", q: 'Space+Grotesk:wght@500;700', w: 700, lw: 500, label: 'Space Grotesk (clean, techy)' },
  syne: { family: "'Syne'", q: 'Syne:wght@600;800', w: 800, lw: 600, label: 'Syne (artsy, editorial)' },
  unbounded: { family: "'Unbounded'", q: 'Unbounded:wght@500;700', w: 700, lw: 500, label: 'Unbounded (bold, wide)' },
  orbitron: { family: "'Orbitron'", q: 'Orbitron:wght@600;800', w: 800, lw: 600, label: 'Orbitron (sci-fi HUD)' },
  bebas: { family: "'Bebas Neue'", q: 'Bebas+Neue', w: 400, lw: 400, label: 'Bebas Neue (cinematic poster)' },
};

export const DEFAULT_THEME = {
  a: '#c2321f', b: '#5f7470', bg: '#0e0605', glow: 1, font: 'newsreader',
  duotone: true, grain: true, grid: false, cursorGlow: false,
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

  const f = FONTS[t.font] || FONTS.newsreader;
  s.setProperty('--font-display', `${f.family}, ${f.italic ? 'Georgia, serif' : 'system-ui, sans-serif'}`);
  s.setProperty('--dw', String(f.w));
  s.setProperty('--dlw', String(f.lw ?? f.w));
  s.setProperty('--dstyle', f.italic ? 'italic' : 'normal');
  // The page's own body fonts live in the link's data-base (the admin keeps Inter + JetBrains Mono).
  const link = document.getElementById('font-link');
  const base = link?.dataset.base || 'Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500';
  const href = `https://fonts.googleapis.com/css2?family=${base}&family=${f.q}&display=swap`;
  if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);

  const cl = document.body.classList;
  cl.toggle('duo-on', !!t.duotone);
  cl.toggle('grain-on', !!t.grain);
  cl.toggle('grid-on', !!t.grid);
  cl.toggle('cursor-on', !!t.cursorGlow);

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  setFavicon(t.a, t.b, t.bg);
}

function setFavicon(a, b, bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="10" fill="${bg}"/><circle cx="32" cy="32" r="17" fill="${a}"/><circle cx="32" cy="32" r="7" fill="${b}"/></svg>`;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.append(link);
  }
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
