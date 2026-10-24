// Public portfolio: renders everything from the content document, in the "darkroom" look.
// Motion (GSAP + ScrollTrigger + Lenis) is optional: without it every print is fully developed and static.
import { esc, prose, fmtMonth, fmtRange, initials, ratioOf } from './dom.js';
import { DEMO, loadDefaults, normalize, readCache, writeCache, fetchPublic } from './store.js';
import { applyTheme, pairVars } from './theme.js';
import { parse, thumbUrl, srcUrl, playerHTML, linkCard, isPlayable, actionLabel, actionIcon } from './media.js';
import { platformOf, socialHref, handleOf } from './platforms.js';
import { trackVisit, trackClick, trackProject } from './analytics.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const params = new URLSearchParams(location.search);
const PREVIEW = params.has('preview');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FOCUS = (params.get('focus') || '').toLowerCase();

// The CDN scripts are deferred, so they have run (or failed) before this module.
const G = window.gsap && window.ScrollTrigger ? window.gsap : null;
const ST = G ? window.ScrollTrigger : null;
const MOTION = !!G && !REDUCED;
const root = document.documentElement;
if (G) {
  G.registerPlugin(ST);
  G.defaults({ ease: 'power3.out', duration: 0.9 });
  root.classList.add('js');
}
if (REDUCED) root.classList.add('rm');
if (MOTION) root.classList.add('anim');
if (MOTION && !PREVIEW) root.classList.add('reveal');

const state = {
  c: null,
  cat: FOCUS || 'all',
  list: [],
  project: null,
  slide: 0,
  timers: [],
};

// Everything GSAP creates in render() lives in these, so a re-render (admin preview) can revert it cleanly.
const motion = { lenis: null, page: null, work: null, workMM: null, pinST: null, intro: null, introDone: !MOTION || PREVIEW, busy: false, develop: [] };

const app = $('#app');
const modal = $('#modal');
const panel = $('#modalPanel');

/* ---------- helpers ---------- */

const published = (c) => c.projects.filter((p) => p.published !== false && p.title);
const catOf = (id) => state.c.categories.find((x) => x.id === id);
const visibleSections = (c) => c.sections.filter((s) => s.visible !== false);
const pad2 = (n) => String(n).padStart(2, '0');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

function socialList(c, { skipEmail = false } = {}) {
  return c.socials.filter((s) => socialHref(s) && !(skipEmail && s.platform === 'email'));
}

function socialIcons(c) {
  return socialList(c).map((s) => {
    const p = platformOf(s);
    const ext = s.platform !== 'email';
    return `<a class="icon-btn" href="${esc(socialHref(s))}" ${ext ? 'target="_blank" rel="noopener"' : ''} aria-label="${esc(p.label)}" title="${esc(p.label)}" data-track="${esc(s.platform)}"><i class="${p.icon}" aria-hidden="true"></i></a>`;
  }).join('');
}

function facade(m, { label = '', cls = '' } = {}) {
  const t = thumbUrl(m, 1400);
  return `<button type="button" class="facade ${cls}" data-play="${esc(m.raw)}" aria-label="${esc(label || actionLabel(m))}">
    ${t ? `<img src="${esc(t)}" alt="" loading="lazy" decoding="async">` : '<span class="ph-soft"></span>'}
    <span class="play"><i class="${actionIcon(m)}" aria-hidden="true"></i></span>
    ${label ? `<span class="facade-label">${esc(label)}</span>` : ''}
  </button>`;
}

function head(s) {
  return `<div class="sec-head" data-rv>
    <h2 class="h2" id="${esc(s.id)}-h">${esc(s.title)}</h2>
    ${s.intro ? `<p>${esc(s.intro)}</p>` : ''}
  </div>`;
}

// Blank-paper emulsion: deterministic variety, like the hand-placed prints in the approved preview.
const TINTS = [
  'color-mix(in srgb, var(--b) 45%, transparent)',
  'rgba(243, 236, 226, .18)',
  'color-mix(in srgb, color-mix(in srgb, var(--a) 75%, #000) 60%, transparent)',
  'color-mix(in srgb, var(--a) 55%, transparent)',
];
function emulVars(i) {
  const r = (k) => (Math.sin((i + 1) * k) + 1) / 2;
  return `--x1:${Math.round(27 + r(12.99) * 42)}%;--y1:${Math.round(34 + r(78.23) * 33)}%;--x2:${Math.round(43 + r(39.35) * 36)}%;--y2:${Math.round(32 + r(11.13) * 36)}%;--t1:${TINTS[i % 4]};--t2:${TINTS[(i + 1) % 4]};--ang:${(16 + 47 * (i + 1)) % 360}deg`;
}

