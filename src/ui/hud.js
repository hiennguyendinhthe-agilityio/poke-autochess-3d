// HUD bằng DOM: vòng đấu, cửa hàng, vàng/cấp, tộc, kho đồ, xếp hạng, thông tin Pokémon.
import { LINE, LINES, FORMS, formAt, unitTraits, COST_COL, baseStats } from '../data/roster.js';
import { TRAITS, calcTraits, modsText } from '../data/traits.js';
import { ITEMS } from '../data/items.js';
import { TYPE_COL } from '../data/types.js';
import { traitBadge, typeChip, itemIcon, portraitUrl, mountSprite } from './icons.js';
import { abilityText, itemTip } from './describe.js';
import { sellValue, XP_COST, ROLL_COST, BENCH_SIZE, XP_NEED, MAX_ITEMS } from '../game/state.js';
import { scoutTeam } from '../game/scout.js';
import { previewFighter } from '../sim/battle.js';
import { LINES_BY_COST } from '../data/roster.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STAR = n => '<span style="color:' + ['', '#fff', '#ffd24a', '#ff6ad5'][n] + '">' + '★'.repeat(n) + '</span>';

// Các tộc/hệ mà một dòng Pokémon có thể mang (gộp mọi dạng tiến hóa) — dùng để liệt kê thành viên trong chú thích
const memberCache = {};
function membersOf(id) {
  if (memberCache[id]) return memberCache[id];
  return memberCache[id] = LINES.filter(l => l.traits.includes(id) || [0, 1, 2].some(i => FORMS[l.dex[i]].types.includes(id))).sort((a, b) => a.cost - b.cost);
}

export class Hud {
  constructor(root, app) {
    this.app = app; this.root = root; this.last = {}; this.tips = [];
    root.innerHTML = `
      <div class="top-left">
        <button class="iconbtn" id="bMenu" title="Menu (Esc)">☰</button>
        <div class="panel round"><div class="r1" id="rTitle"></div><div class="r2" id="rSub"></div><div class="pbar"><i id="rBar"></i></div></div>
        <div class="panel hp" id="hpBox"><span>♥</span><div class="bar"><i id="hpBar"></i></div><b id="hpNum"></b></div>
      </div>
      <div class="top-center"><div class="panel vs hidden" id="vsBox"></div><button class="panel spd hidden" id="bSpd">x1</button><button class="panel spd hidden" id="bSkip">Bỏ qua ›</button></div>
      <div class="panel top-right" id="standings"></div>
      <div class="traits" id="traits"></div>
      <div class="panel info hidden" id="info"></div>
      <div class="panel tpanel hidden" id="tpanel"></div>
      <div class="panel spanel hidden" id="spanel"></div>
      <div class="bottom">
        <div class="panel bag" id="bag"></div>
        <div class="shopwrap">
          <div class="panel econ"><div class="lv"><span id="lvT"></span><div class="xpb"><i id="xpBar"></i></div><span id="xpT" style="font-size:11px;opacity:.85"></span></div><div class="gold" id="goldT"></div><div class="bc" id="bcT"></div></div>
          <div class="shop" id="shop"><div class="sell" id="sell">KÉO VÀO ĐÂY ĐỂ BÁN</div></div>
        </div>
        <div class="ctrls">
          <button class="btn gold" id="bRoll"><span>Làm mới <small>(D)</small></span><small><i class="coin"></i>${ROLL_COST}</small></button>
          <button class="btn" id="bXp"><span>Mua XP <small>(F)</small></span><small><i class="coin"></i>${XP_COST}</small></button>
          <button class="btn" id="bLock"><span>Khóa <small>(L)</small></span><small id="lockI">🔓</small></button>
          <button class="btn green" id="bReady"><span>SẴN SÀNG</span><small>␣</small></button>
        </div>
      </div>
      <div id="bannerHost"></div><div id="hintHost"></div>`;
    this.$ = id => root.querySelector('#' + id);
    this.tip = document.createElement('div'); this.tip.className = 'tip hidden'; document.body.appendChild(this.tip);
    this.bind();
  }

