// Public portfolio: renders everything from the content document.
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

const state = {
  c: null,
  cat: FOCUS || 'all',
  orient: 'all',
  kind: 'all',
  list: [],
  project: null,
  slide: 0,
  timers: [],
};

const app = $('#app');
const modal = $('#modal');
const panel = $('#modalPanel');

/* ---------- helpers ---------- */

const published = (c) => c.projects.filter((p) => p.published !== false && p.title);
const catOf = (id) => state.c.categories.find((x) => x.id === id);
const visibleSections = (c) => c.sections.filter((s) => s.visible !== false);

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
    return `<a class="icon-btn" href="${esc(socialHref(s))}" ${ext ? 'target="_blank" rel="noopener"' : ''} aria-label="${esc(p.label)}" title="${esc(p.label)}" data-track="${esc(s.platform)}"><i class="${p.icon}"></i></a>`;
  }).join('');
}

function facade(m, { label = '', cls = '' } = {}) {
  const t = thumbUrl(m, 1400);
  return `<button class="facade ${cls}" data-play="${esc(m.raw)}" aria-label="${esc(label || actionLabel(m))}">
    ${t ? `<img src="${esc(t)}" alt="" loading="lazy" decoding="async">` : '<span class="ph ph-soft"></span>'}
    <span class="play"><i class="${actionIcon(m)}"></i></span>
    ${label ? `<span class="facade-label">${esc(label)}</span>` : ''}
  </button>`;
}

function head(s, n) {
  return `<header class="sec-head">
    <p class="eyebrow rv">${String(n).padStart(2, '0')} / ${esc(s.nav || s.title)}</p>
    <h2 class="rv" style="--d:1">${esc(s.title)}</h2>
    ${s.intro ? `<p class="sec-intro rv" style="--d:2">${esc(s.intro)}</p>` : ''}
  </header>`;
}

/* ---------- sections ---------- */

function heroSection(s, c) {
  const p = c.profile;
  const tags = (p.taglines || []).filter(Boolean);
  const work = visibleSections(c).find((x) => x.type === 'work');
  const contact = visibleSections(c).find((x) => x.type === 'contact');
  const avail = p.availability?.show && p.availability?.text;
  return `<section class="sec hero" id="${esc(s.id)}" data-sec style="${pairVars(s.colors)}">
    <div class="wrap hero-grid">
      <div class="hero-copy">
        ${avail ? `<p class="badge rv"><span class="pulse"></span>${esc(p.availability.text)}</p>` : ''}
        <h1 class="hero-name rv" style="--d:1"><span class="grad-text">${esc(p.name)}</span></h1>
        <p class="hero-role rv" style="--d:2">${esc(p.role)}</p>
        ${tags.length ? `<p class="hero-tag rv" style="--d:3"><span class="caret">&gt;</span> <span class="rotator" data-tags="${esc(JSON.stringify(tags))}">${esc(tags[0])}</span><span class="cursor-bar"></span></p>` : ''}
        <div class="hero-cta rv" style="--d:4">
          ${work ? `<a class="btn btn-primary" href="#${esc(work.id)}">View work <i class="fa-solid fa-arrow-down"></i></a>` : ''}
          ${contact ? `<a class="btn" href="#${esc(contact.id)}">Get in touch</a>` : ''}
          ${p.resume ? `<a class="btn" href="${esc(socialHref({ url: p.resume }))}" target="_blank" rel="noopener" data-track="resume"><i class="fa-solid fa-file-arrow-down"></i> Résumé</a>` : ''}
        </div>
        <div class="hero-socials rv" style="--d:5">${socialIcons(c)}</div>
      </div>
      <div class="hero-visual rv" style="--d:3">${reel(p)}</div>
    </div>
  </section>`;
}

