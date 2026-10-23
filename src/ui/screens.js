// Các màn hình lớn: menu chính, chọn Pokémon khởi đầu, cách chơi, cài đặt, tạm dừng, kết thúc.
import { LINE, LINES, formAt, unitTraits, COST_COL, baseStats } from '../data/roster.js';
import { typeChip, mountSprite, drawSprite, traitBadge } from './icons.js';
import { abilityText } from './describe.js';
import { TYPE_COL } from '../data/types.js';
import { TRAIT_LIST, modsText } from '../data/traits.js';
import { DIFFICULTY } from '../game/bots.js';

const STARTERS = [
  { key: 'bulbasaur', desc: 'Bắn mưa lá từ xa, hồi phục nhờ hệ Cỏ.' },
  { key: 'charmander', desc: 'Phun lửa gây sát thương vùng, tiến hóa thành Charizard.' },
  { key: 'squirtle', desc: 'Tạo khiên bảo vệ cả đội, đỡ đòn rất tốt.' },
  { key: 'pikachu', desc: 'Tia điện nảy qua nhiều kẻ địch (đã là Pichu ở 1★).' }
];

export class Screens {
  constructor(root, app) { this.root = root; this.app = app; this.stops = []; }
  clear() { this.stops.forEach(s => s()); this.stops = []; this.root.innerHTML = ''; this.app.screenOpen = false; }
  open(html, cls = '') {
    const d = document.createElement('div'); d.className = 'screen ' + cls; d.innerHTML = html; this.root.appendChild(d); this.app.screenOpen = true; return d;
  }
  modal(html) {
    const d = document.createElement('div'); d.className = 'modal'; d.innerHTML = `<div class="panel box">${html}</div>`;
    d.addEventListener('pointerdown', e => { if (e.target === d) d.remove(); this.fix(); });
    document.body.appendChild(d); this.fix(); return d;
  }
  fix() { this.app.modalOpen = !!document.querySelector('.modal'); }

