// Loads and saves site content. All public content lives in one Firestore document
// (site/public), so a visit costs a single read.
import { firebaseConfig } from './config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2/';
export const DEMO = !firebaseConfig || !firebaseConfig.apiKey;

const CACHE_KEY = DEMO ? 'pf_demo_content' : 'pf_cache_content';

let fbPromise;
export function fb() {
  fbPromise ||= (async () => {
    const [appMod, fs] = await Promise.all([import(`${SDK}firebase-app.js`), import(`${SDK}firebase-firestore-lite.js`)]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
    return { app, db: fs.getFirestore(app), fs };
  })();
  return fbPromise;
}

let authPromise;
export function fbAuth() {
  authPromise ||= (async () => {
    const { app } = await fb();
    const m = await import(`${SDK}firebase-auth.js`);
    return { auth: m.getAuth(app), m };
  })();
  return authPromise;
}

let defaultsPromise;
export function loadDefaults() {
  defaultsPromise ||= fetch(new URL('../../data/default-content.json', import.meta.url)).then((r) => r.json());
  return defaultsPromise;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

// The first version of the site shipped a neon theme. Saves that still carry its untouched
// colours (and were never opened since the darkroom redesign) move to the darkroom defaults.
const NEON = '#00e5ff,#ff2bd6,#07070d';
const NEON_PRESETS = 'Neon,Cinema,Arcade,Poster,Sunset,Ice';
function migrateTheme(t, d) {
  if (!t || t.darkroom || [t.a, t.b, t.bg].map((x) => String(x || '').toLowerCase()).join() !== NEON) return t || {};
  const out = { ...t, a: d.a, b: d.b, bg: d.bg };
  if (!t.font || t.font === 'grotesk') out.font = d.font;
  if (!Array.isArray(t.presets) || t.presets.map((p) => p?.name).join() === NEON_PRESETS) out.presets = clone(d.presets || []);
  return out;
}

// Fill in anything missing (older saves, new fields) from the defaults.
export function normalize(c, d) {
  if (!c || typeof c !== 'object') return clone(d);
  const out = clone(c);
  out.profile = { ...d.profile, ...(c.profile || {}) };
  out.profile.availability = { ...d.profile.availability, ...(c.profile?.availability || {}) };
  out.theme = { ...d.theme, ...clone(migrateTheme(c.theme, d.theme)) };
  out.seo = { ...d.seo, ...(c.seo || {}) };
  for (const k of ['sections', 'categories', 'projects', 'experience', 'socials']) {
    if (!Array.isArray(out[k])) out[k] = clone(d[k]);
  }
  for (const s of d.sections) {
    if (!out.sections.some((x) => x.type === s.type)) out.sections.push({ ...clone(s), visible: false });
  }
  return out;
}

export function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

export function writeCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* storage full or blocked */ }
}

export function clearDemo() {
  try { localStorage.removeItem('pf_demo_content'); } catch { /* ignore */ }
}

export async function fetchPublic() {
  const { db, fs } = await fb();
  const snap = await fs.getDoc(fs.doc(db, 'site', 'public'));
  return snap.exists() ? snap.data() : null;
}

// Strip undefined values (Firestore rejects them) and add bookkeeping fields.
export function prepareForSave(content) {
  const c = clone(content);
  c.projectIds = (c.projects || []).map((p) => p.id);
  c.updatedAt = Date.now();
  return c;
}

export async function savePublic(content) {
  const c = prepareForSave(content);
  if (!DEMO) {
    const { db, fs } = await fb();
    await fs.setDoc(fs.doc(db, 'site', 'public'), c);
  }
  writeCache(c);
  return c;
}

export async function loadPrivate() {
  if (DEMO) {
    try { return JSON.parse(localStorage.getItem('pf_demo_private')) || {}; } catch { return {}; }
  }
  const { db, fs } = await fb();
  const snap = await fs.getDoc(fs.doc(db, 'private', 'config'));
  return snap.exists() ? snap.data() : {};
}

export async function savePrivate(cfg) {
  if (DEMO) {
    try { localStorage.setItem('pf_demo_private', JSON.stringify(cfg)); } catch { /* ignore */ }
    return;
  }
  const { db, fs } = await fb();
  await fs.setDoc(fs.doc(db, 'private', 'config'), clone(cfg));
}
