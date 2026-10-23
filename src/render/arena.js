// Đấu trường 3D: bàn cờ LỤC GIÁC 8x8, hàng ghế chờ, đảo nổi, bầu trời, trang trí theo chủ đề.
import * as THREE from 'three';
import { center, W, RAD, END_Z, MID_Z, BENCH_Z as BZ, COLS } from '../sim/hex.js';

export const BENCH_Z = BZ;
export const benchPos = i => ({ x: .5 + i * ((W - 1) / 8), z: BENCH_Z });
export const boardPos = (c, r) => center(c, 4 + r);     // ô của người chơi: hàng 0 sát đối thủ

export const THEMES = {
  grass: { name: 'Đồng cỏ', tiles: ['#6fb26a', '#5da25a'], foe: ['#78b4c4', '#68a4b4'], rim: '#3b7d3a', side: '#4a3a2a', sky: ['#5fb8ff', '#d8f2ff'], fog: '#cdeaff', accent: '#8dff8a', decor: 'trees' },
  cave: { name: 'Hang động', tiles: ['#7a6e86', '#6c6078'], foe: ['#8a6a7e', '#7a5a6e'], rim: '#403850', side: '#2a2433', sky: ['#1c1830', '#4a3f66'], fog: '#2c2540', accent: '#c9a8ff', decor: 'stalag' },
  water: { name: 'Hồ nước', tiles: ['#5fa6d8', '#4f96c8'], foe: ['#6a8ed0', '#5a7ec0'], rim: '#2a6a9a', side: '#26466a', sky: ['#2f8fe0', '#bfeaff'], fog: '#aee0ff', accent: '#7fe8ff', decor: 'ripples' },
  volcano: { name: 'Núi lửa', tiles: ['#9a5a48', '#8a4a3a'], foe: ['#a8584a', '#984838'], rim: '#5a2018', side: '#3a1a14', sky: ['#3a1a1a', '#ff8a4a'], fog: '#7a3020', accent: '#ffb347', decor: 'lava' },
  ice: { name: 'Băng giá', tiles: ['#b8e4f0', '#a4d6e8'], foe: ['#b0c8f0', '#9cb8e0'], rim: '#6aa8c8', side: '#4a7898', sky: ['#7fc0f0', '#f0fbff'], fog: '#e0f6ff', accent: '#e0fbff', decor: 'crystals' },
  psychic: { name: 'Cõi tâm linh', tiles: ['#9a78c8', '#8a68b8'], foe: ['#b878b8', '#a868a8'], rim: '#5a3a8a', side: '#33244f', sky: ['#2a1a5a', '#c878ff'], fog: '#4a2a7a', accent: '#ff9aff', decor: 'orbs' }
};

const col = c => new THREE.Color(c);

