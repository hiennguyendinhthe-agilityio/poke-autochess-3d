// Roster: ghép dòng Pokémon (lines.js) + dữ liệu tải về (generated/forms.json) -> chỉ số chiến đấu.
import FORMS from './generated/forms.json' with { type: 'json' };
import { LINES, WILD } from './lines.js';
import { ABILITY_KINDS } from '../sim/ability-kinds.js';

export { FORMS, LINES };
export const LINE = {}; LINES.forEach(l => { LINE[l.key] = l; });
export const POOL_SIZE = [0, 22, 20, 17, 10, 9];       // số bản sao mỗi Pokémon trong kho chung, theo giá
export const COST_COL = ['', '#9aa3b5', '#5fd068', '#4aa8ff', '#c46bff', '#ffcf3a'];
export const STAR_HP = [0, 1, 1.8, 3.24];
export const STAR_ATK = [0, 1, 1.5, 2.25];
export const STAR_ABILITY = [0, 1, 1.75, 3.0];

// Chỉ số cơ bản ở 1★ theo giá
// (mỗi bậc giá mạnh hơn bậc trước khoảng 1.2 lần ở mỗi chỉ số; bậc 5 là huyền thoại nên nhỉnh hơn)
const COST_HP = [0, 520, 610, 710, 820, 950];
const COST_ATK = [0, 38, 44, 51, 60, 70];
export const COST_POWER = [0, 110, 128, 148, 172, 205];   // sức mạnh kỹ năng 1★

// Trung bình các chỉ số gốc (dạng cuối của mỗi dòng) để quy đổi tỉ lệ
const mean = {};
{
  const acc = { hp: 0, off: 0, def: 0, spd: 0, spe: 0 }; let n = 0;
  for (const l of LINES) for (const d of [l.dex[2]]) {
    const s = FORMS[d].stats; n++;
    acc.hp += s.hp; acc.off += Math.max(s.atk, s.spa); acc.def += s.def; acc.spd += s.spd; acc.spe += s.spe;
  }
  for (const k in acc) mean[k] = acc[k] / n;
}
const R = (x, m, pw, lo, hi) => Math.max(lo, Math.min(hi, Math.pow(x / m, pw)));

export const formAt = (line, star) => { const dex = line.dex[star - 1]; return { dex, ...FORMS[dex] }; };
export const unitTraits = (line, star) => [...new Set([...formAt(line, star).types, ...line.traits])];
export const skillAt = (line, star) => {
  const s = (star === 3 && line.skill3) ? line.skill3 : line.skill;
  return { name: s[0], kind: s[1], type: s[2] };
};

// Chỉ số cơ bản (chưa tính tộc & vật phẩm) cho Pokémon `line` ở `star`
export function baseStats(line, star, opt = {}) {
  // "hình dáng" chỉ số lấy theo dạng cuối của dòng, để Pokémon chưa tiến hóa không bị thiệt so với cùng bậc giá
  // (riêng dòng có cờ `own`, như Magikarp, dùng đúng dạng hiện tại)
  const f = formAt(line, star), s = (line.own ? f : FORMS[line.dex[2]]).stats, c = line.cost;
  // `tune` (trong lines.js) là hệ số tinh chỉnh riêng từng dòng, rút ra từ tools/balance-teams.mjs
  const t = line.tune || 1, mult = (opt.mult || 1) * Math.sqrt(t);
  const off = Math.max(s.atk, s.spa);
  const sk = line.skill ? skillAt(line, star) : null;
  const kind = sk && ABILITY_KINDS[sk.kind];
  return {
    hp: Math.round(COST_HP[c] * R(s.hp, mean.hp, .5, .75, 1.5) * STAR_HP[star] * mult),
    atk: Math.round(COST_ATK[c] * R(off, mean.off, .6, .7, 1.5) * STAR_ATK[star] * mult),
    as: Math.max(.45, Math.min(.95, .55 * Math.pow(s.spe / mean.spe, .4))),
    armor: Math.round(10 + 22 * R(s.def, mean.def, .7, .5, 1.8)),
    mr: Math.round(10 + 22 * R(s.spd, mean.spd, .7, .5, 1.8)),
    range: line.range || 1,
    moveSpeed: 1.9 * R(s.spe, mean.spe, .2, .85, 1.2),
    crit: .05, critDmg: .5,
    manaMax: kind ? kind.mana : 0,
    manaStart: 0,
    abilityPower: COST_POWER[c] * STAR_ABILITY[star] * (opt.mult || 1) * t
  };
}

// Pokémon hoang dã cho vòng PvE: dùng chỉ số theo giá + hệ số, không có kỹ năng
export function wildDef(key, cost, star = 1, mult = 1) {
  const w = WILD[key], f = FORMS[w.dex];
  const line = { key: 'wild_' + key, cost, dex: [w.dex, w.dex, w.dex], traits: [], skill: null, range: 1, wild: true };
  return { line, form: { dex: w.dex, ...f }, stats: baseStats(line, star, { mult }) };
}

export const LINES_BY_COST = [null, [], [], [], [], []];
LINES.forEach(l => LINES_BY_COST[l.cost].push(l));
