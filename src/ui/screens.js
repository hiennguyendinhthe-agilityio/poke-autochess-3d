// Các màn hình lớn: menu chính, chọn Pokémon khởi đầu, cách chơi, cài đặt, tạm dừng, kết thúc.
import { LINE, formAt, unitTraits } from '../data/roster.js';
import { typeChip, mountSprite } from './icons.js';
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

  title() {
    this.clear(); const a = this.app;
    const hasSave = a.hasSave();
    const d = this.open(`
      <div class="logo">ĐẤU TRƯỜNG POKÉMON<small>AUTO CHESS 3D</small></div>
      <div class="menu">
        <button class="btn gold" id="mNew">Chơi mới</button>
        ${hasSave ? `<button class="btn green" id="mCont">Tiếp tục · Vòng ${hasSave.round}</button>` : ''}
        <button class="btn" id="mHow">Cách chơi</button>
        <button class="btn" id="mSet">Cài đặt</button>
      </div>
      <div class="foot">Dự án fan phi thương mại, làm vì đam mê. Pokémon và tên Pokémon thuộc Nintendo / Game Freak / The Pokémon Company, dự án không liên kết với họ.<br>Sprite: PMD SpriteCollab (CC BY-NC 4.0) · Dữ liệu: PokeAPI · Âm thanh tự tổng hợp</div>`, 'title');
    d.querySelector('#mNew').onclick = () => { a.audio.init(); a.audio.sfx('click'); this.starter(); };
    if (hasSave) d.querySelector('#mCont').onclick = () => { a.audio.init(); a.audio.sfx('click'); a.continueGame(); };
    d.querySelector('#mHow').onclick = () => { a.audio.init(); a.audio.sfx('click'); this.howTo(); };
    d.querySelector('#mSet').onclick = () => { a.audio.init(); a.audio.sfx('click'); this.settings(); };
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
      <div class="set"><span style="width:90px">Rung màn hình</span><input type="checkbox" id="sShake" ${a.settings.shake ? 'checked' : ''}></div>
      <div class="set"><span style="width:90px">Chất lượng</span><select id="sQ"><option value="1">Tiết kiệm pin</option><option value="2">Sắc nét</option></select></div>
      <p style="opacity:.75;font-size:12px">Muốn dùng nhạc hoặc âm thanh riêng? Xem <code>public/audio-user/README.md</code> trong mã nguồn. Âm thanh mặc định là tự tổng hợp, không có bản quyền.</p>
      <div class="set"><button class="btn red" id="sWipe" style="padding:6px 12px">Xóa dữ liệu lưu</button></div>`);
    m.querySelector('#sMusic').oninput = e => au.setVolume('music', e.target.value / 100);
    m.querySelector('#sSfx').oninput = e => { au.setVolume('sfx', e.target.value / 100); };
    m.querySelector('#sSfx').onchange = () => au.sfx('buy');
    m.querySelector('#sShake').onchange = e => { a.settings.shake = e.target.checked; a.saveSettings(); };
    const q = m.querySelector('#sQ'); q.value = String(a.settings.dpr); q.onchange = () => { a.settings.dpr = +q.value; a.saveSettings(); a.applyQuality(); };
    m.querySelector('#sWipe').onclick = () => { if (confirm('Xóa ván đang lưu và kỷ lục?')) { a.wipe(); m.remove(); this.fix(); if (!a.match) this.title(); } };
    m.querySelector('.close').onclick = () => { m.remove(); this.fix(); };
  }

  pause() {
    const a = this.app;
    const m = this.modal(`<h2 style="text-align:center">Tạm dừng</h2><div class="menu" style="margin:14px auto 4px">
      <button class="btn green" id="pRes">Tiếp tục</button><button class="btn" id="pHow">Cách chơi</button><button class="btn" id="pSet">Cài đặt</button><button class="btn red" id="pQuit">Bỏ cuộc về menu</button></div>`);
    a.paused = true;
    const done = () => { m.remove(); a.paused = false; this.fix(); };
    m.querySelector('#pRes').onclick = done; m.querySelector('#pHow').onclick = () => this.howTo(); m.querySelector('#pSet').onclick = () => this.settings();
    m.querySelector('#pQuit').onclick = () => { if (confirm('Bỏ ván này? (Ván được lưu tự động đầu mỗi vòng, bạn có thể tiếp tục sau)')) { m.remove(); a.paused = false; this.fix(); a.quitToTitle(); } };
    m.addEventListener('pointerdown', e => { if (e.target === m) done(); });
  }

  over(g, placement, record) {
    this.clear(); const a = this.app;
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
