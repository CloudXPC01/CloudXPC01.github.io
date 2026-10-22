// One function per admin tab. Each returns an Element bound to the draft content.
import { h, uid, slug, ORIENT } from '../dom.js';
import { parse, thumbUrl } from '../media.js';
import { FONTS } from '../theme.js';
import { PLATFORMS } from '../platforms.js';
import { card, note, text, area, lines, toggle, select, month, color, range, tags, media, mediaList, colorPair, list, icon, changed, toast } from './forms.js';

let rulesText;
export const loadRules = () => (rulesText ||= fetch(new URL('../../../firestore.rules', import.meta.url)).then((r) => r.text()).then((t) => t.replace(/^(\/\/.*\n)+/, '')));

const ORIENT_OPTS = Object.entries(ORIENT).map(([k, v]) => [k, v.label]);

const CAT_ICONS = [
  ['fa-solid fa-wand-magic-sparkles', 'Magic wand (VFX)'], ['fa-solid fa-film', 'Film'], ['fa-solid fa-video', 'Camera'],
  ['fa-solid fa-clapperboard', 'Clapperboard'], ['fa-solid fa-scissors', 'Scissors (edit)'], ['fa-solid fa-pen-nib', 'Pen nib (design)'],
  ['fa-solid fa-palette', 'Palette'], ['fa-solid fa-image', 'Image'], ['fa-solid fa-camera', 'Photo camera'], ['fa-solid fa-cube', 'Cube (3D)'],
  ['fa-solid fa-cubes', 'Cubes'], ['fa-solid fa-person-running', 'Animation'], ['fa-solid fa-gamepad', 'Gamepad'], ['fa-solid fa-dice-d20', 'Dice'],
  ['fa-solid fa-music', 'Music'], ['fa-solid fa-microphone', 'Microphone'], ['fa-solid fa-code', 'Code'], ['fa-solid fa-star', 'Star'],
  ['fa-solid fa-bolt', 'Bolt'], ['fa-solid fa-layer-group', 'Layers'],
];

const KINDS = ['Work', 'Internship', 'Freelance', 'Volunteering', 'Education', 'Achievement', 'Leadership', 'Workshop'];

const projThumb = (p) => thumbUrl(parse(p.cover) || (p.media || []).map((m) => parse(m.url)).find(Boolean) || parse(p.compare?.after), 200);

/* ---------- Profile ---------- */
export function profileTab(ctx) {
  const p = ctx.draft.profile;
  p.availability ||= { show: false, text: '' };
  p.highlights ||= [];
  return h('div', { class: 'stack' },
    card('Identity',
      h('div', { class: 'grid' },
        text(p, 'name', { label: 'Your name' }),
        text(p, 'shortName', { label: 'Initials for the logo', help: '1–3 letters, e.g. AK', placeholder: 'AK' }),
        text(p, 'role', { label: 'Role line', help: 'Shown under your name', cls: 'f-wide' }),
        text(p, 'location', { label: 'Location' }),
        text(p, 'email', { label: 'Contact email', type: 'email', help: 'Shown as the big button in Contact' }),
      ),
      h('div', { class: 'grid' },
        toggle(p.availability, 'show', { label: 'Show availability badge', help: 'The glowing pill above your name' }),
        text(p.availability, 'text', { label: 'Badge text', placeholder: 'Open to VFX internships' }),
      )),
    card('Hero',
      h('div', { class: 'grid' },
        lines(p, 'taglines', { label: 'Rotating taglines', help: 'One per line. They cycle under your role.' }),
        media(p, 'showreel', { label: 'Showreel', help: 'YouTube/Vimeo link, or upload a short MP4 (plays muted on loop on desktop). Leave empty for the animated logo.' }),
        text(p, 'showreelCaption', { label: 'Showreel caption', placeholder: 'Showreel 2026' }),
        media(p, 'resume', { label: 'Résumé (PDF)', accept: 'application/pdf', placeholder: 'Paste a Google Drive link to your PDF, or upload', help: 'Shows a “Résumé” button. Google Drive: set sharing to “Anyone with the link”.' }),
      )),
    card('About',
      h('div', { class: 'grid' },
        media(p, 'photo', { label: 'Photo', accept: 'image/*', help: 'Portrait crop (4:5) looks best.' }),
        area(p, 'bio', { label: 'Bio', rows: 6, help: 'Blank line = new paragraph. Start a line with “- ” for a bullet. **bold** and [link](https://…) work.' }),
        tags(p, 'skills', { label: 'Skills' }),
        tags(p, 'software', { label: 'Software' }),
      ),
      h('div', { class: 'f f-wide' }, h('span', { class: 'f-label' }, 'Highlight numbers'), h('span', { class: 'f-help' }, 'Small stat boxes in About, e.g. “30+ / Edits delivered”.'),
        list(p.highlights, {
          title: (x) => [x.value, x.label].filter(Boolean).join('  ·  '),
          body: (x) => h('div', { class: 'grid' }, text(x, 'value', { label: 'Number / short text', placeholder: '30+' }), text(x, 'label', { label: 'Label', placeholder: 'Edits delivered' })),
          create: () => ({ value: '', label: '' }),
          addLabel: 'Add highlight',
        }))));
}

