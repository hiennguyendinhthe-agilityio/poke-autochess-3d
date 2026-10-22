// Mô tả Pokémon, kỹ năng, vật phẩm cho giao diện (dùng chung số liệu với engine)
import { LINE, formAt, baseStats, skillAt, COST_COL } from '../data/roster.js';
import { ABILITY_KINDS } from '../sim/ability-kinds.js';
import { ITEMS } from '../data/items.js';
import { modsText } from '../data/traits.js';

export function abilityText(line, star, apPct = 0) {
  if (!line.skill) return null;
  const sk = skillAt(line, star), kind = ABILITY_KINDS[sk.kind], b = baseStats(line, star);
  const nums = kind.nums(b.abilityPower * (1 + apPct / 100));
  return { name: sk.name, type: sk.type, kind: sk.kind, mana: kind.mana, text: kind.desc(nums, line.fx) };
}
export const itemTip = id => { const it = ITEMS[id]; return `<b>${it.name}</b><br>${modsText(it.mods)}${it.comp ? '<br><i>Nguyên liệu: ghép 2 cái thành vật phẩm</i>' : ''}`; };
export { COST_COL, LINE, formAt };
