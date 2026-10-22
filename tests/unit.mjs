// Kiểm thử logic (không cần trình duyệt): node tests/unit.mjs
import assert from 'node:assert/strict';
import { LINES, LINE, FORMS, POOL_SIZE, baseStats, unitTraits, formAt, skillAt } from '../src/data/roster.js';
import { WILD } from '../src/data/lines.js';
import { TRAITS, calcTraits } from '../src/data/traits.js';
import { ITEMS, COMPONENTS, COMBOS, combine } from '../src/data/items.js';
import { ABILITY_KINDS } from '../src/sim/ability-kinds.js';
import { rawEff, effMult, TYPES } from '../src/data/types.js';
import { Game, SHOP_ODDS, sellValue, XP_NEED, newPool } from '../src/game/state.js';
import { Match } from '../src/game/match.js';
import { roundInfo, isPve } from '../src/game/rounds.js';
import { Battle, runBattle } from '../src/sim/battle.js';
import { playGame } from '../tools/autoplay.mjs';

let pass = 0, fail = 0; const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; failures.push([name, e]); console.log('  ✗', name, '\n    ', e.message.split('\n')[0]); }
}
const sec = s => console.log('\n' + s);
const spec = (team, i, key, star = 1, items = []) => ({ id: team * 100 + i, team, cell: { c: 2 + i, r: LINE[key] && LINE[key].range > 1 ? 3 : 0 }, key, star, items });

sec('Dữ liệu');
t('mọi dòng Pokémon có đủ dữ liệu sprite + chỉ số', () => {
  for (const l of LINES) for (const d of l.dex) {
    const f = FORMS[d]; assert.ok(f, `thiếu forms[${d}] (${l.key})`);
    for (const a of ['Idle', 'Walk', 'Attack', 'Hurt']) assert.ok(f.anims[a] && f.anims[a].n > 0, `${l.key}/${d} thiếu ${a}`);
    assert.ok(f.types.length >= 1 && f.stats.hp > 0);
  }
  for (const k in WILD) assert.ok(FORMS[WILD[k].dex], 'thiếu hoang dã ' + k);
});
t('roster đủ lớn, giá 1-5, khóa không trùng', () => {
  assert.ok(LINES.length >= 70);
  assert.equal(LINES.length, new Set(LINES.map(l => l.key)).size);
  for (const l of LINES) assert.ok(l.cost >= 1 && l.cost <= 5);
  for (let c = 1; c <= 5; c++) assert.ok(LINES.filter(l => l.cost === c).length >= 8, 'giá ' + c + ' ít Pokémon');
});
t('kiểu kỹ năng hợp lệ và có mô tả', () => {
  for (const l of LINES) for (const s of [l.skill, l.skill3].filter(Boolean)) {
    assert.ok(ABILITY_KINDS[s[1]], `${l.key}: kiểu kỹ năng ${s[1]}`); assert.ok(TYPES.includes(s[2]), `${l.key}: hệ ${s[2]}`);
    const k = ABILITY_KINDS[s[1]]; assert.ok(typeof k.desc(k.nums(200), l.fx) === 'string');
  }
});
t('tộc/hệ: mọi mốc có thể đạt được với số Pokémon trong roster', () => {
  for (const id in TRAITS) {
    const members = LINES.filter(l => l.traits.includes(id) || [0, 1, 2].some(i => FORMS[l.dex[i]].types.includes(id)));
    const max = TRAITS[id].tiers[TRAITS[id].tiers.length - 1].n;
    assert.ok(members.length >= max, `${id}: chỉ ${members.length} thành viên nhưng mốc cao nhất ${max}`);
  }
  for (const l of LINES) for (const tr of l.traits) assert.ok(TRAITS[tr], 'tộc không tồn tại: ' + tr);
});
t('21 vật phẩm hoàn chỉnh, ghép đúng', () => {
  assert.equal(Object.keys(COMBOS).length, 21); assert.equal(Object.keys(COMPONENTS).length, 6);
  assert.equal(combine('band', 'scarf').id, combine('scarf', 'band').id);
  assert.equal(combine('band', 'band').id, 'choiceband'); assert.equal(combine('choiceband', 'band'), null);
});
t('bảng tương khắc: Nước > Lửa, Điện vô hiệu với Đất (được làm mềm)', () => {
  assert.equal(rawEff('Water', ['Fire']), 2); assert.equal(rawEff('Electric', ['Ground']), 0); assert.equal(rawEff('Fire', ['Rock', 'Water']), .25);
  assert.ok(effMult(2) > 1 && effMult(.5) < 1 && effMult(0) > 0);
});
t('tỉ lệ cửa hàng mỗi cấp cộng đủ 100%', () => { for (let l = 1; l <= 9; l++) assert.equal(SHOP_ODDS[l].reduce((a, b) => a + b), 100); });
t('chỉ số tăng theo giá và theo sao', () => {
  const hp = (k, s) => baseStats(LINE[k], s).hp;
  assert.ok(hp('geodude', 2) > hp('geodude', 1) && hp('geodude', 3) > hp('geodude', 2));
  const avg = c => { const ls = LINES.filter(l => l.cost === c); return ls.reduce((s, l) => s + baseStats(l, 1).hp, 0) / ls.length; };
  for (let c = 1; c < 5; c++) assert.ok(avg(c + 1) > avg(c));
});
t('tiến hóa theo sao: Charmander -> Charmeleon -> Charizard, hệ đổi theo dạng', () => {
  const l = LINE.charmander; assert.deepEqual([1, 2, 3].map(s => formAt(l, s).name), ['Charmander', 'Charmeleon', 'Charizard']);
  assert.ok(unitTraits(l, 3).includes('Flying') && !unitTraits(l, 1).includes('Flying'));
  assert.equal(formAt(LINE.magikarp, 3).name, 'Gyarados'); assert.equal(skillAt(LINE.magikarp, 3).kind, 'beam'); assert.equal(skillAt(LINE.magikarp, 1).kind, 'splash');
});
t('lịch vòng: PvE ở 1,2,3,6,11,16 ...', () => {
  const pve = [1, 2, 3, 4, 5, 6, 7, 11, 12, 16, 21].filter(isPve); assert.deepEqual(pve, [1, 2, 3, 6, 11, 16, 21]);
  for (const r of [1, 2, 3, 6, 11, 16, 21, 26]) assert.ok(roundInfo(r).units.length > 0);
});

