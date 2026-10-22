// Hệ & Tộc (synergy). Mỗi mốc: { n: số Pokémon khác nhau cần có, mods: cho thành viên, allMods: cho cả đội }
// Mọi giá trị phần trăm là số thập phân (0.15 = 15%).

import { TYPE_COL, TYPE_VI } from './types.js';

// Từ điển hiệu ứng -> mô tả (dùng chung cho tộc và vật phẩm, đảm bảo mô tả luôn khớp số liệu)
const P = v => Math.round(v * 100) + '%';
export const MOD_TEXT = {
  hpPct: v => `+${P(v)} máu`, atkPct: v => `+${P(v)} công`, asPct: v => `+${P(v)} tốc đánh`,
  ap: v => `+${v} sức mạnh kỹ năng`, armor: v => `+${v} giáp`, mr: v => `+${v} kháng phép`,
  crit: v => `+${P(v)} chí mạng`, critDmg: v => `+${P(v)} sát thương chí mạng`, dodge: v => `+${P(v)} né`,
  lifesteal: v => `hút ${P(v)} máu`, dr: v => `giảm ${P(v)} sát thương nhận`, shieldPct: v => `khiên ${P(v)} máu đầu trận`,
  manaStart: v => `+${v} năng lượng đầu trận`, manaRegen: v => `+${v} năng lượng/giây`, regenPct: v => `hồi ${(v * 100).toFixed(1).replace(/\.0$/, '')}% máu/giây`,
  thorns: v => `phản ${P(v)} sát thương`, poisonOnHit: v => `đòn đánh gây độc ${P(v)} máu/3s`, slowOnHit: v => `đòn đánh làm chậm ${P(v)}`,
  burnOnHit: v => `đòn đánh gây bỏng ${P(v)} máu/3s`, moveSpeed: v => `+${P(v)} tốc chạy`,
  secondWind: v => `hồi ${P(v)} máu một lần khi xuống dưới 35%`, sash: () => 'sống sót 1 đòn chí mạng',
  growth: v => `mỗi ${v.every}s: +${P(v.atkPct)} công, +${P(v.hpPct)} máu`,
  deathExplode: v => `khi gục: nổ ${v.dmg} sát thương${v.stun ? ', choáng ' + v.stun + 's' : ''}`
};
export const modsText = m => Object.keys(m || {}).filter(k => MOD_TEXT[k]).map(k => MOD_TEXT[k](m[k])).join(', ');

const T = (id, name, kind, color, tiers, flavor = '') => ({ id, name, kind, color, tiers, flavor });

export const TRAITS = {};
const add = t => { TRAITS[t.id] = t; };

// ---------- Hệ ----------
const type = (t, tiers, flavor) => add(T(t, TYPE_VI[t], 'type', TYPE_COL[t], tiers, flavor));
type('Normal', [{ n: 2, mods: { hpPct: .15 } }, { n: 4, mods: { hpPct: .30 } }, { n: 6, mods: { hpPct: .50 } }]);
type('Fire', [{ n: 2, mods: { atkPct: .15 } }, { n: 4, mods: { atkPct: .30, burnOnHit: .04 } }, { n: 6, mods: { atkPct: .50, burnOnHit: .07 } }]);
type('Water', [{ n: 2, mods: { manaRegen: 2 } }, { n: 4, mods: { manaRegen: 4, ap: 15 } }, { n: 6, mods: { manaRegen: 7, ap: 30 } }]);
type('Grass', [{ n: 2, mods: { regenPct: .008 } }, { n: 4, mods: { regenPct: .016 } }, { n: 6, mods: { regenPct: .028 }, allMods: { regenPct: .008 } }]);
type('Electric', [{ n: 2, mods: { asPct: .15 } }, { n: 4, mods: { asPct: .30 } }, { n: 6, mods: { asPct: .50 } }]);
type('Ice', [{ n: 2, mods: { slowOnHit: .25, armor: 15 } }, { n: 4, mods: { slowOnHit: .40, armor: 35 } }]);
type('Fighting', [{ n: 2, mods: { atkPct: .12, lifesteal: .08 } }, { n: 4, mods: { atkPct: .25, lifesteal: .16 } }]);
type('Poison', [{ n: 2, mods: { poisonOnHit: .05 } }, { n: 4, mods: { poisonOnHit: .10 } }]);
type('Ground', [{ n: 2, mods: { armor: 20, mr: 20 } }, { n: 4, mods: { armor: 40, mr: 40 } }]);
type('Flying', [{ n: 2, mods: { dodge: .15, asPct: .10 } }, { n: 4, mods: { dodge: .25, asPct: .20 } }]);
type('Psychic', [{ n: 2, mods: { ap: 20 } }, { n: 4, mods: { ap: 45 } }, { n: 6, mods: { ap: 80 } }]);
type('Bug', [{ n: 2, mods: { asPct: .15, dr: .05 } }, { n: 4, mods: { asPct: .30, dr: .10 } }]);
type('Rock', [{ n: 2, mods: { armor: 25, dr: .05 } }, { n: 4, mods: { armor: 50, dr: .10 } }]);
type('Ghost', [{ n: 2, mods: { dodge: .12, ap: 20 } }, { n: 4, mods: { dodge: .22, ap: 35 } }]);
type('Dragon', [{ n: 2, mods: { hpPct: .15, atkPct: .15 } }, { n: 3, mods: { hpPct: .25, atkPct: .25 } }, { n: 4, mods: { hpPct: .40, atkPct: .40 } }]);
type('Dark', [{ n: 2, mods: { crit: .15, critDmg: .20 } }, { n: 4, mods: { crit: .30, critDmg: .40 } }]);
type('Steel', [{ n: 2, mods: { dr: .08, hpPct: .10 } }, { n: 4, mods: { dr: .16, hpPct: .20 } }]);
type('Fairy', [{ n: 2, allMods: { shieldPct: .12 } }, { n: 4, allMods: { shieldPct: .24 } }]);

