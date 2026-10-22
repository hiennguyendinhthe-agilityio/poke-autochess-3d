// Người chơi tự động (heuristic đơn giản) dùng cho test và cân bằng: chơi trọn một ván qua đúng luật.
import { Match } from '../src/game/match.js';
import { Battle, DT } from '../src/sim/battle.js';
import { LINE, formAt, unitTraits } from '../src/data/roster.js';
import { calcTraits, TRAITS } from '../src/data/traits.js';
import { ITEMS, combine } from '../src/data/items.js';

const ORDER = [3, 4, 2, 5, 1, 6, 0, 7];

// level mục tiêu theo vòng (người chơi "ổn")
const targetLevel = (r, skill) => Math.min(9, Math.round((r < 3 ? 2 : r < 5 ? 3 : r < 8 ? 4 : r < 11 ? 5 : r < 15 ? 6 : r < 20 ? 7 : r < 26 ? 8 : 9) + (skill > 1 ? 1 : 0)));

export function placeBest(g) {
  // đưa mọi Pokémon xuống băng ghế rồi chọn lại N con mạnh nhất
  for (let i = 0; i < g.board.length; i++) if (g.board[i]) { const u = g.board[i]; const bi = g.bench.findIndex(x => !x); if (bi < 0) break; g.move(u.id, { zone: 'bench', idx: bi }); }
  const val = u => LINE[u.key].cost * (u.star === 1 ? 1 : u.star === 2 ? 3.2 : 10) + u.items.length * .6;
  const pick = g.bench.filter(Boolean).sort((a, b) => val(b) - val(a)).slice(0, g.cap);
  const front = pick.filter(u => LINE[u.key].range <= 1), back = pick.filter(u => LINE[u.key].range > 1);
  let k = 0;
  for (const u of front) g.move(u.id, { zone: 'board', idx: 0 * 8 + ORDER[k++ % 8] });
  k = 0;
  for (const u of back) g.move(u.id, { zone: 'board', idx: 3 * 8 + ORDER[k++ % 8] });
}

export function equip(g) {
  let guard = 0;
  while (g.bag.length && guard++ < 30) {
    const carriers = g.boardUnits().filter(u => u.items.length < 3 || u.items.some(i => ITEMS[i].comp)).sort((a, b) => LINE[b.key].cost * b.star - LINE[a.key].cost * a.star);
    if (!carriers.length) break;
    const r = g.giveItem(0, carriers[0].id);
    if (!r.ok) break;
  }
}

export function shopTurn(g, skill = 1) {
  const reserve = g.round < 8 ? 6 : g.round < 14 ? 20 : 30;
  const want = targetLevel(g.round, skill);
  // lên cấp
  let guard = 0;
  while (g.level < want && g.gold >= 4 + (g.round < 6 ? 0 : 10) && guard++ < 10) g.buyXp();
  // mua đồ
  for (let pass = 0; pass < 4; pass++) {
    const act = calcTraits(g.boardUnits().map(u => ({ key: u.key, traits: unitTraits(LINE[u.key], u.star) })));
    let bestSlot = -1, bestScore = 0;
    g.shop.forEach((key, i) => {
      if (!key) return; const l = LINE[key];
      if (g.gold - l.cost < (l.cost <= 2 && g.round < 6 ? 0 : reserve - 8)) return;
      if (!g.canFit(key)) return;
      const have = g.allUnits().filter(u => u.key === key && u.star === 1).length;
      let score = l.cost + (have >= 2 ? 20 : have === 1 ? 4 : 0);
      for (const t of unitTraits(l, 1)) { const a = act[t]; if (a && a.count >= 1) score += 1.5 + a.count * .5; }
      if (score > bestScore) { bestScore = score; bestSlot = i; }
    });
    if (bestSlot >= 0) { g.buy(bestSlot); continue; }
    if (g.gold - 2 >= reserve && g.round >= 3 && pass < 3) { g.reroll(); continue; }
    break;
  }
  // bán bớt khi băng ghế đầy
  while (g.bench.filter(Boolean).length >= 9) {
    const worst = g.bench.filter(Boolean).sort((a, b) => LINE[a.key].cost * a.star - LINE[b.key].cost * b.star)[0]; g.sell(worst.id);
  }
  placeBest(g); equip(g);
}

// Chơi trọn ván: trả về { placement, rounds, match }
export function playGame({ seed = 1, skill = 1, starter = 'charmander', maxRounds = 80, lazy = false } = {}) {
  const m = Match.create(seed, starter), g = m.g;
  let guard = 0;
  while (!g.over && guard++ < maxRounds) {
    m.beginRound();
    if (!lazy) shopTurn(g, skill); else placeBest(g);
    const specs = [...g.teamSpecs(), ...g.fight.specs];
    const b = new Battle(specs, { seed: (g.rng() * 2 ** 31) >>> 0, events: false });
    let n = 0; while (!b.over && n++ < 4000) b.step();
    m.finishRound({ winner: b.winner, survivors: b.alive(b.winner).length });
  }
  return { placement: g.placement || 8, rounds: g.round, match: m };
}