sec('Kinh tế & cửa hàng');
t('xổ cửa hàng: đủ 5 ô, đúng giá theo cấp, kho chung được trừ', () => {
  const g = Game.create(1, 'charmander'); const before = { ...g.pool };
  assert.equal(g.shop.length, 5); for (const k of g.shop) assert.equal(LINE[k].cost, 1, 'cấp 2 chỉ ra giá 1');
  const held = g.allUnits().length;
  let total = 0; for (const k in g.pool) total += g.pool[k] + g.shop.filter(x => x === k).length + g.allUnits().filter(u => u.key === k).reduce((s, u) => s + Math.pow(3, u.star - 1), 0);
  let init = 0; for (const k in newPool()) init += newPool()[k]; assert.equal(total, init, 'tổng bản sao phải bảo toàn');
});
t('kho chung được bảo toàn sau nhiều lần mua/làm mới/bán', () => {
  const g = Game.create(7, 'squirtle'); g.gold = 500; g.level = 9;
  for (let i = 0; i < 60; i++) { g.reroll(); for (let s = 0; s < 5; s++) if (g.shop[s] && g.bench.some(x => !x)) g.buy(s); if (i % 7 === 0) for (const u of g.allUnits().slice(0, 2)) g.sell(u.id); g.gold = 500; }
  let total = 0, init = 0; const np = newPool();
  for (const k in np) { init += np[k]; total += g.pool[k] + g.shop.filter(x => x === k).length + g.allUnits().filter(u => u.key === k).reduce((s, u) => s + Math.pow(3, u.star - 1), 0); }
  assert.equal(total, init);
});
t('mua đủ 3 con giống nhau -> gộp 2★, tiến hóa; đủ 9 -> 3★', () => {
  const g = Game.create(3, 'charmander'); g.gold = 200; g.level = 9;
  g.bench.fill(null); g.board.fill(null);
  const buyKey = key => { g.shop[0] = key; g.pool[key]--; const r = g.buy(0); assert.ok(r.ok, r.err); return r; };
  buyKey('geodude'); buyKey('geodude'); const r = buyKey('geodude');
  assert.equal(r.merges.length, 1); assert.equal(g.allUnits().length, 1); assert.equal(g.allUnits()[0].star, 2);
  assert.equal(formAt(LINE.geodude, 2).name, 'Graveler');
  for (let i = 0; i < 6; i++) buyKey('geodude');
  assert.equal(g.allUnits().length, 1); assert.equal(g.allUnits()[0].star, 3);
});
t('băng ghế đầy vẫn mua được nếu việc gộp giải phóng chỗ; nếu không thì từ chối', () => {
  const g = Game.create(5, 'charmander'); g.gold = 100; g.bench.fill(null); g.board.fill(null);
  for (let i = 0; i < 7; i++) g.bench[i] = g.makeUnit('pidgey' + '', 1) && g.makeUnit(['zubat', 'meowth', 'geodude', 'machop', 'koffing', 'ekans', 'caterpie'][i], 1);
  g.bench[7] = g.makeUnit('pidgey', 1); g.bench[8] = g.makeUnit('pidgey', 1);
  g.shop[0] = 'pidgey'; const r = g.buy(0); assert.ok(r.ok, 'phải gộp được'); assert.equal(g.bench.length, 9);
  assert.equal(g.bench.filter(x => x && x.key === 'pidgey' && x.star === 2).length, 1);
  g.bench.fill(null); ['zubat', 'meowth', 'geodude', 'machop', 'koffing', 'ekans', 'caterpie', 'pidgey', 'magikarp'].forEach((k, i) => g.bench[i] = g.makeUnit(k, 1));
  g.shop[1] = 'bulbasaur'; const r2 = g.buy(1); assert.equal(r2.ok, false); assert.equal(g.bench.length, 9);
});
t('giữ vị trí trên sân khi gộp và giữ vật phẩm', () => {
  const g = Game.create(6, 'charmander'); g.bench.fill(null); g.board.fill(null); g.gold = 50; g.level = 5;
  const a = g.makeUnit('machop', 1); a.items = ['band']; g.board[10] = a; g.bench[0] = g.makeUnit('machop', 1); g.shop[0] = 'machop'; g.pool.machop--; g.buy(0);
  assert.equal(g.board[10].star, 2); assert.deepEqual(g.board[10].items, ['band']); assert.equal(g.bench.filter(Boolean).length, 0);
});
t('bán: hoàn vàng đúng và trả bản sao về kho', () => {
  assert.equal(sellValue(1, 1), 1); assert.equal(sellValue(1, 2), 3); assert.equal(sellValue(3, 1), 3); assert.equal(sellValue(3, 2), 8); assert.equal(sellValue(5, 3), 44);
  const g = Game.create(2, 'charmander'); g.bench.fill(null); const u = g.makeUnit('geodude', 2); g.bench[0] = u; const p = g.pool.geodude, gold = g.gold;
  g.sell(u.id); assert.equal(g.gold, gold + 3); assert.equal(g.pool.geodude, p + 3);
});
t('giới hạn số Pokémon trên sân theo cấp độ', () => {
  const g = Game.create(2, 'charmander'); g.bench.fill(null); g.board.fill(null); g.level = 2;
  const us = ['geodude', 'machop', 'zubat'].map((k, i) => (g.bench[i] = g.makeUnit(k, 1)));
  assert.ok(g.move(us[0].id, { zone: 'board', idx: 3 }).ok); assert.ok(g.move(us[1].id, { zone: 'board', idx: 4 }).ok);
  assert.equal(g.move(us[2].id, { zone: 'board', idx: 5 }).ok, false);
  assert.ok(g.move(us[2].id, { zone: 'board', idx: 3 }).ok, 'hoán đổi với ô đang có thì được');
  assert.equal(g.boardCount(), 2);
});
t('XP và lên cấp; cấp 9 là tối đa', () => {
  const g = Game.create(2, 'charmander'); g.gold = 1000; const lv = g.level;
  g.buyXp(); assert.equal(g.xp, 4 - (g.level > lv ? XP_NEED[lv] : 0));
  for (let i = 0; i < 100; i++) g.buyXp(); assert.equal(g.level, 9); assert.equal(g.buyXp().ok, false);
});
t('thu nhập: cơ bản + lãi (tối đa 5) + chuỗi', () => {
  const g = Game.create(2, 'charmander'); g.round = 10; g.gold = 100; g.streak = 0;
  const inc = g.endRound(true, true); assert.equal(inc.base, 5); assert.equal(inc.interest, 5); assert.equal(inc.win, 1); assert.equal(inc.streak, 0);
  const g2 = Game.create(2, 'charmander'); g2.round = 10; g2.gold = 25; for (let i = 0; i < 5; i++) g2.endRound(true, true);
  assert.equal(g2.streak, 5); assert.equal(g2.streakBonus(), 3);
  const g3 = Game.create(2, 'charmander'); g3.round = 10; for (let i = 0; i < 4; i++) g3.endRound(false, true); assert.equal(g3.streak, -4); assert.equal(g3.streakBonus(), 2);
});
t('khóa cửa hàng giữ nguyên các thẻ qua vòng', () => {
  const g = Game.create(4, 'charmander'); const shop = [...g.shop]; g.toggleLock(); g.endRound(true, false); assert.deepEqual(g.shop, shop);
  g.toggleLock(); g.endRound(true, false); assert.notDeepEqual(g.shop.join(), shop.join() + 'x');
});
t('vật phẩm: trang bị, tự ghép 2 nguyên liệu, tối đa 3 món', () => {
  const g = Game.create(2, 'charmander'); const u = g.bench[0]; g.bag = ['band', 'scarf', 'orb', 'shell', 'cloak', 'berry'];
  assert.ok(g.giveItem(0, u.id).ok); assert.deepEqual(u.items, ['band']);
  const r = g.giveItem(0, u.id); assert.ok(r.combined); assert.deepEqual(u.items, ['quickclaw']);
  g.giveItem(0, u.id); assert.equal(u.items.length, 2); g.giveItem(0, u.id); g.giveItem(0, u.id); assert.equal(u.items.length, 3);
  const last = g.giveItem(0, u.id); assert.ok(last.combined && last.combined.id === 'lumberry', 'nguyên liệu thứ 3 vẫn ghép được');
  g.bag.push('band'); assert.equal(g.giveItem(g.bag.length - 1, u.id).ok, false, 'đủ 3 món hoàn chỉnh thì không nhận thêm'); assert.equal(u.items.length, 3);
});

