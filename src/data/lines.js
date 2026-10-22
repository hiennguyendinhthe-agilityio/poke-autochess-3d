// Danh sách "dòng" Pokémon trong game (nguồn dữ liệu gốc, dùng cả cho game lẫn tool tải asset).
// Mỗi dòng có 3 dạng ứng với 1★ / 2★ / 3★ (lên sao = tiến hóa).
// L(khóa, giá, [dex 1★, dex 2★, dex 3★], 'tộc1+tộc2', kỹ năng, tuỳ chọn)
//   kỹ năng = [tên chiêu, kiểu kỹ năng, hệ của chiêu]  (kiểu: xem sim/abilities.js)
//   tuỳ chọn: range (tầm đánh, ô), skill3 (kỹ năng riêng ở 3★), want (gợi ý hàng đứng cho bot)

export const LINES = [];
const L = (key, cost, dex, traits, skill, opt = {}) => LINES.push({ key, cost, dex, traits: traits ? traits.split('+') : [], skill, ...opt });

// ===== GIÁ 1 =====
L('bulbasaur', 1, [1, 2, 3], 'satoshi+starter', ['Razor Leaf', 'volley', 'Grass'], { range: 3, starter: true });
L('charmander', 1, [4, 5, 6], 'satoshi+starter', ['Ember', 'burst', 'Fire'], { range: 2, starter: true });
L('squirtle', 1, [7, 8, 9], 'satoshi+starter', ['Withdraw', 'shield', 'Water'], { range: 1, starter: true });
L('pidgey', 1, [16, 17, 18], 'satoshi', ['Gust', 'nova', 'Flying'], { range: 2 });
L('caterpie', 1, [10, 11, 12], 'satoshi', ['String Shot', 'burst', 'Bug'], { range: 2, fx: 'web' });
L('ekans', 1, [23, 24, 24], 'rocket', ['Poison Sting', 'poison', 'Poison'], { range: 1 });
L('koffing', 1, [109, 110, 110], 'rocket', ['Smog', 'burst', 'Poison'], { range: 2, fx: 'poison' });
L('magikarp', 1, [129, 129, 130], null, ['Splash', 'splash', 'Water'], { range: 1, skill3: ['Hydro Pump', 'beam', 'Water'] });
L('geodude', 1, [74, 75, 76], null, ['Rock Throw', 'bolt', 'Rock'], { range: 1 });
L('machop', 1, [66, 67, 68], null, ['Dynamic Punch', 'stun', 'Fighting'], { range: 1 });
L('meowth', 1, [52, 53, 53], 'rocket', ['Pay Day', 'volley', 'Normal'], { range: 1 });
L('zubat', 1, [41, 42, 169], null, ['Leech Life', 'drain', 'Bug'], { range: 1 });

// ===== GIÁ 2 =====
L('pikachu', 2, [172, 25, 26], 'satoshi', ['Thunderbolt', 'chain', 'Electric'], { range: 3 });
L('abra', 2, [63, 64, 65], null, ['Psybeam', 'beam', 'Psychic'], { range: 3 });
L('chikorita', 2, [152, 153, 154], 'starter', ['Synthesis', 'heal', 'Grass'], { range: 2, starter: true });
L('cyndaquil', 2, [155, 156, 157], 'starter', ['Flamethrower', 'beam', 'Fire'], { range: 2, starter: true });
L('totodile', 2, [158, 159, 160], 'starter+satoshi', ['Aqua Tail', 'leap', 'Water'], { range: 1, starter: true });
L('gastly', 2, [92, 93, 94], null, ['Shadow Ball', 'bolt', 'Ghost'], { range: 3 });
L('mankey', 2, [56, 57, 57], 'satoshi', ['Seismic Toss', 'stun', 'Fighting'], { range: 1 });
L('onix', 2, [95, 95, 208], null, ['Rock Slide', 'burst', 'Rock'], { range: 1 });
L('staryu', 2, [120, 120, 121], null, ['Rapid Spin', 'nova', 'Water'], { range: 2 });
L('vaporeon', 2, [134, 134, 134], 'eevee', ['Aqua Ring', 'heal', 'Water'], { range: 2 });
L('jolteon', 2, [135, 135, 135], 'eevee', ['Thunder Wave', 'nova', 'Electric'], { range: 2 });
L('flareon', 2, [136, 136, 136], 'eevee', ['Fire Blast', 'burst', 'Fire'], { range: 2 });