// ---------- Tộc (lấy cảm hứng từ anime) ----------
add(T('satoshi', 'Đội Satoshi', 'anime', '#ff5a5a', [
  { n: 3, mods: { atkPct: .12 } },
  { n: 5, mods: { atkPct: .25, secondWind: .20 } },
  { n: 7, mods: { atkPct: .40, asPct: .15, secondWind: .35 } }
], 'Không bao giờ bỏ cuộc, dù chỉ còn một chút sức lực.'));
add(T('rocket', 'Hỏa Tiễn', 'anime', '#4a4a6a', [
  { n: 2, mods: { armor: 10, deathExplode: { dmg: 160, rad: 1.8, stun: 0 } } },
  { n: 4, mods: { armor: 25, deathExplode: { dmg: 380, rad: 2.0, stun: 1 } } },
  { n: 6, mods: { armor: 40, deathExplode: { dmg: 700, rad: 2.2, stun: 1.5 } } }
], 'Lại bị bắn bay mất rồi! ... nhưng đi thì phải nổ cái đã.'));
add(T('starter', 'Khởi Đầu', 'anime', '#7ed957', [
  { n: 3, mods: { growth: { every: 4, atkPct: .03, hpPct: .03 } } },
  { n: 6, mods: { growth: { every: 4, atkPct: .05, hpPct: .05 } } },
  { n: 9, mods: { growth: { every: 4, atkPct: .08, hpPct: .08 } } }
], 'Người bạn đầu tiên luôn lớn lên cùng bạn.'));
add(T('eevee', 'Họ Eevee', 'anime', '#c8935a', [
  { n: 2, mods: { ap: 15, hpPct: .08 } },
  { n: 4, mods: { ap: 35, hpPct: .18 } },
  { n: 6, mods: { ap: 60, hpPct: .30 } }
], 'Một cái tên, tám con đường tiến hóa.'));
add(T('legend', 'Huyền Thoại', 'anime', '#ffcf3a', [
  { n: 1, mods: { hpPct: .15, atkPct: .15, manaStart: 20 } },
  { n: 2, mods: { hpPct: .30, atkPct: .30, manaStart: 30 }, allMods: { atkPct: .08 } },
  { n: 3, mods: { hpPct: .50, atkPct: .50, manaStart: 40 }, allMods: { atkPct: .15, asPct: .10 } }
], 'Truyền thuyết chỉ xuất hiện khi trận đấu đủ lớn.'));

export const TRAIT_LIST = Object.values(TRAITS);

// Tính các tộc/hệ đang kích hoạt từ danh sách đơn vị { key, traits[] }; chỉ tính mỗi dòng Pokémon một lần
export function calcTraits(units) {
  const seen = {}; const count = {};
  for (const u of units) {
    if (!u) continue;
    for (const t of u.traits) {
      const k = t + '|' + u.key; if (seen[k]) continue; seen[k] = 1;
      count[t] = (count[t] || 0) + 1;
    }
  }
  const out = {};
  for (const id in count) {
    const tr = TRAITS[id]; if (!tr) continue;
    let tier = -1; tr.tiers.forEach((x, i) => { if (count[id] >= x.n) tier = i; });
    out[id] = { id, count: count[id], tier };
  }
  return out;
}
