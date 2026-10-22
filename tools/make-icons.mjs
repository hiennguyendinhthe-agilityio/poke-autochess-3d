// Tạo icon PNG từ public/icon.svg (192, 512, maskable 512, apple-touch 180)
import { chromium } from 'playwright';
import fs from 'node:fs';
const svg = fs.readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
async function render(size, out, pad = 0) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:${pad ? '#14102a' : 'transparent'}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center"><img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}" style="width:${size - pad * 2}px;height:${size - pad * 2}px"></div></body>`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: out, omitBackground: !pad });
}
await render(192, 'public/icon-192.png'); await render(512, 'public/icon-512.png'); await render(512, 'public/icon-maskable-512.png', 64); await render(180, 'public/apple-touch-icon.png', 14);
await browser.close(); console.log('Đã tạo icon');