// The paper part of a print. img = image URL, inner = media HTML (both make it a "real" print),
// over = overlay HTML on top of a blank print (e.g. initials).
function paper({ i = 0, img = '', alt = '', inner = '', over = '', mark = '', label = '', flag = '', peg = true }) {
  const real = !!(img || inner);
  return `<span class="swing">${peg ? '<i class="peg" aria-hidden="true"></i>' : ''}
    <span class="paper"><span class="frame" style="${real ? '' : emulVars(i)}">
      <span class="emul${real ? ' has-img' : ''}">${img ? `<img src="${esc(img)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : inner}</span>
      <span class="edge" aria-hidden="true"></span>${over}
      ${mark ? `<span class="pmark" aria-hidden="true">${esc(mark)}</span>` : ''}${flag}
      ${label ? `<span class="plabel" aria-hidden="true">${esc(label)}</span>` : ''}
    </span></span></span>`;
}

/* ---------- sections ---------- */

function heroSection(s, c) {
  const p = c.profile;
  const words = String(p.name || '').trim().split(/\s+/).filter(Boolean);
  const lines = words.length > 1 ? [words[0], words.slice(1).join(' ')] : words;
  const tags = (p.taglines || []).filter(Boolean);
  const work = visibleSections(c).find((x) => x.type === 'work');
  const contact = visibleSections(c).find((x) => x.type === 'contact');
  const avail = p.availability?.show && p.availability?.text;
  const acts = [
    work ? `<a class="btn btn-primary" href="#${esc(work.id)}">${esc(work.nav || work.title)} <i class="fa-solid fa-arrow-down" aria-hidden="true"></i></a>` : '',
    contact ? `<a class="btn" href="#${esc(contact.id)}">${esc(contact.nav || contact.title)}</a>` : '',
    p.resume ? `<a class="btn" href="${esc(socialHref({ url: p.resume }))}" target="_blank" rel="noopener" data-track="resume"><i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i> Résumé</a>` : '',
    socialIcons(c),
  ].join('');
  return `<header class="hero" id="${esc(s.id)}" data-sec data-glow="1" style="${pairVars(s.colors)}">
    <div class="hero-in">
      <div class="countdown" aria-hidden="true"><span class="cd-n">3</span><span class="cd-n">2</span><span class="cd-n">1</span><span class="cd-label">Exposing…</span></div>
      <h1 class="name" aria-label="${esc(p.name)}">${lines.map((l) => `<span class="nl" aria-hidden="true"><span>${esc(l)}</span></span>`).join('')}</h1>
      <div class="hero-foot">
        <div class="hero-copy">
          ${p.role ? `<p class="role">${esc(p.role)}</p>` : ''}
          ${tags.length ? `<p class="tagline" data-tags="${esc(JSON.stringify(tags))}">${esc(tags[0])}</p>` : ''}
          ${acts.trim() ? `<div class="hero-acts">${acts}</div>` : ''}
        </div>
        ${avail ? `<p class="tag"><i aria-hidden="true"></i>${esc(p.availability.text)}</p>` : '<span></span>'}
        <p class="cue">${work ? 'Scroll to develop' : ''}</p>
      </div>
    </div>
    ${reel(p)}
  </header>`;
}

// Showreel: a large 16:9 print that develops as it scrolls in. Nothing at all when empty.
function reel(p) {
  const m = parse(p.showreel);
  if (!m) return '';
  const cap = p.showreelCaption || 'Showreel';
  let inner = '';
  let img = '';
  let extra = '';
  if (m.type === 'video' && autoplayOK()) {
    const poster = thumbUrl(m, 1400);
    inner = `<video class="reel-video" src="${esc(m.src)}" ${poster ? `poster="${esc(poster)}"` : ''} muted loop playsinline autoplay preload="auto" aria-label="${esc(cap)}"></video>`;
    extra = '<button type="button" class="reel-sound" data-reel-sound aria-label="Turn sound on"><i class="fa-solid fa-volume-xmark" aria-hidden="true"></i></button>';
  } else if (m.type === 'image') {
    img = srcUrl(m, 1800);
  } else if (m.type === 'link') {
    inner = `<a class="linkcard" href="${esc(m.url)}" target="_blank" rel="noopener"><i class="${esc(m.icon)}" aria-hidden="true"></i><span>Watch the reel on ${esc(m.site)}</span></a>`;
  } else {
    inner = facade(m, { label: 'Play showreel' });
  }
  return `<div class="reel-wrap"><figure class="print reel" data-develop>
    ${paper({ i: 5, img, alt: cap, inner, mark: 'Reel', peg: false, flag: extra })}
    <figcaption class="cap"><span class="cap-t">${esc(cap)}</span></figcaption>
  </figure></div>`;
}

function autoplayOK() {
  return !REDUCED && !navigator.connection?.saveData && innerWidth >= 768;
}

// Words never break; if the longest line is wider than the column, shrink the whole name to fit.
function fitName() {
  const h = $('.hero .name');
  if (!h) return;
  h.style.fontSize = '';
  const avail = h.clientWidth;
  const widest = Math.max(0, ...$$('.nl', h).map((l) => l.firstElementChild.getBoundingClientRect().width + (parseFloat(getComputedStyle(l).paddingLeft) || 0) + 6));
  if (avail && widest > avail) h.style.fontSize = `${parseFloat(getComputedStyle(h).fontSize) * (avail / widest) * 0.97}px`;
}

function workSection(s) {
  return `<section class="sec-work" id="${esc(s.id)}" data-sec data-work data-glow=".55" style="${pairVars(s.colors)}" aria-labelledby="${esc(s.id)}-h">
    <div class="work-head">
      <div class="work-title" data-rv><h2 id="${esc(s.id)}-h">${esc(s.title)}</h2>${s.intro ? `<p class="work-intro">${esc(s.intro)}</p>` : ''}</div>
      <div class="trays" id="trays" role="group" aria-label="Filter work by category" hidden></div>
      <p class="line-note" id="lineNote" aria-live="polite"></p>
    </div>
    <div class="track" id="track"></div>
  </section>`;
}

function aboutSection(s, c) {
  const p = c.profile;
  const m = parse(p.photo);
  const photo = m ? thumbUrl(m, 900) || srcUrl(m) : '';
  const paras = String(p.bio || '').replace(/\r/g, '').split(/\n\s*\n/).filter((x) => x.trim());
  const facts = [
    p.location ? ['Based in', p.location] : null,
    p.availability?.show && p.availability?.text ? ['Availability', p.availability.text] : null,
    ...(p.highlights || []).filter((x) => x.value || x.label).map((x) => [x.label, x.value]),
  ].filter(Boolean);
  const skills = (p.skills || []).filter(Boolean);
  const software = (p.software || []).filter(Boolean);
  const mono = p.shortName || initials(p.name);
  return `<section class="sec sec-about" id="${esc(s.id)}" data-sec data-glow=".8" style="${pairVars(s.colors)}" aria-labelledby="${esc(s.id)}-h">
    <div class="about">
      <div>
        <h2 class="h2" id="${esc(s.id)}-h" data-rv>${esc(s.title)}</h2>
        ${paras[0] ? `<div class="lead" data-rv>${prose(paras[0])}</div>` : ''}
        ${paras.length > 1 ? `<div class="body prose" data-rv>${prose(paras.slice(1).join('\n\n'))}</div>` : ''}
        ${facts.length ? `<dl class="facts" data-rv>${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      </div>
      <figure class="portrait print" data-develop>
        ${paper({ i: 7, img: photo, alt: p.name, mark: 'Portrait', label: photo ? '' : 'Portrait · awaiting exposure', over: photo ? '' : `<span class="ph-initials" aria-hidden="true">${esc(mono)}</span>` })}
        <figcaption class="cap"><span class="cap-m">${esc([p.name, p.location].filter(Boolean).join(' · '))}</span></figcaption>
      </figure>
    </div>
    ${skills.length || software.length ? `<div class="spec-block">
      ${skills.length ? `<h3 class="soft-title" data-rv>Specializations</h3>
        <ol class="spec-list">${skills.map((k, i) => `<li class="spec"><span class="spec-n">${pad2(i + 1)}</span><span class="spec-name">${esc(k)}</span></li>`).join('')}</ol>` : ''}
      ${software.length ? `<h3 class="soft-title${skills.length ? ' shelf' : ''}" data-rv>On the shelf — software</h3>
        <ul class="bottles" data-rv-group>${software.map((x) => `<li class="bottle">${esc(x)}</li>`).join('')}</ul>` : ''}
    </div>` : ''}
  </section>`;
}

function experienceSection(s) {
  return `<section class="sec sec-exp" id="${esc(s.id)}" data-sec data-glow=".7" style="${pairVars(s.colors)}" aria-labelledby="${esc(s.id)}-h">
    ${head(s)}<div id="expBody"></div>
  </section>`;
}

function contactSection(s, c) {
  const email = c.profile.email || c.socials.find((x) => x.platform === 'email' && x.url)?.url || '';
  const socials = socialList(c, { skipEmail: !!email });
  const shown = email.replace(/^mailto:/i, '').toLowerCase();
  return `<section class="sec sec-contact" id="${esc(s.id)}" data-sec data-glow="1" style="${pairVars(s.colors)}" aria-labelledby="${esc(s.id)}-h">
    <h2 class="contact-h" id="${esc(s.id)}-h" data-rv>${esc(s.title)}</h2>
    <div class="contact-grid">
      <div data-rv>
        ${email ? `<a class="mail" href="${esc(socialHref({ platform: 'email', url: email }))}" data-track="email">${esc(shown)}</a>` : ''}
        ${s.intro ? `<p class="avail">${esc(s.intro)}</p>` : ''}
      </div>
      ${socials.length ? `<div class="links" data-rv>${socials.map((x) => {
        const p = platformOf(x);
        return `<a href="${esc(socialHref(x))}" ${x.platform !== 'email' ? 'target="_blank" rel="noopener"' : ''} data-track="${esc(x.platform)}"><i class="${p.icon}" aria-hidden="true"></i>${esc(p.label)}<small>${esc(handleOf(x))}</small></a>`;
      }).join('')}</div>` : ''}
    </div>
  </section>`;
}

function textSection(s) {
  const m = parse(s.media);
  let media = '';
  if (m) {
    const img = m.type === 'image' ? srcUrl(m, 1600) : '';
    const inner = img ? '' : m.type === 'link' ? linkCard(m) : facade(m);
    media = `<figure class="print text-media" data-develop style="--ar:${ratioOf(s.orientation)};--rot:-.8deg">${paper({ i: 3, img, alt: s.title, inner })}</figure>`;
  }
  return `<section class="sec sec-text" id="${esc(s.id)}" data-sec data-glow=".7" style="${pairVars(s.colors)}" aria-labelledby="${esc(s.id)}-h">
    <div class="text-grid ${media ? 'has-media' : ''}">
      <div>${head(s)}<div class="prose" data-rv>${prose(s.body)}</div>
        ${s.buttonUrl ? `<p data-rv><a class="btn btn-primary" href="${esc(socialHref({ url: s.buttonUrl }))}" target="_blank" rel="noopener">${esc(s.buttonLabel || 'Learn more')} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></p>` : ''}
      </div>
      ${media}
    </div>
  </section>`;
}

const RENDER = { hero: heroSection, work: workSection, about: aboutSection, experience: experienceSection, contact: contactSection, text: textSection };

/* ---------- work: prints on the line ---------- */

function sortProjects(list) {
  return list.map((p, i) => ({ p, i })).sort((x, y) => (y.p.featured ? 1 : 0) - (x.p.featured ? 1 : 0) || x.i - y.i).map((x) => x.p);
}

function printCard(p, i) {
  const cat = catOf(p.category);
  const ar = ratioOf(p.orientation);
  const first = (p.media || []).map((m) => parse(m.url)).find(Boolean);
  const src = parse(p.cover) || first || parse(p.compare?.after);
  const img = thumbUrl(src, ar >= 1 ? 1000 : 700);
  // Width factor in the wrapped grid, height factor on the pinned line (keeps wide prints from hogging it).
  const wf = ar >= 2 ? 1.5 : ar > 1.2 ? 1.25 : ar < 0.7 ? 0.8 : 1;
  const hf = ar >= 2 ? 0.72 : ar > 1.2 ? 0.82 : 1;
  const meta = [cat?.name, p.date ? fmtMonth(p.date) : ''].filter(Boolean).join(' · ');
  const flags = [p.featured ? '<span>Featured</span>' : '', isPlayable(first) ? '<i class="fa-solid fa-play" aria-hidden="true"></i>' : ''].join('');
  return `<article class="print" data-cat="${esc(p.category)}" style="--rot:${[-0.5, 0, 0.5, 1, -1, -0.5][i % 6]}deg;--ar:${ar.toFixed(4)};--wf:${wf};--hf:${hf};${pairVars(cat?.colors)}">
    <button type="button" class="print-btn" data-open="${esc(p.id)}" aria-label="${esc(meta ? `${p.title}, ${meta}` : p.title)}">
      ${paper({ i, img, mark: pad2(i + 1), label: img ? '' : `${cat?.name || 'Untitled'} · your shot here`, flag: flags ? `<span class="pflag" aria-hidden="true">${flags}</span>` : '' })}
      <span class="cap"><span class="cap-t">${esc(p.title)}</span>${meta ? `<span class="cap-m">${esc(meta)}</span>` : ''}</span>
    </button>
  </article>`;
}

function renderWork() {
  const sec = $('[data-work]');
  if (!sec) return;
  const c = state.c;
  const all = published(c);
  let cats = c.categories.filter((cat) => all.some((p) => p.category === cat.id));
  if (FOCUS) cats = [...cats.filter((x) => x.id === FOCUS), ...cats.filter((x) => x.id !== FOCUS)];
  if (state.cat !== 'all' && !cats.some((x) => x.id === state.cat)) state.cat = 'all';
  const cur = cats.find((x) => x.id === state.cat);
  const items = sortProjects(state.cat === 'all' ? all : all.filter((p) => p.category === state.cat));
  state.list = items;

  const tray = (id, label, n, colors) =>
    `<button type="button" class="tray" data-cat="${esc(id)}" aria-pressed="${state.cat === id}" style="${pairVars(colors)}"><b>${esc(label)}</b><span>${plural(n, 'print', 'prints')}</span></button>`;
  const trays = $('#trays', sec);
  trays.hidden = cats.length < 2;
  trays.innerHTML = cats.length > 1 ? tray('all', 'All', all.length) + cats.map((x) => tray(x.id, x.name, all.filter((p) => p.category === x.id).length, x.colors)).join('') : '';
  $('#lineNote', sec).textContent = cur?.blurb || '';

  const contact = visibleSections(c).find((x) => x.type === 'contact');
  $('#track', sec).innerHTML = items.length
    ? `<svg class="cord" aria-hidden="true"><path fill="none" stroke-width="2" stroke-linecap="round"/></svg>
      ${items.map(printCard).join('')}
      <div class="endcard"><h3>End of the line</h3><p>${plural(items.length, 'print', 'prints')} ${cur ? `in ${esc(cur.name)}` : 'on the line'}.</p>
        ${contact ? `<a class="btn" href="#${esc(contact.id)}">${esc(contact.nav || contact.title)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>` : ''}</div>`
    : '<p class="empty">Nothing here yet.</p>';

  // The work section takes the selected category's colours (if it has its own pair).
  const own = c.sections.find((x) => x.id === sec.id)?.colors;
  const pair = cur?.colors?.a ? cur.colors : own?.a ? own : null;
  if (pair) { sec.style.setProperty('--a', pair.a); sec.style.setProperty('--b', pair.b); }
  else { sec.style.removeProperty('--a'); sec.style.removeProperty('--b'); }
  if (sec.classList.contains('is-current')) setCurrent(sec);
}

function setTray(cat) {
  if (motion.busy || cat === state.cat) return;
  const sec = $('[data-work]');
  const swap = () => {
    const y = scrollY;
    const inside = !!motion.pinST && y > motion.pinST.start && y < motion.pinST.end;
    state.cat = cat;
    buildWork({ before: renderWork });
    $(`.tray[data-cat="${CSS.escape(cat)}"]`, sec)?.focus({ preventScroll: true });
    // A swapped line starts from its first print; elsewhere stay put.
    jumpTo(inside && motion.pinST ? motion.pinST.start : y);
    const prints = $$('.track .print', sec);
    if (!MOTION || !prints.length) { motion.busy = false; return; }
    G.fromTo(prints, { y: -70, opacity: 0, rotation: -3 }, {
      y: 0, opacity: 1, rotation: 0, duration: 1, stagger: 0.09, ease: 'power3.out',
      onComplete: () => { motion.busy = false; G.set(prints, { clearProps: 'transform,opacity' }); },
    });
  };
  const old = $$('.track .print', sec);
  if (!MOTION || !old.length) { swap(); return; }
  motion.busy = true;
  G.to(old, { y: -40, opacity: 0, duration: 0.4, stagger: 0.035, ease: 'power2.in', onComplete: swap });
}

/* ---------- experience: multi-track timeline ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const decYear = (v) => {
  const m = String(v || '').match(/^(\d{4})(?:-(\d{1,2}))?/);
  return m ? +m[1] + ((m[2] ? Math.min(12, Math.max(1, +m[2])) : 1) - 1) / 12 : null;
};
const nowYear = () => { const d = new Date(); return d.getFullYear() + (d.getMonth() + (d.getDate() - 1) / 31) / 12; };
const monthLabel = (d) => { let y = Math.floor(d + 1e-6); let m = Math.round((d - y) * 12); if (m > 11) { y += 1; m = 0; } return `${MONTHS[m]} ${y}`; };
function lengthLabel(s, e) {
  const m = Math.max(1, Math.round((e - s) * 12));
  const y = Math.floor(m / 12);
  const r = m % 12;
  return [y ? plural(y, 'year', 'years') : '', r ? plural(r, 'month', 'months') : ''].filter(Boolean).join(' ');
}
const ALT_KIND = /educ|stud|course|school|college|universit|degree|workshop|training|certif/i;

function renderExperience() {
  const body = $('#expBody');
  if (!body) return;
  const today = nowYear();
  const items = state.c.experience.filter((e) => e.title).map((e) => {
    let s = decYear(e.start);
    let en = decYear(e.end);
    if (s == null && en == null) return null;
    if (s == null) s = en;
    en = e.current ? Math.max(today, s + 1 / 12) : en != null ? Math.max(en + 1 / 12, s + 1 / 12) : s + 1 / 12;
    return { e, s, en, kind: String(e.kind || '').trim() || 'Other' };
  }).filter(Boolean);
  if (!items.length) { body.innerHTML = '<p class="empty" data-rv>Nothing here yet.</p>'; return; }

  // Tracks in order of first appearance; overlapping entries in one track get their own lane.
  const tracks = [];
  for (const it of items) {
    let t = tracks.find((x) => x.name === it.kind);
    if (!t) tracks.push((t = { name: it.kind, items: [] }));
    t.items.push(it);
  }
  for (const t of tracks) {
    const ends = [];
    for (const it of [...t.items].sort((a, b) => a.s - b.s)) {
      let lane = ends.findIndex((x) => x <= it.s + 1e-6);
      if (lane < 0) lane = ends.length;
      ends[lane] = it.en;
      it.lane = lane;
    }
    t.lanes = Math.max(1, ends.length);
  }
  [...items].sort((a, b) => a.s - b.s || a.en - b.en).forEach((it, i) => { it.no = i + 1; });

  const from = Math.floor(Math.min(...items.map((x) => x.s)));
  const latest = Math.max(today, ...items.map((x) => x.en));
  const to = Math.max(Math.floor(latest) + 2, from + 3);
  const span = to - from;
  const years = Array.from({ length: span }, (_, k) => from + k);
  const recent = [...items].sort((a, b) => b.en - a.en || b.s - a.s)[0];
  const order = tracks.flatMap((t) => t.items);
  const rowOf = (it) => tracks.findIndex((t) => t.items.includes(it));

  body.innerHTML = `
    <div class="xv" data-rv>
      <figure class="xv-print" aria-hidden="true"><span class="xv-tag"></span><span class="xv-ph"></span><span class="xv-dur"></span></figure>
      <div class="xv-info" aria-live="polite">
        <h3 class="xv-title"></h3>
        <dl>
          <div><dt>Organisation</dt><dd class="xv-org"></dd></div>
          <div><dt>Track</dt><dd class="xv-trk"></dd></div>
          <div><dt>Dates</dt><dd class="xv-dates"></dd></div>
          <div><dt>Length</dt><dd class="xv-len"></dd></div>
        </dl>
        <div class="prose xv-desc"></div>
        <div class="xv-link"></div>
      </div>
    </div>
    <div class="xtl-bar"><span class="xtl-count"></span><button class="xtl-all" type="button" hidden>All tracks</button></div>
    <div class="xtl-scroll" tabindex="0" role="region" aria-label="Timeline (scrolls sideways)">
      <div class="xtl" style="--from:${from};--span:${span};--t:${today.toFixed(3)}">
        <div class="xtl-ruler"><span>Year</span><div class="xtl-years">${years.map((y) => `<span style="--y:${y}">${y}</span>`).join('')}</div></div>
        ${tracks.map((t, ti) => `<div class="xtl-row" style="--lanes:${t.lanes}">
          <button class="xtl-name" type="button" aria-pressed="false" title="Show only this track"><small>T${ti + 1}</small>${esc(t.name)}</button>
          <div class="xtl-lane">${t.items.map((it) => `<button class="xc${ALT_KIND.test(t.name) ? ' alt' : ''}" type="button" data-x="${order.indexOf(it)}" style="--s:${it.s.toFixed(4)};--e:${it.en.toFixed(4)};--ln:${it.lane};--i:${it.no - 1}" aria-label="${esc(`${it.e.title}, ${fmtRange(it.e.start, it.e.end, it.e.current)}`)}"><small>E${pad2(it.no)}</small><span>${esc(it.e.title)}</span></button>`).join('')}</div>
        </div>`).join('')}
        <div class="xtl-ov" aria-hidden="true"><i class="xtl-now"><b>Today</b></i><i class="xtl-ph"><b></b></i></div>
      </div>
    </div>`;

  const x = $('.xtl', body);
  const clips = $$('.xc', x);
  const rows = $$('.xtl-row', x);
  const all = $('.xtl-all', body);
  const count = $('.xtl-count', body);
  const ph = $('.xtl-ph', x);
  const ov = $('.xtl-ov', x);
  const set = (sel, v) => { $(sel, body).textContent = v; };
  let pinned = recent;

  const show = (it) => {
    const e = it.e;
    const ti = rowOf(it);
    clips.forEach((k) => k.classList.toggle('on', +k.dataset.x === order.indexOf(it)));
    const len = lengthLabel(it.s, Math.min(it.en, e.current ? today : it.en));
    set('.xv-title', e.title);
    set('.xv-org', [e.org, e.location].filter(Boolean).join(' · ') || '—');
    set('.xv-trk', tracks[ti].name);
    set('.xv-dates', fmtRange(e.start, e.end, e.current) || monthLabel(it.s));
    set('.xv-len', len);
    set('.xv-dur', len);
    set('.xv-tag', `T${ti + 1} · ${tracks[ti].name}`);
    set('.xv-ph', e.org || e.title);
    $('.xv-desc', body).innerHTML = prose(e.description);
    $('.xv-link', body).innerHTML = e.link ? `<a class="btn" href="${esc(socialHref({ url: e.link }))}" target="_blank" rel="noopener">View <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>` : '';
  };
  clips.forEach((k) => {
    const it = order[+k.dataset.x];
    k.addEventListener('mouseenter', () => show(it));
    k.addEventListener('focus', () => show(it));
    k.addEventListener('click', () => { pinned = it; show(it); });
  });
  x.addEventListener('mouseleave', () => show(pinned));

  const solo = (row) => {
    const on = !!row && !row.classList.contains('on');
    rows.forEach((r) => {
      r.classList.toggle('on', on && r === row);
      $('.xtl-name', r).setAttribute('aria-pressed', String(on && r === row));
    });
    x.classList.toggle('solo', on);
    all.hidden = !on;
    const n = on ? $$('.xc', row).length : clips.length;
    count.textContent = `${plural(n, 'entry', 'entries')} · ${on ? tracks[rows.indexOf(row)].name : plural(tracks.length, 'track', 'tracks')}`;
  };
  rows.forEach((r) => $('.xtl-name', r).addEventListener('click', () => solo(r)));
  all.addEventListener('click', () => { solo(null); $('.xtl-name', rows[0])?.focus({ preventScroll: true }); });

  // Pointer scrub line with a month readout.
  x.addEventListener('pointermove', (ev) => {
    const b = ov.getBoundingClientRect();
    const p = (ev.clientX - b.left) / b.width;
    if (p < 0 || p > 1) { ph.style.opacity = '0'; return; }
    ph.style.opacity = '';
    ph.style.left = `${p * 100}%`;
    ph.firstChild.textContent = monthLabel(from + Math.floor(p * span * 12) / 12);
  });

  solo(null);
  show(pinned);
  if (!MOTION || PREVIEW) x.classList.add('dev');

  // On narrow screens the strip scrolls sideways: start with the newest entries in view.
  const sc = x.parentNode;
  if (sc.scrollWidth > sc.clientWidth + 2) {
    const lab = parseFloat(getComputedStyle(x).getPropertyValue('--lab')) || 0;
    const laneW = x.clientWidth - lab;
    const end = lab + ((Math.max(recent.en, today) - from) / span) * laneW;
    sc.scrollLeft = Math.max(0, end - sc.clientWidth + 48);
  }
}

/* ---------- project modal ---------- */

function slidesOf(p) {
  const out = [];
  const before = parse(p.compare?.before);
  const after = parse(p.compare?.after);
  if (before && after) out.push({ kind: 'ba', before, after, lb: p.compare.labelBefore || 'Before', la: p.compare.labelAfter || 'After' });
  for (const item of p.media || []) {
    const m = parse(item.url);
    if (m) out.push({ kind: 'media', m, caption: item.caption });
  }
  if (!out.length) {
    const cover = parse(p.cover);
    out.push(cover ? { kind: 'media', m: cover } : { kind: 'empty' });
  }
  return out;
}

function baLayer(m) {
  return m.type === 'video'
    ? `<video src="${esc(m.src)}" muted loop playsinline autoplay preload="auto"></video>`
    : `<img src="${esc(srcUrl(m, 2000))}" alt="" draggable="false">`;
}

function slideHTML(sl, p) {
  const r = ratioOf(p.orientation);
  if (sl.kind === 'ba') {
    return `<div class="m-frame" style="--r:${r}">
      <div class="ba" tabindex="0" role="slider" aria-label="Before and after comparison" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
        <div class="ba-layer">${baLayer(sl.after)}</div>
        <div class="ba-layer ba-before">${baLayer(sl.before)}</div>
        <span class="ba-line"></span><span class="ba-knob"><i class="fa-solid fa-left-right" aria-hidden="true"></i></span>
        <span class="ba-label l">${esc(sl.lb)}</span><span class="ba-label r">${esc(sl.la)}</span>
      </div></div>`;
  }
  if (sl.kind === 'empty') {
    return `<div class="m-frame" style="--r:${r}"><span class="ph"><i class="${esc(catOf(p.category)?.icon || 'fa-solid fa-star')}" aria-hidden="true"></i>Awaiting exposure</span></div>`;
  }
  const m = sl.m;
  const fr = m.type === 'instagram' ? 0.5 : m.type === 'youtube' && m.vertical ? 9 / 16 : r;
  let inner;
  if (m.type === 'image' || m.type === 'video') inner = playerHTML(m, { autoplay: false });
  else if (m.type === 'link') inner = linkCard(m);
  else inner = facade(m, { label: actionLabel(m) });
  return `<div class="m-frame" style="--r:${fr}">${inner}</div>${sl.caption ? `<p class="m-cap">${esc(sl.caption)}</p>` : ''}`;
}

function openProject(id, { push = true } = {}) {
  const p = published(state.c).find((x) => x.id === id);
  if (!p) return;
  if (!state.list.some((x) => x.id === id)) state.list = sortProjects(published(state.c));
  const wasOpen = !modal.hidden;
  state.project = p;
  state.slide = 0;
  renderModal();
  if (!wasOpen) {
    state.lastFocus = document.activeElement;
    modal.hidden = false;
    root.classList.add('modal-open');
    motion.lenis?.stop();
    $('.m-close', modal).focus({ preventScroll: true });
  }
  const hash = `#/p/${id}`;
  if (location.hash !== hash) {
    if (push && !wasOpen) history.pushState({ pfModal: 1 }, '', hash);
    else history.replaceState(history.state, '', hash);
  }
  trackProject(id);
}

function renderModal() {
  const p = state.project;
  const cat = catOf(p.category);
  const slides = slidesOf(p);
  const idx = state.list.findIndex((x) => x.id === p.id);
  const r = ratioOf(p.orientation);
  panel.setAttribute('style', pairVars(cat?.colors));
  panel.classList.toggle('is-tall', r < 0.95);
  const links = (p.links || []).filter((l) => l.url);
  panel.innerHTML = `
    <div class="m-stage">
      <div class="m-slide">${slideHTML(slides[state.slide], p)}</div>
      ${slides.length > 1 ? `
        <button type="button" class="m-arrow prev" data-slide="-1" aria-label="Previous media"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
        <button type="button" class="m-arrow next" data-slide="1" aria-label="Next media"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
        <div class="m-dots">${slides.map((_, i) => `<button type="button" class="m-dot" aria-label="Media ${i + 1}" aria-current="${i === state.slide}" data-goto="${i}"></button>`).join('')}</div>` : ''}
    </div>
    <div class="m-body">
      <p class="eyebrow">${cat ? `<i class="${esc(cat.icon)}" aria-hidden="true"></i> ${esc(cat.name)}` : 'Project'}</p>
      <h2 id="mTitle">${esc(p.title)}</h2>
      <div class="m-meta">
        ${p.role ? `<span><i class="fa-solid fa-user-pen" aria-hidden="true"></i>${esc(p.role)}</span>` : ''}
        ${p.client ? `<span><i class="fa-solid fa-briefcase" aria-hidden="true"></i>${esc(p.client)}</span>` : ''}
        ${p.date ? `<span><i class="fa-regular fa-calendar" aria-hidden="true"></i>${esc(fmtMonth(p.date))}</span>` : ''}
      </div>
      ${p.tools?.length ? `<ul class="pills">${p.tools.map((t) => `<li class="pill">${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="prose">${prose(p.description || p.summary)}</div>
      <div class="m-actions">
        ${links.map((l) => `<a class="btn" href="${esc(socialHref({ url: l.url }))}" target="_blank" rel="noopener">${esc(l.label || 'Open link')} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>`).join('')}
        <button type="button" class="btn" data-share><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Share</button>
      </div>
      ${state.list.length > 1 ? `<div class="m-nav">
        <button type="button" class="m-navbtn" data-mnav="-1"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Previous</button>
        <span class="m-count">${pad2(idx + 1)} / ${pad2(state.list.length)}</span>
        <button type="button" class="m-navbtn" data-mnav="1">Next <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
      </div>` : ''}
    </div>`;
  panel.scrollTop = 0;
  wireBA(panel);
}

function setSlide(i) {
  const n = slidesOf(state.project).length;
  state.slide = (i + n) % n;
  const stage = $('.m-slide', panel);
  stage.innerHTML = slideHTML(slidesOf(state.project)[state.slide], state.project);
  $$('.m-dot', panel).forEach((d, k) => d.setAttribute('aria-current', String(k === state.slide)));
  wireBA(panel);
}

function stepProject(dir) {
  if (state.list.length < 2) return;
  const i = state.list.findIndex((x) => x.id === state.project.id);
  const next = state.list[(i + dir + state.list.length) % state.list.length];
  openProject(next.id, { push: false });
}

function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  panel.innerHTML = '';
  root.classList.remove('modal-open');
  motion.lenis?.start();
  state.project = null;
  state.lastFocus?.focus?.({ preventScroll: true });
}

function requestClose() {
  if (history.state?.pfModal) history.back();
  else {
    history.replaceState(null, '', location.pathname + location.search);
    closeModal();
  }
}

function wireBA(scope) {
  for (const ba of $$('.ba', scope)) {
    const set = (pct) => {
      pct = Math.max(0, Math.min(100, pct));
      ba.style.setProperty('--pos', `${pct}%`);
      ba.setAttribute('aria-valuenow', String(Math.round(pct)));
    };
    const fromEvent = (e) => {
      const r = ba.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 100);
    };
    ba.addEventListener('pointerdown', (e) => { ba.setPointerCapture(e.pointerId); ba.dataset.drag = '1'; fromEvent(e); });
    ba.addEventListener('pointermove', (e) => { if (ba.dataset.drag) fromEvent(e); });
    const stop = () => { delete ba.dataset.drag; };
    ba.addEventListener('pointerup', stop);
    ba.addEventListener('pointercancel', stop);
    ba.addEventListener('keydown', (e) => {
      const now = parseFloat(ba.style.getPropertyValue('--pos')) || 50;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        set(now + (e.key === 'ArrowLeft' ? -5 : 5));
      }
    });
    const [after, before] = $$('video', ba);
    if (after && before) {
      after.addEventListener('timeupdate', () => {
        if (Math.abs(before.currentTime - after.currentTime) > 0.12) before.currentTime = after.currentTime;
      });
    }
  }
}

async function share() {
  const p = state.project;
  const url = `${location.origin}${location.pathname}#/p/${p.id}`;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: p.title, url }); return; } catch { /* cancelled */ }
  }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Copy this link', url); }
}

