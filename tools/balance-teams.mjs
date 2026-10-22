// Cân bằng bằng trận đội hình ngẫu nhiên: mỗi bên 4 Pokémon cùng bậc giá (sao 1 hoặc tuỳ chọn).
// In tỉ lệ thắng của từng Pokémon khi có mặt trong đội, và tỉ lệ thắng giữa các bậc giá liền kề.
// Dùng: node tools/balance-teams.mjs [số trận mỗi bậc=1500] [sao=1]
import { runBattle } from '../src/sim/battle.js';
import { LINES } from '../src/data/roster.js';
import { mulberry32 } from '../src/sim/rng.js';
const N = +(process.argv[2] || 1500), STAR = +(process.argv[3] || 1), TEAM = 4;
const rng = mulberry32(2024);
const ORDER = [3, 4, 2, 5, 1, 6, 0, 7];
function team(t, lines, star) {
  const front = lines.filter(l => l.range <= 1), back = lines.filter(l => l.range > 1);
  const out = []; let k = 0;
  for (const l of front) out.push({ id: t * 100 + out.length + 1, team: t, cell: { c: ORDER[k++], r: 0 }, key: l.key, star, items: [] });
  k = 0; for (const l of back) out.push({ id: t * 100 + out.length + 1, team: t, cell: { c: ORDER[k++], r: 3 }, key: l.key, star, items: [] });
  return out;
}
const sample = (pool, n) => { const a = [...pool], o = []; while (o.length < n) o.push(a.splice(rng.int(a.length), 1)[0]); return o; };

for (let c = 1; c <= 5; c++) {
  const pool = LINES.filter(l => l.cost === c), size = Math.min(TEAM, pool.length);
  const st = {}; pool.forEach(l => st[l.key] = [0, 0]);
  for (let i = 0; i < N; i++) {
    const A = sample(pool, size), B = sample(pool, size);
    const r = runBattle([...team(0, A, STAR), ...team(1, B, STAR)], i + 1);
    for (const l of A) { st[l.key][1]++; if (r.winner === 0) st[l.key][0]++; }
    for (const l of B) { st[l.key][1]++; if (r.winner === 1) st[l.key][0]++; }
  }
  const rows = pool.map(l => [l.key, st[l.key][0] / st[l.key][1], l.skill[1]]).sort((a, b) => b[1] - a[1]);
  console.log(`\n== Giá ${c} (sao ${STAR}) — tỉ lệ thắng khi có mặt trong đội`);
  console.log(rows.map(r => `${r[0]} ${Math.round(r[1] * 100)}% (${r[2]})`).join('\n'));
}
// bậc giá cao vs thấp
console.log('\n== Đội 4 con giá c+1 vs đội 4 con giá c (sao 1 cả hai)');
for (let c = 1; c < 5; c++) {
  const lo = LINES.filter(l => l.cost === c), hi = LINES.filter(l => l.cost === c + 1); let w = 0; const n = 600;
  for (let i = 0; i < n; i++) { const r = runBattle([...team(0, sample(hi, Math.min(4, hi.length)), 1), ...team(1, sample(lo, 4), 1)], i + 5); if (r.winner === 0) w++; }
  console.log(`giá ${c + 1} thắng giá ${c}: ${Math.round(w / n * 100)}%`);
}
