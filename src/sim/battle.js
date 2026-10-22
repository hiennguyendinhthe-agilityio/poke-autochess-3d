// Engine chiến đấu tự động. Thuần logic (không DOM/Three.js) nên chạy được trong Node để test và mô phỏng bot.
// Bàn cờ lục giác 8x8 (xem hex.js). Mỗi Pokémon chiếm 1 ô, di chuyển từng ô, tầm đánh đo bằng số ô.
// Toạ độ thế giới (x, z) dùng cho hiển thị, hiệu ứng vùng và đạn. Đội 0 (người chơi) ở nửa dưới, đội 1 ở nửa trên.
import { rawEff, effMult } from '../data/types.js';
import { LINE, baseStats, formAt, unitTraits, skillAt, wildDef } from '../data/roster.js';
import { TRAITS, calcTraits } from '../data/traits.js';
import { ITEMS } from '../data/items.js';
import { ABILITY_KINDS } from './ability-kinds.js';
import { mulberry32 } from './rng.js';
import { COLS, CELLS, NB, center, idx, toGlobal, dist as hexDist } from './hex.js';

export const DT = 1 / 30;
const SUDDEN_AT = 32, HARD_CAP = 80;
const SELF_CAST = new Set(['heal', 'shield', 'rally', 'counter', 'splash', 'leap', 'blink', 'meteor']);

// Toạ độ thế giới từ ô của đội: hàng 0 = sát đối thủ
export function cellPos(team, c, r) { const g = toGlobal(team, c, r); return center(g.c, g.r); }

const sumMods = list => {
  const o = {};
  for (const m of list) for (const k in m) {
    const v = m[k];
    if (typeof v === 'number') o[k] = (o[k] || 0) + v; else o[k] = v;
  }
  return o;
};

// spec: { id, team, cell:{c,r}, key, star, items:[], wild?:'rattata', cost?, mult? }
export function resolveSpec(s) {
  if (s.wild) {
    const d = wildDef(s.wild, s.cost || 1, s.star || 1, s.mult || 1);
    return { line: d.line, form: d.form, base: d.stats, traits: [], ability: null };
  }
  const line = LINE[s.key], star = s.star || 1;
  const form = formAt(line, star);
  return { line, form, base: baseStats(line, star), traits: unitTraits(line, star), ability: line.skill ? skillAt(line, star) : null };
}

export class Battle {
  constructor(specs, { seed = 1, events = true } = {}) {
    this.rng = mulberry32(seed);
    this.emit = events;
    this.ev = [];
    this.t = 0; this.tick = 0;
    this.f = []; this.proj = []; this.zones = []; this.grid = Array(CELLS).fill(null);
    this.winner = null; this.over = false;
    this.nextId = 1;
    const defs = specs.map(s => ({ s, d: resolveSpec(s) }));
    // tộc/hệ kích hoạt theo từng đội
    const active = [{}, {}];
    for (const team of [0, 1]) {
      const us = defs.filter(x => x.s.team === team && !x.s.wild).map(x => ({ key: x.s.key, traits: x.d.traits }));
      active[team] = calcTraits(us);
    }
    for (const { s, d } of defs) { const f = this.make(s, d, active[s.team]); this.f.push(f); this.grid[idx(f.hc, f.hr)] = f; }
    this.active = active;
    // khiên đầu trận
    for (const f of this.f) if (f.m.shieldPct) { f.shield = f.maxHp * f.m.shieldPct; f.shieldUntil = 12; }
  }