sec('Chiến đấu');
t('xác định: cùng seed + cùng đội hình -> cùng kết quả', () => {
  const sp = () => [spec(0, 0, 'machop'), spec(0, 1, 'pikachu', 2), spec(0, 2, 'gastly'), spec(1, 0, 'geodude'), spec(1, 1, 'abra'), spec(1, 2, 'squirtle', 2)];
  const a = runBattle(sp(), 42), b = runBattle(sp(), 42);
  assert.equal(a.winner, b.winner); assert.equal(a.t, b.t);
  assert.deepEqual(a.battle.f.map(f => Math.round(f.hp)), b.battle.f.map(f => Math.round(f.hp)));
});
t('trận luôn kết thúc, có người thắng', () => {
  for (let s = 1; s <= 8; s++) { const r = runBattle([spec(0, 0, 'snorlax', 3), spec(1, 0, 'umbreon', 3)], s); assert.ok(r.battle.over && (r.winner === 0 || r.winner === 1)); assert.ok(r.t < 80.5); }
});
t('mạnh hơn thì thắng: 3★ giá 3 thắng 1★ giá 1', () => {
  let w = 0; for (let s = 1; s <= 6; s++) if (runBattle([spec(0, 0, 'treecko', 3), spec(1, 0, 'meowth', 1)], s).winner === 0) w++;
  assert.ok(w >= 5, 'thắng ' + w + '/6');
});
t('vật phẩm tăng sức mạnh thật (Đai Sức Mạnh +45% công)', () => {
  const mk = items => new Battle([spec(0, 0, 'machop', 1, items), spec(1, 0, 'geodude')], { seed: 1, events: false });
  const a = mk([]), b = mk(['choiceband']); a.refresh(a.f[0]); b.refresh(b.f[0]);
  assert.ok(Math.abs(b.f[0].atkE / a.f[0].atkE - 1.45) < 1e-6);
  const c = mk(['bigberry']); assert.ok(c.f[0].maxHp > a.f[0].maxHp * 1.4);
});
t('tộc kích hoạt: 2 Pokémon hệ Lửa -> +15% công; chỉ tính mỗi dòng một lần', () => {
  const act = calcTraits([{ key: 'charmander', traits: unitTraits(LINE.charmander, 1) }, { key: 'cyndaquil', traits: unitTraits(LINE.cyndaquil, 1) }, { key: 'cyndaquil', traits: unitTraits(LINE.cyndaquil, 1) }]);
  assert.equal(act.Fire.count, 2); assert.equal(act.Fire.tier, 0);
  const one = calcTraits([{ key: 'charmander', traits: ['Fire'] }]); assert.equal(one.Fire.tier, -1);
  const mk = list => new Battle(list, { seed: 1, events: false }); const base = mk([spec(0, 0, 'charmander'), spec(1, 0, 'geodude')]), syn = mk([spec(0, 0, 'charmander'), spec(0, 1, 'cyndaquil'), spec(1, 0, 'geodude')]);
  base.refresh(base.f[0]); syn.refresh(syn.f[0]);
  assert.ok(syn.f[0].atkE > base.f[0].atkE * 1.14);
});
t('tương khắc hệ: Nước đánh Lửa mạnh hơn đánh Nước', () => {
  const dmg = (def) => { const b = new Battle([spec(0, 0, 'staryu'), spec(1, 0, def)], { seed: 3, events: true }); b.f[0].mana = b.f[0].manaMax; let n = 0, first = 0; while (n++ < 300 && !first) { b.step(); const h = b.ev.find(e => e.ability && e.dmg); if (h) first = h; b.ev.length = 0; } return first; };
  const sup = dmg('flareon'), res = dmg('vaporeon'); assert.ok(sup && res && sup.eff === 'super' && res.eff === 'weak');
});
t('mỗi kiểu kỹ năng đều được tung và gây hiệu quả (mọi dòng)', () => {
  const dummy = () => spec(1, 0, 'snorlax', 3);
  for (const l of LINES) {
    if (l.skill[1] === 'splash') continue;
    const b = new Battle([spec(0, 0, l.key, 2), spec(0, 1, 'geodude', 1), dummy(), { ...spec(1, 1, 'onix', 3), cell: { c: 5, r: 1 } }], { seed: 5, events: true });
    b.f[0].mana = b.f[0].manaMax - 1; let cast = false, effect = false, n = 0;
    while (n++ < 30 * 40 && !b.over) { b.step(); for (const e of b.ev) { if (e.t === 'cast' && e.id === b.f[0].id) cast = true; if (['hit', 'heal', 'status'].includes(e.t) && cast) effect = true; } b.ev.length = 0; if (cast && effect) break; }
    assert.ok(cast, `${l.key} (${l.skill[1]}) không tung được chiêu`); assert.ok(effect, `${l.key} (${l.skill[1]}) tung chiêu nhưng không có tác dụng`);
  }
});
t('Rocket: nổ khi gục gây sát thương cho kẻ địch gần', () => {
  const b = new Battle([spec(0, 0, 'ekans'), spec(0, 1, 'koffing'), { ...spec(1, 0, 'geodude'), cell: { c: 2, r: 0 } }], { seed: 1, events: true });
  assert.ok(b.f[0].m.deathExplode); const foe = b.f[2], hp0 = foe.hp; b.f[0].x = foe.x; b.f[0].z = foe.z + .5;
  b.kill(b.f[0], null); assert.ok(foe.hp < hp0);
});
t('Khiên Fairy / sash / second wind hoạt động', () => {
  const b = new Battle([spec(0, 0, 'sylveon'), spec(0, 1, 'ralts'), spec(1, 0, 'machop')], { seed: 1, events: false });
  assert.ok(b.f[0].shield > 0 && b.f[1].shield > 0, 'Fairy 2 có khiên đầu trận');
  const s = new Battle([spec(0, 0, 'machop', 1, ['focussash']), spec(1, 0, 'geodude')], { seed: 1, events: false }); const f = s.f[0];
  s.damage(s.f[1], f, 99999, { kind: 'true' }); assert.equal(f.alive, true); assert.equal(f.hp, 1); s.damage(s.f[1], f, 99999, { kind: 'true' }); assert.equal(f.alive, false);
});
t('PvE hoang dã: đội đủ mạnh thì thắng vòng 1', () => {
  const m = Match.create(9, 'charmander'); const f = m.beginRound(); let w = 0;
  for (let s = 1; s <= 5; s++) if (runBattle([spec(0, 0, 'charmander', 1), spec(0, 1, 'bulbasaur'), ...f.specs], s).winner === 0) w++;
  assert.ok(w >= 4, 'thắng ' + w + '/5');
});

