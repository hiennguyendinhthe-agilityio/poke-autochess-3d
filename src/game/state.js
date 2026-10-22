// Luật chơi: kinh tế, cửa hàng, kho chung, băng ghế, đội hình, gộp sao, vật phẩm.
// Toàn bộ trạng thái là dữ liệu thuần (JSON) nên lưu/tải game rất dễ.
import { LINES, LINE, POOL_SIZE, LINES_BY_COST } from '../data/roster.js';
import { COMP_IDS, ITEMS, combine } from '../data/items.js';
import { mulberry32 } from '../sim/rng.js';

export const BENCH_SIZE = 9, BOARD_COLS = 8, BOARD_ROWS = 4, SHOP_SIZE = 5, MAX_LEVEL = 9, MAX_ITEMS = 3;
export const ROLL_COST = 2, XP_COST = 4, XP_BUY = 4;
// XP cần để lên cấp kế tiếp, theo cấp hiện tại
export const XP_NEED = [0, 2, 2, 6, 10, 20, 36, 56, 80, 0];
// Tỉ lệ ra Pokémon theo cấp: [giá1..giá5] (%)
export const SHOP_ODDS = [null,
  [100, 0, 0, 0, 0], [100, 0, 0, 0, 0], [75, 25, 0, 0, 0], [55, 30, 15, 0, 0], [45, 33, 20, 2, 0],
  [30, 40, 25, 5, 0], [19, 30, 40, 10, 1], [18, 25, 32, 22, 3], [10, 20, 25, 35, 10]];

export const sellValue = (cost, star) => {
  const n = Math.pow(3, star - 1);
  return cost === 1 ? n : n * cost - (star > 1 ? 1 : 0);
};
export const copiesOf = star => Math.pow(3, star - 1);

export function newPool() {
  const p = {};
  for (const l of LINES) p[l.key] = POOL_SIZE[l.cost];
  return p;
}

export class Game {
  constructor(data) { Object.assign(this, data); this.rng = mulberry32(this.seed); this.rng.setState(this.rngState); this.listeners = []; }

  static create(seed = (Math.random() * 2 ** 32) >>> 0, starterKey = 'charmander') {
    const g = new Game({
      v: 1, seed, rngState: seed, nid: 1,
      round: 1, gold: 5, hp: 100, level: 2, xp: 0, streak: 0, bestStreak: 0,
      bench: Array(BENCH_SIZE).fill(null), board: Array(BOARD_COLS * BOARD_ROWS).fill(null),
      shop: Array(SHOP_SIZE).fill(null), locked: false, bag: [],
      pool: newPool(), stats: { wins: 0, losses: 0, rolls: 0, merges: 0, gold: 0, damageDealt: 0 }
    });
    g.rng.setState(seed);
    // Pokémon khởi đầu
    const u = g.makeUnit(starterKey, 1); g.pool[starterKey]--; g.bench[0] = u;
    g.rollShop(true);
    g.save();
    return g;
  }

  // dữ liệu thuần để lưu
  save() { this.rngState = this.rng.state(); }
  toJSON() { this.save(); const o = { ...this }; delete o.rng; delete o.listeners; return o; }

  on(fn) { this.listeners.push(fn); }
  emit(e) { for (const f of this.listeners) f(e); }

  makeUnit(key, star = 1) { return { id: this.nid++, key, star, items: [] }; }
  allUnits() { return [...this.board, ...this.bench].filter(Boolean); }
  boardUnits() { return this.board.filter(Boolean); }
  find(id) {
    let i = this.bench.findIndex(u => u && u.id === id); if (i >= 0) return { u: this.bench[i], zone: 'bench', idx: i };
    i = this.board.findIndex(u => u && u.id === id); if (i >= 0) return { u: this.board[i], zone: 'board', idx: i };
    return null;
  }
  get cap() { return this.level; }
  get xpNeed() { return XP_NEED[this.level] || 0; }