/* ---------- nav, footer, observers ---------- */

function renderNav(c) {
  const p = c.profile;
  $('#brandMark').textContent = p.shortName || initials(p.name);
  $('#brandName').textContent = p.name;
  $('#navLinks').innerHTML = visibleSections(c).filter((s) => s.type !== 'hero')
    .map((s) => `<a href="#${esc(s.id)}" data-nav="${esc(s.id)}">${esc(s.nav || s.title)}</a>`).join('');
}

function renderFooter(c) {
  const p = c.profile;
  $('#foot').innerHTML = `
    <div class="foot-name" aria-hidden="true">${esc(p.name)}</div>
    <div class="foot-note">
      <span>© ${new Date().getFullYear()} ${esc(p.name)}</span>
      <span class="foot-socials">${socialIcons(c)}</span>
      <a href="#top" class="foot-top">Back to top <i class="fa-solid fa-arrow-up" aria-hidden="true"></i></a>
    </div>`;
}

function setCurrent(sec) {
  const a = getComputedStyle(sec).getPropertyValue('--a').trim();
  if (a) document.body.style.setProperty('--cur-a', a);
}

let sectionIO;
function observeSections() {
  sectionIO?.disconnect();
  sectionIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      $$('[data-sec].is-current').forEach((x) => x.classList.remove('is-current'));
      e.target.classList.add('is-current');
      setCurrent(e.target);
      $$('#navLinks a').forEach((a) => a.classList.toggle('active', a.dataset.nav === e.target.id));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('[data-sec]').forEach((s) => sectionIO.observe(s));
}

