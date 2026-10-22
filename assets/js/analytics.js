// Privacy-friendly visit counters stored in Firestore (no cookies, no personal data).
// Every key written here must also be listed in firestore.rules.
import { DEMO, fb } from './store.js';

export const SOURCES = ['direct', 'instagram', 'linkedin', 'youtube', 'search', 'behance', 'artstation', 'whatsapp', 'x', 'facebook', 'github', 'reddit', 'other'];
export const CLICKS = ['instagram', 'linkedin', 'youtube', 'behance', 'artstation', 'vimeo', 'itch', 'github', 'x', 'facebook', 'tiktok', 'threads', 'discord', 'whatsapp', 'email', 'website', 'other', 'resume'];

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

function skip() {
  if (DEMO || navigator.webdriver) return true;
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname) || location.protocol === 'file:') return true;
  if (new URLSearchParams(location.search).has('preview')) return true;
  return ls.get('pf_owner') === '1';
}

const pad = (n) => String(n).padStart(2, '0');
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const SOURCE_MATCH = [
  [/instagram|^ig$|insta/, 'instagram'],
  [/linkedin|lnkd\.in/, 'linkedin'],
  [/youtube|youtu\.be/, 'youtube'],
  [/google|bing|duckduckgo|yahoo|ecosia|brave/, 'search'],
  [/behance/, 'behance'],
  [/artstation/, 'artstation'],
  [/whatsapp|wa\.me/, 'whatsapp'],
  [/^t\.co$|twitter|^x(\.com)?$/, 'x'],
  [/facebook|fb\.|messenger/, 'facebook'],
  [/github/, 'github'],
  [/reddit/, 'reddit'],
];

// ?ref=instagram (or utm_source) wins; otherwise the referrer's domain.
function source() {
  const p = new URLSearchParams(location.search);
  let s = (p.get('ref') || p.get('utm_source') || p.get('src') || '').toLowerCase();
  if (!s && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname.replace(/^(www|m|l|lm)\./, '');
      if (host === location.hostname) return null;
      s = host;
    } catch { /* ignore */ }
  }
  if (!s) return 'direct';
  return (SOURCE_MATCH.find(([re]) => re.test(s)) || [null, 'other'])[1];
}

async function bump(fields) {
  if (skip() || !fields.length) return;
  try {
    const { db, fs } = await fb();
    const data = Object.fromEntries(fields.map((f) => [f, fs.increment(1)]));
    await Promise.all([
      fs.setDoc(fs.doc(db, 'days', dayKey()), data, { merge: true }),
      fs.setDoc(fs.doc(db, 'stats', 'total'), data, { merge: true }),
    ]);
  } catch { /* analytics must never break the page */ }
}

export function trackVisit() {
  if (skip()) return;
  try {
    if (sessionStorage.getItem('pf_session')) return;
    sessionStorage.setItem('pf_session', '1');
  } catch { /* ignore */ }
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
  const f = ['visits', mobile ? 'mobile' : 'desktop'];
  const today = dayKey();
  if (ls.get('pf_day') !== today) { f.push('uniques'); ls.set('pf_day', today); }
  if (!ls.get('pf_seen')) { f.push('newVisitors'); ls.set('pf_seen', '1'); }
  const s = source();
  if (s) f.push(`s_${s}`);
  bump(f);
}

export function trackClick(kind) {
  bump([`c_${CLICKS.includes(kind) ? kind : 'other'}`]);
}

const seenProjects = new Set();
export async function trackProject(id) {
  if (skip() || seenProjects.has(id) || !/^[\w-]{1,48}$/.test(id)) return;
  seenProjects.add(id);
  try {
    const { db, fs } = await fb();
    await fs.setDoc(fs.doc(db, 'projectViews', id), { count: fs.increment(1) }, { merge: true });
  } catch { /* ignore */ }
}
