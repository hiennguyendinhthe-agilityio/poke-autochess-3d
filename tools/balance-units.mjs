// Cân bằng từng Pokémon: đấu vòng tròn 1v1 (và 2v2 bản sao) giữa các dòng cùng giá / khác giá.
// Dùng: node tools/balance-units.mjs [sao=1]
import { runBattle } from '../src/sim/battle.js';
import { LINES } from '../src/data/roster.js';
const STAR = +(process.argv[2] || 1), COPIES = 2;
const mk = (team, l, i) => ({ id: team * 100 + i, team, cell: { c: 3 + i, r: LINE_ROW(l) }, key: l.key, star: STAR, items: [] });
const LINE_ROW = l => l.range <= 1 ? 0 : 3;
function duel(a, b, seed) {
  const specs = [];
  for (let i = 0; i < COPIES; i++) { specs.push(mk(0, a, i)); specs.push(mk(1, b, i)); }
  const r = runBattle(specs, seed);
  return r.winner === 0 ? 1 : 0;
}
const wr = {};
for (const l of LINES) wr[l.key] = { w: 0, n: 0, byCost: {} };
for (let i = 0; i < LINES.length; i++) for (let j = 0; j < LINES.length; j++) {
  if (i === j) continue;
  const a = LINES[i], b = LINES[j];
  let w = 0; for (let s = 1; s <= 2; s++) w += duel(a, b, s * 17 + i);
  wr[a.key].w += w; wr[a.key].n += 2;
  const k = b.cost; wr[a.key].byCost[k] = wr[a.key].byCost[k] || [0, 0]; wr[a.key].byCost[k][0] += w; wr[a.key].byCost[k][1] += 2;
}
for (let c = 1; c <= 5; c++) {
  console.log(`\n== Giá ${c} (sao ${STAR}) — thắng % vs tất cả | vs giá thấp hơn | vs cùng giá | vs giá cao hơn`);
  for (const l of LINES.filter(x => x.cost === c)) {
    const r = wr[l.key], pct = (a, b) => b ? Math.round(a / b * 100) : '-';
    const lo = [0, 0], same = r.byCost[c] || [0, 0], hi = [0, 0];
    for (const k in r.byCost) { const t = r.byCost[k]; if (+k < c) { lo[0] += t[0]; lo[1] += t[1]; } if (+k > c) { hi[0] += t[0]; hi[1] += t[1]; } }
    console.log(l.key.padEnd(11), String(pct(r.w, r.n)).padStart(3) + '%', '|', String(pct(lo[0], lo[1])).padStart(3), '|', String(pct(same[0], same[1])).padStart(3), '|', String(pct(hi[0], hi[1])).padStart(3), `  ${l.skill[1]}`);
  }
}
