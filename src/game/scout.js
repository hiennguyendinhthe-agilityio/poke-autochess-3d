// "Do thám": xem đội hình đối thủ (chỉ đọc, không đổi trạng thái ván). Thuần logic — không DOM, không RNG.
import { LINE, unitTraits } from '../data/roster.js';
import { calcTraits } from '../data/traits.js';
import { fieldUnits } from './bots.js';

const pack = list => list.map(u => ({ key: u.key, star: u.star, items: [...u.items], cost: LINE[u.key].cost }))
  .sort((a, b) => (b.cost - a.cost) || (b.star - a.star) || a.key.localeCompare(b.key));

function summarize(row, units) {
  const act = calcTraits(units.map(u => ({ key: u.key, traits: unitTraits(LINE[u.key], u.star) })));
  const traits = Object.values(act).sort((a, b) => (b.tier >= 0) - (a.tier >= 0) || b.tier - a.tier || b.count - a.count || a.id.localeCompare(b.id));
  return { ...row, units, traits };
}

// id = 0: chính người chơi (đội trên sân); id khác: một bot. Bot đã bị loại vẫn trả về đội cuối cùng của nó.
export function scoutTeam(g, id) {
  if (!id) return summarize({ id: 0, name: 'Bạn', col: '#ffcf3a', hp: g.hp, alive: g.hp > 0, level: g.level, me: true }, pack(g.boardUnits()));
  const b = g.bots.find(x => x.id === id);
  if (!b) return null;
  return summarize({ id: b.id, name: b.name, col: b.col, hp: b.hp, alive: b.alive, level: b.level, me: false }, pack(fieldUnits(b)));
}
