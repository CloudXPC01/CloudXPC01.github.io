// Small shared helpers for the public site and the admin.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// h('div', { class: 'x', onclick: fn }, child, 'text', [more]) -> Element
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('aria-') && typeof v === 'boolean') { el.setAttribute(k, String(v)); continue; }
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export const slug = (s) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 32);

export const initials = (name) =>
  String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2024-06' -> 'Jun 2024', '2024' -> '2024'
export function fmtMonth(v) {
  const m = String(v || '').match(/^(\d{4})(?:-(\d{1,2}))?/);
  if (!m) return v || '';
  return m[2] ? `${MONTHS[+m[2] - 1]} ${m[1]}` : m[1];
}

export function fmtRange(start, end, current) {
  const a = fmtMonth(start);
  const b = current ? 'Present' : fmtMonth(end);
  if (a && b && a !== b) return `${a} — ${b}`;
  return a || b || '';
}

// Aspect presets used by projects (value = width / height).
export const ORIENT = {
  landscape: { r: 16 / 9, label: 'Landscape 16:9' },
  wide: { r: 2.39, label: 'Cinema 2.39:1' },
  square: { r: 1, label: 'Square 1:1' },
  vertical: { r: 4 / 5, label: 'Vertical 4:5 (feed post)' },
  poster: { r: 1 / 1.414, label: 'Poster (A4 / A3)' },
  portrait: { r: 9 / 16, label: 'Portrait 9:16 (Reels / Shorts)' },
};
export const ratioOf = (o) => (ORIENT[o] || ORIENT.landscape).r;

// **bold** and [text](https://link) inside escaped text.
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, text, url) =>
      /^(https?:|mailto:)/i.test(url) ? `<a href="${url}" target="_blank" rel="noopener">${text}</a>` : text);
}

// Plain text -> paragraphs, line breaks and "- " bullet lists.
export function prose(text) {
  if (!text) return '';
  const out = [];
  let para = [];
  let list = [];
  const flushP = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };
  const flushL = () => { if (list.length) out.push(`<ul>${list.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`); list = []; };
  for (const line of String(text).replace(/\r/g, '').split('\n')) {
    const bullet = line.match(/^\s*[-•*]\s+(.*)/);
    if (bullet) { flushP(); list.push(bullet[1]); }
    else if (!line.trim()) { flushP(); flushL(); }
    else { flushL(); para.push(line); }
  }
  flushP();
  flushL();
  return out.join('');
}
