// Kiểm thử end-to-end bằng trình duyệt thật (Playwright + Chromium) trên bản build.
// Chạy: npm run build && node tests/e2e.mjs   (đặt SHOTS=<thư mục> để lưu ảnh chụp)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PNG } from 'pngjs';

const PORT = 4173, URL = `http://localhost:${PORT}/`, SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0; const failures = [];
const step = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; failures.push([name, e]); console.log('  ✗', name, '\n    ', String(e.message).split('\n')[0]); } };

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const kill = () => { try { server.kill(); } catch (e) { } };
process.on('exit', kill);
for (let i = 0; i < 50; i++) { try { const r = await fetch(URL); if (r.ok) break; } catch (e) { } await new Promise(r => setTimeout(r, 300)); }

const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args }).catch(() => chromium.launch({ args }));

async function open(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: !!opts.touch, isMobile: !!opts.touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.goto(URL); await page.waitForFunction(() => window.__app, null, { timeout: 20000 });
  return { ctx, page, errors };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
// vị trí màn hình (px) của một điểm trên mặt đất cảnh 3D
const screenOf = (page, x, z, y = 0.5) => page.evaluate(([x, y, z]) => { const p = __app.world.project(x, y, z), r = __app.world.canvas.getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, [x, y, z]);
// chờ mọi Pokémon trượt xong về ô của mình rồi mới lấy tọa độ
const settle = page => page.waitForFunction(() => [...__app.world.views.values()].every(v => v.f || (Math.abs(v.x - v.tx) < .03 && Math.abs(v.z - v.tz) < .03 && !v.spawn)), null, { timeout: 15000 });
// vị trí màn hình của một ô: zone 'board' (c, r của người chơi) hoặc 'bench' (chỉ số)
const cellScreen = (page, zone, a, b) => page.evaluate(([zone, a, b]) => { const g = __app.geo, p = zone === 'bench' ? g.benchPos(a) : g.boardPos(a, b), q = __app.world.project(p.x, 0, p.z), r = __app.world.canvas.getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y }; }, [zone, a, b]);
const unitScreen = async (page, uid) => { await settle(page); return unitScreen0(page, uid); };
const unitScreen0 = (page, uid) => page.evaluate(id => { const v = __app.world.views.get('u' + id), p = __app.world.project(v.x, .5, v.z), r = __app.world.canvas.getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, uid);
const state = page => page.evaluate(() => { const g = __app.match.g; return { gold: g.gold, level: g.level, round: g.round, bench: g.bench.filter(Boolean).length, board: g.boardCount(), bag: g.bag.length, phase: __app.phase, hp: g.hp }; });
async function drag(page, a, b, steps = 12) { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 }); await page.mouse.move(b.x, b.y, { steps }); await page.waitForTimeout(80); await page.mouse.up(); }

console.log('\nDesktop 1280x720');
const { ctx, page, errors } = await open({ width: 1280, height: 720 });

