// Đo cân bằng bằng mô phỏng: chạy nhiều ván với người chơi tự động và in phân bố thứ hạng.
// Dùng: node tools/balance.mjs [số ván=30] [--income=0.8] [--item=3]
import { playGame } from './autoplay.mjs';
import { BOT_TUNE } from '../src/game/bots.js';
const args = process.argv.slice(2);
const n = +(args.find(a => /^\d+$/.test(a)) || 30);
for (const a of args) { const m = a.match(/^--(\w+)=([\d.]+)$/); if (m) { if (m[1] === 'income') BOT_TUNE.income = +m[2]; if (m[1] === 'item') BOT_TUNE.itemEvery = +m[2]; } }
const hist = Array(9).fill(0), rounds = [];
for (let seed = 1; seed <= n; seed++) {
  const r = playGame({ seed, skill: 1 }); hist[r.placement]++; rounds.push(r.rounds);
}
const avg = hist.reduce((s, c, p) => s + c * p, 0) / n;
console.log(`income=${BOT_TUNE.income} itemEvery=${BOT_TUNE.itemEvery} | ${n} ván | hạng TB ${avg.toFixed(2)} | vòng TB ${(rounds.reduce((a, b) => a + b, 0) / n).toFixed(1)}`);
console.log('phân bố hạng 1..8:', hist.slice(1).join(' '));
