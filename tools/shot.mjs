// Chụp ảnh màn hình để tự kiểm tra giao diện: node tools/shot.mjs <url> <out.png> [rộng] [cao] [chờ ms] [js chạy trước khi chụp]
import { chromium } from 'playwright';
const [url, out, w = 1280, h = 720, wait = 2500, js = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] }).catch(async () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] }));
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(url);
await page.waitForTimeout(+wait);
if (js) { const r = await page.evaluate(js); if (r !== undefined) console.log('JS ->', JSON.stringify(r)); await page.waitForTimeout(800); }
await page.screenshot({ path: out });
console.log(errs.length ? errs.slice(0, 12).join('\n') : 'không có lỗi console');
await browser.close();