  // ---------- cửa hàng ----------
  rollShop(free = false) {
    // trả lại các thẻ chưa mua về kho chung
    for (const k of this.shop) if (k) this.pool[k]++;
    const odds = SHOP_ODDS[this.level];
    const out = [];
    for (let i = 0; i < SHOP_SIZE; i++) {
      let key = null;
      for (let tries = 0; tries < 12 && !key; tries++) {
        let r = this.rng() * 100, cost = 1;
        for (let c = 0; c < 5; c++) { if (r < odds[c]) { cost = c + 1; break; } r -= odds[c]; }
        const cand = LINES_BY_COST[cost].filter(l => this.pool[l.key] > 0);
        if (!cand.length) continue;
        const total = cand.reduce((s, l) => s + this.pool[l.key], 0);
        let x = this.rng() * total;
        for (const l of cand) { x -= this.pool[l.key]; if (x < 0) { key = l.key; break; } }
        if (!key) key = cand[cand.length - 1].key;
      }
      if (key) this.pool[key]--;
      out.push(key);
    }
    this.shop = out;
    this.save();
  }
  reroll() {
    if (this.gold < ROLL_COST) return { ok: false, err: 'Không đủ vàng' };
    this.gold -= ROLL_COST; this.stats.rolls++;
    this.rollShop(); this.emit({ t: 'roll' }); return { ok: true };
  }
  toggleLock() { this.locked = !this.locked; return this.locked; }

  // có thể mua `key` không (kể cả khi băng ghế đầy nhưng gộp được)
  canFit(key) {
    if (this.bench.some(x => !x)) return true;
    // băng ghế đầy: chỉ mua được nếu việc gộp sẽ giải phóng chỗ
    const same = this.allUnits().filter(u => u.key === key && u.star === 1);
    return same.length >= 2;
  }
  buy(slot) {
    const key = this.shop[slot]; if (!key) return { ok: false, err: 'Ô trống' };
    const cost = LINE[key].cost;
    if (this.gold < cost) return { ok: false, err: 'Không đủ vàng' };
    if (!this.canFit(key)) return { ok: false, err: 'Băng ghế đầy' };
    this.gold -= cost; this.shop[slot] = null;
    const u = this.makeUnit(key, 1);
    // băng ghế đầy mà vẫn mua được (vì sẽ gộp): dùng một ô tạm rồi dọn lại
    let idx = this.bench.findIndex(x => !x);
    const temp = idx < 0; if (temp) idx = this.bench.length;
    this.bench[idx] = u;
    const merges = this.mergeAll();
    if (temp) this.bench.length = BENCH_SIZE;
    this.emit({ t: 'buy', unit: u, merges });
    return { ok: true, unit: u, merges };
  }

  // ---------- gộp sao (3 -> 1, tiến hóa) ----------
  mergeAll() {
    const evs = [];
    let again = true;
    while (again) {
      again = false;
      for (const l of LINES) for (let star = 1; star <= 2; star++) {
        const ids = this.allUnits().filter(u => u.key === l.key && u.star === star);
        if (ids.length >= 3) {
          // ưu tiên giữ vị trí trên sân
          ids.sort((a, b) => (this.find(a.id).zone === 'board' ? 0 : 1) - (this.find(b.id).zone === 'board' ? 0 : 1) || a.id - b.id);
          const three = ids.slice(0, 3), keep = three[0], loc = this.find(keep.id);
          const items = [];
          for (const u of three) items.push(...u.items);
          // xoá 2 bản kia
          for (const u of three.slice(1)) { const p = this.find(u.id); this[p.zone][p.idx] = null; }
          keep.star = star + 1; keep.items = [];
          for (const it of items) { if (keep.items.length < MAX_ITEMS) keep.items.push(it); else this.bag.push(it); }
          evs.push({ unit: keep, star: keep.star, zone: loc.zone, idx: loc.idx });
          this.stats.merges++;
          again = true;
        }
      }
    }
    // nếu băng ghế "mượn" ô cuối thì không còn tình trạng chồng
    return evs;
  }

  // ---------- bán / di chuyển ----------
  sell(id) {
    const p = this.find(id); if (!p) return { ok: false, err: 'Không thấy Pokémon' };
    const l = LINE[p.u.key], v = sellValue(l.cost, p.u.star);
    this.gold += v; this.pool[l.key] += copiesOf(p.u.star);
    for (const it of p.u.items) this.bag.push(it);
    this[p.zone][p.idx] = null;
    this.emit({ t: 'sell', unit: p.u, gold: v });
    return { ok: true, gold: v };
  }
  boardCount() { return this.board.filter(Boolean).length; }
  // đích: {zone:'board'|'bench', idx}
  move(id, to) {
    const p = this.find(id); if (!p) return { ok: false, err: 'Không thấy Pokémon' };
    if (to.zone === p.zone && to.idx === p.idx) return { ok: true, noop: true };
    const dest = this[to.zone][to.idx];
    // giới hạn số Pokémon trên sân
    let delta = 0;
    if (p.zone === 'bench' && to.zone === 'board') delta = dest ? 0 : 1;
    if (p.zone === 'board' && to.zone === 'bench') delta = dest ? 0 : -1;
    if (delta > 0 && this.boardCount() >= this.cap) return { ok: false, err: `Cấp ${this.level}: tối đa ${this.cap} Pokémon trên sân` };
    this[p.zone][p.idx] = dest || null; this[to.zone][to.idx] = p.u;
    this.emit({ t: 'move', unit: p.u });
    return { ok: true };
  }