// ===== GIÁ 3 =====
L('treecko', 3, [252, 253, 254], 'starter', ['Leaf Blade', 'leap', 'Grass'], { range: 1, starter: true });
L('torchic', 3, [255, 256, 257], 'starter', ['Blaze Kick', 'leap', 'Fire'], { range: 1, starter: true });
L('mudkip', 3, [258, 259, 260], 'starter', ['Earthquake', 'quake', 'Ground'], { range: 1, starter: true });
L('riolu', 3, [447, 447, 448], 'satoshi', ['Aura Sphere', 'bolt', 'Fighting'], { range: 2 });
L('ralts', 3, [280, 281, 282], null, ['Dazzling Gleam', 'nova', 'Fairy'], { range: 3 });
L('wobbuffet', 3, [360, 202, 202], 'rocket', ['Mirror Coat', 'counter', 'Psychic'], { range: 1 });
L('snorlax', 3, [446, 143, 143], 'satoshi', ['Rest', 'heal', 'Normal'], { range: 1 });
L('lapras', 3, [131, 131, 131], 'satoshi', ['Ice Beam', 'beam', 'Ice'], { range: 3 });
L('espeon', 3, [196, 196, 196], 'eevee', ['Psychic', 'stun', 'Psychic'], { range: 3 });
L('umbreon', 3, [197, 197, 197], 'eevee', ['Moonlight', 'heal', 'Dark'], { range: 1 });
L('leafeon', 3, [470, 470, 470], 'eevee', ['Leaf Storm', 'volley', 'Grass'], { range: 2 });
L('scyther', 3, [123, 123, 212], null, ['X-Scissor', 'blink', 'Bug'], { range: 1 });
L('seviper', 3, [336, 336, 336], 'rocket', ['Poison Tail', 'poison', 'Poison'], { range: 1 });

// ===== GIÁ 4 =====
L('larvitar', 4, [246, 247, 248], null, ['Crunch', 'drain', 'Dark'], { range: 1 });
L('dratini', 4, [147, 148, 149], null, ['Dragon Dance', 'rally', 'Dragon'], { range: 2 });
L('gible', 4, [443, 444, 445], null, ['Earthquake', 'quake', 'Ground'], { range: 1 });
L('bagon', 4, [371, 372, 373], null, ['Dragon Claw', 'blink', 'Dragon'], { range: 1 });
L('beldum', 4, [374, 375, 376], null, ['Meteor Mash', 'stun', 'Steel'], { range: 1 });
L('chimchar', 4, [390, 391, 392], 'starter+satoshi', ['Flare Blitz', 'leap', 'Fire'], { range: 1, starter: true });
L('piplup', 4, [393, 394, 395], 'starter+satoshi', ['Hydro Cannon', 'beam', 'Water'], { range: 3, starter: true });
L('froakie', 4, [656, 657, 658], 'starter+satoshi', ['Water Shuriken', 'volley', 'Water'], { range: 3, starter: true });
L('glaceon', 4, [471, 471, 471], 'eevee', ['Blizzard', 'nova', 'Ice'], { range: 3 });
L('sylveon', 4, [700, 700, 700], 'eevee', ['Moonblast', 'burst', 'Fairy'], { range: 3 });

// ===== GIÁ 5 (huyền thoại) =====
L('mewtwo', 5, [150, 150, 150], 'legend', ['Psystrike', 'bolt', 'Psychic'], { range: 4 });
L('mew', 5, [151, 151, 151], 'legend', ['Ancient Power', 'meteor', 'Rock'], { range: 3 });
L('lugia', 5, [249, 249, 249], 'legend', ['Aeroblast', 'beam', 'Flying'], { range: 3 });
L('hooh', 5, [250, 250, 250], 'legend', ['Sacred Fire', 'burst', 'Fire'], { range: 3, fx: 'burn' });
L('rayquaza', 5, [384, 384, 384], 'legend', ['Draco Meteor', 'meteor', 'Dragon'], { range: 3 });
L('dialga', 5, [483, 483, 483], 'legend', ['Roar of Time', 'beam', 'Dragon'], { range: 3 });
L('giratina', 5, [487, 487, 487], 'legend', ['Shadow Force', 'blink', 'Ghost'], { range: 1 });
L('arceus', 5, [493, 493, 493], 'legend', ['Judgment', 'nova', 'Normal'], { range: 3 });

// Pokémon hoang dã (chỉ xuất hiện ở các vòng PvE, không có trong cửa hàng)
export const WILD = {
  rattata: { dex: 19, types: ['Normal'] }, raticate: { dex: 20, types: ['Normal'] },
  spearow: { dex: 21, types: ['Normal', 'Flying'] }, fearow: { dex: 22, types: ['Normal', 'Flying'] },
  weedle: { dex: 13, types: ['Bug', 'Poison'] }, kakuna: { dex: 14, types: ['Bug', 'Poison'] }, beedrill: { dex: 15, types: ['Bug', 'Poison'] },
  tauros: { dex: 128, types: ['Normal'] }, miltank: { dex: 241, types: ['Normal'] }, kangaskhan: { dex: 115, types: ['Normal'] },
  rhydon: { dex: 112, types: ['Ground', 'Rock'] }
};

export const allDex = () => {
  const s = new Set();
  for (const l of LINES) l.dex.forEach(d => s.add(d));
  for (const k in WILD) s.add(WILD[k].dex);
  return [...s].sort((a, b) => a - b);
};
