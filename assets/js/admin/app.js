// Admin shell: sign-in, tabs, save/discard, live preview.
import { h, esc, initials } from '../dom.js';
import { DEMO, fbAuth, loadDefaults, normalize, readCache, fetchPublic, savePublic, loadPrivate, savePrivate } from '../store.js';
import { applyTheme } from '../theme.js';
import { setHooks, icon, note } from './forms.js';
import { setUploadConfig } from './upload.js';
import { dashboardTab } from './dashboard.js';
import { profileTab, workTab, categoriesTab, sectionsTab, experienceTab, socialsTab, themeTab, settingsTab, loadRules } from './editors.js';

const $ = (s) => document.querySelector(s);

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-simple', render: dashboardTab, hint: 'Who is visiting your portfolio' },
  { id: 'work', label: 'Work', icon: 'fa-table-cells-large', render: workTab, hint: 'Add, edit and reorder your projects' },
  { id: 'profile', label: 'Profile', icon: 'fa-user', render: profileTab, hint: 'Name, top banner, showreel and about' },
  { id: 'experience', label: 'Experience', icon: 'fa-timeline', render: experienceTab, hint: 'Work, volunteering, education' },
  { id: 'socials', label: 'Links', icon: 'fa-link', render: socialsTab, hint: 'Instagram, LinkedIn, email and more' },
  { id: 'theme', label: 'Theme', icon: 'fa-palette', render: themeTab, hint: 'Colours, glow, fonts and effects' },
  { id: 'categories', label: 'Categories', icon: 'fa-tags', render: categoriesTab, hint: 'The tabs in your Work section' },
  { id: 'sections', label: 'Sections', icon: 'fa-bars-staggered', render: sectionsTab, hint: 'Show, hide, reorder or add page sections' },
  { id: 'settings', label: 'Settings', icon: 'fa-gear', render: settingsTab, hint: 'Uploads, sharing links, backup, rules' },
];

const S = { draft: null, saved: '', priv: {}, privSaved: '{}', user: null, tab: 'dashboard', view: {}, defaults: null, fresh: false };
let authApi = null;

/* ---------- toast ---------- */
function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.className = 'toast'; }, kind === 'bad' ? 6000 : 2600);
}

/* ---------- dirty state ---------- */
const pubDirty = () => JSON.stringify(S.draft) !== S.saved;
const privDirty = () => JSON.stringify(S.priv) !== S.privSaved;
const isDirty = () => pubDirty() || privDirty();

function updateSaveBar() {
  const dirty = isDirty();
  $('#savebar').classList.toggle('dirty', dirty);
  $('#saveState').innerHTML = dirty
    ? '<i class="fa-solid fa-circle"></i> Unsaved changes'
    : '<i class="fa-solid fa-circle-check"></i> All saved';
  $('#saveBtn').disabled = !dirty;
  $('#discardBtn').disabled = !dirty;
}

let themeTimer;
function onChange() {
  updateSaveBar();
  schedulePreview();
  if (S.tab === 'theme') {
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => applyTheme(S.draft.theme), 120);
  }
}

/* ---------- tabs ---------- */
function renderNav() {
  $('#sideNav').replaceChildren(...TABS.map((t) => h('button', {
    type: 'button', class: 'nav-btn', 'aria-current': S.tab === t.id ? 'page' : null,
    onclick: () => go(t.id),
  }, icon(t.icon), h('span', {}, t.label))));
}

function go(id) {
  S.tab = TABS.some((t) => t.id === id) ? id : 'dashboard';
  history.replaceState(null, '', `#${S.tab}`);
  renderNav();
  renderTab();
  $('#panel').scrollTop = 0;
  scrollTo({ top: 0 });
}

function ctx() {
  return {
    draft: S.draft,
    priv: S.priv,
    user: S.user,
    view: S.view,
    rerender: renderTab,
    openPreview,
    signOut,
    defaults: () => JSON.parse(JSON.stringify(S.defaults)),
    replaceDraft: (data) => { S.draft = normalize(data, S.defaults); renderTab(); onChange(); toast('Loaded. Press Save to publish it.'); },
  };
}

function renderTab() {
  const tab = TABS.find((t) => t.id === S.tab);
  $('#tabTitle').textContent = tab.label;
  $('#tabHint').textContent = tab.hint;
  const panel = $('#panel');
  const kids = [];
  if (S.fresh && S.tab !== 'settings') {
    kids.push(note('<b>Welcome!</b> Your site has no content online yet, so this is the starter content. Edit anything, then press <b>Save &amp; publish</b>.', 'callout-note'));
  }
  try {
    kids.push(tab.render(ctx()));
  } catch (err) {
    console.error(err);
    kids.push(note(`Something went wrong showing this tab: ${esc(err.message)}`, 'callout-bad'));
  }
  panel.replaceChildren(...kids);
  $('#sideMark').textContent = S.draft.profile.shortName || initials(S.draft.profile.name);
}

