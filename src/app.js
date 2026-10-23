// Bộ điều khiển chính: vòng đời ván chơi, lưu/tải, nối game logic với 3D, HUD và âm thanh.
import { World } from './render/world.js';
import { Match } from './game/match.js';
import { Battle, DT } from './sim/battle.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { Input } from './ui/input.js';
import { Audio } from './audio/audio.js';
import { LINE, formAt } from './data/roster.js';
import { itemColor } from './ui/icons.js';
import FORMS from './data/generated/forms.json';
import { initModels } from './render/models.js';
import { boardPos, benchPos } from './render/arena.js';

const SAVE = 'pac3d.save', SET = 'pac3d.settings', BEST = 'pac3d.best';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

export class App {
  constructor(root) {
    this.forms = FORMS;       // phục vụ kiểm thử
    this.geo = { boardPos, benchPos };
    this.modelsReady = initModels();
    this.settings = Object.assign({ shake: true, dpr: 2, seenHint: false, seenShop: false, diff: 1, splash: true }, store.get(SET) || {});
    this.audio = new Audio();
    this.world = new World(root);
    this.applyQuality();
    const vg = document.createElement('div'); vg.id = 'vignette'; root.appendChild(vg);
    const hudRoot = document.createElement('div'); hudRoot.id = 'hud'; root.appendChild(hudRoot);
    const scrRoot = document.createElement('div'); scrRoot.id = 'screens'; root.appendChild(scrRoot);
    this.hudRoot = hudRoot;
    this.hud = new Hud(hudRoot, this);
    this.screens = new Screens(scrRoot, this);
    this.input = new Input(this);
    this.world.sound = (k, p) => this.audio.sfx(k, p);
    this.world.itemCol = itemColor;
    this.phase = 'title'; this.match = null; this.battle = null; this.speed = 1; this.screenOpen = false; this.modalOpen = false; this.paused = false;
    this.world.shakeOn = () => this.settings.shake;
    hudRoot.classList.add('hidden');
    this.showcase();
    // màn mở đầu (bỏ qua bằng ?nosplash hoặc tắt trong Cài đặt)
    if (!new URLSearchParams(location.search).has('nosplash') && this.settings.splash !== false) {
      this.world.startIntro(); this.screens.splash();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.world.endIntro();
    } else this.screens.title();
    addEventListener('resize', () => this.updateInset());
    this.last = performance.now();
    const loop = t => { const dt = Math.min(.05, (t - this.last) / 1000); this.last = t; this.update(dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => { const c = this.audio.ctx; if (!c) return; if (document.hidden) c.suspend(); else c.resume(); });
  }

  // ---------- thiết lập / lưu ----------
  saveSettings() { store.set(SET, this.settings); }
  applyQuality() { this.world.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.dpr)); this.world.resize(); this.world.setBloom(this.settings.dpr >= 2); }
  hasSave() { const s = store.get(SAVE); return s && !s.over && s.v === 1 ? s : null; }
  saveGame() { if (this.match && !this.match.g.over) store.set(SAVE, this.match.g.toJSON()); }
  wipe() { store.del(SAVE); store.del(BEST); }
  best() { return store.get(BEST); }

  // ---------- màn hình chính ----------
  showcase() {
    this.world.arena.setTheme('grass');
    const keys = ['charizard', 'pikachu', 'gengar', 'lapras', 'snorlax', 'mewtwo', 'gardevoir', 'lucario'];
    const demo = [['charmander', 3], ['pikachu', 3], ['gastly', 3], ['lapras', 1], ['snorlax', 1], ['mewtwo', 1], ['ralts', 3], ['riolu', 3]];
    const g = { bench: [], board: Array(32).fill(null) };
    const slots = [3, 12, 20, 6, 27, 4, 9, 14];
    demo.forEach(([k, s], i) => { g.board[slots[i]] = { id: -(i + 1), key: k, star: s, items: [] }; });
    this.world.syncPrep(g, { instant: true }); this.world.clearEnemies(); this.world.title = true; this.world.mode = 'title';
  }
  quitToTitle() {
    this.screens.clear(); document.querySelectorAll('.modal').forEach(m => m.remove()); this.modalOpen = false;
    this.world.endCombat(null); this.world.drag = null; this.world.clearEnemies();
    this.match = null; this.battle = null; this.phase = 'title'; this.hudRoot.classList.add('hidden'); this.paused = false;
    this.world.fx.clear();
    for (const k of [...this.world.views.keys()]) this.world.removeView(k);
    this.updateInset(); this.showcase(); this.screens.title();
  }

  // Tải trước toàn bộ sprite vào bộ nhớ đệm để chơi không cần mạng
  async precache(onProgress) {
    if (!('serviceWorker' in navigator)) throw new Error('Trình duyệt không hỗ trợ');
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.active) throw new Error('Chức năng này chỉ có trên bản đã triển khai (HTTPS)');
    const urls = [];
    for (const dex in FORMS) { urls.push(`assets/pokemon/${dex}/portrait.png`); for (const a in FORMS[dex].anims) urls.push(`assets/pokemon/${dex}/${a}.png`); }
    return new Promise(res => {
      const on = e => { const d = e.data; if (!d) return; if (d.type === 'precache-progress') onProgress(d.done / d.total); if (d.type === 'precache-done') { navigator.serviceWorker.removeEventListener('message', on); res(); } };
      navigator.serviceWorker.addEventListener('message', on);
      reg.active.postMessage({ type: 'precache', urls: urls.map(u => new URL(u, document.baseURI).href) });
    });
  }

  // ---------- bắt đầu ván ----------
  newGame(starter, diff = this.settings.diff ?? 1) {
    store.del(SAVE);
    this.match = Match.create(undefined, starter, diff);
    this.enterGame();
  }
  continueGame() { const d = this.hasSave(); if (!d) return; this.match = Match.load(d); this.enterGame(true); }
  enterGame(loaded) {
    this.screens.clear(); this.hudRoot.classList.remove('hidden');
    this.world.title = false; this.world.mode = 'prep';
    for (const k of [...this.world.views.keys()]) this.world.removeView(k);
    this.world.fx.clear();
    this.match.g.on(e => this.onGameEvent(e));
    this.world.syncPrep(this.match.g, { instant: true });
    this.startRound(loaded);
  }

  startRound(loaded) {
    const m = this.match, g = m.g, info = m.info;
    if (!(loaded && g.fight)) m.beginRound();
    const f = g.fight;
    this.phase = 'prep'; this.prepT = info.prep; this.prepMax = info.prep; this.warned = 0; this.lastOut = null;
    this.world.endCombat(g);
    this.world.arena.setTheme(f.arena);
    this.world.showEnemies(f.specs);
    this.hud.setCombatUi(false);
    this.hud.hideResult(); this.hud.hideInfo(true);
    this.refreshView();
    this.hud.banner(`Vòng ${g.round}`, info.pve ? info.name : 'Đối thủ: ' + f.name, info.pve ? '#9be0ff' : '#ffcf3a');
    this.audio.music('prep'); this.audio.sfx('ready');
    this.saveGame();
    this.updateHint();
  }

  // Gợi ý từng bước cho người mới (biến mất sau khi người chơi làm đúng)
  updateHint() {
    const g = this.match.g;
    if (this.phase !== 'prep') return this.hud.hint('');
    if (!this.settings.seenHint && g.round === 1 && !g.boardCount()) this.hud.hint('Kéo Pokémon từ băng ghế xuống bàn cờ rồi bấm SẴN SÀNG');
    else if (!this.settings.seenShop && g.round <= 3 && g.gold >= 1) this.hud.hint('Bấm vào thẻ ở cửa hàng để mua thêm Pokémon (tốn vàng)');
    else this.hud.hint('');
  }
  refreshView() { this.world.syncPrep(this.match.g); this.hud.refresh(); this.updateInset(); }
  // báo cho camera biết HUD chiếm bao nhiêu màn hình để bàn cờ không bị che
  updateInset() {
    if (this.phase === 'title' || this.hudRoot.classList.contains('hidden')) return this.world.setInset(0, 0);
    const b = this.hudRoot.querySelector('.bottom'), top = innerWidth < 700 ? 44 : 0;
    this.world.setInset(top, b ? Math.max(0, innerHeight - b.getBoundingClientRect().top) : 0);
  }

  onGameEvent(e) {
    if (e.t === 'level') { this.audio.sfx('levelup'); this.hud.toast('Lên cấp ' + e.level + '! Sân chứa được ' + e.level + ' Pokémon'); }
  }

  // ---------- vòng lặp ----------
  update(dt) {
    const w = this.world;
    if (this.phase === 'prep' && !this.paused && !this.modalOpen && !this.screenOpen) {
      this.prepT -= dt;
      const left = Math.max(0, this.prepT);
      this.hud.setPhase('prep', '', `Chuẩn bị · ${Math.ceil(left)}s`, left / this.prepMax);
      if (left < 5.5 && Math.ceil(left) !== this.warned && left > 0) { this.warned = Math.ceil(left); this.audio.sfx('tick'); }
      if (this.prepT <= 0) this.startCombat();
    } else if (this.phase === 'combat' && !this.paused) {
      this.updateCombat(dt);
    } else if (this.phase === 'result') {
      this.hud.setPhase('result', '', 'Kết quả', 1);
      if (this.lastOut && !this.lastOut.over && !this.paused && !this.modalOpen) {
        this.resT -= dt; this.hud.setResultCountdown(Math.ceil(this.resT));
        if (this.resT <= 0) this.nextAfterResult();
      }
    }
    if (!this.paused) w.frame(dt); else w.frame(0);
  }

  // ---------- chiến đấu ----------
  autoFill() {
    return this.match?.g ? this.match.g.autoFill() : 0;
  }
  ready() {
    if (this.phase !== 'prep' || this.screenOpen || this.modalOpen) return;
    const g = this.match.g;
    const filled = this.autoFill();
    if (filled > 0) {
      this.refreshView();
      this.hud.toast(`Đã tự đưa ${filled} Pokémon lên sân`);
      this.audio.sfx('drop');
    }
    if (!g.boardCount()) { this.audio.sfx('error'); return this.hud.toast('Hãy đặt ít nhất 1 Pokémon lên sân'); }
    this.settings.seenHint = true; this.saveSettings();
    this.startCombat();
  }
  startCombat() {
    if (this.phase !== 'prep') return;
    const m = this.match, g = m.g;
    const filled = this.autoFill();
    if (filled > 0) {
      this.hud.toast(`Đã tự đưa ${filled} Pokémon lên sân`);
      this.audio.sfx('drop');
    }
    this.refreshView();
    const specs = [...g.teamSpecs(), ...g.fight.specs];
    const seed = (g.rng() * 2 ** 31) >>> 0; g.save();
    this.battle = new Battle(specs, { seed, events: true });
    this.world.beginCombat(this.battle, g.fight.arena);
    this.phase = 'combat'; this.acc = 0; this.intro = 1.1; this.endT = 0; this.speed = 1;
    this.hud.setCombatUi(true, g.fight); this.hud.setSpeed(1); this.hud.hideInfo(true); this.hud.hint('');
    this.hud.banner('CHIẾN ĐẤU!', g.fight.pve ? g.fight.name : 'vs ' + g.fight.name, '#ff6a6a', 1500);
    this.audio.sfx('fight'); this.audio.music('combat');
    this.world.mode = 'combat'; this.hud.refresh();
  }
  updateCombat(dt) {
    const b = this.battle, w = this.world;
    if (this.intro > 0) { this.intro -= dt; w.consume([]); this.hud.setPhase('combat', '', 'Sắp bắt đầu...', 1); return; }
    if (!b.over) {
      this.acc += dt * this.speed;
      let n = 0; while (this.acc >= DT && !b.over && n++ < 12) { b.step(); this.acc -= DT; }
      if (this.acc > .2) this.acc = 0;
      if (b.ev.length) { w.consume(b.ev); b.ev.length = 0; }
      const a0 = b.alive(0).length, a1 = b.alive(1).length;
      this.hud.setPhase('combat', '', `Chiến đấu · ${a0} vs ${a1} · ${Math.floor(b.t)}s`, Math.min(1, b.t / 40));
    } else {
      if (b.ev.length) { w.consume(b.ev); b.ev.length = 0; }
      this.endT += dt;
      if (this.endT > 1.5) this.finishCombat();
    }
  }
  cycleSpeed() { this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1; this.hud.setSpeed(this.speed); this.audio.sfx('click'); }
  skipBattle() {
    const b = this.battle; if (!b || this.phase !== 'combat') return; this.intro = 0;
    b.emit = false; let n = 0; while (!b.over && n++ < 3000) b.step(); b.ev.length = 0; this.endT = 2;
    // đưa mọi nhân vật về trạng thái cuối
    for (const v of this.world.views.values()) if (v.f && !v.f.alive) { v.dying = 1; v.actor.group.visible = false; }
  }
  finishCombat() {
    const b = this.battle, g = this.match.g;
    const winner = b.winner, survivors = b.alive(winner).length;
    const out = this.match.finishRound({ winner, survivors });
    this.lastOut = out; this.phase = 'result'; this.resT = 8;
    this.hud.setCombatUi(false); this.world.mode = 'prep';
    this.audio.sfx(out.won ? 'win' : 'lose'); if (!out.pve && !out.won) this.audio.sfx('damage');
    this.audio.music(out.won ? 'victory' : 'defeat');
    this.hud.refresh();
    this.hud.showResult(out);
    if (out.over) store.del(SAVE);
    else if (this.settings.seenHint === false) { this.settings.seenHint = true; this.saveSettings(); }
  }
  nextAfterResult() {
    if (this.phase !== 'result') return;
    const out = this.lastOut, g = this.match.g;
    this.hud.hideResult();
    if (out.over) {
      const best = this.best(), record = !best || out.placement < best.placement;
      if (record) store.set(BEST, { placement: out.placement, round: g.round });
      this.phase = 'over'; this.audio.music(out.placement === 1 ? 'victory' : 'defeat');
      this.world.endCombat(g);
      this.screens.over(g, out.placement, record);
      return;
    }
    this.startRound();
  }

  // ---------- hành động của người chơi ----------
  fail(msg) { this.audio.sfx('error'); this.hud.toast(msg); }
  inCombat() { return this.phase === 'combat'; }
  buy(slot) {
    if (this.phase === 'result' || this.screenOpen || this.modalOpen) return;
    const g = this.match.g, r = g.buy(slot);
    if (!r.ok) return this.fail(r.err);
    if (!this.settings.seenShop) { this.settings.seenShop = true; this.saveSettings(); this.updateHint(); }
    this.audio.sfx('buy'); this.audio.cry(formAt(LINE[r.unit.key], 1).dex, { quiet: true });
    this.refreshView();
    r.merges.forEach((mg, i) => {
      this.audio.sfx(mg.star === 3 ? 'star3' : 'star2');
      setTimeout(() => { this.world.evolveFx(mg.unit.id); this.audio.cry(formAt(LINE[mg.unit.key], mg.star).dex); }, 120 + i * 250);
      this.hud.toast(`${formAt(LINE[mg.unit.key], mg.star).name} lên ${mg.star}★!`);
    });
  }
  reroll() { if (this.blocked()) return; const r = this.match.g.reroll(); if (!r.ok) return this.fail(r.err); this.audio.sfx('roll'); this.refreshView(); }
  buyXp() { if (this.blocked()) return; const r = this.match.g.buyXp(); if (!r.ok) return this.fail(r.err); this.audio.sfx('xp'); this.hud.refresh(); }
  toggleLock() { if (this.blocked()) return; const l = this.match.g.toggleLock(); this.audio.sfx('click'); this.hud.toast(l ? 'Đã khóa cửa hàng' : 'Đã mở khóa'); this.hud.refresh(); }
  blocked() { return this.phase === 'result' || this.phase === 'title' || this.phase === 'over' || this.screenOpen || this.modalOpen; }
  moveUnit(id, to) {
    const g = this.match.g, r = g.move(id, to);
    if (!r.ok) return this.fail(r.err);
    if (!r.noop) { this.audio.sfx('drop'); if (!this.settings.seenHint) { this.settings.seenHint = true; this.saveSettings(); } this.updateHint(); }
    this.refreshView();
  }
  sell(id) {
    const g = this.match.g, p = g.find(id); if (!p) return;
    if (this.inCombat() && p.zone === 'board') return this.fail('Không thể bán Pokémon đang chiến đấu');
    const key = 'u' + id;
    g.sell(id); this.audio.sfx('sell'); this.world.fx.smoke((this.world.views.get(key) || { x: 0 }).x, .6, (this.world.views.get(key) || { z: 0 }).z, 6);
    if (this.hud.sel && this.hud.sel.id === id) this.hud.hideInfo(true);
    this.refreshView();
  }
  itemTargetOk(v) { return this.phase === 'prep' || (v.unit && v.zone === 'bench'); }
  giveItem(idx, unitId) {
    const g = this.match.g, p = g.find(unitId); if (!p) return;
    if (this.inCombat() && p.zone === 'board') return this.fail('Không thể trang bị khi đang chiến đấu');
    const r = g.giveItem(idx, unitId);
    if (!r.ok) return this.fail(r.err);
    this.audio.sfx(r.combined ? 'combine' : 'item');
    if (r.combined) this.hud.toast('Ghép thành ' + r.combined.name + '!');
    const v = this.world.views.get('u' + unitId); if (v) { v.actor.flash = 1; this.world.fx.spark(v.x, .8, v.z, r.combined ? '#ffe14a' : '#ffffff', 10, 3); }
    this.hud.shownKey = null; this.refreshView();
  }
  takeItem(unitId, i) {
    if (this.inCombat()) { const p = this.match.g.find(unitId); if (p && p.zone === 'board') return this.fail('Không thể tháo khi đang chiến đấu'); }
    this.match.g.takeItem(unitId, i); this.audio.sfx('click'); this.hud.shownKey = null; this.refreshView();
  }
  openMenu() { if (this.screenOpen || this.modalOpen || this.phase === 'title') return; this.screens.pause(); }
}
