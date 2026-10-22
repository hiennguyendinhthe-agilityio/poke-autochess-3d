// Icon SVG vẽ bằng code (hệ, tộc, vật phẩm) + hiển thị sprite động trong giao diện.
import FORMS from '../data/generated/forms.json';
import { TYPE_COL } from '../data/types.js';
import { TRAITS } from '../data/traits.js';
import { ITEMS } from '../data/items.js';

const G = {
  Normal: '<circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff" stroke-width="2.6"/>',
  Fire: '<path d="M12 2.5c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.2 1-3.5 2-4.5.3 1.6 1 2.5 2 2.8C10 8.8 10.5 5.5 12 2.5z" fill="#fff"/>',
  Water: '<path d="M12 3C9 8 6.5 10.5 6.5 14.2a5.5 5.5 0 0 0 11 0C17.5 10.5 15 8 12 3z" fill="#fff"/>',
  Grass: '<path d="M5 19C4 10 9 4.5 20 4c.5 10.5-4.5 15.5-12 15.5" fill="#fff"/><path d="M5 19c3-5 6-8 10-10" stroke="#0004" stroke-width="1.5" fill="none"/>',
  Electric: '<path d="M13.5 2L6 13.5h4.8L9.5 22 18 10h-5z" fill="#fff"/>',
  Ice: '<g stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v18M4.4 7.5l15.2 9M19.6 7.5l-15.2 9"/></g>',
  Fighting: '<path d="M6 10.5V8a1.8 1.8 0 0 1 3.4-.8 1.8 1.8 0 0 1 3.2 0 1.8 1.8 0 0 1 3.2 0 1.8 1.8 0 0 1 2.2 1.8V15c0 3.5-2.5 6-6 6s-6-2.5-6-6z" fill="#fff"/>',
  Poison: '<circle cx="12" cy="10.5" r="6.5" fill="#fff"/><rect x="8.5" y="15" width="7" height="5" rx="1.5" fill="#fff"/><circle cx="9.5" cy="10.5" r="1.7" fill="#0006"/><circle cx="14.5" cy="10.5" r="1.7" fill="#0006"/>',
  Ground: '<path d="M2.5 19.5L9 7l4 7 2.5-3.5 6 9z" fill="#fff"/>',
  Flying: '<path d="M2.5 16C7 15 8 9 13 6c-.5 3-.5 4 0 5 1.5-1 3-1.5 5-1.5-1.5 2-2 3-1.5 4.5 2-.5 3.500-.2 4.500.5-4 4.500-12 6-18.500 1.500z" fill="#fff"/>',
  Psychic: '<ellipse cx="12" cy="12" rx="9.5" ry="5.5" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="12" cy="12" r="3" fill="#fff"/>',
  Bug: '<ellipse cx="12" cy="14" rx="4.5" ry="6" fill="#fff"/><path d="M9 7L7 3.500M15 7l2-3.500M7.500 12.500H3.500M16.500 12.500h4M8 18l-3 2.500M16 18l3 2.500" stroke="#fff" stroke-width="1.800" stroke-linecap="round"/>',
  Rock: '<path d="M7.500 4h9l4.500 8-4.500 8h-9L3 12z" fill="#fff"/><path d="M8 4l4 8-4 8M16 4l-4 8 4 8" stroke="#0003" fill="none"/>',
  Ghost: '<path d="M5 20V11a7 7 0 0 1 14 0v9l-2.500-2.200L14 20l-2-2.200L10 20l-2.500-2.200z" fill="#fff"/><circle cx="9.500" cy="11" r="1.600" fill="#0006"/><circle cx="14.500" cy="11" r="1.600" fill="#0006"/>',
  Dragon: '<path d="M3 20c2-8 5-13 9-17 1 4 4 5 6 5-1 2-2 3-4 3.500 3 1 5 3.500 4 6.500-3-2-6-2-9-1-2 .5-4 1.500-6 3z" fill="#fff"/>',
  Dark: '<path d="M15.500 3.500A9 9 0 1 0 20.500 15 7 7 0 0 1 15.500 3.500z" fill="#fff"/>',
  Steel: '<circle cx="12" cy="12" r="5.500" fill="none" stroke="#fff" stroke-width="3"/><g stroke="#fff" stroke-width="3.200" stroke-linecap="round"><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/></g>',
  Fairy: '<path d="M12 2l2.200 7.800L22 12l-7.800 2.200L12 22l-2.200-7.800L2 12l7.800-2.200z" fill="#fff"/>',
  // tộc
  satoshi: '<circle cx="12" cy="12" r="9" fill="#fff"/><path d="M3 12a9 9 0 0 1 18 0z" fill="#ff4a4a"/><path d="M3 12h18" stroke="#222" stroke-width="1.800"/><circle cx="12" cy="12" r="3" fill="#fff" stroke="#222" stroke-width="1.800"/>',
  rocket: '<path d="M12 2c3 3 4 7 3 12l2 3-3-.5-2 3.500-2-3.500-3 .5 2-3c-1-5 0-9 3-12z" fill="#fff"/><circle cx="12" cy="9" r="1.800" fill="#0006"/>',
  starter: '<path d="M12 21v-8" stroke="#fff" stroke-width="2.400" stroke-linecap="round"/><path d="M12 13C12 7 7 5.500 3.500 6.500 3.500 11 6.500 13.500 12 13zM12 13c0-5 4-7 8.500-6.500C20.500 11 17 13.500 12 13z" fill="#fff"/>',
  eevee: '<path d="M12 21c-5 0-8-3-8-7 0-3 2-4 3-7l2.500 2.500C10.500 8.700 13.500 8.700 14.500 9.500L17 7c1 3 3 4 3 7 0 4-3 7-8 7z" fill="#fff"/><circle cx="9.500" cy="14" r="1.200" fill="#0006"/><circle cx="14.500" cy="14" r="1.200" fill="#0006"/>',
  legend: '<path d="M3.500 18.500L2.500 7l5 4.500L12 4l4.500 7.500 5-4.500-1 11.500z" fill="#fff"/>'
};
export const glyph = id => G[id] || G.Normal;