/* ---------- Work ---------- */
export function workTab(ctx) {
  const d = ctx.draft;
  const view = ctx.view.work ||= { cat: 'all', q: '' };
  const catName = (id) => d.categories.find((c) => c.id === id)?.name || 'No category';
  const catOptions = () => d.categories.map((c) => [c.id, c.name]);

  const projectBody = (p) => {
    p.media ||= [];
    p.links ||= [];
    p.tools ||= [];
    p.compare ||= { before: '', after: '', labelBefore: 'Before', labelAfter: 'After' };
    const autoOrient = (res) => {
      if (!res?.width || !res?.height || p.media.length > 1) return;
      const r = res.width / res.height;
      const best = Object.entries(ORIENT).sort((a, b) => Math.abs(a[1].r - r) - Math.abs(b[1].r - r))[0][0];
      if (best !== p.orientation) { p.orientation = best; toast(`Shape set to ${ORIENT[best].label}`); ctx.rerender(); }
    };
    const baBox = h('div', { class: 'grid' });
    const drawBA = () => {
      baBox.replaceChildren(...(p.compare.on ? [
        media(p.compare, 'before', { label: 'Before (plate / raw)' }),
        media(p.compare, 'after', { label: 'After (final comp)' }),
        text(p.compare, 'labelBefore', { label: 'Before label', placeholder: 'Plate' }),
        text(p.compare, 'labelAfter', { label: 'After label', placeholder: 'Final' }),
        note('Use two images or two uploaded videos of the same shot and size. Videos play in sync.', 'f-wide'),
      ] : []));
    };
    p.compare.on ??= !!(p.compare.before || p.compare.after);
    drawBA();
    return h('div', { class: 'stack-sm' },
      h('div', { class: 'grid' },
        text(p, 'title', { label: 'Title', cls: 'f-wide' }),
        select(p, 'category', { label: 'Category', options: catOptions() }),
        select(p, 'orientation', { label: 'Shape', options: ORIENT_OPTS, help: 'Set automatically when you upload' }),
        text(p, 'summary', { label: 'One-line summary', help: 'Shown on the card when hovered', cls: 'f-wide' }),
        area(p, 'description', { label: 'Description', rows: 4, help: '“- ” starts a bullet. **bold** works.' }),
      ),
      mediaList(p.media, { label: 'Media', help: 'Uploads, YouTube / Shorts, Vimeo, Instagram reels, Drive, Sketchfab, itch.io embeds. The first one is the main thumbnail.', onMedia: autoOrient }),
      h('div', { class: 'grid' },
        media(p, 'cover', { label: 'Cover image (optional)', accept: 'image/*', help: 'Overrides the thumbnail. Needed for Instagram, Sketchfab and itch.io, which have no thumbnail.' }),
        toggle(p.compare, 'on', { label: 'Before / after slider', help: 'Great for VFX breakdowns', onChange: drawBA }),
      ),
      baBox,
      h('div', { class: 'grid' },
        text(p, 'role', { label: 'Your role', placeholder: 'Compositing, tracking' }),
        text(p, 'client', { label: 'Client / context', placeholder: 'College assignment, Brand X…' }),
        month(p, 'date', { label: 'Date' }),
        tags(p, 'tools', { label: 'Tools used' }),
      ),
      h('div', { class: 'f f-wide' }, h('span', { class: 'f-label' }, 'Buttons / links'),
        list(p.links, {
          title: (l) => l.label || l.url || 'New link',
          body: (l) => h('div', { class: 'grid' }, text(l, 'label', { label: 'Button text', placeholder: 'Watch on YouTube' }), text(l, 'url', { label: 'Link', placeholder: 'https://…' })),
          create: () => ({ label: '', url: '' }),
          addLabel: 'Add link',
        })),
      h('div', { class: 'grid' },
        toggle(p, 'featured', { label: 'Featured', help: 'Shown first, with a star' }),
        toggle(p, 'published', { label: 'Published', help: 'Off = hidden draft' })));
  };

  const projects = list(d.projects, {
    title: (p) => p.title,
    sub: (p) => [catName(p.category), ORIENT[p.orientation]?.label.split(' ')[0], p.featured ? '★ Featured' : '', p.published === false ? 'Draft' : ''].filter(Boolean).join(' · '),
    thumb: projThumb,
    icon: (p) => d.categories.find((c) => c.id === p.category)?.icon || 'fa-image',
    dim: (p) => p.published === false,
    body: projectBody,
    filter: (p) => (view.cat === 'all' || p.category === view.cat) && (!view.q || `${p.title} ${p.summary} ${(p.tools || []).join(' ')}`.toLowerCase().includes(view.q.toLowerCase())),
    duplicate: (p) => ({ ...JSON.parse(JSON.stringify(p)), id: uid('p'), title: `${p.title} (copy)` }),
    create: () => ({
      id: uid('p'), title: 'New project', category: view.cat !== 'all' ? view.cat : d.categories[0]?.id || '', orientation: 'landscape',
      summary: '', description: '', role: '', client: '', tools: [], date: new Date().toISOString().slice(0, 7), cover: '', media: [],
      compare: { before: '', after: '', labelBefore: 'Before', labelAfter: 'After' }, links: [], featured: false, published: true,
    }),
    addToTop: true,
    addLabel: 'Add project',
    empty: 'No projects match.',
  });

  const filterSel = h('select', { onchange: (e) => { view.cat = e.target.value; projects.refresh(); } },
    h('option', { value: 'all', selected: view.cat === 'all' }, `All categories (${d.projects.length})`),
    d.categories.map((c) => h('option', { value: c.id, selected: view.cat === c.id }, `${c.name} (${d.projects.filter((p) => p.category === c.id).length})`)));
  const search = h('input', { type: 'search', placeholder: 'Search projects', value: view.q, oninput: (e) => { view.q = e.target.value; projects.refresh(); } });

  return h('div', { class: 'stack' },
    note('Tap a project to edit it. Drag the <i class="fa-solid fa-grip-vertical"></i> handle or use the arrows to change the order on the site.'),
    h('div', { class: 'toolbar' }, filterSel, search),
    projects);
}