function startEffects() {
  state.timers.forEach(clearInterval);
  state.timers = [];
  const rot = $('.tagline');
  if (rot && !REDUCED) {
    const tags = JSON.parse(rot.dataset.tags || '[]');
    let i = 0;
    if (tags.length > 1) {
      state.timers.push(setInterval(() => {
        rot.classList.add('out');
        setTimeout(() => { i = (i + 1) % tags.length; rot.textContent = tags[i]; rot.classList.remove('out'); }, 420);
      }, 3800));
    }
  }
}

/* ---------- motion ---------- */

function initLenis() {
  if (!MOTION || motion.lenis || !window.Lenis) return;
  const lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
  lenis.on('scroll', ST.update);
  G.ticker.add((t) => lenis.raf(t * 1000));
  G.ticker.lagSmoothing(0);
  motion.lenis = lenis;
}

function scrollToTarget(el) {
  if (motion.lenis) motion.lenis.scrollTo(el || 0, { duration: 1.6 });
  else if (el) el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  else scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
}

// Creating a pinned ScrollTrigger measures from the top of the page, so put the reader back where they were.
function jumpTo(y) {
  if (Math.abs(scrollY - y) < 1) return;
  if (motion.lenis) motion.lenis.scrollTo(y, { immediate: true, force: true });
  else scrollTo(0, y);
  ST?.update();
}