/* ---------- save / discard ---------- */
async function save() {
  const btn = $('#saveBtn');
  btn.disabled = true;
  btn.lastChild.textContent = 'Saving…';
  try {
    if (pubDirty()) {
      const size = JSON.stringify(S.draft).length;
      if (size > 900000) throw new Error('Your content is too large to save in one go (over 900 KB of text). Shorten some descriptions.');
      const saved = await savePublic(S.draft);
      S.draft.projectIds = saved.projectIds;
      S.draft.updatedAt = saved.updatedAt;
      S.saved = JSON.stringify(S.draft);
      S.fresh = false;
    }
    if (privDirty()) {
      await savePrivate(S.priv);
      S.privSaved = JSON.stringify(S.priv);
    }
    applyTheme(S.draft.theme);
    toast(DEMO ? 'Saved in this browser (demo mode).' : 'Published! Your site is updated.');
    if (S.tab !== 'theme') renderTab();
  } catch (err) {
    console.error(err);
    toast(err.code === 'permission-denied'
      ? 'Not allowed to save. Copy the database rules from Settings into Firebase and publish them.'
      : `Save failed: ${err.message}`, 'bad');
  } finally {
    btn.lastChild.textContent = 'Save & publish';
    updateSaveBar();
  }
}

function discard() {
  if (!confirm('Throw away all unsaved changes?')) return;
  S.draft = S.saved ? JSON.parse(S.saved) : normalize(null, S.defaults);
  S.priv = JSON.parse(S.privSaved);
  setUploadConfig(S.priv);
  applyTheme(S.draft.theme);
  renderTab();
  onChange();
}

/* ---------- live preview ---------- */
const pv = { mode: innerWidth < 700 ? 'phone' : 'desktop', ready: false, timer: 0 };
const iframe = () => $('#pvIframe');

function postPreview() {
  if (!pv.ready || !document.body.classList.contains('pv-open')) return;
  iframe().contentWindow?.postMessage({ type: 'pf-preview', content: JSON.parse(JSON.stringify(S.draft)) }, location.origin);
}

function schedulePreview() {
  clearTimeout(pv.timer);
  pv.timer = setTimeout(postPreview, 250);
}

function fitPreview() {
  const box = $('#pvFrame');
  const f = iframe();
  const base = pv.mode === 'phone' ? 390 : 1280;
  const W = box.clientWidth - (pv.mode === 'phone' ? 24 : 0);
  const H = box.clientHeight - (pv.mode === 'phone' ? 24 : 0);
  if (W <= 0 || H <= 0) return;
  const scale = Math.min(1, W / base);
  const height = pv.mode === 'phone' ? Math.min(844, H / scale) : H / scale;
  f.style.width = `${base}px`;
  f.style.height = `${height}px`;
  f.style.transform = `scale(${scale})`;
  box.classList.toggle('phone', pv.mode === 'phone');
}

function openPreview() {
  document.body.classList.add('pv-open');
  $('#pvToggle').setAttribute('aria-pressed', 'true');
  const f = iframe();
  if (!f.getAttribute('src')) f.setAttribute('src', '../index.html?preview=1');
  requestAnimationFrame(() => { fitPreview(); postPreview(); });
}

function closePreview() {
  document.body.classList.remove('pv-open');
  $('#pvToggle').setAttribute('aria-pressed', 'false');
}

function wirePreview() {
  $('#pvToggle').addEventListener('click', () => (document.body.classList.contains('pv-open') ? closePreview() : openPreview()));
  $('#pvClose').addEventListener('click', closePreview);
  document.querySelectorAll('[data-pv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pv === pv.mode)));
  document.querySelectorAll('[data-pv]').forEach((b) => b.addEventListener('click', () => {
    pv.mode = b.dataset.pv;
    document.querySelectorAll('[data-pv]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    fitPreview();
  }));
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.type !== 'pf-preview-ready') return;
    pv.ready = true;
    postPreview();
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (document.body.classList.contains('pv-open')) fitPreview(); }).observe($('#pvFrame'));
  else addEventListener('resize', () => { if (document.body.classList.contains('pv-open')) fitPreview(); });
}

