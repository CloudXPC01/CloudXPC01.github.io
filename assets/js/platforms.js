// Social platforms: label + Font Awesome icon. Keys double as analytics click buckets.
export const PLATFORMS = {
  instagram: { label: 'Instagram', icon: 'fa-brands fa-instagram' },
  linkedin: { label: 'LinkedIn', icon: 'fa-brands fa-linkedin-in' },
  youtube: { label: 'YouTube', icon: 'fa-brands fa-youtube' },
  behance: { label: 'Behance', icon: 'fa-brands fa-behance' },
  artstation: { label: 'ArtStation', icon: 'fa-brands fa-artstation' },
  vimeo: { label: 'Vimeo', icon: 'fa-brands fa-vimeo-v' },
  itch: { label: 'itch.io', icon: 'fa-brands fa-itch-io' },
  github: { label: 'GitHub', icon: 'fa-brands fa-github' },
  x: { label: 'X', icon: 'fa-brands fa-x-twitter' },
  facebook: { label: 'Facebook', icon: 'fa-brands fa-facebook-f' },
  tiktok: { label: 'TikTok', icon: 'fa-brands fa-tiktok' },
  threads: { label: 'Threads', icon: 'fa-brands fa-threads' },
  discord: { label: 'Discord', icon: 'fa-brands fa-discord' },
  whatsapp: { label: 'WhatsApp', icon: 'fa-brands fa-whatsapp' },
  email: { label: 'Email', icon: 'fa-solid fa-envelope' },
  website: { label: 'Website', icon: 'fa-solid fa-globe' },
  other: { label: 'Link', icon: 'fa-solid fa-link' },
};

export const platformOf = (s) => PLATFORMS[s.platform] || PLATFORMS.other;

// Turns what the owner typed (handle, bare domain, email, phone) into a safe link.
export function socialHref(s) {
  const v = String(s?.url || '').trim();
  if (!v) return '';
  if (s.platform === 'email') return /^mailto:/i.test(v) ? v : `mailto:${v}`;
  if (s.platform === 'whatsapp' && /^\+?[\d\s()-]{6,}$/.test(v)) return `https://wa.me/${v.replace(/\D/g, '')}`;
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^[a-z][\w+.-]*:/i.test(v)) return ''; // block javascript: and friends
  return `https://${v.replace(/^\/+/, '')}`;
}

export function handleOf(s) {
  if (s.label) return s.label;
  const v = String(s.url || '').trim();
  if (s.platform === 'email') return v.replace(/^mailto:/i, '');
  try {
    const u = new URL(socialHref(s));
    const seg = u.pathname.split('/').filter(Boolean).pop();
    if (seg && s.platform !== 'website' && s.platform !== 'other') return seg.startsWith('@') ? seg : `@${seg}`;
    return u.hostname.replace(/^www\./, '');
  } catch {
    return platformOf(s).label;
  }
}