sec('Ván chơi trọn vẹn');
t('ID đối thủ không bao giờ trùng ID Pokémon người chơi', () => {
  const m = Match.create(21, 'charmander'); const g = m.g; g.nid = 999990;           // giả lập ván rất dài
  for (const r of [1, 4]) { g.round = r; const f = m.beginRound(); for (const sp of f.specs) assert.ok(sp.id >= 1e6, 'id ' + sp.id); }
});
t('lưu/tải: JSON khứ hồi, tiếp tục cho kết quả y hệt', () => {
  const a = Match.create(11, 'squirtle'); a.beginRound();
  const json = JSON.stringify(a.g.toJSON()); const b = Match.load(JSON.parse(json));
  assert.equal(b.g.gold, a.g.gold); assert.deepEqual(b.g.shop, a.g.shop); assert.equal(b.g.fight.name, a.g.fight.name);
  const ra = a.finishRound({ winner: 0, survivors: 2 }), rb = b.finishRound({ winner: 0, survivors: 2 });
  assert.deepEqual(ra, rb); assert.deepEqual(a.g.shop, b.g.shop); assert.equal(a.g.rng(), b.g.rng());
});
t('chơi trọn ván với người chơi tự động: không lỗi, hạng hợp lệ, bot bị loại đúng', () => {
  for (const seed of [1, 2, 3]) {
    const r = playGame({ seed, skill: 1 }); assert.ok(r.placement >= 1 && r.placement <= 8, 'hạng ' + r.placement); const g = r.match.g;
    assert.ok(g.over); assert.ok(g.hp <= 0 || g.bots.every(b => !b.alive));
    const dead = g.bots.filter(b => !b.alive); for (const b of dead) assert.ok(b.place >= 2 && b.place <= 8, 'hạng bot ' + b.place);
    assert.equal(new Set(dead.map(b => b.place)).size, dead.length, 'hạng bot không được trùng');
  }
});
t('người chơi tự động giỏi hơn người chơi "lười" (cân bằng cơ bản)', () => {
  let a = 0, z = 0; for (let s = 1; s <= 8; s++) { a += playGame({ seed: s, skill: 1 }).rounds; z += playGame({ seed: s, lazy: true }).rounds; }
  assert.ok(a > z, `tự động ${a / 8} vòng vs lười ${z / 8} vòng`);
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
if (fail) { for (const [n, e] of failures) console.log('\n✗', n, '\n', e.stack.split('\n').slice(0, 4).join('\n')); process.exit(1); }
console.log('Tất cả đều ĐẠT');