  make(s, d, act) {
    const mods = [];
    for (const id in act) {
      const a = act[id]; if (a.tier < 0) continue;
      const tier = TRAITS[id].tiers[a.tier], mine = d.traits.includes(id);
      if (mine && tier.mods) mods.push(tier.mods);
      if (tier.allMods) mods.push(tier.allMods);
    }
    for (const it of (s.items || [])) if (ITEMS[it]) mods.push(ITEMS[it].mods);
    const m = sumMods(mods);
    const b = d.base, g = toGlobal(s.team, s.cell.c, s.cell.r), pos = center(g.c, g.r);
    const maxHp = Math.round(b.hp * (1 + (m.hpPct || 0)));
    return {
      id: s.id, team: s.team, key: s.key || ('wild_' + s.wild), star: s.star || 1, dex: d.form.dex, name: d.form.name, types: d.form.types, line: d.line,
      x: pos.x, z: pos.z, hc: g.c, hr: g.r, mv: null, fx: 0, fz: s.team === 0 ? -1 : 1,
      hp: maxHp, maxHp, shield: 0, shieldUntil: 0, alive: true,
      b, m, base: b, atkPct0: m.atkPct || 0,
      mana: Math.min(b.manaMax || 0, (b.manaStart || 0) + (m.manaStart || 0)), manaMax: b.manaMax,
      ability: d.ability, abPow: b.abilityPower, fxKind: d.line.fx || null,
      target: null, atkT: 0, wind: null, cast: null, leap: null, recover: 0,
      stun: 0, slows: [], buffs: [], dots: [], dotAcc: 0, dotT: 0,
      gs: 0, gT: 0, sw: false, sashUsed: false, moving: false,
      // chỉ số hiệu dụng (cập nhật mỗi tick)
      atkE: b.atk, asE: b.as, msE: b.moveSpeed, armorE: b.armor, mrE: b.mr, drE: 0, thE: 0,
      items: s.items || [], dealt: 0, taken: 0, kills: 0, lastHit: -9
    };
  }

  // ---------- tiện ích ----------
  push(e) { if (this.emit) this.ev.push(e); }
  alive(team) { return this.f.filter(f => f.alive && f.team === team); }
  byId(id) { return this.f.find(f => f.id === id); }
  foes(f) { return this.f.filter(o => o.alive && o.team !== f.team); }
  friends(f) { return this.f.filter(o => o.alive && o.team === f.team); }
  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  // khoảng cách theo số ô giữa hai Pokémon
  hd(a, b) { return hexDist(a.hc, a.hr, b.hc, b.hr); }
  nearest(f, list) { let best = null, bd = 1e9; for (const o of list) { const d = this.hd(f, o) + Math.hypot(f.x - o.x, f.z - o.z) * 1e-3; if (d < bd - 1e-9 || (Math.abs(d - bd) < 1e-9 && best && o.id < best.id)) { bd = d; best = o; } } return best; }
  reach(f) { return f.b.range; }
  free(i) { return !this.grid[i]; }
  // chuyển sang ô i: giải phóng ô cũ, giữ chỗ ô mới ngay (tránh hai Pokémon cùng bước vào một ô)
  claim(f, i) { this.grid[idx(f.hc, f.hr)] = null; this.grid[i] = f; f.hc = i % COLS; f.hr = (i / COLS) | 0; }
  beginMove(f, i) {
    this.claim(f, i); const p = center(f.hc, f.hr), dx = p.x - f.x, dz = p.z - f.z, L = Math.hypot(dx, dz) || 1;
    f.mv = { x0: f.x, z0: f.z, x1: p.x, z1: p.z, p: 0 }; f.fx = dx / L; f.fz = dz / L; f.moving = true;
  }
  // Đi một ô về phía `tg` cho tới khi vào tầm `range` (BFS qua các ô trống). Trả về true nếu đã bắt đầu bước.
  stepToward(f, tg, range) {
    const start = idx(f.hc, f.hr), prev = new Int16Array(CELLS).fill(-2); prev[start] = -1;
    const q = [start]; let goal = -1;
    for (let h = 0; h < q.length; h++) {
      const cur = q[h];
      if (cur !== start && hexDist(cur % COLS, (cur / COLS) | 0, tg.hc, tg.hr) <= range) { goal = cur; break; }
      for (const n of NB[cur]) if (prev[n] === -2 && !this.grid[n]) { prev[n] = cur; q.push(n); }
    }
    if (goal >= 0) { let c = goal; while (prev[c] !== start) c = prev[c]; this.beginMove(f, c); return true; }
    // bị chặn kín: nhích sang ô trống gần mục tiêu hơn nếu có
    let best = -1, bd = hexDist(f.hc, f.hr, tg.hc, tg.hr);
    for (const n of NB[start]) if (!this.grid[n]) { const d = hexDist(n % COLS, (n / COLS) | 0, tg.hc, tg.hr); if (d < bd) { bd = d; best = n; } }
    if (best >= 0) { this.beginMove(f, best); return true; }
    return false;
  }
  // ô trống kề `o` tốt nhất theo `score` (nhỏ hơn là tốt hơn); -1 nếu không có
  freeNeighbor(o, score) {
    let best = -1, bs = 1e9;
    for (const n of NB[idx(o.hc, o.hr)]) if (!this.grid[n]) { const sc = score(n) + n * 1e-6; if (sc < bs) { bs = sc; best = n; } }
    return best;
  }

