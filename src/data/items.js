// Vật phẩm: 6 nguyên liệu, ghép 2 nguyên liệu = 1 vật phẩm hoàn chỉnh (21 loại). Tối đa 3 món / Pokémon.
// Dùng chung bộ "mods" với tộc (xem traits.js).

export const COMPONENTS = {
  band: { id: 'band', name: 'Vuốt Sắc', mods: { atkPct: .20 }, col: '#ff7a5a', glyph: 'claw' },
  scarf: { id: 'scarf', name: 'Khăn Lanh Lẹ', mods: { asPct: .20 }, col: '#ffd24a', glyph: 'bolt' },
  orb: { id: 'orb', name: 'Ngọc Tâm Linh', mods: { ap: 25 }, col: '#c46bff', glyph: 'orb' },
  shell: { id: 'shell', name: 'Vỏ Cứng', mods: { armor: 20 }, col: '#c0c8d8', glyph: 'shield' },
  cloak: { id: 'cloak', name: 'Áo Choàng Bạc', mods: { mr: 20 }, col: '#5ad6ff', glyph: 'cloak' },
  berry: { id: 'berry', name: 'Quả Sitrus', mods: { hpPct: .20 }, col: '#6ee07a', glyph: 'leaf' }
};
export const COMP_IDS = Object.keys(COMPONENTS);

const C = (a, b, id, name, mods, col) => ({ id, name, mods, col, parts: [a, b], glyph: 'gem' });
const list = [
  C('band', 'band', 'choiceband', 'Đai Sức Mạnh', { atkPct: .45 }, '#ff5a3a'),
  C('band', 'scarf', 'quickclaw', 'Vuốt Nhanh', { atkPct: .20, asPct: .20, crit: .10 }, '#ffb347'),
  C('band', 'orb', 'lifeorb', 'Ngọc Sinh Mệnh', { atkPct: .30, ap: 25 }, '#ff4fa0'),
  C('band', 'shell', 'rockyhelmet', 'Mũ Gai', { atkPct: .15, armor: 20, thorns: .15 }, '#b0803a'),
  C('band', 'cloak', 'scopelens', 'Kính Ngắm', { atkPct: .15, mr: 20, crit: .20 }, '#4fd0ff'),
  C('band', 'berry', 'shellbell', 'Chuông Vỏ Sò', { atkPct: .15, hpPct: .15, lifesteal: .15 }, '#ff9ec4'),
  C('scarf', 'scarf', 'choicescarf', 'Khăn Choice', { asPct: .45 }, '#ffe14a'),
  C('scarf', 'orb', 'wiseglasses', 'Kính Thông Thái', { asPct: .20, ap: 30 }, '#d58bff'),
  C('scarf', 'shell', 'ironball', 'Bóng Sắt', { asPct: .20, armor: 20, moveSpeed: .15 }, '#a0a8b8'),
  C('scarf', 'cloak', 'brightpowder', 'Bột Sáng', { asPct: .20, mr: 15, dodge: .15 }, '#f4f4ff'),
  C('scarf', 'berry', 'leftovers', 'Túi Thức Ăn', { asPct: .15, hpPct: .15, regenPct: .01 }, '#8fe08a'),
  C('orb', 'orb', 'mysticwater', 'Nước Thần', { ap: 65, manaStart: 10 }, '#9b5bff'),
  C('orb', 'shell', 'eviolite', 'Đá Tiến Hóa', { ap: 25, armor: 20, mr: 10, shieldPct: .10 }, '#e0b8ff'),
  C('orb', 'cloak', 'lightclay', 'Đất Sét Sáng', { ap: 25, mr: 25, manaStart: 15 }, '#8fd8ff'),
  C('orb', 'berry', 'souldew', 'Giọt Linh Hồn', { ap: 30, hpPct: .15, manaRegen: 2 }, '#7fe0c0'),
  C('shell', 'shell', 'ironplate', 'Giáp Thép', { armor: 45, hpPct: .10 }, '#8c96aa'),
  C('shell', 'cloak', 'focussash', 'Khăn Trụ Vững', { armor: 20, mr: 20, sash: true }, '#ff7070'),
  C('shell', 'berry', 'sturdyfeather', 'Lông Bền', { armor: 20, hpPct: .25, dr: .05 }, '#d0e8b0'),
  C('cloak', 'cloak', 'spelltag', 'Bùa Phép', { mr: 45, hpPct: .10 }, '#4aa8ff'),
  C('cloak', 'berry', 'lumberry', 'Quả Lum', { mr: 20, hpPct: .20, dr: .05 }, '#58d890'),
  C('berry', 'berry', 'bigberry', 'Quả Đại Hồi Phục', { hpPct: .45, regenPct: .005 }, '#2fd05a')
];
export const COMBOS = {};
for (const c of list) COMBOS[[c.parts[0], c.parts[1]].sort().join('+')] = c;
export const ITEMS = {};
for (const k in COMPONENTS) ITEMS[k] = { ...COMPONENTS[k], comp: true };
for (const c of list) ITEMS[c.id] = c;

// Ghép 2 nguyên liệu -> vật phẩm; null nếu không phải nguyên liệu
export const combine = (a, b) => (COMPONENTS[a] && COMPONENTS[b]) ? COMBOS[[a, b].sort().join('+')] : null;