function teardownMotion() {
  if (motion.intro) motion.intro.progress(1);
  motion.workMM?.revert();
  motion.workMM = null;
  motion.work?.revert();
  motion.work = null;
  motion.pinST = null;
  motion.page?.revert();
  motion.page = null;
  motion.develop = [];
  motion.busy = false;
}

// Scroll-linked pieces outside the work section: develop-on-scroll prints, reveals, safelight breathing.
function buildPage() {
  if (!MOTION) return;
  motion.page = G.context(() => {
    for (const el of $$('[data-develop]')) {
      el.style.setProperty('--d', 0);
      const st = ST.create({ trigger: el, start: 'top 92%', end: 'top 30%', scrub: 0.8, onUpdate: (s) => el.style.setProperty('--d', s.progress.toFixed(3)) });
      motion.develop.push([el, st]);
    }
    for (const el of $$('.spec')) {
      G.fromTo(el.children, { opacity: 0.08, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', ease: 'none', scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 58%', scrub: 1 } });
    }
    if (!PREVIEW) {
      for (const el of $$('[data-rv]')) {
        G.fromTo(el, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 1.05, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
      }
      for (const g of $$('[data-rv-group]')) {
        G.fromTo(g.children, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.95, ease: 'power4.out', stagger: 0.08, scrollTrigger: { trigger: g, start: 'top 86%', once: true } });
      }
      for (const x of $$('.xtl')) ST.create({ trigger: x, start: 'top 82%', once: true, onEnter: () => x.classList.add('dev') });
    }
    const sl = $('.safelight');
    for (const s of $$('[data-glow]')) {
      const v = parseFloat(s.dataset.glow) || 1;
      ST.create({ trigger: s, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => { if (self.isActive) G.to(sl, { opacity: v, duration: 1.3, overwrite: true }); } });
    }
    const name = $('.hero .name');
    if (name) G.to(name, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hero-in', start: 'top top', end: 'bottom top', scrub: 1 } });
  });
}