function reel(p) {
  const m = parse(p.showreel);
  let inner;
  if (!m) {
    inner = `<div class="reel-art"><span class="orb o1"></span><span class="orb o2"></span><span class="ring r1"></span><span class="ring r2"></span><span class="reel-initials">${esc(p.shortName || initials(p.name))}</span></div>`;
  } else if (m.type === 'video' && autoplayOK()) {
    const poster = thumbUrl(m, 1400);
    inner = `<video class="reel-video" src="${esc(m.src)}" ${poster ? `poster="${esc(poster)}"` : ''} muted loop playsinline autoplay preload="auto"></video>
      <button class="reel-sound" data-reel-sound aria-label="Turn sound on"><i class="fa-solid fa-volume-xmark"></i></button>`;
  } else if (m.type === 'image') {
    inner = `<img class="reel-img" src="${esc(srcUrl(m, 1600))}" alt="">`;
  } else {
    inner = facade(m, { label: 'Play showreel' });
  }
  return `<div class="reel">
      ${inner}
      <span class="vf tl"></span><span class="vf tr"></span><span class="vf bl"></span><span class="vf br"></span>
    </div>
    <div class="reel-meta"><span><i class="rec"></i>REC</span><span class="reel-cap">${esc(p.showreelCaption || 'Showreel')}</span><span class="tc" id="timecode">00:00:00:00</span></div>`;
}

function autoplayOK() {
  return !REDUCED && !navigator.connection?.saveData && innerWidth >= 768;
}

function workSection(s, c, n) {
  return `<section class="sec sec-work" id="${esc(s.id)}" data-sec style="${pairVars(s.colors)}">
    <div class="wrap">${head(s, n)}<div class="work-body" id="workBody"></div></div>
  </section>`;
}