/* ---------- Categories & sections ---------- */
export function categoriesTab(ctx) {
  const d = ctx.draft;
  return h('div', { class: 'stack' },
    note('Categories are the tabs in your Work section. Empty categories are hidden on the site. Colours for each category are in the Theme tab.'),
    list(d.categories, {
      title: (c) => c.name,
      sub: (c) => `${d.projects.filter((p) => p.category === c.id).length} projects · link: ?focus=${c.id}`,
      thumb: () => '',
      icon: (c) => c.icon,
      canRemove: (c) => {
        const n = d.projects.filter((p) => p.category === c.id).length;
        return n ? `Move or delete its ${n} project${n > 1 ? 's' : ''} first.` : true;
      },
      body: (c) => h('div', { class: 'grid' },
        text(c, 'name', { label: 'Name' }),
        select(c, 'icon', { label: 'Icon', options: CAT_ICONS }),
        text(c, 'blurb', { label: 'Short description', cls: 'f-wide', help: 'Shown when the tab is selected' })),
      create: () => {
        const name = prompt('Category name?', 'Photography');
        if (!name) return null;
        let id = slug(name) || uid('cat');
        while (d.categories.some((c) => c.id === id)) id = `${id}-2`;
        return { id, name, icon: 'fa-solid fa-star', blurb: '', colors: null };
      },
      addLabel: 'Add category',
    }));
}

