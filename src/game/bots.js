// Đối thủ AI: 7 bot phát triển kinh tế, lên cấp, mua và gộp Pokémon theo luật gần giống người chơi.
import { LINES, LINE, formAt, unitTraits, LINES_BY_COST } from '../data/roster.js';
import { ITEMS } from '../data/items.js';
import { SHOP_ODDS, MAX_ITEMS } from './state.js';
import { baseDamage } from './rounds.js';

export const BOT_TEMPLATES = [
  { name: 'Kasumi', col: '#4aa8ff', focus: ['Water', 'Psychic'] },
  { name: 'Takeshi', col: '#c4ae4a', focus: ['Rock', 'Ground', 'Fighting'] },
  { name: 'Shigeru', col: '#c8935a', focus: ['eevee', 'Normal', 'Electric'] },
  { name: 'Haruka', col: '#ff7a8a', focus: ['Fire', 'Fairy', 'Flying'] },
  { name: 'Hikari', col: '#7ec8ff', focus: ['starter', 'Ice', 'Grass'] },
  { name: 'Cynthia', col: '#9a6cff', focus: ['Ghost', 'Dark', 'Psychic'] },
  { name: 'Lance', col: '#ff5a3a', focus: ['Dragon', 'Flying', 'Fire'] }
];
// Hệ số điều chỉnh độ khó của bot (cân bằng bằng tools/balance.mjs)
export const BOT_TUNE = { income: .65, itemEvery: 3 };
// 3 mức độ khó: hệ số thu nhập của bot (đo bằng tools/balance.mjs với người chơi tự động trung bình)
export const DIFFICULTY = [
  { id: 0, name: 'Dễ', desc: 'Bot phát triển chậm, hợp để làm quen', income: .45 },
  { id: 1, name: 'Thường', desc: 'Cân bằng, phù hợp đa số người chơi', income: .65 },
  { id: 2, name: 'Khó', desc: 'Bot mạnh và ít mắc lỗi hơn', income: .9 }
];
// Cấp độ của bot theo vòng (vòng nhỏ nhất để đạt cấp)
const LEVEL_AT = [0, 0, 1, 3, 5, 8, 12, 17, 23, 30];
const COMPLETE = Object.values(ITEMS).filter(i => !i.comp).map(i => i.id);

export function makeBots(rng) {
  return BOT_TEMPLATES.map((t, i) => ({
    id: 100 + i, ...t, hp: 100, alive: true, place: 0,
    skill: .85 + rng() * .3, level: 2, gold: 0, units: [], nid: 1, lastOpp: -1, streak: 0
  }));
}

const traitsOf = (key, star = 1) => unitTraits(LINE[key], star);
const focusHits = (bot, key) => traitsOf(key, 1).filter(t => bot.focus.includes(t)).length;
const value = (bot, u) => LINE[u.key].cost * (u.star === 1 ? 1 : u.star === 2 ? 3.2 : 10) + focusHits(bot, u.key) * .8 + u.items.length * .6;

function mergeBot(bot) {
  let again = true;
  while (again) {
    again = false;
    for (const l of LINES) for (let star = 1; star <= 2; star++) {
      const us = bot.units.filter(u => u.key === l.key && u.star === star);
      if (us.length >= 3) {
        const t = us.slice(0, 3), keep = t[0], items = t.flatMap(u => u.items);
        bot.units = bot.units.filter(u => u === keep || !t.includes(u));
        keep.star = star + 1; keep.items = items.slice(0, MAX_ITEMS); again = true;
      }
    }
  }
}

function draw(bot, rng) {
  const odds = SHOP_ODDS[bot.level], out = [];
  for (let i = 0; i < 5; i++) {
    let r = rng() * 100, cost = 1;
    for (let c = 0; c < 5; c++) { if (r < odds[c]) { cost = c + 1; break; } r -= odds[c]; }
    const cand = LINES_BY_COST[cost]; out.push(cand[rng.int(cand.length)]);
  }
  return out;
}