// The clothesline: pinned horizontal travel on desktop, a sticky stack on phones. Prints develop as they move.
function buildWork({ before } = {}) {
  motion.workMM?.revert();
  motion.workMM = null;
  motion.work?.revert();
  motion.work = null;
  motion.pinST = null;
  before?.();
  const sec = $('[data-work]');
  if (!sec || !MOTION || !$('.track .print', sec)) { if (MOTION) ST.refresh(); return; }
  const track = $('.track', sec);
  const prints = $$('.print', track);

  motion.work = G.context(() => {
    if (innerWidth > 800) {
      for (const p of prints) {
        const r = parseFloat(p.style.getPropertyValue('--rot')) || 0;
        G.fromTo($('.swing', p), { rotation: r - 1.4 }, { rotation: r + 1.4, duration: 3 + Math.random() * 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: -Math.random() * 4 });
      }
    }
  });

  const mm = G.matchMedia();
  motion.workMM = mm;
  mm.add('(min-width: 801px)', () => {
    sec.classList.add('is-pinned');
    const path = $('.cord path', track);
    const svg = $('.cord', track);
    const end = () => { const e = $('.endcard', track) || track.lastElementChild; return e.offsetLeft + e.offsetWidth + innerWidth * 0.24; };
    // Print height = what is left of the viewport under the trays.
    const size = () => {
      const free = innerHeight - track.offsetTop - 104 - 40 - 92;
      track.style.setProperty('--ph', `${Math.round(Math.max(150, Math.min(480, free)))}px`);
    };
    const cord = () => {
      const w = end();
      svg.setAttribute('width', w);
      svg.setAttribute('height', 46);
      svg.setAttribute('viewBox', `0 0 ${w} 46`);
      const xs = [-40, ...prints.map((p) => p.offsetLeft + p.offsetWidth / 2), w + 40];
      let d = `M${xs[0]},14`;
      for (let i = 1; i < xs.length; i++) d += ` Q${(xs[i - 1] + xs[i]) / 2},${i === 1 || i === xs.length - 1 ? 20 : 34} ${xs[i]},14`;
      path.setAttribute('d', d);
    };
    const develop = () => {
      const vw = innerWidth;
      for (const p of prints) {
        const r = p.getBoundingClientRect();
        p.style.setProperty('--d', G.utils.clamp(0, 1, (0.9 * vw - (r.left + r.width / 2)) / (0.46 * vw)).toFixed(3));
      }
    };
    size();
    ST.addEventListener('refreshInit', size);
    const dist = () => Math.max(end() - innerWidth, 500);
    const tw = G.to(track, {
      x: () => -dist(), ease: 'none', onUpdate: develop,
      scrollTrigger: { trigger: sec, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 1, onRefresh: () => { cord(); develop(); } },
    });
    motion.pinST = tw.scrollTrigger;
    cord();
    develop();
    return () => {
      ST.removeEventListener('refreshInit', size);
      sec.classList.remove('is-pinned');
      track.style.removeProperty('--ph');
      G.set(track, { clearProps: 'transform' });
      prints.forEach((p) => p.style.removeProperty('--d'));
      path.setAttribute('d', '');
      motion.pinST = null;
    };
  });
  mm.add('(max-width: 800px)', () => {
    for (const p of prints) {
      p.style.setProperty('--d', 0);
      ST.create({ trigger: p, start: 'top 96%', end: 'top 42%', scrub: 0.6, onUpdate: (s) => p.style.setProperty('--d', s.progress.toFixed(3)) });
    }
    return () => prints.forEach((p) => p.style.removeProperty('--d'));
  });
  ST.sort();
  ST.refresh();
}