export function sectionsTab(ctx) {
  const d = ctx.draft;
  const TYPE_LABEL = { hero: 'Top banner (hero)', work: 'Work grid', about: 'About', experience: 'Experience timeline', contact: 'Contact', text: 'Custom text section' };
  return h('div', { class: 'stack' },
    note('Turn sections on or off and set their order. The top banner always comes first if it is on. Add custom sections for awards, services, a client list, anything.'),
    list(d.sections, {
      title: (s) => (s.type === 'hero' ? 'Top banner' : s.title || s.nav),
      sub: (s) => `${TYPE_LABEL[s.type] || s.type}${s.visible === false ? ' · hidden' : ''}`,
      thumb: () => '',
      icon: (s) => ({ hero: 'fa-house', work: 'fa-table-cells-large', about: 'fa-user', experience: 'fa-timeline', contact: 'fa-envelope', text: 'fa-align-left' })[s.type] || 'fa-square',
      dim: (s) => s.visible === false,
      canRemove: (s) => (s.type === 'text' ? true : 'Built-in sections can be hidden but not deleted.'),
      body: (s) => {
        s.visible ??= true;
        const kids = [toggle(s, 'visible', { label: 'Show this section' })];
        if (s.type !== 'hero') {
          kids.push(
            text(s, 'nav', { label: 'Menu label', help: 'Short word in the top menu' }),
            text(s, 'title', { label: 'Heading' }),
          );
        }
        if (['work', 'experience', 'contact', 'text'].includes(s.type)) kids.push(area(s, 'intro', { label: 'Intro line', rows: 2 }));
        if (s.type === 'text') {
          kids.push(
            area(s, 'body', { label: 'Text', rows: 6, help: '“- ” starts a bullet. **bold** and [links](https://…) work.' }),
            media(s, 'media', { label: 'Image / video (optional)' }),
            select(s, 'orientation', { label: 'Media shape', options: ORIENT_OPTS }),
            text(s, 'buttonLabel', { label: 'Button text (optional)' }),
            text(s, 'buttonUrl', { label: 'Button link' }),
          );
        }
        return h('div', { class: 'grid' }, kids);
      },
      create: () => ({ id: uid('sec'), type: 'text', nav: 'Awards', title: 'Awards & features', intro: '', body: '', media: '', orientation: 'landscape', buttonLabel: '', buttonUrl: '', visible: true, colors: null }),
      addLabel: 'Add custom section',
    }));
}

/* ---------- Experience ---------- */
export function experienceTab(ctx) {
  const d = ctx.draft;
  const dl = h('datalist', { id: 'kinds' }, KINDS.map((k) => h('option', { value: k })));
  return h('div', { class: 'stack' },
    note('The site sorts entries newest first automatically. The type becomes a filter chip (Work, Volunteering…).'),
    dl,
    list(d.experience, {
      title: (e) => e.title,
      sub: (e) => [e.kind, e.org, e.current ? 'Present' : e.end || e.start].filter(Boolean).join(' · '),
      thumb: () => '',
      icon: (e) => ({ Work: 'fa-briefcase', Internship: 'fa-briefcase', Freelance: 'fa-laptop', Volunteering: 'fa-hand-holding-heart', Education: 'fa-graduation-cap', Achievement: 'fa-trophy' })[e.kind] || 'fa-circle-dot',
      body: (e) => {
        const kind = text(e, 'kind', { label: 'Type', help: 'Pick or type your own' });
        kind.querySelector('input').setAttribute('list', 'kinds');
        return h('div', { class: 'grid' },
          kind,
          text(e, 'title', { label: 'Title / role' }),
          text(e, 'org', { label: 'Organisation' }),
          text(e, 'location', { label: 'Location' }),
          month(e, 'start', { label: 'Start' }),
          month(e, 'end', { label: 'End' }),
          toggle(e, 'current', { label: 'I still do this', help: 'Shows “Present”' }),
          area(e, 'description', { label: 'What you did', rows: 4, help: 'Start lines with “- ” for bullets.' }),
          text(e, 'link', { label: 'Link (optional)', placeholder: 'Certificate, article, project…', cls: 'f-wide' }));
      },
      create: () => ({ id: uid('e'), kind: 'Work', title: 'New role', org: '', location: '', start: new Date().toISOString().slice(0, 7), end: '', current: false, description: '', link: '' }),
      addToTop: true,
      addLabel: 'Add experience',
    }));
}

