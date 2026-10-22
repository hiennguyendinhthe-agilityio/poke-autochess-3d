// Điều phối một ván: vòng đấu, ghép cặp, sát thương, loại người chơi, xếp hạng.
import { Game } from './state.js';
import { makeBots, growBot, botSpecs, wildSpecs, DIFFICULTY } from './bots.js';
import { roundInfo, baseDamage, ARENAS } from './rounds.js';
import { runBattle } from '../sim/battle.js';
import { mulberry32 } from '../sim/rng.js';

// ID của đơn vị đối thủ nằm ở dải riêng để không bao giờ trùng ID Pokémon của người chơi
export const ENEMY_ID = 1e6;

export class Match {
  constructor(game) { this.g = game; }

  static create(seed, starterKey, diff = 1) {
    const g = Game.create(seed, starterKey);
    g.diff = diff; g.bots = makeBots(g.rng);
    g.over = false; g.placement = 0; g.history = []; g.fight = null;
    g.save();
    return new Match(g);
  }
  static load(data) { return new Match(new Game(data)); }

  get info() { return roundInfo(this.g.round); }
  aliveBots() { return this.g.bots.filter(b => b.alive); }

  // Chuẩn bị đối thủ của vòng hiện tại (gọi khi bắt đầu vòng, trước giai đoạn chuẩn bị)
  beginRound() {
    const g = this.g, info = this.info;
    const income = DIFFICULTY[g.diff ?? 1].income;
    for (const b of this.aliveBots()) growBot(b, g.round, g.rng, income);
    if (info.pve) {
      g.fight = { pve: true, name: info.name, col: '#9aa3b5', specs: wildSpecs(info), arena: 'grass', oppId: 0 };
    } else {
      const alive = this.aliveBots();
      const pool = alive.filter(b => b.id !== g.lastOpp);
      const opp = (pool.length ? pool : alive)[g.rng.int((pool.length ? pool : alive).length)];
      // sân đấu mang màu hệ chủ đạo của đối thủ
      const arena = ARENAS[opp.id % ARENAS.length];
      g.fight = { pve: false, name: opp.name, col: opp.col, specs: botSpecs(opp, 1, ENEMY_ID), arena, oppId: opp.id };
    }
    g.save();
    return g.fight;
  }

  // Sau khi trận của người chơi kết thúc. result = { winner, survivors } (survivors: số Pokémon còn sống bên thắng)
  finishRound(result) {
    const g = this.g, info = this.info, f = g.fight;
    const won = result.winner === 0;
    const out = { round: g.round, pve: info.pve, won, damage: 0, income: null, drops: [], eliminated: [], opp: f.name };
    if (!info.pve) {
      if (!won) {
        out.damage = baseDamage(g.round) + result.survivors;
        g.hp = Math.max(0, g.hp - out.damage);
      } else {
        const opp = g.bots.find(b => b.id === f.oppId);
        const dmg = baseDamage(g.round) + result.survivors;
        opp.hp = Math.max(0, opp.hp - dmg); out.dealt = dmg; g.stats.damageDealt += dmg;
        opp.streak = Math.min(0, opp.streak) - 1;
      }
      if (!won) { const opp = g.bots.find(b => b.id === f.oppId); opp.streak = Math.max(0, opp.streak) + 1; }
      g.lastOpp = f.oppId;
      this.botFights(f.oppId, out);
    }
    // vật phẩm
    if (info.pve) { if (won) out.drops = g.grantComponents(info.drop); }
    else if (info.drop) out.drops = g.grantComponents(info.drop);
    out.income = g.endRound(won, !info.pve);
    // loại bot hết máu
    this.reap(out);
    if (g.hp <= 0) { g.over = true; g.placement = this.aliveBots().length + 1; }
    else if (!this.aliveBots().length) { g.over = true; g.placement = 1; }
    g.history.push({ round: out.round, won, pve: out.pve, opp: out.opp, damage: out.damage });
    g.fight = null;
    g.save();
    out.over = g.over; out.placement = g.placement;
    return out;
  }

  // Các bot đánh nhau (trừ cặp có người chơi)
  botFights(oppId, out) {
    const g = this.g;
    const free = this.aliveBots().filter(b => b.id !== oppId);
    // xáo trộn
    for (let i = free.length - 1; i > 0; i--) { const j = g.rng.int(i + 1); [free[i], free[j]] = [free[j], free[i]]; }
    const fights = [];
    for (let i = 0; i + 1 < free.length; i += 2) fights.push([free[i], free[i + 1], true]);
    if (free.length % 2) {
      // bot lẻ đấu với bản sao của một bot khác (không gây sát thương cho bản sao)
      const lone = free[free.length - 1], ghost = free.length > 1 ? free[g.rng.int(free.length - 1)] : null;
      if (ghost) fights.push([lone, ghost, false]);
    }
    for (const [a, b, real] of fights) {
      const specs = [...botSpecs(a, 0, 0), ...botSpecs(b, 1, 100)];
      if (!specs.some(s => s.team === 0) || !specs.some(s => s.team === 1)) continue;
      const r = runBattle(specs, (g.rng() * 2 ** 31) >>> 0);
      const dmg = baseDamage(g.round) + r.survivors;
      if (r.winner === 0) {
        a.streak = Math.max(0, a.streak) + 1;
        if (real) { b.hp = Math.max(0, b.hp - dmg); b.streak = Math.min(0, b.streak) - 1; }
      } else {
        b.streak = Math.max(0, b.streak) + 1;
        a.hp = Math.max(0, a.hp - dmg); a.streak = Math.min(0, a.streak) - 1;
      }
    }
  }

  reap(out) {
    const g = this.g;
    const dead = g.bots.filter(b => b.alive && b.hp <= 0).sort((a, b) => a.hp - b.hp);
    for (const b of dead) {
      const aliveCount = this.aliveBots().length + (g.hp > 0 ? 1 : 0);
      b.alive = false; b.place = aliveCount; out.eliminated.push(b.name);
    }
  }

  // Bảng xếp hạng hiện tại: người chơi + bot, sắp theo (còn sống, máu)
  standings() {
    const g = this.g;
    const rows = g.bots.map(b => ({ id: b.id, name: b.name, col: b.col, hp: b.hp, alive: b.alive, place: b.place, me: false }));
    rows.push({ id: 0, name: 'Bạn', col: '#ffcf3a', hp: g.hp, alive: g.hp > 0, place: g.hp > 0 ? 0 : g.placement, me: true });
    return rows.sort((a, b) => (b.alive - a.alive) || (b.hp - a.hp) || (a.place - b.place));
  }
}