function syncDevelop() {
  for (const [el, st] of motion.develop) el.style.setProperty('--d', st.progress.toFixed(3));
}

// Enlarger countdown 3-2-1, then the name develops. Once per visit, skippable by any input.
function intro() {
  if (motion.introDone) return;
  motion.introDone = true;
  const hero = $('.hero');
  if (!hero || app.firstElementChild !== hero || location.hash || FOCUS || scrollY > 40) return;
  root.classList.add('intro');
  motion.lenis?.stop();
  scrollTo(0, 0);
  const nums = $$('.cd-n', hero);
  const label = $('.cd-label', hero);
  const glow = $('.safelight');
  const parts = $$('.role, .tagline, .hero-acts, .tag, .cue', hero);
  const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  const skip = () => tl.progress(1);
  const finish = () => {
    evs.forEach((ev) => removeEventListener(ev, skip));
    root.classList.remove('intro');
    G.set([...$$('.nl > span', hero), ...parts, '.nav', glow], { clearProps: 'filter,transform,opacity' });
    motion.intro = null;
    motion.lenis?.start();
    ST.refresh();
  };
  const tl = G.timeline({ onComplete: finish });
  nums.forEach((n, i) => {
    tl.fromTo(n, { opacity: 0, scale: 1.05, filter: 'blur(10px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.28, ease: 'power2.out' }, i * 0.9 + 0.2)
      .to(n, { opacity: 0, duration: 0.35, ease: 'power1.in' }, i * 0.9 + 0.72)
      .fromTo(glow, { opacity: 1 }, { opacity: 0.55, duration: 0.12, yoyo: true, repeat: 1 }, i * 0.9 + 0.2);
  });
  tl.call(() => { label.textContent = 'Developing…'; }, null, 2.75)
    .fromTo($$('.nl > span', hero), { opacity: 0, yPercent: 10, filter: 'blur(18px) brightness(2.4) contrast(.4)' }, { opacity: 1, yPercent: 0, filter: 'blur(0px) brightness(1) contrast(1)', duration: 2.3, stagger: 0.4, ease: 'power2.out' }, 2.9)
    .to(label, { opacity: 0, duration: 0.6 }, 4.4)
    .fromTo(parts, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, stagger: 0.14, ease: 'power3.out' }, 4.6)
    .fromTo('.nav', { opacity: 0 }, { opacity: 1, duration: 1 }, 5);
  motion.intro = tl;
  evs.forEach((ev) => addEventListener(ev, skip, { once: true, passive: true }));
}

function buildMotion() {
  if (!MOTION) return;
  initLenis();
  buildPage();
  buildWork();
  syncDevelop();
  intro();
}

/* ---------- global wiring ---------- */

function wireGlobal() {
  const nav = $('#nav');
  const toggle = $('#navToggle');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    root.classList.toggle('menu-open', open);
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));

  // Refit the name when the window changes size or the display font finishes loading.
  let fitRaf = 0;
  addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitName); });
  const refit = () => { fitName(); ST?.refresh(); };
  document.fonts?.addEventListener?.('loadingdone', refit);
  document.fonts?.ready.then(refit);
  addEventListener('load', () => ST?.refresh());

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { requestClose(); return; }
    const t = e.target.closest('a, button');
    if (!t) return;
    if (t.closest('#navLinks') || t.classList.contains('brand')) setMenu(false);
    if (t.dataset.track) trackClick(t.dataset.track);
    const href = t.tagName === 'A' ? t.getAttribute('href') || '' : '';
    if (href.startsWith('#') && !href.startsWith('#/')) {
      const target = href.length > 1 && href !== '#top' ? document.getElementById(decodeURIComponent(href.slice(1))) : null;
      if (target || href === '#top' || href === '#') { e.preventDefault(); scrollToTarget(target); }
      return;
    }
    if (t.dataset.open) { openProject(t.dataset.open); return; }
    if (t.classList.contains('tray') && t.dataset.cat) { setTray(t.dataset.cat); return; }
    if (t.dataset.play != null) {
      const m = parse(t.dataset.play);
      if (m) t.outerHTML = playerHTML(m, { autoplay: true });
      return;
    }
    if (t.hasAttribute('data-reel-sound')) {
      const v = $('.reel-video');
      v.muted = !v.muted;
      v.controls = !v.muted;
      if (!v.muted) { v.currentTime = 0; v.play(); }
      t.innerHTML = `<i class="fa-solid ${v.muted ? 'fa-volume-xmark' : 'fa-volume-high'}" aria-hidden="true"></i>`;
      t.setAttribute('aria-label', v.muted ? 'Turn sound on' : 'Mute');
      return;
    }
    if (t.dataset.mnav) { stepProject(+t.dataset.mnav); return; }
    if (t.dataset.slide) { setSlide(state.slide + +t.dataset.slide); return; }
    if (t.dataset.goto) { setSlide(+t.dataset.goto); return; }
    if (t.hasAttribute('data-share')) share();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!modal.hidden) requestClose();
      else if (nav.classList.contains('open')) setMenu(false);
    }
    if (!modal.hidden && !e.target.closest?.('input, textarea, .ba')) {
      if (e.key === 'ArrowRight') stepProject(1);
      if (e.key === 'ArrowLeft') stepProject(-1);
    }
  });

  // Swipe: between media slides when there are several, otherwise between projects.
  let sx = 0;
  let sy = 0;
  let tracking = false;
  panel.addEventListener('touchstart', (e) => {
    tracking = !e.target.closest('.ba, video, .pills');
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (!tracking || !state.project) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 50) return;
    const dir = dx < 0 ? 1 : -1;
    if (e.target.closest('.m-stage') && slidesOf(state.project).length > 1) setSlide(state.slide + dir);
    else stepProject(dir);
  }, { passive: true });

  addEventListener('popstate', route);
  addEventListener('hashchange', route);
}