/* ---------- Socials ---------- */
export function socialsTab(ctx) {
  const d = ctx.draft;
  const hint = { email: 'you@example.com', whatsapp: '+91 98765 43210', instagram: 'https://instagram.com/yourhandle', linkedin: 'https://linkedin.com/in/yourname', youtube: 'https://youtube.com/@yourchannel' };
  return h('div', { class: 'stack' },
    note('Links with an empty address are hidden. They appear in the top banner, the Contact section and the footer, in this order.'),
    list(d.socials, {
      title: (s) => PLATFORMS[s.platform]?.label || 'Link',
      sub: (s) => s.url || 'empty (hidden)',
      thumb: () => '',
      icon: (s) => PLATFORMS[s.platform]?.icon || 'fa-link',
      dim: (s) => !s.url,
      body: (s) => h('div', { class: 'grid' },
        select(s, 'platform', { label: 'Platform', options: Object.entries(PLATFORMS).map(([k, v]) => [k, v.label]) }),
        text(s, 'url', { label: 'Address', placeholder: hint[s.platform] || 'https://…' }),
        text(s, 'label', { label: 'Display text (optional)', help: 'Defaults to your @handle', cls: 'f-wide' })),
      create: () => ({ platform: 'website', url: '', label: '' }),
      addLabel: 'Add link',
    }));
}

/* ---------- Theme ---------- */
export function themeTab(ctx) {
  const t = ctx.draft.theme;
  t.presets ||= [];
  const base = () => ({ a: t.a, b: t.b });
  const presetBox = h('div', { class: 'presets' });
  const pairsBox = h('div', { class: 'pairs' });
  let mainColors;
  const drawPresets = () => {
    presetBox.replaceChildren(...t.presets.map((p, i) => h('div', { class: 'preset' },
      h('button', { type: 'button', class: 'preset-btn', style: `--pa:${p.a};--pb:${p.b}`, title: `Use ${p.name}`,
        onclick: () => { t.a = p.a; t.b = p.b; redraw(); changed(); } }, h('span', { class: 'preset-sw' }), p.name),
      h('button', { type: 'button', class: 'icon preset-x', 'aria-label': `Delete preset ${p.name}`,
        onclick: () => { if (confirm(`Delete preset “${p.name}”?`)) { t.presets.splice(i, 1); drawPresets(); changed(); } } }, icon('fa-xmark')))),
    h('button', { type: 'button', class: 'btn sm ghost', onclick: () => {
      const name = prompt('Name this colour pair', 'My colours');
      if (!name) return;
      t.presets.push({ name, a: t.a, b: t.b });
      drawPresets();
      changed();
    } }, icon('fa-plus'), 'Save current as preset'));
  };
  const drawMain = () => {
    const box = h('div', { class: 'grid grid-3' },
      color(t, 'a', { label: 'Colour A (main glow)', onChange: drawPairs }),
      color(t, 'b', { label: 'Colour B (second tone)', onChange: drawPairs }),
      color(t, 'bg', { label: 'Background' }));
    mainColors ? mainColors.replaceWith(box) : null;
    mainColors = box;
    return box;
  };
  function drawPairs() {
    const rows = [
      h('h4', { class: 'pairs-h' }, 'Sections'),
      ...ctx.draft.sections.map((s) => colorPair(s, 'colors', { label: s.type === 'hero' ? 'Top banner' : s.title || s.nav, base })),
      h('h4', { class: 'pairs-h' }, 'Work categories'),
      ...ctx.draft.categories.map((c) => colorPair(c, 'colors', { label: c.name, base })),
    ];
    pairsBox.replaceChildren(...rows);
  }
  const redraw = () => { drawMain(); drawPairs(); };
  drawPresets();
  drawPairs();
  return h('div', { class: 'stack' },
    h('div', { class: 'callout' }, icon('fa-eye'), h('span', {}, 'Open the live preview to see colour changes as you make them.'),
      h('button', { type: 'button', class: 'btn sm', onclick: ctx.openPreview }, 'Live preview')),
    card('Colour presets', note('Tap a preset to use it as your main pair.'), presetBox),
    card('Main colours', drawMain(),
      range(t, 'glow', { label: 'Glow strength', min: 0, max: 2, step: 0.1, format: (v) => (v === 0 ? 'Off' : `${Math.round(v * 100)}%`) }),
      select(t, 'font', { label: 'Heading font', options: Object.entries(FONTS).map(([k, v]) => [k, v.label]) })),
    card('Effects', h('div', { class: 'grid' },
      toggle(t, 'duotone', { label: 'Duotone thumbnails', help: 'Images tinted in your two colours, full colour on hover' }),
      toggle(t, 'grain', { label: 'Film grain', help: 'Subtle animated noise' }),
      toggle(t, 'grid', { label: 'Grid lines', help: 'Faint viewport grid at the top' }),
      toggle(t, 'cursorGlow', { label: 'Cursor glow', help: 'A soft light that follows the mouse on PC' }))),
    card('Colours per section', note('Each section and category can keep the main pair or use its own. The page glow fades between them as visitors scroll.'), pairsBox));
}

