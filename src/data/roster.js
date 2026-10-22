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
const COST_HP = [0, 520, 700, 920, 1180, 1500];
const COST_ATK = [0, 38, 50, 64, 82, 108];
export const COST_POWER = [0, 110, 150, 200, 270, 380];   // sức mạnh kỹ năng 1★

// Trung bình các chỉ số gốc trong roster (để quy đổi tỉ lệ)
const mean = {};
{
  const seen = new Set(), acc = { hp: 0, off: 0, def: 0, spd: 0, spe: 0 }; let n = 0;
  for (const l of LINES) for (const d of l.dex) {
    if (seen.has(d)) continue; seen.add(d); const s = FORMS[d].stats; n++;
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
  const f = formAt(line, star), s = f.stats, c = line.cost, mult = opt.mult || 1;
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
    abilityPower: COST_POWER[c] * STAR_ABILITY[star] * mult
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