function aboutSection(s, c, n) {
  const p = c.profile;
  const m = parse(p.photo);
  const photo = m ? thumbUrl(m, 900) || srcUrl(m) : '';
  const list = (arr, cls) => (arr || []).filter(Boolean).map((x) => `<li class="${cls}">${esc(x)}</li>`).join('');
  const highlights = (p.highlights || []).filter((x) => x.value || x.label);
  return `<section class="sec sec-about" id="${esc(s.id)}" data-sec style="${pairVars(s.colors)}">
    <div class="wrap about-grid">
      <div class="about-side rv">
        ${photo
          ? `<div class="photo"><div class="photo-in duo"><img src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy"></div></div>`
          : `<div class="photo"><div class="photo-in photo-ph"><span>${esc(p.shortName || initials(p.name))}</span></div></div>`}
        ${p.location ? `<p class="about-loc"><i class="fa-solid fa-location-dot"></i> ${esc(p.location)}</p>` : ''}
      </div>
      <div class="about-copy">
        ${head(s, n)}
        <div class="prose rv">${prose(p.bio)}</div>
        ${highlights.length ? `<div class="highlights rv">${highlights.map((x) => `<div class="hl"><span class="hl-v grad-text">${esc(x.value)}</span><span class="hl-l">${esc(x.label)}</span></div>`).join('')}</div>` : ''}
        ${p.skills?.length ? `<h3 class="mini rv">Skills</h3><ul class="pills rv">${list(p.skills, 'pill')}</ul>` : ''}
        ${p.software?.length ? `<h3 class="mini rv">Software</h3><ul class="pills rv">${list(p.software, 'pill pill-soft')}</ul>` : ''}
      </div>
    </div>
  </section>`;
}

function experienceSection(s, c, n) {
  return `<section class="sec sec-exp" id="${esc(s.id)}" data-sec style="${pairVars(s.colors)}">
    <div class="wrap narrow">${head(s, n)}<div id="expBody"></div></div>
  </section>`;
}

function contactSection(s, c, n) {
  const email = c.profile.email || c.socials.find((x) => x.platform === 'email' && x.url)?.url || '';
  const socials = socialList(c, { skipEmail: !!email });
  return `<section class="sec sec-contact" id="${esc(s.id)}" data-sec style="${pairVars(s.colors)}">
    <div class="wrap">
      <div class="contact-box rv">
        <p class="eyebrow">${String(n).padStart(2, '0')} / ${esc(s.nav || 'Contact')}</p>
        <h2 class="grad-text">${esc(s.title)}</h2>
        ${s.intro ? `<p class="sec-intro">${esc(s.intro)}</p>` : ''}
        ${email ? `<a class="btn btn-primary btn-lg" href="${esc(socialHref({ platform: 'email', url: email }))}" data-track="email"><i class="fa-solid fa-envelope"></i> ${esc(email.replace(/^mailto:/i, ''))}</a>` : ''}
        ${socials.length ? `<div class="social-grid">${socials.map((x) => {
          const p = platformOf(x);
          return `<a class="social" href="${esc(socialHref(x))}" ${x.platform !== 'email' ? 'target="_blank" rel="noopener"' : ''} data-track="${esc(x.platform)}"><i class="${p.icon}"></i><span><b>${esc(p.label)}</b><small>${esc(handleOf(x))}</small></span></a>`;
        }).join('')}</div>` : ''}
      </div>
    </div>
  </section>`;
}

function textSection(s, c, n) {
  const m = parse(s.media);
  const r = ratioOf(s.orientation);
  let media = '';
  if (m) {
    const inner = m.type === 'image' ? `<img class="player" src="${esc(srcUrl(m, 1600))}" alt="" loading="lazy">` : m.type === 'link' ? linkCard(m) : facade(m);
    media = `<div class="text-media rv"><div class="frame" style="--r:${r}">${inner}</div></div>`;
  }
  return `<section class="sec sec-text" id="${esc(s.id)}" data-sec style="${pairVars(s.colors)}">
    <div class="wrap text-grid ${media ? 'has-media' : ''}">
      <div>${head(s, n)}<div class="prose rv">${prose(s.body)}</div>
        ${s.buttonUrl ? `<p class="rv"><a class="btn btn-primary" href="${esc(socialHref({ url: s.buttonUrl }))}" target="_blank" rel="noopener">${esc(s.buttonLabel || 'Learn more')} <i class="fa-solid fa-arrow-right"></i></a></p>` : ''}
      </div>
      ${media}
    </div>
  </section>`;
}

const RENDER = { hero: heroSection, work: workSection, about: aboutSection, experience: experienceSection, contact: contactSection, text: textSection };

/* ---------- work grid ---------- */

function sortProjects(list) {
  return list.map((p, i) => ({ p, i })).sort((x, y) => (y.p.featured ? 1 : 0) - (x.p.featured ? 1 : 0) || x.i - y.i).map((x) => x.p);
}

function cardHTML(p, i) {
  const cat = catOf(p.category);
  const r = ratioOf(p.orientation);
  const first = (p.media || []).map((m) => parse(m.url)).find(Boolean);
  const cover = parse(p.cover);
  const thumbSrc = cover || first || parse(p.compare?.after);
  const t = thumbUrl(thumbSrc, r >= 1 ? 1000 : 640);
  const hasBA = p.compare?.before && p.compare?.after;
  const flag = p.featured ? '<span class="card-flag"><i class="fa-solid fa-star"></i> Featured</span>' : hasBA ? '<span class="card-flag">Breakdown</span>' : '';
  return `<button class="card rv" style="--r:${r};--d:${i % 6};${pairVars(cat?.colors)}" data-open="${esc(p.id)}" aria-label="${esc(p.title)}">
    <span class="thumb ${t ? 'duo' : ''}">${t ? `<img src="${esc(t)}" alt="" loading="lazy" decoding="async">` : `<span class="ph"><i class="${esc(cat?.icon || 'fa-solid fa-star')}"></i></span>`}</span>
    ${flag}
    ${isPlayable(first) ? '<span class="card-play"><i class="fa-solid fa-play"></i></span>' : ''}
    <span class="card-info">
      <span class="card-cat">${esc(cat?.name || '')}</span>
      <span class="card-title">${esc(p.title)}</span>
      ${p.summary ? `<span class="card-sum">${esc(p.summary)}</span>` : ''}
    </span>
  </button>`;
}

function renderWork() {
  const body = $('#workBody');
  if (!body) return;
  const c = state.c;
  const all = published(c);
  let cats = c.categories.filter((cat) => all.some((p) => p.category === cat.id));
  if (FOCUS) cats = [...cats.filter((x) => x.id === FOCUS), ...cats.filter((x) => x.id !== FOCUS)];
  if (state.cat !== 'all' && !cats.some((x) => x.id === state.cat)) state.cat = 'all';
  const cur = cats.find((x) => x.id === state.cat);

  let items = sortProjects(state.cat === 'all' ? all : all.filter((p) => p.category === state.cat));
  const hasPortrait = items.some((p) => ratioOf(p.orientation) < 0.95);
  const hasLandscape = items.some((p) => ratioOf(p.orientation) > 1.05);
  const showOrient = hasPortrait && hasLandscape;
  if (!showOrient) state.orient = 'all';
  if (state.orient === 'landscape') items = items.filter((p) => ratioOf(p.orientation) > 1.05);
  if (state.orient === 'portrait') items = items.filter((p) => ratioOf(p.orientation) < 0.95);
  state.list = items;

  const tab = (id, label, count, icon, colors) =>
    `<button class="tab" role="tab" aria-selected="${state.cat === id}" data-cat="${esc(id)}" style="${pairVars(colors)}">${icon ? `<i class="${esc(icon)}"></i>` : ''}${esc(label)}<span class="count">${count}</span></button>`;
  const chip = (id, label, icon) =>
    `<button class="chip" aria-pressed="${state.orient === id}" data-orient="${id}">${icon ? `<i class="${icon}"></i>` : ''}${label}</button>`;

  body.innerHTML = `
    ${cats.length > 1 ? `<div class="tabs" role="tablist" aria-label="Categories">${tab('all', 'All', all.length)}${cats.map((x) => tab(x.id, x.name, all.filter((p) => p.category === x.id).length, x.icon, x.colors)).join('')}</div>` : ''}
    <div class="work-sub">
      <p class="cat-blurb">${esc(cur?.blurb || '')}</p>
      ${showOrient ? `<div class="chips" aria-label="Orientation">${chip('all', 'All')}${chip('landscape', 'Landscape', 'fa-solid fa-tv')}${chip('portrait', 'Portrait', 'fa-solid fa-mobile-screen')}</div>` : ''}
    </div>
    ${items.length ? `<div class="jgrid">${items.map(cardHTML).join('')}</div>` : '<p class="empty">Nothing here yet.</p>'}`;

  // The work section takes the selected category's colours (if it has its own pair).
  const sec = body.closest('[data-sec]');
  const own = state.c.sections.find((x) => x.id === sec.id)?.colors;
  const pair = cur?.colors?.a ? cur.colors : own?.a ? own : null;
  if (pair) { sec.style.setProperty('--a', pair.a); sec.style.setProperty('--b', pair.b); }
  else { sec.style.removeProperty('--a'); sec.style.removeProperty('--b'); }
  if (sec.classList.contains('is-current')) setCurrent(sec);
  layoutGrid();
  reveal(body);
}

// Justified rows: pack cards into rows near a target height, then scale each row to fill the width.
function layoutGrid() {
  const grid = $('.jgrid');
  if (!grid) return;
  const W = grid.clientWidth;
  if (!W) return;
  const gap = parseFloat(getComputedStyle(grid).columnGap) || 14;
  const target = W < 640 ? 240 : Math.max(200, Math.min(300, W * 0.24));
  const cards = $$('.card', grid).map((el) => ({ el, r: parseFloat(el.style.getPropertyValue('--r')) || 1.7778 }));
  const size = (row, h) => row.forEach(({ el, r }) => {
    const w = Math.max(0, h * r - 0.5);
    el.style.width = `${w}px`;
    el.classList.toggle('is-narrow', w < 175);
  });
  const heightFor = (row) => (W - gap * (row.length - 1)) / row.reduce((s, x) => s + x.r, 0);
  let row = [];
  for (const card of cards) {
    const next = [...row, card];
    const hNext = heightFor(next);
    if (hNext > target) { row = next; continue; }
    // Row is full: keep the card here or push it to the next row, whichever lands closer to the target height.
    const hNow = row.length ? heightFor(row) : Infinity;
    if (row.length && hNow <= target * 1.4 && Math.abs(hNow - target) < Math.abs(hNext - target)) {
      size(row, hNow);
      row = [card];
    } else {
      size(next, hNext);
      row = [];
    }
  }
  if (row.length) size(row, Math.min(target, heightFor(row)));
}

let gridRO;
function watchGrid() {
  if (gridRO || !('ResizeObserver' in window)) return;
  let lastW = 0;
  gridRO = new ResizeObserver(() => {
    const w = $('#workBody')?.clientWidth || 0;
    if (w !== lastW) { lastW = w; layoutGrid(); }
  });
  const body = $('#workBody');
  if (body) gridRO.observe(body);
}

/* ---------- experience ---------- */

function renderExperience() {
  const body = $('#expBody');
  if (!body) return;
  const key = (e) => (e.current ? '9999-99' : e.end || e.start || '');
  const items = [...state.c.experience].filter((e) => e.title).sort((a, b) => key(b).localeCompare(key(a)) || String(b.start).localeCompare(String(a.start)));
  const kinds = [...new Set(items.map((e) => e.kind).filter(Boolean))];
  if (!kinds.includes(state.kind)) state.kind = 'all';
  const shown = state.kind === 'all' ? items : items.filter((e) => e.kind === state.kind);
  body.innerHTML = `
    ${kinds.length > 1 ? `<div class="chips exp-chips"><button class="chip" aria-pressed="${state.kind === 'all'}" data-kind="all">All</button>${kinds.map((k) => `<button class="chip" aria-pressed="${state.kind === k}" data-kind="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}
    <ol class="timeline">${shown.map((e, i) => `
      <li class="tl-item rv" style="--d:${i % 4}">
        <span class="tl-dot"></span>
        <div class="tl-card">
          <div class="tl-top">${e.kind ? `<span class="tl-kind">${esc(e.kind)}</span>` : ''}<span class="tl-date">${esc(fmtRange(e.start, e.end, e.current))}</span></div>
          <h3>${esc(e.title)}</h3>
          ${e.org || e.location ? `<p class="tl-org">${esc([e.org, e.location].filter(Boolean).join(' · '))}</p>` : ''}
          ${e.description ? `<div class="prose">${prose(e.description)}</div>` : ''}
          ${e.link ? `<a class="tl-link" href="${esc(socialHref({ url: e.link }))}" target="_blank" rel="noopener">View <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
        </div>
      </li>`).join('')}</ol>`;
  reveal(body);
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
        <span class="ba-line"></span><span class="ba-knob"><i class="fa-solid fa-left-right"></i></span>
        <span class="ba-label l">${esc(sl.lb)}</span><span class="ba-label r">${esc(sl.la)}</span>
      </div></div>`;
  }
  if (sl.kind === 'empty') {
    return `<div class="m-frame" style="--r:${r}"><span class="ph"><i class="${esc(catOf(p.category)?.icon || 'fa-solid fa-star')}"></i></span></div>`;
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
    document.documentElement.classList.add('modal-open');
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
        <button class="m-arrow prev" data-slide="-1" aria-label="Previous media"><i class="fa-solid fa-chevron-left"></i></button>
        <button class="m-arrow next" data-slide="1" aria-label="Next media"><i class="fa-solid fa-chevron-right"></i></button>
        <div class="m-dots">${slides.map((_, i) => `<button class="m-dot" aria-label="Media ${i + 1}" aria-current="${i === state.slide}" data-goto="${i}"></button>`).join('')}</div>` : ''}
    </div>
    <div class="m-body">
      <p class="eyebrow">${cat ? `<i class="${esc(cat.icon)}"></i> ${esc(cat.name)}` : 'Project'}</p>
      <h2 id="mTitle">${esc(p.title)}</h2>
      <div class="m-meta">
        ${p.role ? `<span><i class="fa-solid fa-user-pen"></i>${esc(p.role)}</span>` : ''}
        ${p.client ? `<span><i class="fa-solid fa-briefcase"></i>${esc(p.client)}</span>` : ''}
        ${p.date ? `<span><i class="fa-regular fa-calendar"></i>${esc(fmtMonth(p.date))}</span>` : ''}
      </div>
      ${p.tools?.length ? `<ul class="pills">${p.tools.map((t) => `<li class="pill pill-soft">${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="prose">${prose(p.description || p.summary)}</div>
      <div class="m-actions">
        ${links.map((l) => `<a class="btn" href="${esc(socialHref({ url: l.url }))}" target="_blank" rel="noopener">${esc(l.label || 'Open link')} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`).join('')}
        <button class="btn" data-share><i class="fa-solid fa-share-nodes"></i> Share</button>
      </div>
      ${state.list.length > 1 ? `<div class="m-nav">
        <button class="m-navbtn" data-mnav="-1"><i class="fa-solid fa-arrow-left"></i> Previous</button>
        <span class="m-count">${String(idx + 1).padStart(2, '0')} / ${String(state.list.length).padStart(2, '0')}</span>
        <button class="m-navbtn" data-mnav="1">Next <i class="fa-solid fa-arrow-right"></i></button>
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
  document.documentElement.classList.remove('modal-open');
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

function wireBA(root) {
  for (const ba of $$('.ba', root)) {
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

/* ---------- nav, observers, effects ---------- */

function renderNav(c) {
  const p = c.profile;
  $('#brandMark').textContent = p.shortName || initials(p.name);
  $('#brandName').textContent = p.name;
  $('#navLinks').innerHTML = visibleSections(c).filter((s) => s.type !== 'hero')
    .map((s) => `<a href="#${esc(s.id)}" data-nav="${esc(s.id)}">${esc(s.nav || s.title)}</a>`).join('');
}

function renderFooter(c) {
  const p = c.profile;
  $('#foot').innerHTML = `<div class="wrap">
    <span>© ${new Date().getFullYear()} ${esc(p.name)}</span>
    <span class="foot-socials">${socialIcons(c)}</span>
    <a href="#top" class="foot-top">Back to top <i class="fa-solid fa-arrow-up"></i></a>
  </div>`;
}

function setCurrent(sec) {
  const cs = getComputedStyle(sec);
  const a = cs.getPropertyValue('--a').trim();
  const b = cs.getPropertyValue('--b').trim();
  if (a) document.body.style.setProperty('--cur-a', a);
  if (b) document.body.style.setProperty('--cur-b', b);
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

let revealIO;
function reveal(root = document) {
  const els = $$('.rv:not(.in)', root);
  if (PREVIEW || REDUCED || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  revealIO ||= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
  els.forEach((el) => revealIO.observe(el));
}

function startEffects() {
  state.timers.forEach(clearInterval);
  state.timers = [];
  const rot = $('.rotator');
  if (rot && !REDUCED) {
    const tags = JSON.parse(rot.dataset.tags || '[]');
    let i = 0;
    if (tags.length > 1) {
      state.timers.push(setInterval(() => {
        rot.classList.add('out');
        setTimeout(() => { i = (i + 1) % tags.length; rot.textContent = tags[i]; rot.classList.remove('out'); }, 380);
      }, 3200));
    }
  }
  const tc = $('#timecode');
  if (tc && !REDUCED) {
    const t0 = performance.now();
    const pad = (n) => String(n).padStart(2, '0');
    state.timers.push(setInterval(() => {
      const f = Math.floor(((performance.now() - t0) / 1000) * 25);
      tc.textContent = `${pad(Math.floor(f / 90000))}:${pad(Math.floor(f / 1500) % 60)}:${pad(Math.floor(f / 25) % 60)}:${pad(f % 25)}`;
    }, 40));
  }
}

function wireGlobal() {
  const nav = $('#nav');
  const toggle = $('#navToggle');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('menu-open', open);
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));

  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (matchMedia('(pointer: fine)').matches && !REDUCED) {
    const glow = $('.cursor-glow');
    let raf = 0;
    addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { glow.style.setProperty('--mx', `${e.clientX}px`); glow.style.setProperty('--my', `${e.clientY}px`); });
    }, { passive: true });
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { requestClose(); return; }
    const t = e.target.closest('a, button');
    if (!t) return;
    if (t.closest('#navLinks') || t.classList.contains('brand')) setMenu(false);
    if (t.dataset.track) trackClick(t.dataset.track);
    if (t.dataset.open) { openProject(t.dataset.open); return; }
    if (t.dataset.cat) { state.cat = t.dataset.cat; state.orient = 'all'; renderWork(); return; }
    if (t.dataset.orient) { state.orient = t.dataset.orient; renderWork(); return; }
    if (t.dataset.kind) { state.kind = t.dataset.kind; renderExperience(); return; }
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
      t.innerHTML = `<i class="fa-solid ${v.muted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>`;
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
    if (!modal.hidden && !e.target.closest('input, textarea, .ba')) {
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
  renderNav(c);
  let n = 0;
  app.innerHTML = visibleSections(c).map((s) => {
    const fn = RENDER[s.type];
    if (!fn) return '';
    if (s.type !== 'hero') n += 1;
    return fn(s, c, n);
  }).join('');
  renderWork();
  gridRO?.disconnect();
  gridRO = null;
  watchGrid();
  renderExperience();
  renderFooter(c);
  reveal(app);
  observeSections();
  startEffects();
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
      if (FOCUS && $('#workBody')) $('#workBody').closest('[data-sec]').scrollIntoView({ behavior: 'instant' });
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
