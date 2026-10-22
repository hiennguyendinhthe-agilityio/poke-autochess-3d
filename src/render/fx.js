// Hiệu ứng hình ảnh: hạt, vòng sóng, tia, đạn, thiên thạch... (tô màu theo hệ của chiêu)
import * as THREE from 'three';
import { TYPE_COL } from '../data/types.js';

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let TEX = null;
function textures() {
  if (TEX) return TEX;
  TEX = {
    glow: canvasTex(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }),
    ring: canvasTex(128, (g, s) => { g.strokeStyle = '#fff'; g.lineWidth = s * .06; g.shadowColor = '#fff'; g.shadowBlur = s * .08; g.beginPath(); g.arc(s / 2, s / 2, s * .42, 0, 7); g.stroke(); }),
    disc: canvasTex(128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, s * .1, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,.05)'); r.addColorStop(.8, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,.9)'); g.fillStyle = r; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1, 0, 7); g.fill(); }),
    plus: canvasTex(64, (g, s) => { g.fillStyle = '#fff'; g.fillRect(s * .4, s * .12, s * .2, s * .76); g.fillRect(s * .12, s * .4, s * .76, s * .2); }),
    star: canvasTex(64, (g, s) => { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? s * .2 : s * .46; g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } g.closePath(); g.fill(); }),
    beam: canvasTex(64, (g, s) => { const r = g.createLinearGradient(0, 0, 0, s); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(.5, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); })
  };
  return TEX;
}

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
const tc = t => new THREE.Color(TYPE_COL[t] || t || '#ffffff');
const quad = new THREE.PlaneGeometry(1, 1);
const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export class FX {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera; this.items = []; this.free = []; this.projViews = new Map();
    this.group = new THREE.Group(); scene.add(this.group); this.T = textures();
  }

  sprite() {
    let s = this.free.pop();
    if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); }
    s.visible = true; this.group.add(s); return s;
  }
  release(s) { s.visible = false; this.group.remove(s); this.free.push(s); }

  // hạt phát sáng bay lên/ra xa
  particle({ x, y, z, vx = 0, vy = 0, vz = 0, g = 0, life = .6, size = .3, end = 0, color = '#fff', alpha = 1, tex = 'glow', blend = true, spin = 0 }) {
    const s = this.sprite(); s.material.map = this.T[tex]; s.material.color.set(tc(color)); s.material.blending = blend ? THREE.AdditiveBlending : THREE.NormalBlending;
    s.position.set(x, y, z); s.scale.setScalar(size); s.material.opacity = alpha; s.material.rotation = 0;
    this.items.push({ kind: 'p', s, vx, vy, vz, g, life, t: 0, size, end, alpha, spin });
  }
  spark(x, y, z, color, n = 6, power = 2, size = .22) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, e = Math.random() * 1.2 + .2, v = power * (.5 + Math.random() * .7);
      this.particle({ x, y, z, vx: Math.cos(a) * v, vy: e * v, vz: Math.sin(a) * v, g: -6, life: .35 + Math.random() * .25, size: size * (.6 + Math.random() * .8), color });
    }
    this.particle({ x, y, z, life: .18, size: size * 4, color, alpha: .8 });
  }
  // vòng sóng trên mặt đất, nở dần tới bán kính rad
  ring(x, z, rad, color, life = .5, thick = 1) {
    const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: this.T.ring, color: tc(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.position.set(x, .06, z); m.scale.setScalar(.1); this.group.add(m);
    this.items.push({ kind: 'ring', m, life, t: 0, rad, thick });
  }
  disc(x, z, rad, color, life = .5, alpha = .7) {
    const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: this.T.disc, color: tc(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.position.set(x, .05, z); m.scale.setScalar(rad * 2); this.group.add(m);
    this.items.push({ kind: 'disc', m, life, t: 0, alpha });
  }
  // tia sáng giữa 2 điểm
  beam(a, b, color, width = .3, life = .25, jag = 0) {
    const make = (p, q) => {
      const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: this.T.beam, color: tc(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      this.group.add(m); return { m, p, q };
    };
    const segs = [];
    if (jag > 0) {
      const n = 6; let prev = a.clone();
      for (let i = 1; i <= n; i++) {
        const t = i / n, p = new THREE.Vector3().lerpVectors(a, b, t);
        if (i < n) p.add(new THREE.Vector3((Math.random() - .5) * jag, (Math.random() - .5) * jag, (Math.random() - .5) * jag));
        segs.push(make(prev, p)); prev = p;
      }
    } else segs.push(make(a.clone(), b.clone()));
    this.items.push({ kind: 'beam', segs, life, t: 0, width });
  }
  place(m, a, b, width) {
    tmp.subVectors(b, a); const len = tmp.length() || .001; const x = tmp.clone().normalize();
    tmp2.copy(this.camera.position).sub(a); const z = tmp2.sub(x.clone().multiplyScalar(tmp2.dot(x))).normalize();
    const y = tmp3.crossVectors(z, x).normalize();
    m.matrix.makeBasis(x, y, z); m.matrix.setPosition(tmp.copy(a).add(b).multiplyScalar(.5));
    m.matrixAutoUpdate = false; m.matrix.scale(new THREE.Vector3(len, width, 1)); m.matrixWorldNeedsUpdate = true;
  }
  // chữ cộng bay lên (hồi máu)
  rise(x, y, z, color = '#6dff9a', n = 6) {
    for (let i = 0; i < n; i++) this.particle({ x: x + (Math.random() - .5) * .6, y: y + Math.random() * .4, z: z + (Math.random() - .5) * .6, vy: 1 + Math.random(), life: .9, size: .28, color, tex: 'plus', alpha: .95 });
  }
  smoke(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) this.particle({ x, y, z, vx: (Math.random() - .5) * 1.6, vy: Math.random() * 1.2, vz: (Math.random() - .5) * 1.6, life: .7, size: .35, end: .9, color: '#e8e8f0', blend: false, alpha: .8 });
  }
  starBurst(x, y, z, color = '#ffe14a', n = 14) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283, v = 2.4 + Math.random();
      this.particle({ x, y, z, vx: Math.cos(a) * v, vy: 1.5 + Math.random() * 2, vz: Math.sin(a) * v, g: -4, life: .9, size: .3, color, tex: 'star', spin: 4 });
    }
    this.ring(x, z, 2.2, color, .7); this.particle({ x, y, z, life: .5, size: 3, color, alpha: .6 });
  }
  // thiên thạch: vòng cảnh báo rồi một vệt sáng rơi xuống
  meteor(x, z, rad, delay, color) {
    this.ring(x, z, rad, color, delay, 1); this.disc(x, z, rad, color, delay, .35);
    this.items.push({ kind: 'meteor', x, z, color, life: delay, t: 0, fired: false });
  }
  // khiên: bong bóng tại nhân vật (trả về điều khiển để bám theo)
  bubble(getPos, color, life = 1.2) {
    const s = this.sprite(); s.material.map = this.T.disc; s.material.color.set(tc(color)); s.material.blending = THREE.AdditiveBlending;
    this.items.push({ kind: 'bubble', s, getPos, life, t: 0 });
  }

  // đạn (đồng bộ từ mô phỏng mỗi khung hình)
  syncProjectiles(list, getY) {
    const seen = new Set();
    for (const p of list) {
      if (p.delay > 0) continue;
      seen.add(p);
      let v = this.projViews.get(p);
      if (!v) {
        const s = this.sprite(); s.material.map = this.T.glow; s.material.color.set(tc(p.type)); s.material.blending = THREE.AdditiveBlending;
        v = { s, trail: 0 }; this.projViews.set(p, v);
      }
      const y = getY(p), big = p.basic ? .5 : .85;
      v.s.position.set(p.x, y, p.z); v.s.scale.setScalar(big); v.s.material.opacity = 1;
      v.trail -= 1; if (v.trail <= 0) { v.trail = 1; this.particle({ x: p.x, y, z: p.z, life: .25, size: big * .55, color: p.type, alpha: .7 }); }
    }
    for (const [p, v] of this.projViews) if (!seen.has(p)) {
      this.release(v.s); this.projViews.delete(p);
      if (p.done) this.spark(p.tx ?? p.x, getY(p), p.tz ?? p.z, p.type, 3, 1.2, .18);
    }
  }

  update(dt) {
    const cam = this.camera;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt; const k = Math.min(1, it.t / it.life);
      let dead = it.t >= it.life;
      switch (it.kind) {
        case 'p': {
          const s = it.s; it.vy += it.g * dt;
          s.position.x += it.vx * dt; s.position.y += it.vy * dt; s.position.z += it.vz * dt;
          s.scale.setScalar(it.size + (it.end ? (it.end - it.size) * k : -it.size * .6 * k)); s.material.opacity = it.alpha * (1 - k * k);
          if (it.spin) s.material.rotation += it.spin * dt;
          if (dead) this.release(s); break;
        }
        case 'ring': { const s = (.1 + (it.rad * 2) * Math.min(1, k * 1.4)); it.m.scale.setScalar(s); it.m.material.opacity = (1 - k) * it.thick; if (dead) { this.group.remove(it.m); it.m.material.dispose(); } break; }
        case 'disc': { it.m.material.opacity = it.alpha * (1 - k); if (dead) { this.group.remove(it.m); it.m.material.dispose(); } break; }
        case 'beam': {
          for (const sg of it.segs) { this.place(sg.m, sg.p, sg.q, it.width * (1 - k * .5)); sg.m.material.opacity = 1 - k; }
          if (dead) for (const sg of it.segs) { this.group.remove(sg.m); sg.m.material.dispose(); }
          break;
        }
        case 'meteor': {
          if (!it.fired && it.t > it.life - .25) { it.fired = true; const a = new THREE.Vector3(it.x + 2, 9, it.z - 2), b = new THREE.Vector3(it.x, .2, it.z); this.beam(a, b, it.color, .8, .25); }
          break;
        }
        case 'bubble': {
          const p = it.getPos(); if (!p) { dead = true; } else { it.s.position.set(p.x, p.y, p.z); const sc = 1.4 + Math.sin(it.t * 8) * .06; it.s.scale.setScalar(sc); it.s.material.opacity = .45 * (1 - k * k); }
          if (dead) this.release(it.s); break;
        }
      }
      if (dead) this.items.splice(i, 1);
    }
  }
  clear() {
    for (const it of this.items) {
      if (it.s) this.release(it.s); if (it.m) { this.group.remove(it.m); it.m.material.dispose(); }
      if (it.segs) for (const sg of it.segs) { this.group.remove(sg.m); sg.m.material.dispose(); }
    }
    this.items = [];
    for (const [, v] of this.projViews) this.release(v.s); this.projViews.clear();
  }
}
