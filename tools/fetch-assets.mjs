// Tải asset cho mọi Pokémon trong src/data/lines.js:
//  - Hoạt ảnh PMD SpriteCollab (CC BY-NC 4.0): Idle, Walk, Attack, Hurt, Charge  -> public/assets/pokemon/<dex>/<Tên>.png
//  - Chân dung PMD (40x40)                                                     -> public/assets/pokemon/<dex>/portrait.png
//  - Chỉ số gốc + hệ từ PokeAPI                                                 -> src/data/generated/forms.json
//  - Credit tác giả sprite                                                      -> CREDITS.md
// Chạy: npm run assets   (thêm --force để tải lại tất cả)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { allDex } from '../src/data/lines.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'public/assets/pokemon');
const GEN = path.join(ROOT, 'src/data/generated');
const PMD = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const FORCE = process.argv.includes('--force');
const ANIMS = ['Idle', 'Walk', 'Attack', 'Hurt', 'Charge'];
const pad = n => String(n).padStart(4, '0');

async function get(url, bin = true, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(r.status);
      return bin ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) { if (i === tries - 1) throw new Error(url + ' -> ' + e.message); await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  }
}

// Đọc AnimData.xml: trả về { Tên: { fw, fh, dur[], hit?, copyOf? } }
function parseAnimData(xml) {
  const out = {};
  for (const m of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const b = m[1], g = t => (b.match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1];
    const name = g('Name'); if (!name) continue;
    const a = { copyOf: g('CopyOf') };
    if (g('FrameWidth')) { a.fw = +g('FrameWidth'); a.fh = +g('FrameHeight'); a.dur = [...b.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(x => +x[1]); }
    if (g('HitFrame')) a.hit = +g('HitFrame');
    out[name] = a;
  }
  const resolve = n => { let a = out[n], name = n, g = 0; while (a && a.copyOf && g++ < 5) { name = a.copyOf; a = out[name]; } return a ? { ...a, src: name } : null; };
  const res = {};
  for (const n in out) { const a = resolve(n); if (a && a.fw) res[n] = a; }
  return res;
}

// Đo khung hình hàng 0 (nhìn xuống): đáy chân (trung vị), chiều cao & chiều rộng cơ thể
function measure(png, fw, fh, n) {
  const bottoms = [], heights = [], widths = [], cxs = [];
  for (let f = 0; f < n; f++) {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const a = png.data[((y) * png.width + f * fw + x) * 4 + 3];
      if (a > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 >= 0) { bottoms.push(y1 + 1); heights.push(y1 - y0 + 1); widths.push(x1 - x0 + 1); cxs.push((x0 + x1 + 1) / 2); }
  }
  const med = a => { if (!a.length) return 0; const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
  return { foot: med(bottoms), bh: med(heights), bw: med(widths), cx: med(cxs) };
}

async function pool(items, n, fn) {
  let i = 0; const run = async () => { while (i < items.length) { const k = items[i++]; await fn(k); } };
  await Promise.all(Array.from({ length: n }, run));
}

const dexes = allDex();
fs.mkdirSync(GEN, { recursive: true });
const formsPath = path.join(GEN, 'forms.json');
const forms = FORCE || !fs.existsSync(formsPath) ? {} : JSON.parse(fs.readFileSync(formsPath, 'utf8'));
const credits = {};

await pool(dexes, 6, async dex => {
  const dir = path.join(OUT, String(dex)); fs.mkdirSync(dir, { recursive: true });
  const have = forms[dex] && fs.existsSync(path.join(dir, 'Idle.png')) && fs.existsSync(path.join(dir, 'portrait.png'));
  // credit luôn tải lại (nhỏ)
  const cr = await get(`${PMD}/sprite/${pad(dex)}/credits.txt`, false).catch(() => null);
  if (cr) credits[dex] = cr.split('\n').filter(Boolean).map(l => l.split('\t')[1]).filter(Boolean);
  if (have && !FORCE) { process.stdout.write('.'); return; }

  const xml = await get(`${PMD}/sprite/${pad(dex)}/AnimData.xml`, false);
  if (!xml) { console.error('\nThiếu AnimData cho', dex); process.exit(1); }
  const ad = parseAnimData(xml);
  const anims = {};
  for (const name of ANIMS) {
    const a = ad[name]; if (!a) continue;
    const buf = await get(`${PMD}/sprite/${pad(dex)}/${a.src}-Anim.png`);
    if (!buf) continue;
    fs.writeFileSync(path.join(dir, name + '.png'), buf);
    const png = PNG.sync.read(buf);
    const n = a.dur.length, m = measure(png, a.fw, a.fh, n);
    anims[name] = { fw: a.fw, fh: a.fh, n, dur: a.dur, hit: a.hit ?? null, rows: png.height / a.fh, ...m };
  }
  for (const need of ['Idle', 'Walk', 'Attack', 'Hurt']) if (!anims[need]) { console.error('\nDex', dex, 'thiếu', need); process.exit(1); }
  const pt = await get(`${PMD}/portrait/${pad(dex)}/Normal.png`);
  if (pt) fs.writeFileSync(path.join(dir, 'portrait.png'), pt);

  const api = JSON.parse(await get(`https://pokeapi.co/api/v2/pokemon/${dex}`, false));
  const st = {}; for (const s of api.stats) st[s.stat.name] = s.base_stat;
  const cap = s => s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
  forms[dex] = {
    name: cap(api.species.name),
    types: api.types.sort((a, b) => a.slot - b.slot).map(t => cap(t.type.name)),
    stats: { hp: st.hp, atk: st.attack, def: st.defense, spa: st['special-attack'], spd: st['special-defense'], spe: st.speed },
    height: api.height / 10, weight: api.weight / 10,
    shadow: +(xml.match(/<ShadowSize>(\d+)/) || [0, 1])[1],
    anims
  };
  process.stdout.write('+');
});

const sorted = {}; Object.keys(forms).sort((a, b) => a - b).forEach(k => sorted[k] = forms[k]);
fs.writeFileSync(formsPath, JSON.stringify(sorted));

// CREDITS.md
const names = new Set();
for (const d of dexes) (credits[d] || []).forEach(n => names.add(n));
const md = `# Ghi công (Credits)

Dự án cá nhân, **phi thương mại**, làm vì đam mê. Pokémon và tên Pokémon thuộc Nintendo / Game Freak / The Pokémon Company.
Dự án không liên kết với các công ty trên.

## Hình ảnh
- **Hoạt ảnh và chân dung Pokémon**: [PMD SpriteCollab](https://github.com/PMDCollab/SpriteCollab) — giấy phép **CC BY-NC 4.0** (không dùng thương mại).
  Danh sách tác giả sprite được dùng trong game (lấy tự động từ \`credits.txt\` của từng Pokémon, ${names.size} người):
  ${[...names].sort((a, b) => a.localeCompare(b)).join(', ')}.
- **Chỉ số gốc và hệ**: [PokeAPI](https://pokeapi.co/).

## Thư viện
- [three.js](https://threejs.org/) (MIT), [Vite](https://vitejs.dev/) (MIT).

## Âm thanh
- Nhạc nền và hiệu ứng được **tự tổng hợp bằng Web Audio** trong code, không dùng bản ghi có bản quyền.
- Người chơi có thể tự thêm file âm thanh riêng (xem \`public/audio-user/README.md\`); các file đó không nằm trong repo.
`;
fs.writeFileSync(path.join(ROOT, 'CREDITS.md'), md);
console.log(`\nXong: ${Object.keys(forms).length} dạng, ${names.size} tác giả.`);
