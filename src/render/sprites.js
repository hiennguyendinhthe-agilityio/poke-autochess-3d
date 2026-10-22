// Nhân vật: billboard trong không gian 3D, phát hoạt ảnh sprite sheet PMD 8 hướng.
import * as THREE from 'three';
import FORMS from '../data/generated/forms.json';
import { hasModel, loadModel, instantiate } from './models.js';

const BASE = 'assets/pokemon/';
const loader = new THREE.TextureLoader();
const cache = new Map();

// Lấy texture (không chặn): trả về null nếu chưa tải xong, đồng thời kích hoạt việc tải
export function texOf(dex, anim) {
  const k = dex + '/' + anim, c = cache.get(k);
  if (c) return c.tex;
  const e = { tex: null };
  cache.set(k, e);
  loader.load(BASE + dex + '/' + anim + '.png', t => {
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    e.tex = t;
  }, undefined, () => { e.tex = null; e.failed = true; });
  return null;
}
export function preload(dexList) {
  for (const d of dexList) for (const a of ['Idle', 'Walk', 'Attack', 'Hurt', 'Charge']) if (FORMS[d] && FORMS[d].anims[a]) texOf(d, a);
}
export const isReady = dex => { const c = cache.get(dex + '/Idle'); return !!(c && c.tex); };

const WORLD_PER_PX = .046;
export function worldHeight(dex) {
  const f = FORMS[dex], bh = f.anims.Idle.bh || 24;
  return Math.max(.95, Math.min(1.95, bh * WORLD_PER_PX));
}

// Hướng PMD: 0 xuống, 1 xuống-phải, 2 phải, 3 lên-phải, 4 lên, 5 lên-trái, 6 trái, 7 xuống-trái
export function dirIndex(vx, vz) {
  const a = Math.atan2(vx, vz) / (Math.PI / 4);
  return ((Math.round(a) % 8) + 8) % 8;
}

let shadowTex = null;
function getShadowTex() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.6, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c); return shadowTex;
}
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const quadGeo = new THREE.PlaneGeometry(1, 1);