/* ---------- auth gate ---------- */
function gate(...kids) {
  $('#shell').hidden = true;
  const g = $('#gate');
  g.hidden = false;
  g.replaceChildren(h('div', { class: 'gate-card' }, h('span', { class: 'gate-mark' }, icon('fa-wand-magic-sparkles')), ...kids));
}

function showSignIn(error = '') {
  const btn = h('button', { type: 'button', class: 'btn primary lg', onclick: signIn }, icon('fa-brands fa-google'), 'Sign in with Google');
  gate(
    h('h1', {}, 'Portfolio admin'),
    h('p', { class: 'muted' }, 'Sign in with the Google account that owns this site.'),
    btn,
    error ? h('p', { class: 'gate-error', html: error }) : null);
}

async function showDenied(user) {
  const rules = (await loadRules()).replace('YOUR_EMAIL@gmail.com', user.email);
  gate(
    h('h1', {}, 'Almost there'),
    h('p', { class: 'muted', html: `You're signed in as <b>${esc(user.email)}</b>, but the database doesn't let this account in yet.` }),
    h('p', { class: 'muted small', html: 'If this is your first time: open <b>Firebase console › Firestore Database › Rules</b>, replace everything with the rules below, press <b>Publish</b>, wait a minute, then reload this page.' }),
    h('pre', { class: 'code' }, rules),
    h('div', { class: 'btn-row center' },
      h('button', { type: 'button', class: 'btn primary', onclick: async () => { try { await navigator.clipboard.writeText(rules); toast('Rules copied'); } catch { prompt('Copy the rules', rules); } } }, icon('fa-copy'), 'Copy rules'),
      h('button', { type: 'button', class: 'btn', onclick: () => location.reload() }, icon('fa-rotate'), 'Reload'),
      h('button', { type: 'button', class: 'btn ghost', onclick: signOut }, 'Use another account')));
}

async function signIn() {
  const { auth, m } = authApi;
  const provider = new m.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await m.signInWithPopup(auth, provider);
  } catch (err) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/web-storage-unsupported'].includes(err.code)) {
      await m.signInWithRedirect(auth, provider);
    } else if (err.code === 'auth/unauthorized-domain') {
      showSignIn(`This address can't sign in yet. In <b>Firebase console › Authentication › Settings › Authorized domains</b>, add <code>${esc(location.hostname)}</code>, then try again.`);
    } else if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) {
      showSignIn(esc(err.message));
    }
  }
}

async function signOut() {
  if (isDirty() && !confirm('You have unsaved changes. Sign out anyway?')) return;
  S.draft = null;
  if (authApi) await authApi.m.signOut(authApi.auth);
  else location.reload();
}

/* ---------- start ---------- */
async function startEditor(user) {
  S.user = user;
  let pub = null;
  if (DEMO) {
    pub = readCache();
    try { S.priv = JSON.parse(localStorage.getItem('pf_demo_private')) || {}; } catch { S.priv = {}; }
  } else {
    pub = await fetchPublic();
  }
  S.draft = normalize(pub, S.defaults);
  S.saved = pub || DEMO ? JSON.stringify(S.draft) : '';
  S.fresh = !pub && !DEMO;
  S.privSaved = JSON.stringify(S.priv);
  setUploadConfig(S.priv);
  if (!DEMO && localStorage.getItem('pf_owner') !== '0') localStorage.setItem('pf_owner', '1');

  applyTheme(S.draft.theme);
  $('#gate').hidden = true;
  $('#shell').hidden = false;
  $('#demoBanner').hidden = !DEMO;
  go(location.hash.slice(1) || 'dashboard');
  updateSaveBar();
}

async function boot() {
  setHooks({ onChange, toast });
  $('#saveBtn').addEventListener('click', save);
  $('#discardBtn').addEventListener('click', discard);
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (isDirty()) save(); }
  });
  addEventListener('beforeunload', (e) => { if (S.draft && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  wirePreview();

  S.defaults = await loadDefaults();
  if (DEMO) { await startEditor(null); return; }

  authApi = await fbAuth();
  const { auth, m } = authApi;
  m.getRedirectResult(auth).catch((err) => showSignIn(esc(err.message)));
  m.onAuthStateChanged(auth, async (user) => {
    if (!user) { showSignIn(); return; }
    try {
      S.priv = await loadPrivate();
    } catch (err) {
      if (err.code === 'permission-denied') { showDenied(user); return; }
      showSignIn(`Couldn't reach the database: ${esc(err.message)}`);
      return;
    }
    try {
      await startEditor(user);
    } catch (err) {
      showSignIn(`Couldn't load your content: ${esc(err.message)}`);
    }
  });
}

boot();