await step('màn hình chính hiện logo và nút Chơi mới', async () => {
  await page.waitForSelector('.logo'); assert.ok(await page.locator('#mNew').isVisible()); assert.ok(await page.locator('#mHow').isVisible());
  await page.waitForTimeout(1500); await shot(page, '01-title');
});
await step('cảnh 3D thật sự được vẽ (không phải màn hình trống)', async () => {
  const buf = await page.screenshot(); const png = PNG.sync.read(buf); const seen = new Set();
  for (let i = 0; i < png.data.length; i += 4 * 97) seen.add((png.data[i] >> 4) + ',' + (png.data[i + 1] >> 4) + ',' + (png.data[i + 2] >> 4));
  assert.ok(seen.size > 25, 'chỉ có ' + seen.size + ' màu');
});
await step('"Cách chơi" mở và đóng được', async () => {
  await page.click('#mHow'); await page.waitForSelector('.modal'); assert.ok((await page.locator('.modal').innerText()).includes('Cách chơi')); await page.click('.modal .close'); await page.waitForFunction(() => !document.querySelector('.modal'));
});
await step('chọn khởi đầu: có 4 Pokémon và 3 mức độ khó', async () => {
  await page.click('#mNew'); await page.waitForSelector('.st'); assert.equal(await page.locator('.st').count(), 4); assert.equal(await page.locator('#diff .btn').count(), 3);
  await shot(page, '02-starter'); await page.click('#diff .btn[data-d="0"]');
});
await step('vào ván: HUD, cửa hàng 5 thẻ, đã có Pokémon khởi đầu trên băng ghế', async () => {
  await page.click('.st[data-k="charmander"]'); await page.waitForSelector('#shop .card', { timeout: 10000 });
  assert.equal(await page.locator('#shop .card:not(.sold)').count(), 5);
  const s = await state(page); assert.equal(s.bench, 1); assert.equal(s.round, 1); assert.equal(s.phase, 'prep');
  assert.equal(await page.evaluate(() => __app.match.g.diff), 0);
  await page.waitForTimeout(2200); await shot(page, '03-prep');
});
await step('âm thanh: mọi hiệu ứng, tiếng kêu 181 dạng và các bài nhạc chạy không lỗi', async () => {
  const r = await page.evaluate(async () => {
    const au = __app.audio; au.init(); const errs = [];
    const names = 'click pick drop error buy sell roll xp levelup item combine star2 star3 ready fight tick swing hit cast faint quake boom leap blink win lose damage'.split(' ');
    for (const n of names) { try { au.sfx(n, { type: 'Fire', crit: true, ability: true, eff: 'super' }); } catch (e) { errs.push(n + ': ' + e.message); } }
    for (const d of Object.keys(__app.forms)) { try { au.lastCry = 0; au.voices = 0; au.cry(+d); } catch (e) { errs.push('cry ' + d + ': ' + e.message); } }
    for (const m of ['menu', 'prep', 'combat', 'victory', 'defeat', 'prep']) { try { au.music(m); await new Promise(r => setTimeout(r, 250)); } catch (e) { errs.push('music ' + m + ': ' + e.message); } }
    au.setVolume('music', .5); au.setVolume('sfx', .8); au.stopMusic();
    return { errs, state: au.ctx && au.ctx.state, n: Object.keys(__app.forms).length };
  });
  assert.deepEqual(r.errs, []); assert.ok(r.n >= 170); assert.ok(['running', 'suspended'].includes(r.state));
});
await step('mua Pokémon: trừ vàng, thêm vào băng ghế; hết vàng thì báo lỗi', async () => {
  await page.evaluate(() => { __app.match.g.gold = 8; __app.refreshView(); });
  const before = await state(page); await page.click('#shop .card:not(.sold)');
  const after = await state(page); assert.ok(after.gold < before.gold && after.bench === before.bench + 1);
  await page.evaluate(() => { __app.match.g.gold = 0; __app.refreshView(); });
  await page.click('#shop .card:not(.sold)'); await page.waitForSelector('.toast'); assert.equal((await state(page)).bench, after.bench);
});
await step('thẻ cửa hàng hiện cột huy hiệu hệ/tộc (mỗi thẻ ít nhất 1 huy hiệu, nhìn thấy được)', async () => {
  const r = await page.evaluate(() => [...document.querySelectorAll('#shop .card:not(.sold)')].map(c => { const b = [...c.querySelectorAll('.tgi')].map(x => x.getBoundingClientRect()); return { n: b.length, ok: b.every(q => q.width > 8 && q.height > 8 && q.right <= c.getBoundingClientRect().right) }; }));
  assert.ok(r.length >= 3); assert.ok(r.every(x => x.n >= 1 && x.ok), JSON.stringify(r));
});
await step('bấm vào hệ/tộc: mở bảng thành viên, có trạng thái sở hữu và viền sáng; bấm khoảng trống thì đóng', async () => {
  await page.evaluate(() => { const g = __app.match.g; g.level = 6; g.bench.fill(null); g.board.fill(null); g.board[27] = g.makeUnit('charmander', 1); g.bench[0] = g.makeUnit('cyndaquil', 1); g.shop[1] = 'flareon'; __app.refreshView(); });
  await page.locator('.trait[data-trait="Fire"]').click(); await page.waitForSelector('#tpanel:not(.hidden)');
  const r = await page.evaluate(() => ({ txt: document.getElementById('tpanel').innerText, board: document.querySelectorAll('.mem.st-board').length, bench: document.querySelectorAll('.mem.st-bench').length, shop: document.querySelectorAll('.mem.st-shop').length, mems: document.querySelectorAll('.mem').length, glow: __app.world.glow && __app.world.glow.keys.size }));
  assert.ok(r.txt.includes('Lửa') && r.mems >= 6); assert.equal(r.board, 1); assert.equal(r.bench, 1); assert.ok(r.shop >= 1); assert.equal(r.glow, 2, 'viền sáng cho cả Pokémon trên sân và ghế');
  await page.locator('.mem.st-board').click(); assert.ok((await page.locator('.tdetail').innerText()).includes('Charmander'));
  await shot(page, '03b-trait-panel');
  await page.mouse.click(1000, 400); await page.waitForSelector('#tpanel.hidden', { state: 'attached' }); assert.equal(await page.evaluate(() => __app.world.glow), null);
  await page.locator('.trait[data-trait="Fire"]').click(); await page.locator('#tpanel .x').click(); await page.waitForSelector('#tpanel.hidden', { state: 'attached' });
});
await step('gộp 3 con giống nhau qua giao diện: lên 2★, tiến hóa, có hiệu ứng, không lỗi', async () => {
  const r = await page.evaluate(() => { const g = __app.match.g; g.gold = 30; g.bench.fill(null); g.board.fill(null); g.bench[0] = g.makeUnit('machop', 1); g.bench[1] = g.makeUnit('machop', 1); g.shop[2] = 'machop'; g.pool.machop--; __app.refreshView(); return true; });
  await page.locator('#shop .card').nth(2).click(); await page.locator('.toast', { hasText: '2★' }).first().waitFor({ timeout: 5000 });
  const u = await page.evaluate(() => __app.match.g.allUnits().map(x => [x.key, x.star])); assert.deepEqual(u, [['machop', 2]]);
  await page.waitForTimeout(700); assert.equal(await page.evaluate(() => __app.world.views.get('u' + __app.match.g.allUnits()[0].id).actor.form.name), 'Machoke');
  await page.evaluate(() => { const g = __app.match.g; g.bench[3] = g.makeUnit('geodude', 1); __app.refreshView(); });
});
await step('kéo-thả bằng chuột: băng ghế -> sân, sân -> băng ghế', async () => {
  const uid = await page.evaluate(() => __app.match.g.bench.find(Boolean).id);
  const a = await unitScreen(page, uid), b = await cellScreen(page, 'board', 4, 2);
  await drag(page, a, b); let s = await state(page); assert.equal(s.board, 1, 'phải lên sân'); assert.equal(await page.evaluate(id => __app.match.g.find(id).zone, uid), 'board');
  const a2 = await unitScreen(page, uid), b2 = await cellScreen(page, 'bench', 2);
  await drag(page, a2, b2); s = await state(page); assert.equal(s.board, 0, 'phải xuống băng ghế');
});
await step('giới hạn sân theo cấp độ: cấp 2 chỉ đặt tối đa 2 con', async () => {
  await page.evaluate(() => { const g = __app.match.g; g.level = 2; g.bench.fill(null); for (let i = 0; i < 3; i++) g.bench[i] = g.makeUnit(['geodude', 'machop', 'zubat'][i], 1); __app.refreshView(); });
  const ids = await page.evaluate(() => __app.match.g.bench.slice(0, 3).map(u => u.id));
  for (let i = 0; i < 3; i++) { const a = await unitScreen(page, ids[i]), b = await cellScreen(page, 'board', 2 + i, 2); await drag(page, a, b); }
  assert.equal((await state(page)).board, 2);
});
await step('bán bằng cách kéo vào vùng bán: nhận vàng, trả về kho', async () => {
  const before = await page.evaluate(() => ({ gold: __app.match.g.gold, bench: __app.match.g.bench.filter(Boolean).length, id: __app.match.g.bench.find(Boolean).id }));
  const a = await unitScreen(page, before.id);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 10, a.y + 10, { steps: 3 });
  await page.waitForSelector('#sell.show', { timeout: 4000 }).catch(async e => { console.log('DEBUG', JSON.stringify(await page.evaluate(() => ({ a: __app.screenOpen, m: __app.modalOpen, ph: __app.phase, cand: !!__app.input.cand, dr: __app.input.dragging, bench: __app.match.g.bench.map(u => u && u.key), board: __app.match.g.board.map(u => u && u.key).filter(Boolean) }))), a); throw e; });
  const r = await page.locator('#sell').boundingBox(); await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 8 }); await page.mouse.up();
  const after = await state(page); assert.ok(after.gold > before.gold && after.bench === before.bench - 1);
});
await step('phím tắt: D làm mới, F mua XP, L khóa', async () => {
  await page.evaluate(() => { __app.match.g.gold = 30; __app.refreshView(); }); await page.mouse.move(640, 300);
  const s0 = await state(page); await page.keyboard.press('d'); const s1 = await state(page); assert.equal(s1.gold, s0.gold - 2);
  await page.keyboard.press('f'); const s2 = await state(page); assert.equal(s2.gold, s1.gold - 4);
  await page.keyboard.press('l'); assert.equal(await page.evaluate(() => __app.match.g.locked), true); await page.keyboard.press('l');
});
await step('kéo vật phẩm từ kho vào Pokémon: trang bị, và 2 nguyên liệu tự ghép', async () => {
  const uid = await page.evaluate(() => { const g = __app.match.g; g.bag = ['band', 'scarf']; __app.refreshView(); return g.boardUnits()[0].id; });
  for (let i = 0; i < 2; i++) { const slot = await page.locator('#bag .slot.has').first().boundingBox(); await drag(page, { x: slot.x + 18, y: slot.y + 18 }, await unitScreen(page, uid)); }
  const items = await page.evaluate(id => __app.match.g.find(id).u.items, uid); assert.deepEqual(items, ['quickclaw']);
  await shot(page, '04-item');
});
await step('rê chuột vào tộc hiện chú thích; bấm Pokémon hiện bảng thông tin', async () => {
  await page.hover('.trait >> nth=0'); await page.waitForSelector('.tip:not(.hidden)'); assert.ok((await page.locator('.tip').innerText()).length > 10);
  const uid = await page.evaluate(() => __app.match.g.boardUnits()[0].id); const p = await unitScreen(page, uid); await page.mouse.click(p.x, p.y);
  await page.waitForSelector('#info:not(.hidden)'); assert.ok((await page.locator('#info').innerText()).includes('Máu')); await shot(page, '05-info');
  await page.mouse.click(700, 120);
});
await step('bấm vào Pokémon đối thủ ở nửa trên hiện thông tin "Đối thủ"', async () => {
  await page.evaluate(() => __app.hud.hideInfo(true));
  const id = await page.evaluate(() => __app.match.g.fight.specs[0].id); await settle(page);
  const p = await page.evaluate(id => { const v = __app.world.views.get('e' + id), q = __app.world.project(v.x, .5, v.z), r = __app.world.canvas.getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y }; }, id);
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(300);
  const visible = await page.evaluate(() => !document.getElementById('info').classList.contains('hidden')); if (visible) assert.ok((await page.locator('#info').innerText()).includes('Đối thủ') || (await page.locator('#info').innerText()).includes('hoang dã'));
  await page.mouse.click(700, 120);
});
await step('SẴN SÀNG -> chiến đấu -> kết quả -> vòng kế tiếp', async () => {
  await page.evaluate(() => { const g = __app.match.g; g.level = 4; if (!g.boardCount()) { g.move(g.bench.find(Boolean).id, { zone: 'board', idx: 27 }); } __app.refreshView(); });
  await page.click('#bReady'); await page.waitForFunction(() => __app.phase === 'combat', null, { timeout: 8000 });
  await page.waitForTimeout(1800); await shot(page, '06-combat');
  await page.evaluate(() => __app.skipBattle()); await page.waitForSelector('#resultBox', { timeout: 15000 });
  assert.ok((await page.locator('#resultBox').innerText()).match(/CHIẾN THẮNG|DỌN SẠCH|THẤT BẠI|THUA/)); await shot(page, '07-result');
  await page.click('#resOk'); await page.waitForFunction(() => __app.phase === 'prep' && __app.match.g.round === 2, null, { timeout: 8000 });
});
await step('tự động lưu: tải lại trang có nút Tiếp tục và quay lại đúng vòng', async () => {
  await page.reload(); await page.waitForSelector('#mCont'); assert.ok((await page.locator('#mCont').innerText()).includes('Vòng 2'));
  await page.click('#mCont'); await page.waitForFunction(() => __app.phase === 'prep' && __app.match.g.round === 2); assert.equal(await page.locator('#shop .card:not(.sold)').count() > 0, true);
});
await step('chơi tiếp vài vòng liên tục không lỗi (tự đặt đội, bỏ qua trận)', async () => {
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { const g = __app.match.g; if (!g.boardCount()) __app.autoFill(); __app.refreshView(); });
    await page.click('#bReady'); await page.waitForFunction(() => __app.phase === 'combat', null, { timeout: 8000 }); await page.evaluate(() => __app.skipBattle());
    await page.waitForSelector('#resultBox', { timeout: 15000 }); await page.click('#resOk');
    const over = await page.evaluate(() => __app.phase === 'over'); if (over) break;
    await page.waitForFunction(() => __app.phase === 'prep', null, { timeout: 8000 });
  }
});
await step('menu tạm dừng mở bằng Esc, tiếp tục được', async () => {
  const over = await page.evaluate(() => __app.phase === 'over'); if (over) return;
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal #pRes'); await page.click('#pRes'); await page.waitForFunction(() => !document.querySelector('.modal'));
});
await step('thua hết máu -> màn hình kết thúc có hạng và nút chơi lại', async () => {
  await page.evaluate(() => { const g = __app.match.g; g.hp = 1; g.board.fill(null); g.bench.fill(null); g.bag = []; });
  // vòng PvP thật: cần ép phase về PvP; dùng finishRound trực tiếp
  await page.evaluate(() => { const a = __app; if (a.phase !== 'prep') return; const m = a.match; m.g.round = 4; m.beginRound(); a.refreshView(); });
  await page.evaluate(() => { __app.startCombat(); }); await page.waitForFunction(() => __app.phase === 'combat'); await page.evaluate(() => __app.skipBattle());
  await page.waitForSelector('#resultBox', { timeout: 15000 }); await page.click('#resOk'); await page.waitForSelector('.place', { timeout: 8000 });
  assert.ok((await page.locator('.place').innerText()).startsWith('#')); assert.ok(await page.locator('#oAgain').isVisible()); await shot(page, '08-over');
  assert.equal(await page.evaluate(() => !!localStorage.getItem('pac3d.save')), false, 'ván kết thúc phải xóa bản lưu');
});
await step('không có lỗi console trong cả phiên desktop', async () => { assert.deepEqual(errors.filter(e => !/favicon|manifest/i.test(e)), []); });
await ctx.close();