export class Actor {
  constructor(dex, { team = 0, scale = 1 } = {}) {
    this.team = team; this.scaleMul = scale;
    this.group = new THREE.Group();
    this.lean = new THREE.Group(); this.group.add(this.lean);
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: .35, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(quadGeo, this.mat); this.mesh.renderOrder = 2;
    this.lean.add(this.mesh);
    this.lean.rotation.x = -.5;
    this.shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: getShadowTex(), transparent: true, depthWrite: false }));
    this.shadow.position.y = .03; this.shadow.renderOrder = 1;
    this.group.add(this.shadow);
    this.texs = {};       // texture riêng (clone) cho mỗi anim để mỗi nhân vật có UV riêng
    this.anim = 'Idle'; this.frame = 0; this.t = 0; this.once = null; this.dir = team === 0 ? 4 : 0;
    this.flash = 0; this.hop = 0; this.fade = 1; this.speed = 1; this.bob = 0;
    this.setDex(dex);
  }

  setDex(dex) {
    this.dex = dex; this.form = FORMS[dex]; this.texs = {};
    this.worldH = worldHeight(dex);
    this.px = this.worldH / (this.form.anims.Idle.bh || 24);
    this.shadow.scale.set(Math.max(.7, this.form.anims.Idle.bw * this.px * 1.15) * this.scaleMul, 1, Math.max(.45, this.form.anims.Idle.bw * this.px * .7) * this.scaleMul);
    this.group.scale.setScalar(this.scaleMul); this.shadow.scale.multiplyScalar(1 / this.scaleMul);
    this.apply();
    this.detachModel();
    if (hasModel(dex)) { const d = dex; loadModel(d).then(m => { if (m && this.dex === d) this.attachModel(m); }); }
  }
  // ----- model 3D tuỳ chọn (thay sprite) -----
  detachModel() { if (this.model) { this.group.remove(this.model.wrap); this.model = null; } this.mesh.visible = true; }
  attachModel(m) {
    this.model = instantiate(m, this.worldH); this.group.add(this.model.wrap); this.mesh.visible = false;
    this.model.yaw = this.model.wrap.rotation.y = 0; this.model.cur = null; this.model.act = null; this.playModel('Idle');
  }
  playModel(name, once = false) {
    const M = this.model; if (!M) return;
    const a = M.actions[name] || M.actions.Idle; if (!a) return;
    if (M.act === a && !once) return;
    if (M.act && M.act !== a) M.act.fadeOut(.15);
    a.reset().fadeIn(.1).play(); a.setLoop(once ? 2200 : 2201, once ? 1 : Infinity); a.clampWhenFinished = once;
    M.act = a; M.once = once ? name : null; M.t = 0;
  }
  setScale(s) { this.scaleMul = s; this.group.scale.setScalar(s); }
  get headY() { return this.worldH * this.scaleMul; }

  play(anim, once = false) {
    if (!this.form.anims[anim]) anim = anim === 'Charge' ? 'Attack' : 'Idle';
    if (this.anim === anim && !once) return;
    this.anim = anim; this.frame = 0; this.t = 0; this.once = once ? true : null;
    if (this.model) this.playModel(anim === 'Charge' ? 'Attack' : anim, once);
  }
  face(vx, vz) { if (Math.abs(vx) + Math.abs(vz) > 1e-4) { this.dir = dirIndex(vx, vz); this.yaw = Math.atan2(vx, vz); } }

  tex(anim) {
    if (this.texs[anim]) return this.texs[anim];
    const base = texOf(this.dex, anim); if (!base) return null;
    const t = base.clone(); this.texs[anim] = t; return t;
  }

  // đặt lại quad/UV theo anim và khung hiện tại
  apply() {
    const info = this.form.anims[this.anim], t = this.tex(this.anim);
    if (!t) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    t.repeat.set(1 / info.n, 1 / info.rows);
    t.offset.set(this.frame / info.n, 1 - (this.dir + 1) / info.rows);
    this.mat.map = t; this.mat.needsUpdate = false;
    const s = this.px;
    this.mesh.scale.set(info.fw * s, info.fh * s, 1);
    this.mesh.position.set((info.fw / 2 - info.cx) * s, (info.foot - info.fh / 2) * s, 0);
  }

  update(dt) {
    if (this.model) {
      const M = this.model; M.mixer.update(dt);
      if (M.once && (M.t += dt) > (M.act.getClip().duration || .5)) { M.once = null; this.playModel(this._rest || 'Idle'); }
      let d = (this.yaw || 0) - M.wrap.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); M.wrap.rotation.y += d * Math.min(1, dt * 12);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
      this.shadow.material.opacity = this.fade * .9; M.wrap.visible = this.fade > .02;
      return;
    }
    const info = this.form.anims[this.anim];
    this.t += dt * 60 * this.speed;
    let d = info.dur[this.frame] || 2;
    while (this.t >= d) {
      this.t -= d; this.frame++;
      if (this.frame >= info.n) {
        if (this.once) { this.once = null; this.anim = this._rest || 'Idle'; this.frame = 0; this.t = 0; return this.apply(); }
        this.frame = 0;
      }
      d = info.dur[this.frame] || 2;
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    const c = 1 + this.flash * 1.8; this.mat.color.setRGB(c, c, c);
    this.mat.opacity = this.fade;
    this.shadow.material.opacity = this.fade * .9;
    this.apply();
  }
  // anim "nghỉ": đứng yên hoặc chạy
  rest(anim) { this._rest = anim; if (!this.once && this.anim !== anim && (this.anim === 'Idle' || this.anim === 'Walk')) this.play(anim); else if (this.model && !this.model.once) this.playModel(anim); }
  dispose() { for (const k in this.texs) this.texs[k].dispose(); this.mat.dispose(); this.shadow.material.dispose(); }
}