/* ---------- Settings ---------- */
export function settingsTab(ctx) {
  const d = ctx.draft;
  const priv = ctx.priv;
  const site = new URL('../', location.href).href;
  const copyRow = (label, url) => h('div', { class: 'copy-row' },
    h('span', { class: 'copy-label' }, label),
    h('code', {}, url),
    h('button', { type: 'button', class: 'btn sm ghost', onclick: async () => { try { await navigator.clipboard.writeText(url); toast('Copied'); } catch { prompt('Copy this link', url); } } }, icon('fa-copy'), 'Copy'));

  const ownerToggle = { on: localStorage.getItem('pf_owner') !== '0' };
  const rulesBox = h('pre', { class: 'code' }, 'Loading…');
  let rules = '';
  loadRules().then((t) => { rules = t.replace('YOUR_EMAIL@gmail.com', ctx.user?.email || 'YOUR_EMAIL@gmail.com'); rulesBox.textContent = rules; });

  const restore = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.profile || !Array.isArray(data.projects)) throw new Error('This is not a portfolio backup file.');
      if (confirm('Replace everything in the editor with this backup? You can still Discard before saving.')) ctx.replaceDraft(data);
    } catch (err) { toast(err.message, 'bad'); }
    e.target.value = '';
  } });

  return h('div', { class: 'stack' },
    card('Uploads (Cloudinary)',
      note(`Free Cloudinary account → <b>Settings › Upload › Upload presets › Add</b>, set <b>Signing mode: Unsigned</b> and folder <code>portfolio</code>. Paste the details below and press <b>Save</b>. Limits: images and PDFs 10 MB, videos 100 MB.`),
      h('div', { class: 'grid' },
        text(priv, 'cloudName', { label: 'Cloud name', placeholder: 'e.g. dxyz123ab' }),
        text(priv, 'uploadPreset', { label: 'Upload preset name', placeholder: 'e.g. portfolio_unsigned' }))),
    card('Search & sharing',
      h('div', { class: 'grid' },
        text(d.seo, 'title', { label: 'Browser tab title', cls: 'f-wide' }),
        area(d.seo, 'description', { label: 'Description (for search engines)', rows: 2 }))),
    card('Share links',
      note('Send recruiters straight to a category. Adding <code>?ref=instagram</code> etc. lets the dashboard know where a visit came from.'),
      copyRow('Portfolio', site),
      ...d.categories.map((c) => copyRow(`${c.name} first`, `${site}?focus=${c.id}`)),
      copyRow('For Instagram bio', `${site}?ref=instagram`),
      copyRow('For LinkedIn', `${site}?ref=linkedin`)),
    card('Your visits',
      toggle(ownerToggle, 'on', { label: 'Don’t count my own visits on this device', help: 'Turn this on in every browser/phone you use to look at your site.',
        onChange: (v) => { localStorage.setItem('pf_owner', v ? '1' : '0'); } })),
    card('Backup',
      note('Download a copy of all your content. Restore it any time (then press Save).'),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn', onclick: () => {
          const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json` });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } }, icon('fa-download'), 'Download backup'),
        h('button', { type: 'button', class: 'btn', onclick: () => restore.click() }, icon('fa-upload'), 'Restore from file'),
        restore,
        h('button', { type: 'button', class: 'btn danger', onclick: async () => {
          if (confirm('Replace everything with the starter content? (Nothing is lost until you press Save.)')) ctx.replaceDraft(await ctx.defaults());
        } }, icon('fa-rotate-left'), 'Reset to starter content'))),
    card('Database rules',
      note('Paste these in <b>Firebase console › Firestore Database › Rules</b> and press <b>Publish</b>. Your email is already filled in.'),
      rulesBox,
      h('button', { type: 'button', class: 'btn sm', onclick: async () => { try { await navigator.clipboard.writeText(rules); toast('Rules copied'); } catch { prompt('Copy the rules', rules); } } }, icon('fa-copy'), 'Copy rules')),
    ctx.user ? card('Account',
      h('p', { class: 'muted' }, 'Signed in as ', h('b', {}, ctx.user.email)),
      h('button', { type: 'button', class: 'btn', onclick: ctx.signOut }, icon('fa-right-from-bracket'), 'Sign out')) : null);
}