// Bot "chơi" một vòng: lên cấp, nhận vàng, mua Pokémon, gộp sao, nhận vật phẩm
export function growBot(bot, round, rng, income = BOT_TUNE.income) {
  while (bot.level < 9 && round >= LEVEL_AT[bot.level + 1]) bot.level++;
  const base = Math.min(5, 1 + round);
  bot.gold += Math.round((base + Math.min(5, Math.floor(bot.gold / 10))) * bot.skill * income) + (Math.abs(bot.streak) >= 3 ? 1 : 0);
  const keep = round < 6 ? 0 : round < 14 ? 10 + (bot.skill > 1 ? 10 : 0) : 30;
  const maxUnits = bot.level + 8;
  let guard = 0;
  while (bot.gold > keep + 1 && guard++ < 10) {
    const shop = draw(bot, rng);
    let bestScore = -1, best = null;
    for (const l of shop) {
      if (l.cost > bot.gold) continue;
      const have = bot.units.filter(u => u.key === l.key && u.star === 1).length;
      const score = l.cost + focusHits(bot, l.key) * 2.5 + (have >= 2 ? 12 : have === 1 ? 4 : 0) + rng() * 1.5;
      if (score > bestScore) { bestScore = score; best = l; }
    }
    if (best && bestScore > 2.5) {
      bot.gold -= best.cost; bot.units.push({ key: best.key, star: 1, items: [], id: bot.nid++ });
      mergeBot(bot);
      if (bot.units.length > maxUnits) {
        const worst = bot.units.reduce((a, b) => value(bot, a) < value(bot, b) ? a : b);
        bot.units.splice(bot.units.indexOf(worst), 1);
      }
    } else if (bot.gold >= keep + 2) bot.gold -= 2;       // làm mới cửa hàng
    else break;
  }
  // vật phẩm
  if (round >= 3 && (round % BOT_TUNE.itemEvery === 0) && bot.units.length) {
    const target = bot.units.filter(u => u.items.length < MAX_ITEMS).sort((a, b) => value(bot, b) - value(bot, a))[0];
    if (target) target.items.push(COMPLETE[rng.int(COMPLETE.length)]);
  }
}

// Xếp đội hình của bot vào ô: kẻ cận chiến đứng trước, đánh xa đứng sau
export function botSpecs(bot, team, idBase = 0) {
  const top = [...bot.units].sort((a, b) => value(bot, b) - value(bot, a)).slice(0, bot.level);
  const front = top.filter(u => LINE[u.key].range <= 1).sort((a, b) => LINE[b.key].cost - LINE[a.key].cost);
  const back = top.filter(u => LINE[u.key].range > 1).sort((a, b) => LINE[b.key].cost - LINE[a.key].cost);
  const order = [3, 4, 2, 5, 1, 6, 0, 7];
  const rows = (list, rs) => {
    const out = []; let k = 0;
    for (const r of rs) for (const c of order) { if (k < list.length) out.push({ u: list[k++], c, r }); }
    return out;
  };
  // cận chiến: hàng 0, rồi 1; đánh xa: hàng 3, rồi 2
  const placed = [...rows(front, [0, 1]), ...rows(back, [3, 2])];
  return placed.map((p, i) => ({ id: idBase + i + 1, team, cell: { c: p.c, r: p.r }, key: p.u.key, star: p.u.star, items: [...p.u.items] }));
}

// Pokémon hoang dã cho vòng PvE
export function wildSpecs(info) {
  const order = [3, 4, 2, 5, 1, 6, 0, 7];
  return info.units.map((u, i) => ({ id: 1e6 + i, team: 1, cell: { c: order[i % 8], r: i < 8 ? 0 : 1 }, wild: u.wild, cost: u.cost, mult: u.mult, star: u.star || 1, items: [] }));
}

export { baseDamage };