function route() {
  const m = location.hash.match(/^#\/p\/([\w-]+)/);
  if (m) {
    if (state.project?.id !== m[1]) openProject(m[1], { push: false });
  } else closeModal();
}

/* ---------- boot ---------- */

function render(c) {
  state.c = c;
  applyTheme(c.theme);
  document.title = c.seo?.title || `${c.profile.name} | Portfolio`;
  $('meta[name="description"]')?.setAttribute('content', c.seo?.description || '');
  const keepY = scrollY;
  teardownMotion();
  renderNav(c);
  app.innerHTML = visibleSections(c).map((s) => RENDER[s.type]?.(s, c) || '').join('');
  renderWork();
  renderExperience();
  renderFooter(c);
  fitName();
  observeSections();
  startEffects();
  buildMotion();
  if (!motion.intro) jumpTo(keepY);
  if (state.project) {
    const p = published(c).find((x) => x.id === state.project.id);
    if (p) { state.project = p; renderModal(); } else requestClose();
  }
}

async function boot() {
  wireGlobal();
  const defaults = await loadDefaults();
  const cached = readCache();
  let first = true;
  const show = (c) => {
    render(normalize(c, defaults));
    if (first) {
      first = false;
      const work = $('[data-work]');
      if (FOCUS && work) {
        if (motion.lenis) motion.lenis.scrollTo(work, { immediate: true, force: true });
        else work.scrollIntoView({ behavior: 'instant' });
      }
      route();
      if (!PREVIEW) trackVisit();
    }
  };

  if (PREVIEW) {
    addEventListener('message', (e) => {
      if (e.origin === location.origin && e.data?.type === 'pf-preview') render(normalize(e.data.content, defaults));
    });
    window.parent?.postMessage({ type: 'pf-preview-ready' }, location.origin);
  }

  if (cached) show(cached);
  if (DEMO) { if (!cached) show(defaults); return; }
  try {
    const fresh = await fetchPublic();
    if (fresh) {
      writeCache(fresh);
      if (!cached || cached.updatedAt !== fresh.updatedAt) show(fresh);
    } else if (!cached) show(defaults);
  } catch (err) {
    console.warn('Could not load content from Firebase', err);
    if (!cached) show(defaults);
  }
}

boot();
