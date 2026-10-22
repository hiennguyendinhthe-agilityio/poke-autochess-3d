// World: scene 3D, camera, nhân vật, hiệu ứng, lớp phủ 2D (thanh máu, số sát thương), chọn/kéo-thả.
import * as THREE from 'three';
import { Arena, THEMES, benchPos, boardPos, BENCH_Z } from './arena.js';
import { FX } from './fx.js';
import { Actor, preload } from './sprites.js';
import { TYPE_COL } from '../data/types.js';
import { LINE, formAt, FORMS } from '../data/roster.js';
import { cryText } from '../data/cries.js';
import { resolveSpec, cellPos } from '../sim/battle.js';

const STAR_COL = ['', '#ffffff', '#ffd24a', '#ff6ad5'];
const ease = (a, b, k) => a + (b - a) * k;

export class World {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement; this.canvas.id = 'gl'; container.appendChild(this.canvas);
    this.overlay = document.createElement('canvas'); this.overlay.id = 'overlay'; container.appendChild(this.overlay);
    this.ctx = this.overlay.getContext('2d');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, .5, 200);
    this.arena = new Arena(this.scene);
    this.fx = new FX(this.scene, this.camera);
    this.views = new Map();       // key -> view
    this.texts = [];              // chữ nổi (sát thương, tên chiêu...)
    this.time = 0; this.shake = 0; this.mode = 'prep';
    this.drag = null; this.hover = null; this.battle = null; this.sound = () => { };
    this.camBase = new THREE.Vector3(); this.camLook = new THREE.Vector3();
    this.mouse = new THREE.Vector2(); this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.resize();
    addEventListener('resize', () => this.resize());
    this.hidden = false;
  }

  resize() {
    const w = this.container.clientWidth || innerWidth, h = this.container.clientHeight || innerHeight;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false); this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    const dpr = this.renderer.getPixelRatio();
    this.overlay.width = w * dpr; this.overlay.height = h * dpr; this.overlay.style.width = w + 'px'; this.overlay.style.height = h + 'px';
    this.dpr = dpr;
    this.camera.aspect = w / h;
    // khung hình: dọc (điện thoại) cần lùi xa hơn
    const portrait = w < h * .9;
    const fov = this.camera.fov * Math.PI / 180, aspect = w / h;
    // phần màn hình bị HUD chiếm (trên/dưới): cảnh được co lại và dịch để nằm gọn trong vùng còn trống
    const ins = this.inset || { top: 0, bottom: 0 }, effH = Math.max(220, h - ins.top - ins.bottom);
    const needW = 5.0 / (Math.tan(fov / 2) * aspect), needH = (portrait ? 4.4 : 3.75) / Math.tan(fov / 2) * (h / effH);
    const d = Math.max(needW, needH);
    const elev = (portrait ? 48 : 42) * Math.PI / 180;
    this.camLook.set(4, 0, portrait ? 5.1 : 5.0);
    this.camBase.set(4, Math.sin(elev) * d, this.camLook.z + Math.cos(elev) * d);
    this.camera.position.copy(this.camBase); this.camera.lookAt(this.camLook);
    this.camera.setViewOffset(w, h, 0, (ins.bottom - ins.top) / 2, w, h);
    this.camera.updateProjectionMatrix();
    this.uiScale = Math.max(.72, Math.min(1.35, Math.min(w / 900, h / 620)));
  }

  setInset(top, bottom) {
    const ins = this.inset || {};
    if (ins.top === top && ins.bottom === bottom) return;
    this.inset = { top, bottom }; this.resize();
  }

  // ---------- quản lý nhân vật ----------
  makeView(key, dex, team, star = 1) {
    const actor = new Actor(dex, { team, scale: 1 });
    this.scene.add(actor.group);
    const v = { key, actor, team, star, x: 0, z: 0, tx: 0, tz: 0, y: 0, f: null, dying: 0, unit: null, hp: 1, hpShown: 1, show: true, spawn: 0 };
    this.views.set(key, v); return v;
  }
  removeView(key) {
    const v = this.views.get(key); if (!v) return;
    this.scene.remove(v.actor.group); v.actor.dispose(); this.views.delete(key);
  }
  scaleFor(star) { return star === 1 ? 1 : star === 2 ? 1.08 : 1.16; }

  // Đồng bộ cảnh chuẩn bị với trạng thái game
  syncPrep(game, { instant = false } = {}) {
    const alive = new Set();
    const place = (u, zone, idx) => {
      const key = 'u' + u.id; alive.add(key);
      const line = LINE[u.key], form = formAt(line, u.star);
      let v = this.views.get(key);
      if (v && v.f) return;            // đang chiến đấu: không đụng tới
      if (!v) { preload([form.dex]); v = this.makeView(key, form.dex, 0, u.star); v.spawn = 1; const p = zone === 'bench' ? benchPos(idx) : boardPos(idx % 8, Math.floor(idx / 8)); v.x = p.x; v.z = p.z; v.actor.group.position.set(v.x, 0, v.z); }
      v.unit = u; v.star = u.star; v.f = null; v.dying = 0; v.actor.fade = 1; v.actor.group.visible = true;
      if (v.actor.dex !== form.dex) { v.actor.setDex(form.dex); preload([form.dex]); v.pop = 1; }
      v.actor.setScale(this.scaleFor(u.star) * (zone === 'bench' ? .85 : 1));
      const p = zone === 'bench' ? benchPos(idx) : boardPos(idx % 8, Math.floor(idx / 8));
      v.tx = p.x; v.tz = p.z; v.zone = zone; v.idx = idx;
      if (instant) { v.x = v.tx; v.z = v.tz; }
    };
    game.bench.forEach((u, i) => u && place(u, 'bench', i));
    game.board.forEach((u, i) => u && place(u, 'board', i));
    for (const [k, v] of [...this.views]) if (k[0] === 'u' && !alive.has(k) && !v.f) this.removeView(k);
  }

  // Hiện đội đối thủ ở nửa trên bàn cờ trong lúc chuẩn bị
  showEnemies(specs) {
    this.clearEnemies();
    for (const sp of specs) {
      const d = resolveSpec(sp), star = sp.star || 1; preload([d.form.dex]);
      const v = this.makeView('e' + sp.id, d.form.dex, 1, star), p = cellPos(1, sp.cell.c, sp.cell.r);
      v.x = v.tx = p.x; v.z = v.tz = p.z; v.zone = 'enemy'; v.spawn = 1; v.actor.setScale(this.scaleFor(star)); v.actor.group.position.set(v.x, 0, v.z);
    }
  }
  clearEnemies() { for (const k of [...this.views.keys()]) if (k[0] === 'e') this.removeView(k); }

  // ---------- chiến đấu ----------
  beginCombat(battle, arenaName) {
    this.battle = battle; this.mode = 'combat'; this.evAcc = 0;
    if (arenaName) this.arena.setTheme(arenaName);
    for (const f of battle.f) {
      const key = (f.team === 0 ? 'u' : 'e') + f.id;
      let v = this.views.get(key);
      if (!v) { preload([f.dex]); v = this.makeView(key, f.dex, f.team, f.star); v.x = f.x; v.z = f.z; v.actor.group.position.set(f.x, 0, f.z); v.spawn = 1; }
      v.f = f; v.dying = 0; v.actor.fade = 1; v.actor.group.visible = true;
      v.actor.setScale(this.scaleFor(f.star)); v.x = ease(v.x, f.x, 1); v.z = f.z;
      v.hpShown = 1;
    }
    preload(battle.f.map(f => f.dex));
  }
  endCombat(game) {
    this.mode = 'prep'; this.battle = null;
    for (const [k, v] of [...this.views]) { if (k[0] === 'e') this.removeView(k); else { v.f = null; v.dying = 0; v.actor.fade = 1; v.actor.group.visible = true; v.actor.play('Idle'); } }
    this.fx.clear(); this.texts.length = 0;
    if (game) this.syncPrep(game);
  }

  headPos(v) { return { x: v.x, y: v.actor.headY * .55 + (v.y || 0), z: v.z }; }
  viewById(team, id) { return this.views.get((team === 0 ? 'u' : 'e') + id); }
  vByFighterId(id) { const f = this.battle && this.battle.byId(id); return f ? this.viewById(f.team, id) : null; }

  addText(o) { this.texts.push({ t: 0, life: 1, vy: -40, ...o }); if (this.texts.length > 90) this.texts.shift(); }

  // xử lý sự kiện từ engine chiến đấu
  consume(events) {
    for (const e of events) {
      switch (e.t) {
        case 'atk': {
          const v = this.vByFighterId(e.id); if (!v) break;
          v.actor.play('Attack', true); v.actor.speed = 1.3;
          if (!e.ranged) this.sound('swing', { id: e.id });
          break;
        }
        case 'hit': {
          const v = this.vByFighterId(e.id); if (!v) break;
          const h = this.headPos(v);
          if (!e.dot) {
            this.fx.spark(h.x, h.y, h.z, e.type || '#fff', e.crit ? 9 : 4, e.crit ? 3 : 2);
            v.actor.flash = e.crit ? 1 : .6;
            if (v.actor.anim !== 'Attack' && v.actor.anim !== 'Charge') v.actor.play('Hurt', true);
            this.sound('hit', { crit: e.crit, ability: e.ability, type: e.type, eff: e.eff });
            if (e.ability && e.dmg > 60) this.shake = Math.max(this.shake, .12);
            if (e.crit) this.shake = Math.max(this.shake, .08);
          }
          const col = e.dot ? (e.type === 'burn' ? '#ff9a4a' : '#d48aff') : e.src && this.battle.byId(e.src) && this.battle.byId(e.src).team === 0 ? '#fff6d0' : '#ffb0b0';
          this.addText({ x: h.x, y: h.y + .5, z: h.z, text: String(e.dmg), col, size: e.crit ? 24 : e.ability ? 19 : e.dot ? 11 : 15, life: .9, jx: (Math.random() - .5) * 18, crit: e.crit });
          if (e.eff === 'super') this.addText({ x: h.x, y: h.y + .75, z: h.z, text: 'Hiệu quả!', col: '#ffb347', size: 12, life: 1.1, jx: 0 });
          else if (e.eff === 'weak') this.addText({ x: h.x, y: h.y + .75, z: h.z, text: 'Không hiệu quả...', col: '#9ab', size: 11, life: 1.0, jx: 0 });
          else if (e.eff === 'immune') this.addText({ x: h.x, y: h.y + .75, z: h.z, text: 'Gần như vô hiệu', col: '#9ab', size: 11, life: 1.0, jx: 0 });
          break;
        }
        case 'miss': { const v = this.vByFighterId(e.id); if (v) { const h = this.headPos(v); this.addText({ x: h.x, y: h.y + .5, z: h.z, text: 'Né!', col: '#b8e0ff', size: 14, life: .8 }); } break; }
        case 'cast': {
          const v = this.vByFighterId(e.id); if (!v) break;
          const h = this.headPos(v);
          v.actor.play(FORMS[v.actor.dex].anims.Charge ? 'Charge' : 'Attack', true); v.actor.speed = 1;
          this.fx.ring(v.x, v.z, 1.1, e.type, .5); this.fx.particle({ x: h.x, y: h.y, z: h.z, life: .4, size: 2, color: e.type, alpha: .6 });
          this.addText({ x: h.x, y: h.y + 1.0, z: h.z, text: e.name + '!', col: TYPE_COL[e.type] || '#fff', size: 14, life: 1.2, vy: -16, banner: true });
          const line = LINE[v.f.key]; const cry = line ? cryText(line, v.actor.dex) : null;
          if (cry && Math.random() < .6) this.addText({ x: h.x, y: h.y + .45, z: h.z, text: cry, col: '#ffffff', size: 11, life: 1.0, vy: -8, bubble: true });
          this.sound('cast', { type: e.type, kind: e.kind, dex: v.actor.dex });
          break;
        }
        case 'status': {
          const v = this.vByFighterId(e.id); if (!v) break; const h = this.headPos(v);
          if (e.s === 'stun') { for (let i = 0; i < 4; i++) this.fx.particle({ x: h.x + Math.cos(i * 1.57) * .35, y: h.y + .65, z: h.z + Math.sin(i * 1.57) * .35, vy: .2, life: Math.min(1.2, e.dur || 1), size: .22, color: '#ffe14a', tex: 'star', spin: 3 }); }
          else if (e.s === 'shield') this.fx.bubble(() => { const q = this.viewById(v.team, v.f.id); return q && q.f && q.f.alive && q.f.shield > 0 ? this.headPos(q) : null; }, '#9ad8ff', 5);
          else if (e.s === 'buff') this.fx.rise(h.x, h.y, h.z, '#ffd24a', 3);
          else if (e.s === 'poison') this.fx.smoke(h.x, h.y, h.z, 2);
          break;
        }
        case 'heal': { const v = this.vByFighterId(e.id); if (v) { const h = this.headPos(v); this.fx.rise(h.x, h.y - .2, h.z); this.addText({ x: h.x, y: h.y + .4, z: h.z, text: '+' + e.amount, col: '#6dff9a', size: 14, life: .9 }); } break; }
        case 'death': {
          const v = this.vByFighterId(e.id); if (v) { v.dying = .01; this.fx.smoke(v.x, .6, v.z, 10); this.fx.spark(v.x, .6, v.z, '#fff', 8, 2.5); this.sound('faint', { team: v.team }); }
          break;
        }
        case 'fx': this.consumeFx(e); break;
        case 'end': break;
      }
    }
  }

  consumeFx(e) {
    const Y = .7, V = (x, y, z) => new THREE.Vector3(x, y, z), type = e.type, f = this.fx;
    switch (e.k) {
      case 'bolt': {
        const a = V(e.x, Y, e.z), b = V(e.tx, Y, e.tz);
        f.beam(a, b, type, type === 'Electric' ? .45 : .6, .3, type === 'Electric' ? .6 : 0);
        f.spark(e.tx, Y, e.tz, type, 8, 3, .3); f.disc(e.tx, e.tz, .9, type, .35, .6);
        if (e.drain) f.rise(e.x, Y, e.z, '#8aff9a', 4);
        break;
      }
      case 'chain': { f.beam(V(e.x, Y, e.z), V(e.tx, Y, e.tz), type, .35, .35, .5); f.spark(e.tx, Y, e.tz, type, 6, 2.5, .25); this.shake = Math.max(this.shake, .05); break; }
      case 'beam': {
        const a = V(e.x, Y, e.z), b = V(e.x + e.ux * e.len, Y, e.z + e.uz * e.len);
        f.beam(a, b, type, 1.0, .55); f.beam(a, b, '#ffffff', .35, .45);
        for (let i = 0; i < 12; i++) { const t = i / 12 * e.len; f.particle({ x: e.x + e.ux * t, y: Y, z: e.z + e.uz * t, vy: .5 + Math.random(), life: .5, size: .35, color: type }); }
        this.shake = Math.max(this.shake, .1); break;
      }
      case 'burst': {
        f.ring(e.x, e.z, e.rad, type, .55); f.disc(e.x, e.z, e.rad, type, .5, .65);
        f.spark(e.x, Y, e.z, type, 14, 3.5, .3);
        if (e.fx === 'poison') f.smoke(e.x, .4, e.z, 10); else if (e.fx === 'web') for (let i = 0; i < 10; i++) f.particle({ x: e.x + (Math.random() - .5) * e.rad, y: .3 + Math.random() * .6, z: e.z + (Math.random() - .5) * e.rad, life: .8, size: .3, color: '#fff', tex: 'star' });
        this.shake = Math.max(this.shake, .1); break;
      }
      case 'nova': { f.ring(e.x, e.z, e.rad, type, .6); f.disc(e.x, e.z, e.rad, type, .5, .5); f.ring(e.x, e.z, e.rad * .6, '#ffffff', .4); f.spark(e.x, Y, e.z, type, 12, 4, .26); if (e.big) this.shake = Math.max(this.shake, .15); break; }
      case 'quake': { f.ring(e.x, e.z, e.rad, '#e2bf65', .5); f.smoke(e.x, .2, e.z, 12); f.spark(e.x, .3, e.z, type, 8, 3); this.shake = Math.max(this.shake, .22); this.sound('quake'); break; }
      case 'volley': f.spark(e.x, Y, e.z, type, 6, 2); break;
      case 'leap': { f.smoke(e.x, .3, e.z, 6); f.ring(e.x, e.z, .8, type, .4); this.sound('leap'); break; }
      case 'blink': { f.smoke(e.x, .6, e.z, 6); f.spark(e.x, .6, e.z, type, 10, 2); f.spark(e.tx, .6, e.tz, type, 10, 2); this.sound('blink'); break; }
      case 'heal': f.rise(e.x, .5, e.z, '#6dff9a', 7); f.ring(e.x, e.z, 1, '#6dff9a', .6); break;
      case 'shield': f.ring(e.x, e.z, 1.1, '#9ad8ff', .5); break;
      case 'rally': f.ring(e.x, e.z, e.rad, '#ffd24a', .7); f.ring(e.x, e.z, e.rad * .6, type, .5); break;
      case 'mark': f.meteor(e.x, e.z, e.rad, e.dur, type); break;
      case 'impact': f.ring(e.x, e.z, e.rad, type, .5); f.spark(e.x, .5, e.z, type, 16, 4, .34); f.smoke(e.x, .3, e.z, 8); this.shake = Math.max(this.shake, .25); this.sound('boom'); break;
    }
  }

  // ---------- vòng lặp vẽ ----------
  frame(dt) {
    this.time += dt;
    const k = Math.min(1, dt * 16);
    for (const v of this.views.values()) {
      const a = v.actor, f = v.f;
      if (f && this.battle) {
        v.x = ease(v.x, f.x, Math.min(1, dt * 22)); v.z = ease(v.z, f.z, Math.min(1, dt * 22));
        v.y = 0;
        if (f.leap) v.y = Math.sin(Math.min(1, f.leap.t / f.leap.dur) * Math.PI) * 1.4;
        a.face(f.fx, f.fz);
        if (v.dying) { v.dying += dt; a.fade = Math.max(0, 1 - v.dying * 2.4); a.group.scale.setScalar(a.scaleMul * (1 + v.dying * .3)); if (v.dying > .45) a.group.visible = false; }
        else { a.rest(f.moving ? 'Walk' : 'Idle'); a.speed = a.anim === 'Attack' ? Math.max(1, f.asE * 1.6) : 1; }
        v.hpShown = ease(v.hpShown, f.hp / f.maxHp, Math.min(1, dt * 10));
      } else {
        // chuẩn bị: trượt về ô
        v.x = ease(v.x, v.tx, k); v.z = ease(v.z, v.tz, k);
        a.face(0, 1); a.rest('Idle'); a.speed = 1; v.y = 0;
        if (v.spawn > 0) { v.spawn = Math.max(0, v.spawn - dt * 2.2); v.y = Math.sin(v.spawn * Math.PI) * .8; }
      }
      a.group.position.set(v.x, v.y, v.z);
      a.shadow.position.y = (.03 - v.y) / a.scaleMul;   // bóng luôn ở mặt đất
      if (v.pop > 0) { v.pop = Math.max(0, v.pop - dt * 2.2); if (!v.dying) a.group.scale.setScalar(a.scaleMul * (1 + Math.sin(v.pop * Math.PI) * .35)); }
      if (v.star === 3 && !v.dying && a.group.visible && (v.aura = (v.aura || 0) - dt) <= 0) {
        v.aura = .16; this.fx.particle({ x: v.x + (Math.random() - .5) * .8, y: .1 + Math.random() * a.headY * .8, z: v.z + (Math.random() - .5) * .5, vy: .6, life: .9, size: .2, color: '#ffe14a', tex: 'star', alpha: .9, spin: 2 });
      }
      a.update(dt);
    }
    // đang kéo
    if (this.drag) {
      const v = this.views.get(this.drag.key);
      if (v) { v.x = ease(v.x, this.drag.x, Math.min(1, dt * 30)); v.z = ease(v.z, this.drag.z, Math.min(1, dt * 30)); v.tx = v.x; v.tz = v.z; v.y = .6; v.actor.group.position.set(v.x, .6, v.z); v.actor.shadow.position.y = .03 - .6; }
    }
    this.arena.update(dt, this.time);
    this.fx.update(dt);
    if (this.battle) this.fx.syncProjectiles(this.battle.proj, p => .65);
    // rung camera
    this.shake = Math.max(0, this.shake - dt * .9);
    const s = this.shake * (this.shakeOn && !this.shakeOn() ? 0 : 1);
    this.camera.position.set(this.camBase.x + (Math.random() - .5) * s, this.camBase.y + (Math.random() - .5) * s * .6, this.camBase.z);
    this.camera.lookAt(this.camLook);
    if (this.mode === 'title') {
      const th = Math.sin(this.time * .2) * .7, ox = (this.camBase.x - this.camLook.x) * .8, oz = (this.camBase.z - this.camLook.z) * .8, oy = (this.camBase.y - this.camLook.y) * .8;
      this.camera.position.set(this.camLook.x + ox * Math.cos(th) + oz * Math.sin(th), this.camLook.y + oy, this.camLook.z - ox * Math.sin(th) + oz * Math.cos(th));
      this.camera.lookAt(this.camLook.x - 2.6, 0, this.camLook.z - .6);
    }
    // texture: bao gồm xoay nhẹ camera lúc chờ cho "3D" hơn
    if (this.mode === 'prep' && !this.drag) { const sw = Math.sin(this.time * .25) * .5; this.camera.position.x += sw; this.camera.lookAt(this.camLook); }
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(dt);
  }

  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * .5 + .5) * this.w, y: (-v.y * .5 + .5) * this.h, z: v.z };
  }

  drawOverlay(dt) {
    const g = this.ctx, d = this.dpr, u = this.uiScale;
    g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, this.w, this.h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const inCombat = this.mode === 'combat' && this.battle;
    const list = [...this.views.values()].sort((a, b) => a.z - b.z);
    for (const v of list) {
      if (!v.actor.group.visible || v.dying > .3) continue;
      const head = this.project(v.x, v.actor.headY + (v.y || 0) + .05, v.z);
      const bw = Math.round(44 * u * (v.star === 3 ? 1.2 : 1)), bh = Math.round(6 * u);
      const x = head.x - bw / 2, y = head.y - bh - 2 * u;
      // sao
      const stars = '★'.repeat(v.star);
      g.font = `900 ${Math.round(11 * u)}px system-ui,sans-serif`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.fillStyle = STAR_COL[v.star];
      const sy = y - 8 * u; g.strokeText(stars, head.x, sy); g.fillText(stars, head.x, sy);
      if (inCombat && v.f) {
        const f = v.f, hp = Math.max(0, v.hpShown);
        g.fillStyle = 'rgba(10,10,20,.85)'; g.fillRect(x - 1, y - 1, bw + 2, bh + (f.manaMax ? 5 * u : 0) + 2);
        g.fillStyle = f.team === 0 ? '#4ade80' : '#f87171'; g.fillRect(x, y, bw * hp, bh);
        if (f.shield > 0) { g.fillStyle = 'rgba(255,255,255,.85)'; const sw = Math.min(bw, bw * f.shield / f.maxHp); g.fillRect(x, y, sw, Math.max(2, bh * .4)); }
        // vạch chia máu
        g.fillStyle = 'rgba(0,0,0,.35)'; const seg = f.maxHp / 250; for (let i = 1; i < Math.min(14, seg); i++) g.fillRect(x + bw * i / seg, y, 1, bh);
        if (f.manaMax) { g.fillStyle = '#2a3a8a'; g.fillRect(x, y + bh + 1, bw, 3 * u); g.fillStyle = '#60a5fa'; g.fillRect(x, y + bh + 1, bw * Math.min(1, f.mana / f.manaMax), 3 * u); }
        if (f.stun > 0) { g.fillStyle = '#ffe14a'; g.font = `900 ${Math.round(10 * u)}px system-ui`; g.fillText('✦', head.x + bw / 2 + 8 * u, y + 2); }
      } else if (this.mode === 'prep' && v.unit && v.unit.items.length) {
        v.unit.items.forEach((it, i) => { g.fillStyle = 'rgba(10,10,20,.8)'; g.beginPath(); g.arc(head.x - (v.unit.items.length - 1) * 5 * u + i * 10 * u, y + 2, 4 * u, 0, 7); g.fill(); g.fillStyle = this.itemCol ? this.itemCol(it) : '#fff'; g.beginPath(); g.arc(head.x - (v.unit.items.length - 1) * 5 * u + i * 10 * u, y + 2, 3 * u, 0, 7); g.fill(); });
      }
    }
    // vòng sáng dưới chân Pokémon sắp nhận vật phẩm
    if (this.hot) { const v = this.views.get(this.hot); if (v) { const p = this.project(v.x, 0, v.z); g.strokeStyle = '#ffe14a'; g.lineWidth = 3 * u; g.beginPath(); g.ellipse(p.x, p.y, 28 * u, 12 * u, 0, 0, 7); g.stroke(); } }
    // chữ nổi
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.t += dt; if (t.t >= t.life) { this.texts.splice(i, 1); continue; }
      const k = t.t / t.life, p = this.project(t.x, t.y, t.z);
      const rise = t.vy * k * u, px = p.x + (t.jx || 0) * k * u, py = p.y + rise - (t.banner ? 0 : 0);
      const a = k < .7 ? 1 : 1 - (k - .7) / .3, sc = t.crit ? 1 + Math.max(0, .5 - k * 2) : 1;
      g.globalAlpha = a; g.font = `900 ${Math.round(t.size * u * sc)}px system-ui,sans-serif`; g.lineJoin = 'round';
      if (t.bubble) {
        const w = g.measureText(t.text).width + 12 * u, h = 18 * u;
        g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.roundRect(px - w / 2, py - h / 2, w, h, 8 * u); g.fill();
        g.fillStyle = '#222'; g.fillText(t.text, px, py + 1);
      } else {
        g.lineWidth = 4 * u; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(t.text, px, py); g.fillStyle = t.col; g.fillText(t.text, px, py);
      }
      g.globalAlpha = 1;
    }
  }

  // ---------- chọn / kéo-thả ----------
  groundPoint(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(this.plane, p) ? p : null;
  }
  // Pokémon của người chơi tại điểm màn hình (cx, cy)
  pickUnit(cx, cy, teamOnly = 0) {
    const r = this.canvas.getBoundingClientRect(); const px = cx - r.left, py = cy - r.top;
    let best = null, bd = 1e9;
    for (const v of this.views.values()) {
      if (v.team !== teamOnly && teamOnly !== -1) continue;
      if (!v.actor.group.visible) continue;
      const foot = this.project(v.x, 0, v.z), head = this.project(v.x, v.actor.headY, v.z);
      const hh = Math.max(24, foot.y - head.y), cxm = foot.x, cym = (foot.y + head.y) / 2;
      const hw = Math.max(20, hh * .5);
      if (Math.abs(px - cxm) < hw && py > head.y - 8 && py < foot.y + 10) { const d = Math.hypot(px - cxm, py - cym) + (foot.y < py ? 0 : 0); if (d < bd) { bd = d; best = v; } }
    }
    return best;
  }
  // ô tại điểm màn hình: { zone:'board', idx } | { zone:'bench', idx } | null
  pickCell(cx, cy) {
    const p = this.groundPoint(cx, cy); if (!p) return null;
    if (p.x >= 0 && p.x < 8 && p.z >= 4 && p.z < 8) return { zone: 'board', idx: Math.floor(p.z - 4) * 8 + Math.floor(p.x), pos: boardPos(Math.floor(p.x), Math.floor(p.z - 4)) };
    if (p.z >= BENCH_Z - .7 && p.z <= BENCH_Z + .75 && p.x > -.4 && p.x < 8.4) {
      let bi = 0, bd = 1e9; for (let i = 0; i < 9; i++) { const d = Math.abs(benchPos(i).x - p.x); if (d < bd) { bd = d; bi = i; } }
      return { zone: 'bench', idx: bi, pos: benchPos(bi) };
    }
    return null;
  }
  startDrag(key) { const v = this.views.get(key); if (!v) return; this.drag = { key, x: v.x, z: v.z }; }
  moveDrag(cx, cy) { if (!this.drag) return null; const p = this.groundPoint(cx, cy); if (p) { this.drag.x = p.x; this.drag.z = p.z; } return this.pickCell(cx, cy); }
  endDrag() { this.drag = null; this.arena.highlight(null); for (let i = 0; i < 9; i++) this.arena.padGlow(i, false); }
  highlightCell(cell, ok) {
    for (let i = 0; i < 9; i++) this.arena.padGlow(i, !!(cell && cell.zone === 'bench' && cell.idx === i && ok));
    if (cell && cell.zone === 'board') this.arena.highlight(cell.pos, ok ? '#6dff9a' : '#ff6a6a'); else this.arena.highlight(null);
  }
  // hiệu ứng khi gộp sao / tiến hóa
  evolveFx(unitId) {
    const v = this.views.get('u' + unitId); if (!v) return;
    v.actor.flash = 2.5; this.fx.starBurst(v.x, .8, v.z); this.shake = Math.max(this.shake, .12);
  }
}