export class Arena {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    this.themeName = null;
    this.buildLights(); this.buildBoard(); this.buildBench(); this.buildIsland(); this.buildSky(); this.buildAmbient();
    this.decor = new THREE.Group(); this.group.add(this.decor);
    this.hl = new THREE.Mesh(new THREE.CylinderGeometry(RAD * .96, RAD * .96, .04, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .5, depthWrite: false }));
    this.hl.visible = false; this.hl.position.y = .02; this.group.add(this.hl);
    this.setTheme('grass');
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight('#ffffff', '#6a7a9a', 1.35); this.group.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff6e0', 1.6); this.sun.position.set(-6, 12, 8); this.group.add(this.sun);
  }

  buildBoard() {
    // mỗi ô là một lăng trụ lục giác (đỉnh nhọn hướng +z), chừa khe nhỏ giữa các ô
    const geo = new THREE.CylinderGeometry(RAD * .94, RAD * .94, .16, 6);
    this.tiles = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: .85, metalness: .02 }), 64);
    const m = new THREE.Matrix4();
    for (let r = 0; r < 8; r++) for (let c = 0; c < COLS; c++) { const p = center(c, r); m.makeTranslation(p.x, -.08, p.z); this.tiles.setMatrixAt(r * 8 + c, m); this.tiles.setColorAt(r * 8 + c, col('#fff')); }
    this.group.add(this.tiles);
    this.frame = new THREE.Mesh(new THREE.BoxGeometry(W + .45, .28, END_Z + .35), new THREE.MeshStandardMaterial({ roughness: .9 }));
    this.frame.position.set(W / 2, -.28, END_Z / 2); this.group.add(this.frame);
    this.rim = new THREE.Mesh(new THREE.BoxGeometry(W + .65, .12, END_Z + .55), new THREE.MeshStandardMaterial({ roughness: .6 }));
    this.rim.position.set(W / 2, -.12, END_Z / 2); this.group.add(this.rim);
    // vạch giữa sân phát sáng
    this.mid = new THREE.Mesh(new THREE.PlaneGeometry(W + .1, .08).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: .55, depthWrite: false }));
    this.mid.position.set(W / 2, .012, MID_Z); this.group.add(this.mid);
  }

  buildBench() {
    this.bench = new THREE.Group();
    const geo = new THREE.CylinderGeometry(.4, .44, .12, 24);
    this.benchPads = [];
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: '#d8dce8', roughness: .5, metalness: .1 });
      const p = new THREE.Mesh(geo, mat); const bp = benchPos(i); p.position.set(bp.x, -.06, bp.z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.32, .035, 8, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff4a4a' }));
      ring.position.set(bp.x, .008, bp.z); this.bench.add(p, ring); this.benchPads.push({ p, ring });
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(W + .2, .2, 1.0), new THREE.MeshStandardMaterial({ roughness: .9 }));
    base.position.set(W / 2, -.2, BENCH_Z); this.bench.add(base); this.benchBase = base;
    this.group.add(this.bench);
  }

  buildIsland() {
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
    this.islandMat = mat;
    const cone = this.cone = new THREE.Mesh(new THREE.ConeGeometry(5.2, 5, 7), mat); cone.rotation.x = Math.PI; cone.position.set(W / 2, -3, END_Z / 2); this.group.add(cone);
    this.rocks = [];
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(.5 + (i % 3) * .25, 0), mat);
      const a = i * 1.05 + .4; r.position.set(W / 2 + Math.cos(a) * (6.6 + (i % 2)), -2 - (i % 3) * .8, END_Z / 2 + .2 + Math.sin(a) * (5 + (i % 2))); r.userData.base = r.position.clone(); r.userData.ph = i;
      this.group.add(r); this.rocks.push(r);
    }
  }

  buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: col('#5fb8ff') }, bot: { value: col('#d8f2ff') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.4+.25, 0., 1.); gl_FragColor = vec4(mix(bot, top, h), 1.); }'
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 16), this.skyMat); this.sky.renderOrder = -10; this.group.add(this.sky);
    // mây
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const ct = new THREE.CanvasTexture(c);
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, opacity: .55, depthWrite: false, fog: false }));
      s.scale.set(7 + (i % 4) * 2, 3 + (i % 3), 1);
      s.position.set(-26 + i * 4.2, -6 - (i % 5) * 1.5, -8 + (i % 4) * 7); s.userData.sp = .15 + (i % 3) * .05;
      this.group.add(s); this.clouds.push(s);
    }
  }

  buildAmbient() {
    const n = 60, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = -3 + Math.random() * 14; pos[i * 3 + 1] = .3 + Math.random() * 5; pos[i * 3 + 2] = -3 + Math.random() * 14; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ size: .09, transparent: true, opacity: .8, depthWrite: false, color: '#ffffff' }));
    this.moteBase = pos.slice(); this.group.add(this.motes);
  }

  setTheme(name) {
    if (this.themeName === name) return;
    this.themeName = name; const t = THEMES[name];
    this.theme = t;
    // tô 3 màu xen kẽ (đúng quy tắc tô màu lưới lục giác), nửa trên (đối thủ) mang tông khác
    for (let r = 0; r < 8; r++) for (let c = 0; c < COLS; c++) {
      const pal = (r < 4 ? t.foe : t.tiles), cx = c - ((r - (r & 1)) >> 1), k = (((cx - r) % 3) + 3) % 3;
      const cc = k === 2 ? col(pal[0]).lerp(col(pal[1]), .5).offsetHSL(0, 0, .02) : col(pal[k]);
      this.tiles.setColorAt(r * 8 + c, cc);
    }
    this.tiles.instanceColor.needsUpdate = true;
    this.frame.material.color.set(t.side); this.rim.material.color.set(t.rim);
    this.islandMat.color.set(t.side);
    this.mid.material.color.set(t.accent);
    this.skyMat.uniforms.top.value.set(t.sky[0]); this.skyMat.uniforms.bot.value.set(t.sky[1]);
    this.motes.material.color.set(t.accent);
    this.benchBase.material.color.set(t.side);
    this.hl.material.color.set(t.accent);
    this.scene.fog = new THREE.Fog(t.fog, 28, 70);
    this.scene.background = col(t.sky[1]);
    this.buildDecor(t.decor, t);
  }

  buildDecor(kind, t) {
    this.decor.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.decor.clear();
    const add = (m, x, y, z) => { m.position.set(x, y, z); this.decor.add(m); return m; };
    const flat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true });
    const emis = (c, k = 1.2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: .4, flatShading: true });
    const ring = (i, n, r, cx, cz) => { const a = (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; };
    this.decorAnim = [];
    for (let i = 0; i < 16; i++) {
      let [x, z] = ring(i, 16, 7.2 + (i % 3) * .6, W / 2, END_Z / 2 + .3);
      if (z > BENCH_Z - 1 && x > -1.5 && x < W + 1.5) continue;       // không che hàng ghế chờ
      if (x > -.8 && x < W + .8 && z > -.8 && z < END_Z + .8) continue;          // không chồng lên bàn cờ
      if (kind === 'trees') {
        const h = 1 + (i % 3) * .5;
        add(new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, h * .5, 6), flat('#7a4a2a')), x, h * .25, z);
        add(new THREE.Mesh(new THREE.ConeGeometry(.5, h, 7), flat(i % 2 ? '#3f9a4a' : '#4fae52')), x, h * .5 + h * .3, z);
      } else if (kind === 'stalag') {
        const h = 1.2 + (i % 4) * .5;
        add(new THREE.Mesh(new THREE.ConeGeometry(.35, h, 5), flat('#5a4e6a')), x, h * .5, z);
        if (i % 3 === 0) add(new THREE.Mesh(new THREE.OctahedronGeometry(.25), emis('#b98aff')), x + .3, .3, z + .2);
      } else if (kind === 'ripples') {
        const m = add(new THREE.Mesh(new THREE.TorusGeometry(.4 + (i % 3) * .2, .03, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#d8f4ff', transparent: true, opacity: .7 })), x, .05, z);
        this.decorAnim.push(m);
        if (i % 4 === 0) add(new THREE.Mesh(new THREE.DodecahedronGeometry(.4), flat('#7a8ea8')), x + .5, .15, z);
      } else if (kind === 'lava') {
        const h = .8 + (i % 3) * .5;
        add(new THREE.Mesh(new THREE.ConeGeometry(.45, h, 5), flat('#4a2a24')), x, h * .5, z);
        add(new THREE.Mesh(new THREE.SphereGeometry(.12, 6, 6), emis('#ff7a2a', 2)), x, h + .05, z);
      } else if (kind === 'crystals') {
        const h = 1 + (i % 4) * .45;
        const m = add(new THREE.Mesh(new THREE.OctahedronGeometry(.35, 0), emis(i % 2 ? '#8fe8ff' : '#c8f4ff', .6)), x, h * .5 + .2, z); m.scale.y = h * 1.6;
      } else if (kind === 'orbs') {
        const m = add(new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 0), emis(i % 2 ? '#ff9aff' : '#9ab0ff', 1.4)), x, 1.2 + (i % 3) * .5, z);
        m.userData.ph = i; this.decorAnim.push(m);
      }
    }
  }

  highlight(pos, color) { if (!pos) { this.hl.visible = false; return; } this.hl.visible = true; this.hl.position.set(pos.x, .02, pos.z); if (color) this.hl.material.color.set(color); }
  padGlow(i, on) { const p = this.benchPads[i]; if (p) p.ring.material.color.set(on ? '#ffe14a' : '#ff4a4a'); }

  // Hoạt ảnh mở đầu: các ô lục giác trồi lên theo sóng lan từ tâm, rồi khung, ghế chờ và trang trí hiện dần. t = giây từ lúc bắt đầu; t >= 5 là trạng thái cuối.
  setIntro(t) {
    const done = t >= 5;
    if (done && this._introDone) return;
    this._introDone = done;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
    const ease = k => { k = Math.max(0, Math.min(1, k)); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };   // easeOutBack
    for (let r = 0; r < 8; r++) for (let c = 0; c < COLS; c++) {
      const p = center(c, r), e = done ? 1 : ease((t - (.2 + Math.hypot(p.x - W / 2, p.z - END_Z / 2) * .13)) / .75);
      pos.set(p.x, -.08 - (1 - Math.min(1, e)) * 5, p.z); const s = Math.max(.001, e); sc.set(s, s, s);
      m.compose(pos, q, sc); this.tiles.setMatrixAt(r * 8 + c, m);
    }
    this.tiles.instanceMatrix.needsUpdate = true; this.tiles.frustumCulled = false;
    const sh = done || t > 1.5; this.frame.visible = this.rim.visible = this.mid.visible = sh;
    this.bench.visible = done || t > 1.9;
    this.cone.scale.setScalar(done ? 1 : Math.max(.001, ease((t - .6) / 1.2)));
    this.decor.scale.setScalar(done ? 1 : Math.max(.001, ease((t - 1.6) / .9)));
  }

  update(dt, t) {
    if (this.hl.visible) { this.hl.material.opacity = .42 + .22 * Math.sin(t * 7); }
    for (const r of this.rocks) r.position.y = r.userData.base.y + Math.sin(t * .6 + r.userData.ph) * .25;
    for (const c of this.clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 30) c.position.x = -30; }
    const p = this.motes.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { p.array[i * 3 + 1] = this.moteBase[i * 3 + 1] + Math.sin(t * .8 + i) * .3; p.array[i * 3] = this.moteBase[i * 3] + Math.sin(t * .3 + i * 1.7) * .4; }
    p.needsUpdate = true;
    for (const m of this.decorAnim || []) {
      if (m.geometry.type === 'TorusGeometry') { const s = 1 + ((t * .5 + m.position.x) % 1) * .5; m.scale.set(s, 1, s); m.material.opacity = .7 * (1 - ((t * .5 + m.position.x) % 1)); }
      else if (m.userData.ph !== undefined) { m.position.y = 1.4 + Math.sin(t + m.userData.ph) * .3; m.rotation.y = t * .5; }
    }
  }
}