  refresh(f) {
    const m = f.m;
    let as = m.asPct || 0, atk = f.atkPct0 + f.gs * (m.growth ? m.growth.atkPct : 0), dr = m.dr || 0, th = m.thorns || 0;
    for (const bf of f.buffs) { as += bf.as || 0; atk += bf.atk || 0; dr += bf.dr || 0; th += bf.thorns || 0; }
    let slow = 0; for (const s of f.slows) slow = Math.max(slow, s.frac);
    f.atkE = f.b.atk * (1 + atk);
    f.asE = Math.min(2.5, f.b.as * (1 + as)) * (1 - slow);
    f.msE = f.b.moveSpeed * (1 + (m.moveSpeed || 0)) * (1 - slow * .6);
    f.armorE = f.b.armor + (m.armor || 0); f.mrE = f.b.mr + (m.mr || 0);
    f.drE = Math.min(.8, dr); f.thE = th;
  }

  // ---------- gây sát thương ----------
  // opt: { kind:'phys'|'mag'|'true', type, basic, ability, noCrit, dot, ranged }
  damage(src, dst, amount, opt = {}) {
    if (!dst.alive || amount <= 0) return 0;
    let crit = false, miss = false;
    if (opt.basic && dst.m.dodge && this.rng() < Math.min(.6, dst.m.dodge)) miss = true;
    if (miss) { this.push({ t: 'miss', id: dst.id }); return 0; }
    let eff = null;
    if (opt.type && !opt.dot) {
      const raw = rawEff(opt.type, dst.types);
      let mult = effMult(raw);
      if (opt.basic) mult = 1 + (mult - 1) * .5;      // đòn thường chịu ảnh hưởng hệ nhẹ hơn
      amount *= mult;
      eff = raw >= 2 ? 'super' : raw === 0 ? 'immune' : raw < 1 ? 'weak' : null;
    }
    if (opt.basic && !opt.noCrit && src) {
      const cc = (src.b.crit) + (src.m.crit || 0);
      if (this.rng() < cc) { crit = true; amount *= 1 + src.b.critDmg + (src.m.critDmg || 0); }
    }
    const kind = opt.kind || 'phys';
    if (kind === 'phys') amount *= 100 / (100 + dst.armorE);
    else if (kind === 'mag') amount *= 100 / (100 + dst.mrE);
    amount *= (1 - dst.drE);
    amount = Math.max(1, amount);
    // khiên
    let absorbed = 0;
    if (dst.shield > 0) { absorbed = Math.min(dst.shield, amount); dst.shield -= absorbed; amount -= absorbed; }
    let dealt = amount;
    if (dst.hp - amount <= 0 && dst.m.sash && !dst.sashUsed) { dst.sashUsed = true; dealt = dst.hp - 1; dst.hp = 1; this.push({ t: 'text', id: dst.id, text: 'Trụ vững!', col: '#ff7070' }); }
    else dst.hp -= amount;
    dst.taken += dealt + absorbed; dst.lastHit = this.t;
    if (src) { src.dealt += dealt + absorbed; if (src.m.lifesteal && src.alive && !opt.dot) this.heal(src, dealt * src.m.lifesteal, true); }
    if (!opt.dot) this.push({ t: 'hit', id: dst.id, src: src ? src.id : 0, dmg: Math.round(dealt + absorbed), crit, eff, type: opt.type || null, ability: !!opt.ability, ranged: !!opt.ranged });
    // năng lượng khi bị đánh
    if (dst.manaMax && !dst.cast) dst.mana = Math.min(dst.manaMax, dst.mana + Math.min(8, 2 + (dealt / dst.maxHp) * 40));
    // hiệu ứng trúng đòn thường
    if (opt.basic && src && src.alive) {
      const mm = src.m;
      if (mm.poisonOnHit) this.addDot(dst, { type: 'poison', dps: dst.maxHp * mm.poisonOnHit / 3, until: this.t + 3, src: src.id });
      if (mm.burnOnHit) this.addDot(dst, { type: 'burn', dps: dst.maxHp * mm.burnOnHit / 3, until: this.t + 3, src: src.id });
      if (mm.slowOnHit) this.slow(dst, mm.slowOnHit, 2);
      if (dst.thE && !opt.ranged && dst.alive) this.damage(dst, src, dealt * dst.thE, { kind: 'true', dot: true });
    }
    if (dst.hp <= 0) this.kill(dst, src);
    else if (!dst.sw && dst.m.secondWind && dst.hp < dst.maxHp * .35) { dst.sw = true; this.heal(dst, dst.maxHp * dst.m.secondWind, false); this.push({ t: 'text', id: dst.id, text: 'Không bỏ cuộc!', col: '#ff8a8a' }); }
    return dealt;
  }
  heal(f, amt, quiet) {
    if (!f.alive) return;
    const a = Math.min(f.maxHp - f.hp, amt); if (a <= 0) return;
    f.hp += a; if (!quiet) this.push({ t: 'heal', id: f.id, amount: Math.round(a) });
  }
  addShield(f, amt, dur) { f.shield += amt; f.shieldUntil = Math.max(f.shieldUntil, this.t + dur); this.push({ t: 'status', id: f.id, s: 'shield' }); }
  stunF(f, dur) { if (!f.alive || dur <= 0) return; f.stun = Math.max(f.stun, dur); f.wind = null; this.push({ t: 'status', id: f.id, s: 'stun', dur }); }
  slow(f, frac, dur) { if (!f.alive) return; f.slows.push({ frac, until: this.t + dur }); this.push({ t: 'status', id: f.id, s: 'slow' }); }
  addDot(f, d) { if (!f.alive) return; f.dots.push(d); this.push({ t: 'status', id: f.id, s: d.type }); }