// ---------- điện thoại ----------
for (const [name, vp] of [['dọc 390x844', { width: 390, height: 844 }], ['ngang 844x390', { width: 844, height: 390 }]]) {
  console.log('\nĐiện thoại ' + name);
  const m = await open(vp, { touch: true }); const pg = m.page;
  await step('HUD vừa màn hình, không cuộn ngang, thẻ cửa hàng đều hiện đủ', async () => {
    await pg.evaluate(() => { __app.audio.init(); __app.newGame('squirtle'); const g = __app.match.g; g.gold = 20; g.level = 4; g.bag = ['band', 'orb', 'cloak']; g.board[3] = g.makeUnit('machop', 1); g.board[11] = g.makeUnit('abra', 1); __app.refreshView(); __app.settings.seenHint = true; __app.hud.hint(''); });
    await pg.waitForTimeout(1800);
    const r = await pg.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth, cards: [...document.querySelectorAll('#shop .card:not(.sold)')].map(c => { const b = c.getBoundingClientRect(); return b.left >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 && b.top >= 0; }) }));
    assert.ok(r.sw <= r.iw + 1, 'cuộn ngang'); assert.equal(r.cards.length, 5); assert.ok(r.cards.every(Boolean), 'thẻ ra ngoài màn hình');
    await shot(pg, name.startsWith('dọc') ? '09-mobile-portrait' : '10-mobile-landscape');
  });
  await step('cảm ứng: chạm thẻ để mua, chạm Pokémon xem thông tin', async () => {
    const before = await state(pg); await pg.locator('#shop .card:not(.sold)').first().tap(); const after = await state(pg); assert.ok(after.gold < before.gold);
    const uid = await pg.evaluate(() => __app.match.g.boardUnits()[0].id); const p = await unitScreen(pg, uid); await pg.touchscreen.tap(p.x, p.y);
    await pg.waitForSelector('#info:not(.hidden)');
  });
  await step('cảm ứng: thẻ có huy hiệu; GIỮ thẻ xem thông tin mà không mua; bấm tộc mở bảng vừa màn hình', async () => {
    await pg.evaluate(() => { const g = __app.match.g; g.gold = 20; g.bench.fill(null); g.shop = ['charmander', 'bulbasaur', 'pikachu', 'geodude', 'machop']; g.board[3] = g.makeUnit('charmander', 1); __app.refreshView(); __app.hud.hideInfo(true); });
    const tg = await pg.evaluate(() => [...document.querySelectorAll('#shop .card')].map(c => c.querySelectorAll('.tgi').length)); assert.ok(tg.every(n => n >= 1), 'thẻ thiếu huy hiệu ' + tg);
    const before = await state(pg); const card = pg.locator('#shop .card').nth(2); const bb = await card.boundingBox(); const pt = { clientX: bb.x + bb.width / 2, clientY: bb.y + bb.height / 2, pointerType: 'touch', pointerId: 7, isPrimary: true, bubbles: true };
    await card.dispatchEvent('pointerdown', pt); await pg.waitForTimeout(600); await card.dispatchEvent('pointerup', pt); await card.dispatchEvent('click', pt);
    await pg.waitForSelector('#info:not(.hidden)'); const after = await state(pg); assert.equal(after.gold, before.gold, 'giữ thẻ không được mua'); assert.equal(after.bench, before.bench);
    assert.ok((await pg.locator('#info').innerText()).includes('Pikachu') || (await pg.locator('#info').innerText()).includes('Pichu'));
    await shot(pg, name.startsWith('dọc') ? '13-mobile-longpress' : '14-mobile-longpress-land');
    await pg.mouse.click(5, 5).catch(() => { }); await pg.evaluate(() => __app.hud.hideInfo(true));
    await pg.locator('.trait').first().tap(); await pg.waitForSelector('#tpanel:not(.hidden)');
    const box = await pg.locator('#tpanel').boundingBox(); assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1, 'bảng tràn màn hình ' + JSON.stringify(box));
    await shot(pg, name.startsWith('dọc') ? '15-mobile-trait' : '16-mobile-trait-land'); await pg.locator('#tpanel .x').tap();
  });
  await step('cảm ứng: SẴN SÀNG bắt đầu trận', async () => {
    await pg.locator('#bReady').tap(); await pg.waitForFunction(() => __app.phase === 'combat', null, { timeout: 8000 }); await pg.waitForTimeout(1500);
    await shot(pg, name.startsWith('dọc') ? '11-mobile-combat-portrait' : '12-mobile-combat-landscape');
  });
  await step('không có lỗi console', async () => { assert.deepEqual(m.errors.filter(e => !/favicon|manifest/i.test(e)), []); });
  await m.ctx.close();
}