  // Màn mở đầu: logo hiện từng chữ, pháo hoa hạt, chạm để vào (cũng là cú chạm đầu tiên để mở âm thanh trên iOS)
  splash() {
    this.clear(); const a = this.app, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const title = 'ĐẤU TRƯỜNG POKÉMON';
    const d = this.open(`<div class="sp-vig"></div><canvas class="sp-fx"></canvas><div class="sp-flash"></div>
      <div class="sp-logo"><div class="sp-star">★</div><h1>${(() => { let n = 0; return title.split(' ').map(w => `<span class="sp-word">${[...w].map(ch => `<span style="--i:${n++}">${ch}</span>`).join('')}</span>`).join(''); })()}</h1><div class="sp-sub">AUTO CHESS 3D</div></div>
      <div class="sp-tap">Chạm để bắt đầu</div>`, 'splash' + (reduce ? ' reduce' : ''));
    const cv = d.querySelector('.sp-fx'), g = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    const fit = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }; fit(); addEventListener('resize', fit);
    const P = []; let t = 0, last = performance.now(), burst = false, alive = true;
    const add = (x, y, vx, vy, life, col, size, grav) => P.push({ x, y, vx, vy, life, max: life, col, size, grav });
    const frame = now => {
      if (!alive) return; const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
      const cx = innerWidth / 2, cy = innerHeight * .42;
      if (!burst && t > 2.1 && !reduce) {          // pháo hoa lúc logo bừng sáng
        burst = true; for (let i = 0; i < 150; i++) { const a = Math.random() * 6.283, v = 90 + Math.random() * 420; add(cx, cy, Math.cos(a) * v, Math.sin(a) * v * .8 - 60, 1.1 + Math.random() * 1.2, ['#ffe14a', '#fff', '#ff9ad5', '#7fe8ff', '#ffb347'][i % 5], 2 + Math.random() * 3.5, 260); }
      }
      if (!reduce && Math.random() < .5) add(Math.random() * innerWidth, innerHeight + 8, (Math.random() - .5) * 20, -40 - Math.random() * 70, 3 + Math.random() * 2, '#ffe9a0', 1.5 + Math.random() * 2, 0);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight); g.globalCompositeOperation = 'lighter';
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.life -= dt; if (p.life <= 0) { P.splice(i, 1); continue; }
        p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .995;
        g.globalAlpha = Math.min(1, p.life / p.max * 1.6); g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.size, 0, 7); g.fill();
        g.globalAlpha *= .35; g.beginPath(); g.arc(p.x, p.y, p.size * 2.6, 0, 7); g.fill();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    // vào màn hình chính (chạm, bấm phím bất kỳ)
    let gone = false;
    const enter = () => {
      if (gone) return; gone = true; alive = false; removeEventListener('resize', fit);
      a.audio.init(); a.audio.sfx('splash'); a.world.endIntro();
      d.classList.add('out'); setTimeout(() => { this.clear(); this.title(true); }, reduce ? 50 : 520);
    };
    d.addEventListener('pointerdown', enter); addEventListener('keydown', function k(e) { if (!gone && !e.repeat && !a.modalOpen) { enter(); removeEventListener('keydown', k); } });
  }

  title(enter = false) {
    this.clear(); const a = this.app;
    const hasSave = a.hasSave();
    const d = this.open(`
      <div class="logo">ĐẤU TRƯỜNG POKÉMON<small>AUTO CHESS 3D</small></div>
      <div class="menu">
        <button class="btn gold" id="mNew">Chơi mới</button>
        ${hasSave ? `<button class="btn green" id="mCont">Tiếp tục · Vòng ${hasSave.round}</button>` : ''}
        <button class="btn" id="mHow">Cách chơi</button>
        <button class="btn" id="mDex">Danh mục Pokémon</button>
        <button class="btn" id="mSet">Cài đặt</button>
      </div>
      <div class="foot">Dự án fan phi thương mại, làm vì đam mê. Pokémon và tên Pokémon thuộc Nintendo / Game Freak / The Pokémon Company, dự án không liên kết với họ.<br>Sprite: PMD SpriteCollab (CC BY-NC 4.0) · Dữ liệu: PokeAPI · Âm thanh tự tổng hợp</div>`, 'title');
    d.querySelector('#mNew').onclick = () => { a.audio.init(); a.audio.sfx('click'); this.starter(); };
    if (hasSave) d.querySelector('#mCont').onclick = () => { a.audio.init(); a.audio.sfx('click'); a.continueGame(); };
    d.querySelector('#mHow').onclick = () => { a.audio.init(); a.audio.sfx('click'); this.howTo(); };
    d.querySelector('#mDex').onclick = () => { a.audio.init(); a.audio.sfx('click'); this.codex(); };
    d.querySelector('#mSet').onclick = () => { a.audio.init(); a.audio.sfx('click'); this.settings(); };
    if (enter) d.classList.add('enter');
    a.audio.music('menu');
  }

  starter() {
    this.clear(); const a = this.app;
    const d = this.open(`<div class="logo" style="font-size:clamp(26px,5vw,46px)">Chọn Pokémon khởi đầu</div>
      <div style="opacity:.85;margin-top:8px">Bạn nhận miễn phí 1 Pokémon. Mua thêm ở cửa hàng, gộp 3 con giống nhau để lên sao và tiến hóa.</div>
      <div class="starters">${STARTERS.map(s => { const l = LINE[s.key], f = formAt(l, 1); return `<div class="st" data-k="${s.key}" style="--stc:${TYPE_COL[f.types[0]]}"><canvas></canvas><h3>${f.name}</h3><div style="display:flex;gap:3px;justify-content:center;flex-wrap:wrap">${unitTraits(l, 1).filter(t => t !== 'satoshi' && t !== 'starter').map(t => typeChip(t)).join('')}</div><div style="font-size:11.5px;opacity:.85;margin-top:6px">${s.desc}</div></div>`; }).join('')}</div>
      <div class="diff" id="diff">${DIFFICULTY.map(x => `<button class="btn ${a.settings.diff === x.id ? 'on' : ''}" data-d="${x.id}" title="${x.desc}">${x.name}</button>`).join('')}</div>
      <div style="font-size:12px;opacity:.8;margin-top:6px" id="diffDesc">${DIFFICULTY[a.settings.diff ?? 1].desc}</div>
      <div class="menu" style="margin-top:14px"><button class="btn" id="mBack">‹ Quay lại</button></div>`, 'dim');
    d.querySelectorAll('#diff .btn').forEach(b => b.onclick = () => {
      a.settings.diff = +b.dataset.d; a.saveSettings(); a.audio.sfx('click');
      d.querySelectorAll('#diff .btn').forEach(x => x.classList.toggle('on', x === b)); d.querySelector('#diffDesc').textContent = DIFFICULTY[a.settings.diff].desc;
    });
    d.querySelectorAll('.st').forEach(el => {
      const k = el.dataset.k, f = formAt(LINE[k], 1);
      this.stops.push(mountSprite(el.querySelector('canvas'), f.dex, { anim: 'Idle', dir: 0, scale: 3 }));
      el.onclick = () => { a.audio.init(); a.audio.sfx('buy'); a.audio.cry(f.dex); a.newGame(k, a.settings.diff ?? 1); };
    });
    d.querySelector('#mBack').onclick = () => { a.audio.sfx('click'); this.title(); };
  }

  howTo() {
    const m = this.modal(`<button class="btn close" style="padding:4px 12px">✕</button><h2>Cách chơi</h2>
      <p>Mỗi ván bạn đối đầu 7 đối thủ AI. Mỗi vòng gồm <b>giai đoạn chuẩn bị</b> (mua, xếp đội) rồi <b>chiến đấu tự động</b>. Hết máu là bị loại; đứng cuối cùng là chiến thắng.</p>
      <h3>Mua và xếp đội</h3><ul>
        <li>Mua Pokémon ở cửa hàng bằng vàng (phím 1-5). <b>Làm mới</b> tốn 2 vàng (D), <b>Mua XP</b> tốn 4 vàng (F), <b>Khóa</b> giữ cửa hàng sang vòng sau (L).</li>
        <li>Kéo Pokémon từ băng ghế xuống sân (nửa dưới bàn cờ). Cấp độ càng cao, sân càng chứa được nhiều Pokémon (cấp N = N con).</li>
        <li>Đặt kẻ cận chiến ở hàng trước, kẻ đánh xa ở hàng sau. Kéo vào vùng đỏ trên cửa hàng để bán (phím E).</li></ul>
      <h3>Lên sao và tiến hóa</h3><p>Gom 3 Pokémon giống nhau cùng sao để gộp thành 1 con mạnh hơn <b>và tiến hóa</b> (Charmander → Charmeleon → Charizard). Một số Pokémon (như Magikarp) rất yếu cho đến khi lên 3★.</p>
      <h3>Hệ và Tộc</h3><p>Có nhiều Pokémon cùng hệ hoặc cùng tộc trên sân sẽ kích hoạt thưởng sức mạnh (xem cột bên trái, rê chuột để xem chi tiết). Chỉ tính mỗi loại Pokémon một lần.</p>
      <ul>${TRAIT_LIST.filter(t => t.kind === 'anime').map(t => `<li><b style="color:${t.color}">${t.name}</b>: ${t.tiers.map(x => x.n + ' → ' + modsText(x.mods || x.allMods)).join(' | ')}</li>`).join('')}</ul>
      <h3>Tương khắc hệ</h3><p>Chiêu thức hệ Nước đánh Pokémon hệ Lửa sẽ "Hiệu quả!" (+30% sát thương), ngược lại sẽ yếu đi. Đòn đánh thường bị ảnh hưởng nhẹ hơn chiêu đặc biệt.</p>
      <h3>Vàng</h3><p>Mỗi vòng nhận vàng cơ bản + <b>lãi 1 vàng cho mỗi 10 vàng đang có (tối đa 5)</b> + thưởng chuỗi thắng hoặc chuỗi thua. Cân bằng giữa tiêu vàng và tiết kiệm lấy lãi là chìa khóa.</p>
      <h3>Vật phẩm</h3><p>Vòng Pokémon hoang dã rơi nguyên liệu. Kéo nguyên liệu vào Pokémon để trang bị; 2 nguyên liệu trên cùng một Pokémon sẽ ghép thành vật phẩm hoàn chỉnh. Tối đa 3 món mỗi Pokémon.</p>
      <h3>Phím tắt</h3><p>D làm mới · F mua XP · L khóa · E bán · 1-5 mua · Cách: sẵn sàng · Esc menu.</p>`);
    m.querySelector('.close').onclick = () => { m.remove(); this.fix(); };
  }

  settings() {
    const a = this.app, au = a.audio;
    const m = this.modal(`<button class="btn close" style="padding:4px 12px">✕</button><h2>Cài đặt</h2>
      <div class="set"><span style="width:90px">Nhạc nền</span><input type="range" id="sMusic" min="0" max="100" value="${Math.round(au.vol.music * 100)}"></div>
      <div class="set"><span style="width:90px">Hiệu ứng</span><input type="range" id="sSfx" min="0" max="100" value="${Math.round(au.vol.sfx * 100)}"></div>
      <div class="set"><span style="width:90px">Màn mở đầu</span><input type="checkbox" id="sSplash" ${a.settings.splash !== false ? 'checked' : ''}></div>
      <div class="set"><span style="width:90px">Rung màn hình</span><input type="checkbox" id="sShake" ${a.settings.shake ? 'checked' : ''}></div>
      <div class="set"><span style="width:90px">Chất lượng</span><select id="sQ"><option value="1">Tiết kiệm pin</option><option value="2">Sắc nét</option></select></div>
      <p style="opacity:.75;font-size:12px">Muốn dùng nhạc hoặc âm thanh riêng? Xem <code>public/audio-user/README.md</code> trong mã nguồn. Âm thanh mặc định là tự tổng hợp, không có bản quyền.</p>
      <div class="set"><button class="btn" id="sOff" style="padding:6px 12px">Tải trước để chơi offline (~15MB)</button><span id="sOffT" style="font-size:12px;opacity:.8"></span></div>
      <div class="set"><button class="btn red" id="sWipe" style="padding:6px 12px">Xóa dữ liệu lưu</button></div>`);
    m.querySelector('#sOff').onclick = async () => {
      const t = m.querySelector('#sOffT'); t.textContent = 'Đang tải...';
      try { await a.precache(p => { t.textContent = Math.round(p * 100) + '%'; }); t.textContent = 'Xong! Có thể chơi không cần mạng.'; } catch (e) { t.textContent = e.message; }
    };
    m.querySelector('#sMusic').oninput = e => au.setVolume('music', e.target.value / 100);
    m.querySelector('#sSfx').oninput = e => { au.setVolume('sfx', e.target.value / 100); };
    m.querySelector('#sSfx').onchange = () => au.sfx('buy');
    m.querySelector('#sSplash').onchange = e => { a.settings.splash = e.target.checked; a.saveSettings(); };
    m.querySelector('#sShake').onchange = e => { a.settings.shake = e.target.checked; a.saveSettings(); };
    const q = m.querySelector('#sQ'); q.value = String(a.settings.dpr); q.onchange = () => { a.settings.dpr = +q.value; a.saveSettings(); a.applyQuality(); };
    m.querySelector('#sWipe').onclick = () => { if (confirm('Xóa ván đang lưu và kỷ lục?')) { a.wipe(); m.remove(); this.fix(); if (!a.match) this.title(); } };
    m.querySelector('.close').onclick = () => { m.remove(); this.fix(); };
  }

  pause() {
    const a = this.app;
    const m = this.modal(`<h2 style="text-align:center">Tạm dừng</h2><div class="menu" style="margin:14px auto 4px">
      <button class="btn green" id="pRes">Tiếp tục</button><button class="btn" id="pHow">Cách chơi</button><button class="btn" id="pDex">Danh mục Pokémon</button><button class="btn" id="pSet">Cài đặt</button><button class="btn red" id="pQuit">Bỏ cuộc về menu</button></div>`);
    a.paused = true;
    const done = () => { m.remove(); a.paused = false; this.fix(); };
    m.querySelector('#pRes').onclick = done; m.querySelector('#pHow').onclick = () => this.howTo(); m.querySelector('#pDex').onclick = () => this.codex(); m.querySelector('#pSet').onclick = () => this.settings();
    m.querySelector('#pQuit').onclick = () => { if (confirm('Bỏ ván này? (Ván được lưu tự động đầu mỗi vòng, bạn có thể tiếp tục sau)')) { m.remove(); a.paused = false; this.fix(); a.quitToTitle(); } };
    m.addEventListener('pointerdown', e => { if (e.target === m) done(); });
  }

  // Danh mục: toàn bộ Pokémon theo giá + các tộc/hệ
  codex(tab = 1) {
    document.querySelectorAll('.modal.codex').forEach(x => x.remove());
    const m = this.modal(`<button class="btn close" style="padding:4px 12px">✕</button><h2>Danh mục Pokémon</h2>
      <div class="tabs">${[1, 2, 3, 4, 5].map(c => `<button class="tab ${tab === c ? 'on' : ''}" data-t="${c}" style="--tc:${COST_COL[c]}">Giá ${c}</button>`).join('')}<button class="tab ${tab === 'tr' ? 'on' : ''}" data-t="tr">Hệ &amp; Tộc</button></div><div id="cxBody"></div>`);
    m.classList.add('codex'); m.querySelector('.box').style.width = 'min(920px,100%)';
    const body = m.querySelector('#cxBody');
    if (tab === 'tr') {
      body.innerHTML = '<div class="cxgrid">' + TRAIT_LIST.map(t => {
        const members = LINES.filter(l => l.traits.includes(t.id) || [0, 1, 2].some(i => formAt(l, i + 1).types.includes(t.id)));
        return `<div class="cxcard" style="--cc:${t.color}"><div style="display:flex;gap:8px;align-items:center">${traitBadge(t.id, 26)}<b>${t.name}</b><span style="opacity:.6;font-size:11px">${t.kind === 'anime' ? 'Tộc' : 'Hệ'} · ${members.length} Pokémon</span></div>
          ${t.tiers.map(x => `<div style="font-size:12px"><b style="color:var(--accent)">(${x.n})</b> ${modsText(x.mods)}${x.mods && x.allMods ? '; ' : ''}${x.allMods ? 'cả đội: ' + modsText(x.allMods) : ''}</div>`).join('')}
          <div style="font-size:11px;opacity:.75;margin-top:4px">${members.map(l => formAt(l, 1).name).join(', ')}</div></div>`;
      }).join('') + '</div>';
    } else {
      body.innerHTML = '<div class="cxgrid">' + LINES.filter(l => l.cost === tab).map(l => {
        const ab = abilityText(l, 1), forms = [1, 2, 3].map(s => formAt(l, s)), names = forms.filter((f, i) => i === 0 || f.dex !== forms[i - 1].dex);
        const traits = [...new Set([1, 2, 3].flatMap(s => unitTraits(l, s)))];
        return `<div class="cxcard" style="--cc:${COST_COL[l.cost]}"><div class="cxs">${names.map(() => '<canvas></canvas>').join('<span>›</span>')}</div>
          <b>${names.map(f => f.name).join(' › ')}</b><div class="row" style="display:flex;gap:3px;flex-wrap:wrap;margin:3px 0">${traits.map(t => typeChip(t)).join('')}</div>
          ${ab ? `<div style="font-size:12px"><b style="color:var(--accent)">✦ ${ab.name}</b>: ${ab.text}</div>` : ''}</div>`;
      }).join('') + '</div>';
      body.querySelectorAll('.cxcard').forEach((el, i) => { const l = LINES.filter(x => x.cost === tab)[i], forms = [1, 2, 3].map(s => formAt(l, s)), names = forms.filter((f, k) => k === 0 || f.dex !== forms[k - 1].dex); el.querySelectorAll('canvas').forEach((cv, k) => drawSprite(cv, names[k].dex, 2)); });
    }
    m.querySelectorAll('.tab').forEach(b => b.onclick = () => { this.app.audio.sfx('click'); this.codex(b.dataset.t === 'tr' ? 'tr' : +b.dataset.t); });
    m.querySelector('.close').onclick = () => { m.remove(); this.fix(); };
  }

  over(g, placement, record) {
    this.clear(); const a = this.app;
    a.hudRoot.classList.add('hidden'); a.hud.hideResult(); a.hud.$('bannerHost').innerHTML = '';
    const win = placement === 1;
    const d = this.open(`<div style="font-size:18px;letter-spacing:4px;opacity:.85">${win ? 'VÔ ĐỊCH!' : 'KẾT THÚC'}</div>
      <div class="place" style="color:${win ? '#ffd24a' : placement <= 4 ? '#7dffa0' : '#ff9aa8'}">#${placement}</div>
      <div style="opacity:.85">${win ? 'Bạn là Nhà Huấn Luyện giỏi nhất đấu trường!' : placement <= 4 ? 'Vào top 4, rất đáng nể!' : 'Thua keo này, bày keo khác.'}${record ? ' <b style="color:#ffd24a">· Kỷ lục mới!</b>' : ''}</div>
      <div class="final" id="fin"></div>
      <div class="stat-grid"><div><b>${g.round - (win ? 0 : 1)}</b>Vòng đã chơi</div><div><b>${g.stats.wins}/${g.stats.losses}</b>Thắng / Thua PvP</div><div><b>${g.bestStreak}</b>Chuỗi dài nhất</div><div><b>${g.stats.merges}</b>Lần lên sao</div><div><b>${g.stats.gold}</b>Vàng kiếm được</div><div><b>${g.stats.damageDealt}</b>Sát thương gây ra</div></div>
      <div class="menu" style="margin-top:6px"><button class="btn gold" id="oAgain">Chơi lại</button><button class="btn" id="oMenu">Về menu</button></div>`, 'dim');
    const fin = d.querySelector('#fin');
    for (const u of g.board.filter(Boolean)) { const cv = document.createElement('canvas'); fin.appendChild(cv); this.stops.push(mountSprite(cv, formAt(LINE[u.key], u.star).dex, { anim: 'Idle', dir: 0, scale: 2 })); }
    d.querySelector('#oAgain').onclick = () => { a.audio.sfx('click'); this.starter(); };
    d.querySelector('#oMenu').onclick = () => { a.audio.sfx('click'); a.quitToTitle(); };
  }
}