  kill(f, src) {
    if (!f.alive) return;
    f.alive = false; f.hp = 0; f.cast = null; f.wind = null; f.leap = null; f.mv = null;
    if (this.grid[idx(f.hc, f.hr)] === f) this.grid[idx(f.hc, f.hr)] = null;
    if (src && src.alive) src.kills++;
    this.push({ t: 'death', id: f.id, x: f.x, z: f.z });
    const de = f.m.deathExplode;
    if (de) {
      this.push({ t: 'fx', k: 'nova', x: f.x, z: f.z, rad: de.rad, type: 'Fire', big: 1 });
      for (const o of this.f) if (o.alive && o.team !== f.team && Math.hypot(o.x - f.x, o.z - f.z) <= de.rad) {
        this.damage(null, o, de.dmg, { kind: 'mag', type: 'Fire', ability: true });
        if (de.stun) this.stunF(o, de.stun);
      }
    }
  }

  // ---------- vòng lặp ----------
  step() {
    if (this.over) return;
    const dt = DT; this.t += dt; this.tick++;
    // vùng trễ (thiên thạch)
    for (const z of this.zones) {
      z.t -= dt; if (z.t > 0) continue; z.done = true;
      this.push({ t: 'fx', k: 'impact', x: z.x, z: z.z, rad: z.rad, type: z.type });
      const src = this.byId(z.src);
      for (const o of this.f) if (o.alive && o.team !== z.team && Math.hypot(o.x - z.x, o.z - z.z) <= z.rad) {
        this.damage(src, o, z.dmg, { kind: 'mag', type: z.type, ability: true });
        if (z.stun) this.stunF(o, z.stun);
      }
    }
    if (this.zones.length) this.zones = this.zones.filter(z => !z.done);
    // đạn
    for (const p of this.proj) this.stepProj(p, dt);
    if (this.proj.length) this.proj = this.proj.filter(p => !p.done);
    for (const f of this.f) if (f.alive) this.update(f, dt);
    // sudden death
    if (this.t > SUDDEN_AT) {
      const rate = .004 * (this.t - SUDDEN_AT);
      for (const f of this.f) if (f.alive) { f.hp -= f.maxHp * rate * dt; if (f.hp <= 0) this.kill(f, null); }
    }
    const a0 = this.f.some(f => f.alive && f.team === 0), a1 = this.f.some(f => f.alive && f.team === 1);
    if (!a0 || !a1 || this.t > HARD_CAP) {
      this.over = true;
      if (a0 && !a1) this.winner = 0; else if (a1 && !a0) this.winner = 1;
      else if (!a0 && !a1) this.winner = 1;       // cùng gục: coi như thua cho đội tấn công (đội 0)
      else { const h = t => this.f.filter(f => f.alive && f.team === t).reduce((s, f) => s + f.hp / f.maxHp, 0); this.winner = h(0) > h(1) ? 0 : 1; }
      this.push({ t: 'end', winner: this.winner });
    }
  }