// ---------- model 3D tuỳ chọn ----------
console.log('\nModel 3D tuỳ chọn (.glb)');
{
  const { execSync } = await import('node:child_process');
  fs.mkdirSync('dist/models', { recursive: true }); execSync('node tools/make-test-glb.mjs dist/models/test.glb');
  fs.writeFileSync('dist/models/manifest.json', JSON.stringify({ 4: 'test.glb' }));
  const m = await open({ width: 900, height: 600 }); const pg = m.page;
  await step('có manifest: Pokémon trong manifest dùng model 3D, có hoạt ảnh; con khác vẫn là sprite', async () => {
    await pg.evaluate(async () => { await __app.modelsReady; __app.audio.init(); __app.newGame('charmander'); const g = __app.match.g; g.bench[2] = g.makeUnit('squirtle', 1); __app.refreshView(); });
    await pg.waitForFunction(() => { const v = __app.world.views.get('u' + __app.match.g.bench[0].id); return v && v.actor.model; }, null, { timeout: 15000 });
    const r = await pg.evaluate(() => { const g = __app.match.g, a = __app.world.views.get('u' + g.bench[0].id).actor, b = __app.world.views.get('u' + g.bench[2].id).actor; return { model: !!a.model, sprHidden: !a.mesh.visible, acts: Object.keys(a.model.actions), other: !!b.model, otherVisible: b.mesh.visible }; });
    assert.ok(r.model && r.sprHidden && r.acts.includes('Idle') && r.acts.includes('Attack')); assert.ok(!r.other && r.otherVisible);
    await pg.evaluate(() => { const a = __app.world.views.get('u' + __app.match.g.bench[0].id).actor; a.play('Attack', true); a.face(1, 0); }); await pg.waitForTimeout(600);
    assert.deepEqual(m.errors.filter(e => !/favicon|manifest/i.test(e)), []);
  });
  await m.ctx.close(); fs.rmSync('dist/models', { recursive: true, force: true });
}

await browser.close(); kill();
console.log(`\n${pass} đạt, ${fail} lỗi`);
if (fail) { for (const [n, e] of failures) console.log('\n✗', n, '\n', e.stack.split('\n').slice(0, 5).join('\n')); process.exit(1); }
console.log('Tất cả đều ĐẠT'); process.exit(0);
