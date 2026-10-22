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
await step('mua Pokémon: trừ vàng, thêm vào băng ghế; hết vàng thì báo lỗi', async () => {
  await page.evaluate(() => { __app.match.g.gold = 8; __app.refreshView(); });
  const before = await state(page); await page.click('#shop .card:not(.sold)');
  const after = await state(page); assert.ok(after.gold < before.gold && after.bench === before.bench + 1);
  await page.evaluate(() => { __app.match.g.gold = 0; __app.refreshView(); });
  await page.click('#shop .card:not(.sold)'); await page.waitForSelector('.toast'); assert.equal((await state(page)).bench, after.bench);
});
await step('kéo-thả bằng chuột: băng ghế -> sân, sân -> băng ghế', async () => {
  const uid = await page.evaluate(() => __app.match.g.bench.find(Boolean).id);
  const a = await unitScreen(page, uid), b = await screenOf(page, 4.5, 6.5, 0);
  await drag(page, a, b); let s = await state(page); assert.equal(s.board, 1, 'phải lên sân'); assert.equal(await page.evaluate(id => __app.match.g.find(id).zone, uid), 'board');
  const a2 = await unitScreen(page, uid), b2 = await screenOf(page, 2.5 * 0.875 + 0.45, 9.05, 0);
  await drag(page, a2, b2); s = await state(page); assert.equal(s.board, 0, 'phải xuống băng ghế');
});
await step('giới hạn sân theo cấp độ: cấp 2 chỉ đặt tối đa 2 con', async () => {
  await page.evaluate(() => { const g = __app.match.g; g.level = 2; g.bench.fill(null); for (let i = 0; i < 3; i++) g.bench[i] = g.makeUnit(['geodude', 'machop', 'zubat'][i], 1); __app.refreshView(); });
  const ids = await page.evaluate(() => __app.match.g.bench.slice(0, 3).map(u => u.id));
  for (let i = 0; i < 3; i++) { const a = await unitScreen(page, ids[i]), b = await screenOf(page, 2.5 + i, 6.5, 0); await drag(page, a, b); }
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
  await step('cảm ứng: SẴN SÀNG bắt đầu trận', async () => {
    await pg.locator('#bReady').tap(); await pg.waitForFunction(() => __app.phase === 'combat', null, { timeout: 8000 }); await pg.waitForTimeout(1500);
    await shot(pg, name.startsWith('dọc') ? '11-mobile-combat-portrait' : '12-mobile-combat-landscape');
  });
  await step('không có lỗi console', async () => { assert.deepEqual(m.errors.filter(e => !/favicon|manifest/i.test(e)), []); });
  await m.ctx.close();
}

await browser.close(); kill();
console.log(`\n${pass} đạt, ${fail} lỗi`);
if (fail) { for (const [n, e] of failures) console.log('\n✗', n, '\n', e.stack.split('\n').slice(0, 5).join('\n')); process.exit(1); }
console.log('Tất cả đều ĐẠT'); process.exit(0);