  stepProj(p, dt) {
    if (p.delay > 0) { p.delay -= dt; const s = this.byId(p.src); if (s) { p.x = s.x; p.z = s.z; } return; }
    const tg = this.byId(p.tid);
    if (tg && tg.alive) { p.tx = tg.x; p.tz = tg.z; }
    const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz), s = p.speed * dt;
    if (d <= s + .12) {
      p.done = true;
      if (tg && tg.alive) { const src = this.byId(p.src); this.damage(src && src.alive ? src : (src || null), tg, p.dmg, { kind: p.kind, type: p.type, basic: p.basic, ability: !p.basic, ranged: true, noCrit: p.noCrit }); if (p.stun) this.stunF(tg, p.stun); }
      return;
    }
    p.x += dx / d * s; p.z += dz / d * s;
  }

  update(f, dt) {
    // dọn hiệu ứng hết hạn
    if (f.slows.length) f.slows = f.slows.filter(s => s.until > this.t);
    if (f.buffs.length) f.buffs = f.buffs.filter(b => b.until > this.t);
    if (f.shield > 0 && f.shieldUntil < this.t) f.shield = 0;
    this.refresh(f);
    // sát thương theo thời gian
    if (f.dots.length) {
      f.dots = f.dots.filter(d => d.until > this.t);
      let sum = 0; for (const d of f.dots) sum += d.dps * dt;
      if (sum > 0) { f.hp -= sum; f.dotAcc += sum; f.dotT += dt; }
      if (f.dotT >= .5 && f.dotAcc >= 1) { this.push({ t: 'hit', id: f.id, src: 0, dmg: Math.round(f.dotAcc), dot: true, type: f.dots[0] ? f.dots[0].type : null }); f.dotAcc = 0; f.dotT = 0; }
      if (f.hp <= 0) { this.kill(f, null); return; }
    }
    if (f.m.regenPct && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * f.m.regenPct * dt);
    if (f.manaMax && f.m.manaRegen && !f.cast) f.mana = Math.min(f.manaMax, f.mana + f.m.manaRegen * dt);
    if (f.m.growth) { f.gT += dt; if (f.gT >= f.m.growth.every) { f.gT = 0; f.gs++; const add = f.b.hp * f.m.growth.hpPct; f.maxHp += add; f.hp += add; this.push({ t: 'text', id: f.id, text: 'Lớn lên!', col: '#7ed957' }); } }
    f.moving = false;
    if (f.atkT > 0) f.atkT -= dt;
    if (f.recover > 0) f.recover -= dt;
    if (f.stun > 0) { f.stun -= dt; f.wind = null; f.cast = null; return; }
    // nhảy
    if (f.leap) {
      const l = f.leap; l.t += dt; const k = Math.min(1, l.t / l.dur);
      f.x = l.x0 + (l.x1 - l.x0) * k; f.z = l.z0 + (l.z1 - l.z0) * k;
      if (k >= 1) { f.leap = null; this.landLeap(f, l); }
      return;
    }
    // đang bước sang ô kế (không làm gì khác cho tới khi tới nơi)
    if (f.mv) {
      const m = f.mv; m.p += dt * f.msE; const k = Math.min(1, m.p);
      f.x = m.x0 + (m.x1 - m.x0) * k; f.z = m.z0 + (m.z1 - m.z0) * k; f.moving = true;
      if (k >= 1) f.mv = null;
      return;
    }
    // đang niệm kỹ năng
    if (f.cast) { f.cast.t -= dt; if (f.cast.t <= 0) { const c = f.cast; f.cast = null; this.resolve(f, c); f.recover = .2; } return; }
    // đang vung đòn
    if (f.wind) { f.wind.t -= dt; if (f.wind.t <= 0) { const w = f.wind; f.wind = null; this.strike(f, w); } return; }
    if (f.recover > 0) return;
    // chọn mục tiêu
    let tg = f.target != null ? this.byId(f.target) : null;
    if (!tg || !tg.alive) tg = null;
    const foes = this.foes(f);
    if (!foes.length) return;
    if (!tg || this.hd(f, tg) > this.reach(f)) { const n = this.nearest(f, foes); if (n !== tg) tg = n; }
    f.target = tg.id;
    const d = this.hd(f, tg), de = Math.hypot(tg.x - f.x, tg.z - f.z) || 1;
    f.fx = (tg.x - f.x) / de; f.fz = (tg.z - f.z) / de;
    // kỹ năng: đủ năng lượng thì tiến lại cho tới khi chiêu trúng đích rồi mới tung (không đánh thường lãng phí)
    if (f.ability && f.manaMax && f.mana >= f.manaMax) {
      const cr = this.castRange(f);
      if (d <= cr) { this.startCast(f, tg); return; }
      this.stepToward(f, tg, cr);
      return;
    }
    if (d <= this.reach(f)) {
      if (f.atkT <= 0) {
        f.wind = { t: Math.min(.22, .35 / f.asE), tid: tg.id };
        f.atkT = 1 / f.asE;
        this.push({ t: 'atk', id: f.id, tid: tg.id, ranged: f.b.range >= 2, type: f.types[0] });
      }
    } else this.stepToward(f, tg, this.reach(f));
  }

  strike(f, w) {
    const tg = this.byId(w.tid);
    if (f.manaMax) f.mana = Math.min(f.manaMax, f.mana + 10);
    if (!tg || !tg.alive) return;
    const type = f.types[0];
    if (f.b.range >= 2) this.proj.push({ x: f.x, z: f.z, tx: tg.x, tz: tg.z, tid: tg.id, src: f.id, speed: 11, dmg: f.atkE, kind: 'phys', type, basic: true, vis: 'basic' });
    else this.damage(f, tg, f.atkE, { kind: 'phys', type, basic: true });
  }

  // ---------- kỹ năng ----------
  startCast(f, tg) {
    const k = ABILITY_KINDS[f.ability.kind];
    f.mana = 0; f.cast = { t: k.cast, tid: tg.id };
    this.push({ t: 'cast', id: f.id, name: f.ability.name, kind: f.ability.kind, type: f.ability.type, tid: tg.id });
  }

  pow(f) { return f.abPow * (1 + (f.m.ap || 0) / 100); }
  // tầm tung chiêu: chiêu nổ quanh người phải có kẻ địch trong bán kính; chiêu tự thân/nhảy tung được từ xa
  castRange(f) {
    const kind = f.ability.kind;
    if (kind === 'nova' || kind === 'quake') return Math.round(ABILITY_KINDS[kind].nums(this.pow(f)).radius);   // số ô
    return SELF_CAST.has(kind) ? 99 : this.reach(f);
  }
  magic(f, o, dmg) { return this.damage(f, o, dmg, { kind: 'mag', type: f.ability.type, ability: true }); }

  resolve(f, c) {
    const kind = f.ability.kind, n = ABILITY_KINDS[kind].nums(this.pow(f)), type = f.ability.type;
    let tg = this.byId(c.tid); if (!tg || !tg.alive) tg = this.nearest(f, this.foes(f));
    if (!tg && !['heal', 'shield', 'rally', 'counter', 'splash'].includes(kind)) return;
    const fxe = (k, extra = {}) => this.push({ t: 'fx', k, type, x: f.x, z: f.z, tx: tg ? tg.x : f.x, tz: tg ? tg.z : f.z, ...extra });
    switch (kind) {
      case 'bolt': fxe('bolt', { id: f.id, tid: tg.id }); this.magic(f, tg, n.dmg); break;
      case 'stun': fxe('bolt', { id: f.id, tid: tg.id }); this.magic(f, tg, n.dmg); this.stunF(tg, n.stun); break;
      case 'drain': { fxe('bolt', { id: f.id, tid: tg.id, drain: 1 }); const d = this.magic(f, tg, n.dmg); this.heal(f, d, false); break; }
      case 'chain': {
        const hit = new Set(); let cur = tg, from = f, dmg = n.dmg;
        for (let i = 0; i < n.hits && cur; i++) {
          hit.add(cur.id); this.push({ t: 'fx', k: 'chain', type, x: from.x, z: from.z, tx: cur.x, tz: cur.z });
          this.magic(f, cur, dmg); dmg *= n.decay; from = cur;
          cur = this.nearest(cur, this.foes(f).filter(o => !hit.has(o.id) && Math.hypot(o.x - from.x, o.z - from.z) <= 3));
        }
        break;
      }
      case 'beam': {
        const dx = tg.x - f.x, dz = tg.z - f.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
        fxe('beam', { ux, uz, len: 9 });
        for (const o of this.foes(f)) {
          const px = o.x - f.x, pz = o.z - f.z, along = px * ux + pz * uz, side = Math.abs(px * uz - pz * ux);
          if (along > 0 && along < 9 && side <= n.width) { this.magic(f, o, n.dmg); }
        }
        break;
      }
      case 'burst': {
        this.push({ t: 'fx', k: 'burst', type, x: tg.x, z: tg.z, rad: n.radius, fx: f.fxKind, from: { x: f.x, z: f.z } });
        for (const o of this.foes(f)) if (Math.hypot(o.x - tg.x, o.z - tg.z) <= n.radius) {
          this.magic(f, o, n.dmg);
          if (f.fxKind === 'web') this.slow(o, n.slow, n.dur);
          else if (f.fxKind === 'poison') this.addDot(o, { type: 'poison', dps: n.dot / 5, until: this.t + 5, src: f.id });
          else if (f.fxKind === 'burn') this.addDot(o, { type: 'burn', dps: n.dot / 5, until: this.t + 5, src: f.id });
        }
        break;
      }
      case 'nova': {
        this.push({ t: 'fx', k: 'nova', type, x: f.x, z: f.z, rad: n.radius });
        for (const o of this.foes(f)) if (Math.hypot(o.x - f.x, o.z - f.z) <= n.radius) { this.magic(f, o, n.dmg); this.slow(o, n.slow, n.dur); }
        break;
      }
      case 'quake': {
        this.push({ t: 'fx', k: 'quake', type, x: f.x, z: f.z, rad: n.radius });
        for (const o of this.foes(f)) if (Math.hypot(o.x - f.x, o.z - f.z) <= n.radius) { this.magic(f, o, n.dmg); this.stunF(o, n.stun); }
        break;
      }
      case 'volley': {
        const foes = this.foes(f);
        for (let i = 0; i < n.n; i++) {
          const o = foes[this.rng.int(foes.length)];
          this.proj.push({ x: f.x, z: f.z, tx: o.x, tz: o.z, tid: o.id, src: f.id, speed: 10, dmg: n.dmg, kind: 'mag', type, basic: false, vis: 'ability', delay: i * .12 });
        }
        this.push({ t: 'fx', k: 'volley', type, x: f.x, z: f.z });
        break;
      }
      case 'leap': {
        // nhảy tới ô trống kề kẻ địch xa nhất (phía gần mình nhất)
        const far = this.foes(f).reduce((b, o) => !b || this.hd(f, o) > this.hd(f, b) ? o : b, null);
        const cell = this.freeNeighbor(far, i => hexDist(i % COLS, (i / COLS) | 0, f.hc, f.hr));
        if (cell < 0) { f.mana = Math.round(f.manaMax * .5); break; }       // không còn chỗ đáp: hoàn nửa năng lượng
        const x0 = f.x, z0 = f.z; this.claim(f, cell); const p = center(f.hc, f.hr), L = Math.hypot(p.x - x0, p.z - z0);
        f.leap = { x0, z0, x1: p.x, z1: p.z, t: 0, dur: Math.max(.3, Math.min(.6, L / 12)), tid: far.id, n };
        this.push({ t: 'fx', k: 'leap', type, x: x0, z: z0, tx: far.x, tz: far.z, id: f.id });
        break;
      }
      case 'blink': {
        // dịch chuyển ra sau lưng kẻ địch yếu nhất (ô trống kề xa phía mình nhất)
        const o = this.foes(f).reduce((b, x) => !b || x.hp < b.hp ? x : b, null);
        this.push({ t: 'fx', k: 'blink', type, x: f.x, z: f.z, tx: o.x, tz: o.z, id: f.id });
        const cell = this.freeNeighbor(o, i => -hexDist(i % COLS, (i / COLS) | 0, f.hc, f.hr));
        if (cell >= 0) { this.claim(f, cell); const p = center(f.hc, f.hr); f.x = p.x; f.z = p.z; }
        f.target = o.id; this.magic(f, o, n.dmg);
        break;
      }
      case 'heal': {
        this.push({ t: 'fx', k: 'heal', type, x: f.x, z: f.z });
        this.heal(f, n.heal, false);
        const ally = this.friends(f).filter(o => o !== f && o.hp < o.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (ally) { this.heal(ally, n.ally, false); this.push({ t: 'fx', k: 'heal', type, x: ally.x, z: ally.z }); }
        break;
      }
      case 'shield': {
        this.push({ t: 'fx', k: 'shield', type, x: f.x, z: f.z });
        this.addShield(f, n.shield, n.dur);
        for (const o of this.friends(f)) if (o !== f && this.dist(f, o) <= n.radius) this.addShield(o, n.ally, n.dur);
        break;
      }
      case 'counter': {
        this.push({ t: 'fx', k: 'shield', type, x: f.x, z: f.z });
        this.addShield(f, n.shield, n.dur);
        f.buffs.push({ until: this.t + n.dur, thorns: n.thorns, dr: n.dr });
        break;
      }
      case 'rally': {
        this.push({ t: 'fx', k: 'rally', type, x: f.x, z: f.z, rad: n.radius });
        for (const o of this.friends(f)) if (this.dist(f, o) <= n.radius) { o.buffs.push({ until: this.t + n.dur, as: n.as, atk: n.atk }); this.push({ t: 'status', id: o.id, s: 'buff' }); }
        break;
      }
      case 'poison': {
        fxe('bolt', { id: f.id, tid: tg.id });
        this.magic(f, tg, n.dmg);
        this.addDot(tg, { type: 'poison', dps: n.dps, until: this.t + n.dur, src: f.id });
        for (const o of this.foes(f)) if (o !== tg && Math.hypot(o.x - tg.x, o.z - tg.z) <= n.radius) this.addDot(o, { type: 'poison', dps: n.dps * .5, until: this.t + n.dur, src: f.id });
        break;
      }
      case 'meteor': {
        const foes = this.foes(f);
        for (let i = 0; i < n.n; i++) {
          const o = foes[this.rng.int(foes.length)];
          const z = { t: n.delay + i * .25, x: o.x + (this.rng() - .5), z: o.z + (this.rng() - .5), rad: n.radius, dmg: n.dmg, stun: n.stun, type, team: f.team, src: f.id };
          this.zones.push(z); this.push({ t: 'fx', k: 'mark', type, x: z.x, z: z.z, rad: z.rad, dur: z.t });
        }
        break;
      }
      case 'splash': this.push({ t: 'text', id: f.id, text: 'Tạch tạch...', col: '#aab' }); break;
    }
  }

  landLeap(f, l) {
    const n = l.n, type = f.ability.type;
    this.push({ t: 'fx', k: 'quake', type, x: f.x, z: f.z, rad: n.radius });
    for (const o of this.foes(f)) if (Math.hypot(o.x - f.x, o.z - f.z) <= n.radius) { this.magic(f, o, n.dmg); this.stunF(o, n.stun); }
    f.target = l.tid; f.recover = .15;
  }
}

// Chạy nguyên trận (không đồ hoạ). Trả về { winner, survivors, t }
export function runBattle(specs, seed = 1) {
  const b = new Battle(specs, { seed, events: false });
  let guard = 0;
  while (!b.over && guard++ < 4000) b.step();
  return { winner: b.winner, survivors: b.alive(b.winner === null ? 0 : b.winner).length, t: b.t, battle: b };
}

// Xem trước chỉ số thật (đã tính tộc + vật phẩm) của một Pokémon trong đội hình `specs` (cùng một đội)
export function previewFighter(specs, id) {
  const b = new Battle(specs, { seed: 1, events: false });
  const f = b.byId(id); if (!f) return null;
  b.refresh(f); return f;
}