  bind() {
    const a = this.app, $ = this.$;
    $('bRoll').onclick = () => a.reroll(); $('bXp').onclick = () => a.buyXp(); $('bLock').onclick = () => a.toggleLock(); $('bReady').onclick = () => a.ready();
    $('bMenu').onclick = () => a.openMenu(); $('bSpd').onclick = () => a.cycleSpeed(); $('bSkip').onclick = () => a.skipBattle();
    // Chạm = mua; GIỮ nửa giây (cảm ứng) = xem thông tin, không mua
    let lpT = null, lpFired = false, lpAt = -1e9, lpX = 0, lpY = 0;
    const shop = $('shop');
    shop.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return; const c = e.target.closest('.card'); if (!c || c.classList.contains('sold')) return;
      lpFired = false; lpX = e.clientX; lpY = e.clientY; clearTimeout(lpT);
      lpT = setTimeout(() => { lpFired = true; this.hideTip(); this.showInfo({ shop: c.dataset.key }); if (navigator.vibrate) navigator.vibrate(12); }, 380);
    });
    shop.addEventListener('pointermove', e => { if (lpT && Math.hypot(e.clientX - lpX, e.clientY - lpY) > 12) { clearTimeout(lpT); lpT = null; } });
    const lpEnd = () => { clearTimeout(lpT); lpT = null; if (lpFired) lpAt = performance.now(); };
    shop.addEventListener('pointerup', lpEnd); shop.addEventListener('pointercancel', lpEnd);
    shop.addEventListener('contextmenu', e => e.preventDefault());
    shop.addEventListener('click', e => {
      if (performance.now() - lpAt < 800) { lpAt = -1e9; return; }          // bỏ qua cú click sau khi giữ
      const c = e.target.closest('.card'); if (c && !c.classList.contains('sold')) a.buy(+c.dataset.slot);
    });
    // chú thích khi rê chuột / chạm
    const show = e => {
      const t = e.target.closest('[data-tid]'); if (!t) return this.hideTip();
      const html = this.tips[+t.dataset.tid]; if (!html) return;
      this.tip.innerHTML = html; this.tip.classList.remove('hidden');
      const r = t.getBoundingClientRect(), tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
      let x = r.right + 8, y = r.top; if (x + tw > innerWidth - 6) x = r.left - tw - 8; if (x < 6) x = Math.max(6, Math.min(innerWidth - tw - 6, r.left));
      if (y + th > innerHeight - 6) y = innerHeight - th - 6; this.tip.style.left = x + 'px'; this.tip.style.top = Math.max(6, y) + 'px';
      clearTimeout(this.tipT); if (e.pointerType === 'touch') this.tipT = setTimeout(() => this.hideTip(), 2600);
    };
    this.root.addEventListener('pointerover', e => { if (e.pointerType !== 'touch') show(e); });
    this.root.addEventListener('pointerout', e => { if (e.pointerType !== 'touch' && !this.root.contains(e.relatedTarget)) this.hideTip(); else if (e.pointerType !== 'touch') { const t = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tid]'); if (!t) this.hideTip(); } });
    this.root.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !e.target.closest('.trait, .tpanel')) show(e); });
    // thông tin khi trỏ vào thẻ trong cửa hàng
    $('shop').addEventListener('pointerover', e => { const c = e.target.closest('.card'); if (c && !c.classList.contains('sold') && e.pointerType !== 'touch') this.showInfo({ shop: c.dataset.key }); });
    $('shop').addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && this.sel && this.sel.shop) this.hideInfo(true); });
    // bấm vào hệ/tộc: mở bảng thành viên
    $('traits').addEventListener('click', e => { const t = e.target.closest('.trait'); if (t) { this.hideTip(); this.toggleTrait(t.dataset.trait); } });
    $('tpanel').addEventListener('click', e => {
      if (e.target.closest('.x')) return this.hideTrait();
      const m = e.target.closest('.mem'); if (m) { this.traitMem = this.traitMem === m.dataset.key ? null : m.dataset.key; this.app.audio.sfx('click'); this.renderTrait(); }
    });
    // bấm vào hàng của một người chơi trong bảng xếp hạng: xem đội hình họ đang xây
    $('standings').addEventListener('click', e => { const r = e.target.closest('.pl'); if (r) this.toggleScout(+r.dataset.pid); });
    $('spanel').addEventListener('click', e => {
      if (e.target.closest('.x')) return this.hideScout();
      const m = e.target.closest('.mem'); if (m) { this.scoutMem = this.scoutMem === m.dataset.key ? null : m.dataset.key; this.app.audio.sfx('click'); this.renderScout(); }
    });
    // kéo vật phẩm từ kho
    $('bag').addEventListener('pointerdown', e => {
      const s = e.target.closest('.slot.has'); if (!s) return; e.preventDefault();
      this.startItemDrag(+s.dataset.bag, e);
    });
    // thông tin: nút bán / tháo đồ
    $('info').addEventListener('click', e => {
      if (e.target.closest('.x')) return this.hideInfo(true);
      const sell = e.target.closest('[data-sell]'); if (sell) return a.sell(+sell.dataset.sell);
      const it = e.target.closest('[data-take]'); if (it) return a.takeItem(+it.dataset.unit, +it.dataset.take);
    });
  }
  hideTip() { this.tip.classList.add('hidden'); }
  tid(html) { this.tips.push(html); return this.tips.length - 1; }

  // ---------- làm mới ----------
  refresh() {
    const a = this.app, g = a.match.g, $ = this.$;
    this.tips = [];
    // vòng + máu
    const info = a.match.info;
    const rr = a.phase === 'result' && a.lastOut ? a.lastOut.round : g.round, pve = a.phase === 'result' && a.lastOut ? a.lastOut.pve : info.pve;
    $('rTitle').textContent = 'Vòng ' + rr + (pve ? ' · Hoang dã' : '');
    $('hpNum').textContent = g.hp; $('hpBar').style.width = g.hp + '%'; $('hpBox').classList.toggle('low', g.hp <= 30);
    // kinh tế
    const lvmax = g.level >= 9, need = g.xpNeed;
    $('lvT').textContent = 'Cấp ' + g.level; $('xpBar').style.width = (lvmax ? 100 : Math.min(100, g.xp / need * 100)) + '%';
    $('xpT').textContent = lvmax ? 'MAX' : g.xp + '/' + need;
    const itr = g.interest();
    $('goldT').innerHTML = `<i class="coin"></i>${g.gold}<small>${itr ? '+' + itr + ' lãi' : ''}${g.streak >= 2 ? ' · ' + g.streak + '🔥' : g.streak <= -2 ? ' · ' + (-g.streak) + '❄' : ''}</small>`;
    const bc = g.boardCount(); $('bcT').innerHTML = `Sân <b>${bc}/${g.cap}</b>`; $('bcT').className = 'bc' + (bc >= g.cap ? ' full' : '');
    $('bRoll').classList.toggle('dim', g.gold < ROLL_COST); $('bXp').classList.toggle('dim', g.gold < XP_COST || lvmax);
    $('lockI').textContent = g.locked ? '🔒' : '🔓'; $('bLock').classList.toggle('on', g.locked);
    // cửa hàng
    let sh = '';
    const owned = key => g.allUnits().filter(u => u.key === key).reduce((s, u) => s + Math.pow(3, u.star - 1), 0);
    g.shop.forEach((key, i) => {
      if (!key) { sh += `<div class="card sold" data-slot="${i}"></div>`; return; }
      const l = LINE[key], f = formAt(l, 1), poor = g.gold < l.cost, up = g.allUnits().filter(u => u.key === key && u.star === 1).length >= 2;
      const trs = unitTraits(l, 1), col = TYPE_COL[f.types[0]];
      const tags = trs.map(t => `<span class="tgi" data-tid="${this.tid(`<b style=\"color:${TRAITS[t].color}\">${TRAITS[t].name}</b>`)}">${traitBadge(t, 20)}</span>`).join('');
      const own = owned(key);
      sh += `<div class="card c${l.cost}${poor ? ' poor' : ''}" data-slot="${i}" data-key="${key}">
        <div class="art" style="--t1:${col}dd;--t2:${col}55"><img class="pt" src="${portraitUrl(f.dex)}" alt="" draggable="false"></div>
        <div class="tg">${tags}</div>${up ? '<div class="up">▲ NÂNG SAO</div>' : own ? `<div class="own">Có ${own}</div>` : ''}
        <div class="bar"><span class="nm">${esc(f.name)}</span><span class="cost"><i class="coin"></i>${l.cost}</span></div></div>`;
    });
    sh += '<div class="sell" id="sell">KÉO VÀO ĐÂY ĐỂ BÁN</div>';
    this.set('shop', sh, () => { $('shop').innerHTML = sh; });
    // kho đồ
    let bg = '';
    for (let i = 0; i < 10; i++) { const it = g.bag[i]; bg += it ? `<div class="slot has" data-bag="${i}" data-tid="${this.tid(itemTip(it))}">${itemIcon(it, 32)}</div>` : '<div class="slot"></div>'; }
    this.set('bag', bg, () => { $('bag').innerHTML = bg; }); $('bag').classList.toggle('hidden', false);
    this.refreshTraits(); this.refreshStandings();
    this.refreshInfo(); if (this.traitSel) this.renderTrait(); if (this.scoutSel != null) this.renderScout();
  }
  set(k, html, fn) { if (this.last[k] === html) return; this.last[k] = html; fn(); }

  teamTraits() {
    const g = this.app.match.g;
    const us = g.boardUnits().map(u => ({ key: u.key, traits: unitTraits(LINE[u.key], u.star) }));
    return calcTraits(us);
  }
  refreshTraits() {
    const act = this.teamTraits(), rows = [];
    for (const id in act) {
      const a = act[id], t = TRAITS[id];
      rows.push({ id, a, t, on: a.tier >= 0 });
    }
    rows.sort((x, y) => (y.on - x.on) || (y.a.tier - x.a.tier) || (y.a.count - x.a.count) || x.t.name.localeCompare(y.t.name));
    const html = rows.map(r => {
      const tiers = r.t.tiers.map((x, i) => i <= r.a.tier ? `<b>${x.n}</b>` : x.n).join(' › ');
      let tip = `<b style="color:${r.t.color}">${r.t.name}</b> <span style="opacity:.7">(${r.a.count})</span>`;
      if (r.t.flavor) tip += `<div class="fl">${esc(r.t.flavor)}</div>`;
      tip += r.t.tiers.map((x, i) => `<div class="tr ${i === r.a.tier ? 'act' : ''}"><b>${x.n}</b><span>${modsText(x.mods)}${x.mods && x.allMods ? '; ' : ''}${x.allMods ? 'cả đội: ' + modsText(x.allMods) : ''}</span></div>`).join('');
      tip += '<div class="fl" style="margin-top:5px">Thành viên: ' + membersOf(r.id).map(l => formAt(l, 1).name).join(', ') + '</div>';
      return `<div class="trait ${r.on ? 'on' : 'off'}" style="--tc:${r.t.color}" data-trait="${r.id}" data-tid="${this.tid(tip)}">${traitBadge(r.id, 24)}<div><div class="tn">${r.t.name}</div><div class="tt">${tiers}</div></div><div class="cnt">${r.a.count}</div></div>`;
    }).join('');
    this.set('traits', html, () => { this.$('traits').innerHTML = html; });
  }
  refreshStandings() {
    const m = this.app.match, g = m.g, st = m.standings(), opp = g.fight ? g.fight.oppId : -1, me = this.app.me();
    const html = '<h4><span>Xếp hạng</span><span>' + st.filter(x => x.alive).length + '/8</span></h4>' + st.map((p, i) =>
      `<div class="pl ${p.id === this.scoutSel ? 'scout' : ''} ${p.me ? 'me' : ''} ${p.alive ? '' : 'dead'} ${p.id === opp && p.id ? 'opp' : ''}" data-pid="${p.id}" title="Xem đội hình"><span style="opacity:.6">${i + 1}</span><span class="av" style="background:${p.col}">${p.me && me.dex ? `<img src="${portraitUrl(me.dex)}" alt="">` : esc((p.me ? me.name : p.name)[0])}</span><div><div class="nm">${esc(p.me ? me.name : p.name)}</div><div class="hb"><i style="width:${Math.max(0, p.hp)}%;background:${p.hp < 30 ? '#ef4444' : ''}"></i></div></div><span class="hv">${p.alive ? p.hp : '☠'}</span></div>`).join('');
    this.set('standings', html, () => { this.$('standings').innerHTML = html; });
  }

  // ---------- bảng thành viên của hệ/tộc ----------
  toggleTrait(id) { this.hideScout(); this.traitMem = null; this.traitSel = this.traitSel === id ? null : id; this.app.audio.sfx('click'); this.renderTrait(); }
  hideTrait() { this.traitSel = null; this.traitMem = null; this.renderTrait(); }
  renderTrait() {
    const el = this.$('tpanel'), id = this.traitSel, w = this.app.world;
    if (!id) { el.classList.add('hidden'); w.glow = null; return; }
    const g = this.app.match.g, t = TRAITS[id], act = this.teamTraits()[id] || { count: 0, tier: -1 };
    // trạng thái sở hữu của từng dòng: sân > ghế; sao cao nhất
    const have = {};
    for (const [zone, list] of [['bench', g.bench], ['board', g.board]]) for (const u of list) if (u) { const h = have[u.key] || (have[u.key] = { zone, star: 0, n: 0 }); h.n++; h.star = Math.max(h.star, u.star); if (zone === 'board') h.zone = 'board'; }
    const inShop = new Set(g.shop);
    const minStar = l => { for (let s = 1; s <= 3; s++) if (unitTraits(l, s).includes(id)) return s; return 1; };
    const mems = membersOf(id).map(l => ({ l, ms: minStar(l) }));
    const next = t.tiers.find(x => x.n > act.count);
    const tiers = t.tiers.map((x, i) => `<div class="tier ${i <= act.tier ? 'reached' : ''} ${i === act.tier ? 'cur' : ''}"><b>${x.n}</b><span>${modsText(x.mods)}${x.mods && x.allMods ? '; ' : ''}${x.allMods ? 'cả đội: ' + modsText(x.allMods) : ''}</span></div>`).join('');
    const grid = mems.map(({ l, ms }) => {
      const h = have[l.key], st = h ? h.zone : inShop.has(l.key) ? 'shop' : 'none', f = formAt(l, ms);
      const lbl = st === 'board' ? 'Sân' : st === 'bench' ? 'Ghế' : st === 'shop' ? 'Cửa hàng' : '';
      return `<div class="mem st-${st} ${this.traitMem === l.key ? 'sel' : ''}" style="--mc:${COST_COL[l.cost]}" data-key="${l.key}">
        <img src="${portraitUrl(f.dex)}" alt="">${h ? `<span class="ms">${'★'.repeat(h.star)}</span>` : ''}${ms > 1 ? `<span class="mn">★${ms}+</span>` : ''}${lbl ? `<div class="ml">${lbl}</div>` : ''}</div>`;
    }).join('');
    let detail = '';
    if (this.traitMem) {
      const l = LINE[this.traitMem], ms = minStar(l), h = have[l.key], ab = abilityText(l, 1), names = [1, 2, 3].map(s => formAt(l, s)).filter((f, i, a) => i === 0 || f.dex !== a[i - 1].dex);
      detail = `<div class="tdetail"><b style="color:${COST_COL[l.cost]}">● Giá ${l.cost}</b> · <b>${names.map(f => esc(f.name)).join(' › ')}</b>${ms > 1 ? `<div style="opacity:.8">Mang ${t.name} từ dạng ${esc(formAt(l, ms).name)} (${ms}★)</div>` : ''}
        <div class="row" style="display:flex;gap:3px;flex-wrap:wrap;margin:4px 0">${[...new Set([1, 2, 3].flatMap(s => unitTraits(l, s)))].map(x => typeChip(x)).join('')}</div>
        ${ab ? `<div><b style="color:${TYPE_COL[ab.type]}">✦ ${ab.name}</b>: ${ab.text}</div>` : ''}<div style="opacity:.8;margin-top:3px">${h ? `Bạn có ${h.n} con (cao nhất ${h.star}★), đang ở ${h.zone === 'board' ? 'sân' : 'băng ghế'}` : g.shop.includes(l.key) ? 'Đang bán ở cửa hàng' : 'Bạn chưa có'}</div></div>`;
    }
    el.innerHTML = `<div class="th">${traitBadge(id, 28)}<div><h3 style="color:${t.color}">${t.name}</h3><div style="font-size:11px;opacity:.7">${t.kind === 'anime' ? 'Tộc' : 'Hệ'} · ${mems.length} Pokémon</div></div><span class="x">✕</span></div>
      ${t.flavor ? `<div class="fl">${esc(t.flavor)}</div>` : ''}${tiers}
      <div class="prog">Trên sân: ${act.count}${next ? ` · cần ${next.n} để mở mốc tiếp theo` : ' · đã đạt mốc cao nhất'}</div>
      ${detail}<div class="mems">${grid}</div>`;
    el.classList.remove('hidden');
    // viền sáng dưới chân Pokémon của bạn thuộc hệ/tộc này
    const keys = new Set();
    for (const [zone, list] of [['board', g.board], ['bench', g.bench]]) for (const u of list) if (u && unitTraits(LINE[u.key], u.star).includes(id)) keys.add('u' + u.id);
    w.glow = { keys, col: t.color };
  }

  // ---------- đội hình của người chơi khác (do thám) ----------
  toggleScout(id) {
    this.app.audio.sfx('click'); this.scoutMem = null;
    if (this.scoutSel === id) return this.hideScout();
    if (this.traitSel) this.hideTrait();
    this.hideInfo(true); this.scoutSel = id; this.refreshStandings(); this.renderScout();
  }
  hideScout() { if (this.scoutSel == null) return; this.scoutSel = null; this.scoutMem = null; this.renderScout(); this.refreshStandings(); }
  renderScout() {
    const el = this.$('spanel'), id = this.scoutSel;
    if (id == null) { el.classList.add('hidden'); return; }
    const g = this.app.match.g, r = scoutTeam(g, id);
    if (!r) return this.hideScout();
    const name = r.me ? this.app.me().name : r.name;
    const grid = r.units.map(u => {
      const f = formAt(LINE[u.key], u.star);
      return `<div class="mem on ${this.scoutMem === u.key ? 'sel' : ''}" style="--mc:${COST_COL[u.cost]}" data-key="${u.key}" title="${esc(f.name)}">
        <img src="${portraitUrl(f.dex)}" alt=""><span class="ms">${'★'.repeat(u.star)}</span>${u.items.length ? `<div class="mi">${u.items.map(i => itemIcon(i, 14)).join('')}</div>` : ''}</div>`;
    }).join('');
    const traits = r.traits.map(a => { const t = TRAITS[a.id]; return `<span class="sch ${a.tier >= 0 ? 'on' : ''}" style="--tc:${t.color}">${traitBadge(a.id, 16)}<b>${a.count}</b></span>`; }).join('');
    let detail = '';
    if (this.scoutMem) {
      const u = r.units.find(x => x.key === this.scoutMem);
      if (u) {
        const l = LINE[u.key], f = formAt(l, u.star), ab = abilityText(l, u.star);
        detail = `<div class="tdetail"><b style="color:${COST_COL[l.cost]}">● Giá ${l.cost}</b> · <b>${esc(f.name)}</b> ${STAR(u.star)}
          <div class="row" style="display:flex;gap:3px;flex-wrap:wrap;margin:4px 0">${unitTraits(l, u.star).map(x => typeChip(x)).join('')}</div>
          ${ab ? `<div><b style="color:${TYPE_COL[ab.type]}">✦ ${ab.name}</b>: ${ab.text}</div>` : ''}
          ${u.items.length ? `<div class="its" style="margin-top:4px">${u.items.map(i => `<div class="slot has" data-tid="${this.tid(itemTip(i))}">${itemIcon(i, 28)}</div>`).join('')}</div>` : ''}</div>`;
      }
    }
    el.classList.toggle('dead', !r.alive);
    el.innerHTML = `<div class="th"><span class="av" style="background:${r.col}">${esc(name[0])}</span><div><h3>${esc(name)}</h3><div style="font-size:11px;opacity:.75">${r.me ? 'Đội của bạn' : 'Đang xây'} · Cấp ${r.level} · ${r.alive ? '♥ ' + r.hp : '☠ đã bị loại (đội cuối cùng)'}</div></div><span class="x">✕</span></div>
      <div class="sct">${traits || '<span style="opacity:.6">Chưa có tộc/hệ nào</span>'}</div>
      ${detail}${r.units.length ? `<div class="mems">${grid}</div>` : '<div class="fl">Chưa có Pokémon nào trên sân.</div>'}`;
    el.classList.remove('hidden');
  }

  // ---------- thông tin Pokémon ----------
  // sel: { id } (của mình) | { shop: key } | { enemy: specId }
  showInfo(sel) { this.hideScout(); this.sel = sel; this.refreshInfo(); }
  hideInfo(clear) { if (clear) this.sel = null; this.$('info').classList.add('hidden'); if (this.stop) { this.stop(); this.stop = null; } this.shownKey = null; }
  refreshInfo() {
    const el = this.$('info'), s = this.sel, a = this.app, g = a.match.g;
    if (!s) return el.classList.add('hidden');
    let line, star = 1, items = [], f = null, unit = null, enemy = false;
    if (s.shop) { line = LINE[s.shop]; }
    else if (s.id) {
      const p = g.find(s.id); if (!p) { this.sel = null; return el.classList.add('hidden'); }
      unit = p.u; line = LINE[unit.key]; star = unit.star; items = unit.items;
      const specs = g.teamSpecs(); const inBoard = p.zone === 'board';
      f = previewFighter(inBoard ? specs : [{ id: unit.id, team: 0, cell: { c: 0, r: 0 }, key: unit.key, star, items: [...items] }], unit.id);
    } else if (s.enemy) {
      const sp = g.fight && g.fight.specs.find(x => x.id === s.enemy); if (!sp || sp.wild) { this.sel = null; return el.classList.add('hidden'); }
      line = LINE[sp.key]; star = sp.star; items = sp.items; enemy = true;
      f = previewFighter(g.fight.specs.filter(x => x.team === 1), sp.id);
    }
    if (!line) return el.classList.add('hidden');
    const form = formAt(line, star), key = [line.key, star, items.join(','), s.shop ? 's' : '', f ? Math.round(f.maxHp) : 0].join('|');
    el.classList.remove('hidden');
    if (this.shownKey === key) return; this.shownKey = key;
    const bs = baseStats(line, star), stat = f ? { hp: Math.round(f.maxHp), atk: Math.round(f.atkE), as: f.asE.toFixed(2), armor: Math.round(f.armorE), mr: Math.round(f.mrE), range: f.b.range, ap: f.m.ap || 0 } : { hp: bs.hp, atk: bs.atk, as: bs.as.toFixed(2), armor: bs.armor, mr: bs.mr, range: bs.range, ap: 0 };
    const ab = abilityText(line, star, stat.ap);
    const traits = unitTraits(line, star);
    const sellV = unit ? sellValue(line.cost, star) : 0;
    el.innerHTML = `<div class="x">✕</div><div class="hd"><canvas id="infoCv"></canvas><div><h3>${esc(form.name)} ${STAR(star)}</h3>
      <div style="font-size:11px;opacity:.85"><span style="color:${COST_COL[line.cost]};font-weight:900">● Giá ${line.cost}</span>${enemy ? ' · Đối thủ' : ''}</div></div></div>
      <div class="row">${traits.map(t => typeChip(t)).join('')}</div>
      <div class="stats"><div><b>${stat.hp}</b><span>Máu</span></div><div><b>${stat.atk}</b><span>Công</span></div><div><b>${stat.as}</b><span>Tốc đánh</span></div><div><b>${stat.armor}</b><span>Giáp</span></div><div><b>${stat.mr}</b><span>Kháng phép</span></div><div><b>${stat.range}</b><span>Tầm</span></div></div>
      ${ab ? `<div class="ab"><div class="an" style="color:${TYPE_COL[ab.type]}">✦ ${ab.name}</div><div>${ab.text}</div><div class="mana">Năng lượng cần: ${ab.mana} · mỗi đòn đánh +10</div></div>` : '<div class="ab">Pokémon hoang dã: chỉ đánh thường.</div>'}
      ${items.length || unit ? `<div class="its">${[0, 1, 2].map(i => items[i] ? `<div class="slot has" data-tid="${this.tid(itemTip(items[i]))}" ${unit ? `data-take="${i}" data-unit="${unit.id}"` : ''}>${itemIcon(items[i], 32)}</div>` : '<div class="slot"></div>').join('')}</div>${unit && items.length ? '<div style="font-size:10px;opacity:.6;margin-top:2px">Bấm vào vật phẩm để tháo</div>' : ''}` : ''}
      ${unit ? `<div class="acts"><button class="btn red" data-sell="${unit.id}">Bán +${sellV} <i class="coin"></i></button></div>` : ''}`;
    if (this.stop) this.stop();
    this.stop = mountSprite(el.querySelector('#infoCv'), form.dex, { anim: 'Idle', dir: 0, scale: 2 });
    a.audio && a.audio.cry && s.id && a.lastCryId !== s.id && (a.lastCryId = s.id, a.audio.cry(form.dex, { quiet: true }));
  }

  // ---------- phase / timer ----------
  setPhase(phase, text, sub, frac) {
    this.$('rSub').textContent = sub || '';
    this.$('rBar').style.width = Math.max(0, Math.min(1, frac ?? 0)) * 100 + '%';
  }
  setCombatUi(on, opp) {
    this.$('vsBox').classList.toggle('hidden', !on); this.$('bSpd').classList.toggle('hidden', !on); this.$('bSkip').classList.toggle('hidden', !on);
    this.$('bReady').classList.toggle('hidden', on);
    if (on && opp) this.$('vsBox').innerHTML = `<span class="dot" style="background:${opp.col}"></span>Đấu với ${esc(opp.name)}`;
  }
  setSpeed(s) { this.$('bSpd').textContent = 'x' + s; }
  setSell(show, hot, value) { const s = this.$('sell'); if (!s) return; s.classList.toggle('show', show); s.classList.toggle('hot', hot); if (show) s.textContent = hot ? `BÁN +${value || ''} VÀNG` : 'KÉO VÀO ĐÂY ĐỂ BÁN'; }
  sellRect() { const s = this.$('sell'); return s ? s.getBoundingClientRect() : null; }

  banner(t1, t2, col = '#ffcf3a', ms = 1700) {
    const h = this.$('bannerHost'); h.innerHTML = `<div class="banner" style="--bc:${col}"><div class="b1" style="color:${col}">${esc(t1)}</div>${t2 ? `<div class="b2">${esc(t2)}</div>` : ''}</div>`;
    clearTimeout(this.bnT); this.bnT = setTimeout(() => { h.innerHTML = ''; }, ms);
  }
  toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; this.root.appendChild(d); setTimeout(() => d.remove(), 2300); }
  hint(text) { const h = this.$('hintHost'); h.innerHTML = text ? `<div class="hint">${text}</div>` : ''; }

  // ---------- kết quả vòng ----------
  showResult(out) {
    this.hideResult();
    const d = document.createElement('div'); d.className = 'panel result ' + (out.won ? 'win' : 'lose'); d.id = 'resultBox';
    const inc = out.income;
    let rows = '';
    if (!out.pve && !out.won) rows += `<div class="ln"><span>Bạn mất</span><span style="color:#ff8a8a">-${out.damage} ♥</span></div>`;
    if (!out.pve && out.won && out.dealt) rows += `<div class="ln"><span>Gây cho đối thủ</span><span>${out.dealt} ♥</span></div>`;
    if (inc) {
      rows += `<div class="ln"><span>Thu nhập cơ bản</span><span><i class="coin"></i> +${inc.base}</span></div>`;
      if (inc.interest) rows += `<div class="ln"><span>Lãi suất</span><span><i class="coin"></i> +${inc.interest}</span></div>`;
      if (inc.win) rows += `<div class="ln"><span>Thắng PvP</span><span><i class="coin"></i> +${inc.win}</span></div>`;
      if (inc.streak) rows += `<div class="ln"><span>Chuỗi ${out.won ? 'thắng' : 'thua'}</span><span><i class="coin"></i> +${inc.streak}</span></div>`;
    }
    if (out.drops && out.drops.length) rows += `<div class="ln"><span>Vật phẩm rơi</span><span>${out.drops.map(i => itemIcon(i, 24)).join(' ')}</span></div>`;
    if (out.eliminated && out.eliminated.length) rows += `<div class="ln"><span>Bị loại</span><span>${out.eliminated.join(', ')}</span></div>`;
    d.innerHTML = `<h2>${out.pve ? (out.won ? 'DỌN SẠCH!' : 'THẤT BẠI') : out.won ? 'CHIẾN THẮNG!' : 'THUA RỒI'}</h2>${rows}<button class="btn green" id="resOk">Tiếp tục</button>`;
    this.root.appendChild(d); d.querySelector('#resOk').onclick = () => this.app.nextAfterResult();
  }
  setResultCountdown(n) { const b = this.root.querySelector('#resOk'); if (b && b.dataset.n !== String(n)) { b.dataset.n = n; b.textContent = n > 0 ? `Tiếp tục (${n})` : 'Tiếp tục'; } }
  hideResult() { const r = this.root.querySelector('#resultBox'); if (r) r.remove(); }

  // ---------- kéo vật phẩm ----------
  startItemDrag(bagIdx, e) {
    const a = this.app, g = a.match.g, it = g.bag[bagIdx]; if (!it) return;
    a.audio.init(); a.audio.sfx('pick');
    const gh = document.createElement('div'); gh.className = 'ghost'; gh.innerHTML = itemIcon(it, 44); document.body.appendChild(gh);
    let moved = false;
    const place = ev => { gh.style.left = ev.clientX + 'px'; gh.style.top = ev.clientY + 'px'; };
    place(e);
    const move = ev => {
      moved = true; place(ev);
      const v = a.world.pickUnit(ev.clientX, ev.clientY, 0); a.world.hot = v && a.itemTargetOk(v) ? v.key : null;
    };
    const up = ev => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); gh.remove(); a.world.hot = null;
      const v = moved ? a.world.pickUnit(ev.clientX, ev.clientY, 0) : null;
      if (v && v.unit) a.giveItem(bagIdx, v.unit.id);
      else if (!moved) this.tipAt(itemTip(it), ev);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  tipAt(html, ev) { this.tip.innerHTML = html; this.tip.classList.remove('hidden'); this.tip.style.left = Math.min(innerWidth - 200, ev.clientX) + 'px'; this.tip.style.top = Math.max(6, ev.clientY - 70) + 'px'; clearTimeout(this.tipT); this.tipT = setTimeout(() => this.hideTip(), 2200); }
}