  // ---------- kinh nghiệm ----------
  addXp(n) {
    this.xp += n;
    let up = false;
    while (this.level < MAX_LEVEL && this.xp >= XP_NEED[this.level]) { this.xp -= XP_NEED[this.level]; this.level++; up = true; }
    if (this.level >= MAX_LEVEL) this.xp = 0;
    if (up) this.emit({ t: 'level', level: this.level });
    return up;
  }
  buyXp() {
    if (this.level >= MAX_LEVEL) return { ok: false, err: 'Đã đạt cấp tối đa' };
    if (this.gold < XP_COST) return { ok: false, err: 'Không đủ vàng' };
    this.gold -= XP_COST; this.addXp(XP_BUY); this.emit({ t: 'xp' }); return { ok: true };
  }

  // ---------- vật phẩm ----------
  giveItem(bagIdx, unitId) {
    const item = this.bag[bagIdx]; if (!item) return { ok: false, err: 'Không có vật phẩm' };
    const p = this.find(unitId); if (!p) return { ok: false, err: 'Không thấy Pokémon' };
    const u = p.u;
    if (ITEMS[item].comp) {
      const ci = u.items.findIndex(i => ITEMS[i].comp);
      if (ci >= 0) {
        const res = combine(u.items[ci], item);
        u.items[ci] = res.id; this.bag.splice(bagIdx, 1);
        this.emit({ t: 'item', unit: u, item: res, combined: true });
        return { ok: true, combined: res };
      }
    }
    if (u.items.length >= MAX_ITEMS) return { ok: false, err: 'Đã đủ 3 vật phẩm' };
    u.items.push(item); this.bag.splice(bagIdx, 1);
    this.emit({ t: 'item', unit: u, item: ITEMS[item] });
    return { ok: true };
  }
  takeItem(unitId, itemIdx) {
    const p = this.find(unitId); if (!p) return { ok: false };
    const it = p.u.items.splice(itemIdx, 1)[0]; if (it) this.bag.push(it);
    return { ok: !!it };
  }
  randomComponent() { return COMP_IDS[this.rng.int(COMP_IDS.length)]; }
  grantComponents(n) { const out = []; for (let i = 0; i < n; i++) { const c = this.randomComponent(); this.bag.push(c); out.push(c); } return out; }

  // ---------- thu nhập cuối vòng ----------
  baseIncome() { return Math.min(5, 1 + this.round); }
  interest() { return Math.min(5, Math.floor(this.gold / 10)); }
  streakBonus() { const s = Math.abs(this.streak); return s >= 5 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0; }
  // won: true/false/null (null = vòng PvE thua: không tính chuỗi)
  endRound(won, pvp) {
    const inc = { base: this.baseIncome(), interest: this.interest(), streak: 0, win: 0 };
    if (pvp) {
      if (won) { this.streak = this.streak > 0 ? this.streak + 1 : 1; this.stats.wins++; inc.win = 1; }
      else { this.streak = this.streak < 0 ? this.streak - 1 : -1; this.stats.losses++; }
      inc.streak = this.streakBonus();
      this.bestStreak = Math.max(this.bestStreak, Math.abs(this.streak));
    }
    inc.total = inc.base + inc.interest + inc.streak + inc.win;
    this.gold += inc.total; this.stats.gold += inc.total;
    this.addXp(2);
    this.round++;
    if (!this.locked) this.rollShop(true);
    this.save();
    return inc;
  }

  // danh sách đơn vị đội người chơi cho engine chiến đấu
  teamSpecs() {
    const out = [];
    this.board.forEach((u, i) => { if (u) out.push({ id: u.id, team: 0, cell: { c: i % BOARD_COLS, r: Math.floor(i / BOARD_COLS) }, key: u.key, star: u.star, items: [...u.items] }); });
    return out;
  }
}