// Huy hiệu hệ/tộc
const badgeCache = {};
export function traitBadge(id, size = 22) {
  const t = TRAITS[id], col = t ? t.color : TYPE_COL[id] || '#888';
  return `<svg class="tb" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11.500" fill="${col}" stroke="rgba(0,0,0,.45)" stroke-width="1"/><g transform="translate(3.600 3.600) scale(.7)">${glyph(id)}</g></svg>`;
}
export function typeChip(t) { return `<span class="chip" style="--c:${TYPE_COL[t]}">${traitBadge(t, 16)}${TRAITS[t] ? TRAITS[t].name : t}</span>`; }

// ---- vật phẩm ----
const ITEM_GLYPH = {
  claw: '<path d="M6 19c0-6 2-11 6-15M11 20c0-6 2-10 6-14M16 21c0-5 1.500-8 5-11" stroke="#fff" stroke-width="2.600" fill="none" stroke-linecap="round"/>',
  bolt: '<path d="M13.500 2L6 13.500h4.800L9.500 22 18 10h-5z" fill="#fff"/>',
  orb: '<circle cx="12" cy="12" r="7.500" fill="#fff"/><circle cx="9.500" cy="9.500" r="2.200" fill="#fff8"/>',
  shield: '<path d="M12 3l7.500 3v5.500c0 5-3.500 8.500-7.500 10C8 20 4.500 16.500 4.500 11.500V6z" fill="#fff"/>',
  cloak: '<path d="M12 3c4 2 7 3 7 3-1 6-2 11-7 15-5-4-6-9-7-15 0 0 3-1 7-3z" fill="#fff"/>',
  leaf: '<path d="M5 19C4 10 9 4.500 20 4c.5 10.500-4.500 15.500-12 15.500" fill="#fff"/>',
  gem: '<path d="M6.500 4h11l4 5.500-9.500 11L2.500 9.500z" fill="#fff"/><path d="M2.500 9.500h19M9 4l-2 5.500 5 11 5-11L15 4" stroke="#0004" fill="none"/>'
};
const itemCache = {};
export function itemIcon(id, size = 34) {
  const it = ITEMS[id]; if (!it) return '';
  const k = id + size; if (itemCache[k]) return itemCache[k];
  const comp = it.comp;
  const second = !comp && it.parts ? ITEMS[it.parts[1]].col : null;
  const bg = comp ? `<rect x="1" y="1" width="30" height="30" rx="8" fill="${it.col}"/>` : `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ITEMS[it.parts[0]].col}"/><stop offset="1" stop-color="${second}"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="8" fill="url(#g${id})"/><rect x="1" y="1" width="30" height="30" rx="8" fill="none" stroke="#ffe9a0" stroke-width="2"/>`;
  const gl = comp ? ITEM_GLYPH[it.glyph] : ITEM_GLYPH.gem;
  const s = `<svg class="ii" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">${bg}<rect x="1" y="1" width="30" height="16" rx="8" fill="#fff" opacity=".18"/><g transform="translate(4 4) scale(1)">${gl}</g></svg>`;
  return itemCache[k] = s;
}
export const itemColor = id => (ITEMS[id] || {}).col || '#fff';

// ---- sprite động trên canvas 2D (starter, thông tin, màn kết thúc) ----
const imgCache = {};
const loadImg = src => imgCache[src] || (imgCache[src] = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
const live = new Set();
export function mountSprite(canvas, dex, { anim = 'Idle', dir = 0, scale = 3 } = {}) {
  const f = FORMS[dex]; if (!f) return () => { };
  const info = f.anims[anim] || f.anims.Idle;
  canvas.width = info.fw * scale; canvas.height = info.fh * scale; canvas.style.imageRendering = 'pixelated';
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
  let img = null, fr = 0, t = 0, dead = false, last = performance.now();
  loadImg(`assets/pokemon/${dex}/${anim}.png`).then(i => { img = i; });
  const tick = now => {
    if (dead) return; const dt = (now - last) / 1000; last = now;
    t += dt * 60; while (t >= (info.dur[fr] || 2)) { t -= info.dur[fr] || 2; fr = (fr + 1) % info.n; }
    if (img) { g.clearRect(0, 0, canvas.width, canvas.height); g.drawImage(img, fr * info.fw, dir * info.fh, info.fw, info.fh, 0, 0, canvas.width, canvas.height); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const stop = () => { dead = true; live.delete(stop); }; live.add(stop); return stop;
}
export const portraitUrl = dex => `assets/pokemon/${dex}/portrait.png`;
