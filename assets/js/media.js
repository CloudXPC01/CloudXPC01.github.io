// Turns any pasted link (or <iframe> embed code) into something the site can show:
// YouTube / Shorts, Vimeo, Instagram, Google Drive, Sketchfab, itch.io, Cloudinary uploads,
// plain image/video files, or a fallback "open link" card.
import { esc } from './dom.js';

const IMG = /\.(jpe?g|png|gif|webp|avif|svg)$/i;
const VID = /\.(mp4|webm|mov|m4v|ogv)$/i;

const HOST_ICONS = {
  'behance.net': 'fa-brands fa-behance',
  'artstation.com': 'fa-brands fa-artstation',
  'github.com': 'fa-brands fa-github',
  'figma.com': 'fa-brands fa-figma',
  'dribbble.com': 'fa-brands fa-dribbble',
  'pinterest.com': 'fa-brands fa-pinterest',
  'itch.io': 'fa-brands fa-itch-io',
};

// Insert a Cloudinary transformation, e.g. cld(url, 'f_auto,q_auto,w_800').
export const cld = (url, t) => (/res\.cloudinary\.com\/.+\/upload\//.test(url) ? url.replace('/upload/', `/upload/${t}/`) : url);

export function parse(raw) {
  raw = String(raw || '').trim();
  if (!raw) return null;
  let url = raw;
  const iframe = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframe) url = iframe[1].replace(/&amp;/g, '&');
  if (url.startsWith('//')) url = `https:${url}`;
  if (!/^https?:\/\//i.test(url)) {
    if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(url)) url = `https://${url}`;
    else return null;
  }
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^(www|m)\./, '');
  const base = { raw, url };

  let yt = null;
  if (host === 'youtu.be') yt = u.pathname.split('/')[1];
  else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) yt = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]+)/) || [])[1];
  if (yt) {
    return {
      ...base, type: 'youtube', id: yt, vertical: u.pathname.startsWith('/shorts'),
      thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      embed: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`,
    };
  }

  if (/(^|\.)vimeo\.com$/.test(host)) {
    const m = u.pathname.match(/(\d{5,})(?:\/([\da-f]{6,}))?/);
    if (m) {
      const hash = m[2] || u.searchParams.get('h');
      return { ...base, type: 'vimeo', id: m[1], thumb: `https://vumbnail.com/${m[1]}.jpg`, embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1${hash ? `&h=${hash}` : ''}` };
    }
  }

  if (host === 'instagram.com') {
    const m = u.pathname.match(/^\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/);
    if (m) {
      const kind = m[1].startsWith('reel') ? 'reel' : m[1];
      return { ...base, type: 'instagram', vertical: true, embed: `https://www.instagram.com/${kind}/${m[2]}/embed/` };
    }
  }

  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const id = (u.pathname.match(/\/d\/([\w-]{10,})/) || [])[1] || u.searchParams.get('id');
    if (id) return { ...base, type: 'drive', id, thumb: `https://drive.google.com/thumbnail?id=${id}&sz=w1600`, embed: `https://drive.google.com/file/d/${id}/preview` };
  }

  if (host === 'sketchfab.com') {
    const m = u.pathname.match(/([0-9a-f]{32})/);
    if (m) return { ...base, type: 'sketchfab', id: m[1], embed: `https://sketchfab.com/models/${m[1]}/embed?autostart=1&ui_theme=dark&dnt=1` };
  }

  if (host.endsWith('itch.io') || host.endsWith('itch.zone')) {
    if (/^\/embed(-upload)?\//.test(u.pathname) || host.endsWith('itch.zone')) return { ...base, type: 'itch', embed: url };
    return { ...base, type: 'link', site: 'itch.io', icon: HOST_ICONS['itch.io'] };
  }

  if (host === 'res.cloudinary.com') {
    if (u.pathname.includes('/video/upload/')) return { ...base, type: 'video', cloud: true, src: cld(url, 'q_auto') };
    if (u.pathname.includes('/image/upload/')) return { ...base, type: 'image', cloud: true, src: url };
  }

  if (VID.test(u.pathname)) return { ...base, type: 'video', src: url };
  if (IMG.test(u.pathname)) return { ...base, type: 'image', src: url, thumb: url };
  if (iframe) return { ...base, type: 'iframe', embed: url };

  const site = Object.keys(HOST_ICONS).find((k) => host === k || host.endsWith(`.${k}`));
  return { ...base, type: 'link', site: site || host, icon: site ? HOST_ICONS[site] : 'fa-solid fa-arrow-up-right-from-square' };
}

// Thumbnail URL for cards (empty string when the source has none).
export function thumbUrl(m, w = 900) {
  if (!m) return '';
  if (m.cloud && m.type === 'video') return cld(m.url, `so_1,q_auto,c_limit,w_${w}`).replace(/\.\w+$/, '.jpg');
  if (m.cloud && m.type === 'image') return cld(m.url, `f_auto,q_auto,c_limit,w_${w}`);
  return m.thumb || '';
}

export function srcUrl(m, w = 2000) {
  if (m.cloud && m.type === 'image') return cld(m.url, `f_auto,q_auto,c_limit,w_${w}`);
  return m.src || m.url;
}

export const isPlayable = (m) => !!m && ['youtube', 'vimeo', 'video', 'drive', 'instagram'].includes(m.type);
export const isEmbed = (m) => !!m && ['youtube', 'vimeo', 'drive', 'instagram', 'sketchfab', 'itch', 'iframe'].includes(m.type);

export function actionLabel(m) {
  if (!m) return '';
  if (m.type === 'sketchfab') return 'View 3D model';
  if (m.type === 'itch') return 'Play game';
  if (m.type === 'iframe') return 'Load';
  return 'Play';
}

export function actionIcon(m) {
  if (m?.type === 'sketchfab') return 'fa-solid fa-cube';
  if (m?.type === 'itch') return 'fa-solid fa-gamepad';
  return 'fa-solid fa-play';
}

export function linkCard(m) {
  return `<a class="linkcard" href="${esc(m.url)}" target="_blank" rel="noopener"><i class="${esc(m.icon || 'fa-solid fa-arrow-up-right-from-square')}"></i><span>Open on ${esc(m.site || 'the web')}</span></a>`;
}

// The real player. Embeds are only created after a click (see facade in site.js).
export function playerHTML(m, { autoplay = true, controls = true } = {}) {
  if (isEmbed(m)) {
    return `<iframe class="player" src="${esc(m.embed)}" title="Embedded media" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; xr-spatial-tracking; gyroscope; accelerometer; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  }
  if (m.type === 'video') {
    const poster = thumbUrl(m, 1600);
    return `<video class="player" src="${esc(m.src)}" ${controls ? 'controls' : ''} playsinline ${autoplay ? 'autoplay' : ''} preload="metadata" ${poster ? `poster="${esc(poster)}"` : ''}></video>`;
  }
  if (m.type === 'image') return `<img class="player contain" src="${esc(srcUrl(m))}" alt="">`;
  return linkCard(m);
}
