// Âm thanh: nhạc nền, hiệu ứng, tiếng kêu Pokémon... đều TỰ TỔNG HỢP bằng Web Audio (không dùng bản ghi có bản quyền).
// Người chơi có thể tự thêm file âm thanh riêng vào public/audio-user/ (xem README ở đó); nếu có thì sẽ được ưu tiên dùng.
import FORMS from '../data/generated/forms.json';

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// Hệ -> tông âm cơ bản (MIDI) và kiểu sóng cho chiêu thức
const TYPE_SND = {
  Normal: [60, 'triangle'], Fire: [55, 'sawtooth'], Water: [64, 'sine'], Grass: [67, 'triangle'], Electric: [76, 'square'], Ice: [79, 'sine'],
  Fighting: [48, 'square'], Poison: [52, 'sawtooth'], Ground: [43, 'sawtooth'], Flying: [72, 'triangle'], Psychic: [70, 'sine'], Bug: [74, 'square'],
  Rock: [45, 'square'], Ghost: [58, 'sine'], Dragon: [50, 'sawtooth'], Dark: [46, 'triangle'], Steel: [62, 'square'], Fairy: [81, 'sine']
};

export class Audio {
  constructor() {
    this.ctx = null; this.vol = { music: .6, sfx: .8 };
    try { const s = JSON.parse(localStorage.getItem('pac3d.audio') || 'null'); if (s) Object.assign(this.vol, s); } catch (e) { }
    this.mood = null; this.user = { bgm: {}, cries: {}, sfx: {} }; this.userSrc = null; this.lastCry = 0; this.voices = 0;
    this.muted = false;
  }

  // phải gọi sau một thao tác của người dùng (chính sách trình duyệt)
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1;
    const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.musicG = this.ctx.createGain(); this.musicG.gain.value = this.vol.music * .5; this.musicG.connect(this.master);
    this.sfxG = this.ctx.createGain(); this.sfxG.gain.value = this.vol.sfx; this.sfxG.connect(this.master);
    this.reverb = this.makeReverb(); this.reverb.connect(this.sfxG);
    this.noiseBuf = this.makeNoise();
    this.loadUser();
    if (this.mood) { const m = this.mood; this.mood = null; this.music(m); }
  }
  save() { try { localStorage.setItem('pac3d.audio', JSON.stringify(this.vol)); } catch (e) { } }
  setVolume(kind, v) {
    this.vol[kind] = v; this.save();
    if (!this.ctx) return;
    if (kind === 'music') this.musicG.gain.value = v * .5; else this.sfxG.gain.value = v;
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 1; return this.muted; }

  makeNoise() { const n = this.ctx.sampleRate, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  makeReverb() {
    const c = this.ctx, len = c.sampleRate * 1.1, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const cv = c.createConvolver(); cv.buffer = b; const g = c.createGain(); g.gain.value = .35; cv.connect(g); const inp = c.createGain(); inp.connect(cv); inp.out = g; g.connect(this.sfxG); return inp;
  }

  // ---------- âm thanh người chơi tự thêm ----------
  async loadUser() {
    try {
      const r = await fetch('audio-user/manifest.json', { cache: 'no-cache' }); if (!r.ok) return;
      const man = await r.json(); this.userSrc = man;
      const dec = async url => { const x = await fetch('audio-user/' + url); if (!x.ok) throw 0; return this.ctx.decodeAudioData(await x.arrayBuffer()); };
      for (const k in (man.bgm || {})) dec(man.bgm[k]).then(b => { this.user.bgm[k] = b; if (this.mood === k) { this.mood = null; this.music(k); } }).catch(() => { });
      for (const k in (man.cries || {})) dec(man.cries[k]).then(b => { this.user.cries[k] = b; }).catch(() => { });
      for (const k in (man.sfx || {})) dec(man.sfx[k]).then(b => { this.user.sfx[k] = b; }).catch(() => { });
      console.info('[audio] Đã tìm thấy audio-user/manifest.json, sẽ dùng file âm thanh riêng của bạn.');
    } catch (e) { /* không có file riêng: dùng âm thanh tổng hợp */ }
  }
  playBuffer(buf, { vol = 1, loop = false, bus = this.sfxG, rate = 1 } = {}) {
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = buf; s.loop = loop; s.playbackRate.value = rate; g.gain.value = vol; s.connect(g); g.connect(bus); s.start(); return { s, g };
  }

  // ---------- khối âm cơ bản ----------
  tone({ f, f2, dur = .2, type = 'square', vol = .2, at = 0, attack = .005, rev = 0, lp = 0, vib = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6; lg.gain.value = f * vib; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + .05); }
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    let out = g; o.connect(g);
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; g.connect(fl); out = fl; }
    out.connect(this.sfxG); if (rev && this.reverb) { const rg = c.createGain(); rg.gain.value = rev; out.connect(rg); rg.connect(this.reverb); }
    o.start(t0); o.stop(t0 + dur + .05);
  }
  noise({ dur = .15, vol = .2, at = 0, type = 'bandpass', f = 1500, f2, q = 1, rev = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + at, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur); fl.Q.value = q;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfxG); if (rev && this.reverb) { const rg = c.createGain(); rg.gain.value = rev; g.connect(rg); rg.connect(this.reverb); }
    s.start(t0, Math.random() * .5); s.stop(t0 + dur + .05);
  }

  // ---------- hiệu ứng ----------
  sfx(name, p = {}) {
    if (!this.ctx || this.muted) return;
    if (this.user.sfx[name]) { this.playBuffer(this.user.sfx[name], { vol: .9 }); return; }
    const T = (o) => this.tone(o), N = (o) => this.noise(o);
    switch (name) {
      case 'click': T({ f: 900, f2: 600, dur: .05, type: 'square', vol: .07 }); break;
      case 'pick': T({ f: 520, dur: .06, type: 'triangle', vol: .12 }); T({ f: 780, dur: .08, type: 'triangle', vol: .1, at: .04 }); break;
      case 'drop': T({ f: 420, f2: 300, dur: .09, type: 'triangle', vol: .14 }); N({ dur: .05, vol: .06, f: 600 }); break;
      case 'error': T({ f: 180, f2: 120, dur: .18, type: 'sawtooth', vol: .12 }); break;
      case 'buy': T({ f: 988, dur: .07, type: 'square', vol: .12 }); T({ f: 1319, dur: .16, type: 'square', vol: .12, at: .06, rev: .2 }); break;
      case 'sell': T({ f: 1319, dur: .07, type: 'square', vol: .1 }); T({ f: 880, dur: .14, type: 'square', vol: .1, at: .06 }); T({ f: 660, dur: .16, type: 'square', vol: .08, at: .12 }); break;
      case 'roll': for (let i = 0; i < 5; i++) T({ f: 500 + i * 90 + Math.random() * 60, dur: .05, type: 'square', vol: .06, at: i * .035 }); N({ dur: .22, vol: .07, f: 3000, f2: 800 }); break;
      case 'xp': T({ f: 440, f2: 880, dur: .18, type: 'triangle', vol: .12 }); break;
      case 'levelup': [60, 64, 67, 72, 76].forEach((m, i) => T({ f: mtof(m + 12), dur: .22, type: 'triangle', vol: .13, at: i * .07, rev: .3 })); break;
      case 'item': T({ f: 660, dur: .06, type: 'square', vol: .1 }); T({ f: 990, dur: .12, type: 'triangle', vol: .12, at: .05, rev: .2 }); break;
      case 'combine': [72, 76, 79, 84].forEach((m, i) => T({ f: mtof(m), dur: .2, type: 'square', vol: .09, at: i * .06, rev: .3 })); break;
      case 'star2': case 'star3': {
        const base = name === 'star3' ? 67 : 64; const n = name === 'star3' ? 8 : 5;
        for (let i = 0; i < n; i++) T({ f: mtof(base + [0, 4, 7, 12, 16, 19, 24, 28][i]), dur: .3, type: 'triangle', vol: .12, at: i * .075, rev: .4 });
        N({ dur: .5, vol: .06, f: 6000, f2: 12000, type: 'highpass', at: .1 }); break;
      }
      case 'ready': T({ f: 523, dur: .08, type: 'square', vol: .1 }); T({ f: 784, dur: .14, type: 'square', vol: .1, at: .08 }); break;
      case 'fight': N({ dur: .35, vol: .16, f: 400, f2: 2500, q: .7 }); T({ f: 220, f2: 440, dur: .3, type: 'sawtooth', vol: .1 }); T({ f: 660, dur: .25, type: 'square', vol: .08, at: .15 }); break;
      case 'tick': T({ f: 1000, dur: .05, type: 'square', vol: .08 }); break;
      case 'swing': if (Math.random() < .5) N({ dur: .09, vol: .05, f: 2400, f2: 900, q: 1.2 }); break;
      case 'hit': {
        const [m] = TYPE_SND[p.type] || TYPE_SND.Normal, v = p.crit ? .22 : p.ability ? .16 : .1;
        N({ dur: p.crit ? .16 : .09, vol: v, f: p.crit ? 700 : 1200, f2: 200, q: .8, type: 'lowpass' });
        T({ f: mtof(m + 12) * (p.eff === 'super' ? 1.5 : 1), f2: mtof(m) * .5, dur: .1, type: 'square', vol: v * .5 });
        if (p.eff === 'super') T({ f: 1400, f2: 2200, dur: .1, type: 'triangle', vol: .07, at: .02 });
        break;
      }
      case 'cast': {
        const [m, w] = TYPE_SND[p.type] || TYPE_SND.Normal;
        T({ f: mtof(m + 12), f2: mtof(m + 24), dur: .35, type: w, vol: .13, rev: .3 });
        T({ f: mtof(m + 19), f2: mtof(m + 7), dur: .4, type: 'triangle', vol: .08, at: .08, rev: .3 });
        N({ dur: .4, vol: .08, f: 500, f2: 4000, q: 1.4, rev: .2 }); break;
      }
      case 'faint': T({ f: 440, f2: 110, dur: .35, type: 'triangle', vol: .12 }); N({ dur: .2, vol: .06, f: 1500, f2: 300 }); break;
      case 'quake': N({ dur: .5, vol: .22, f: 220, f2: 60, type: 'lowpass', q: .6 }); T({ f: 70, f2: 35, dur: .5, type: 'sine', vol: .25 }); break;
      case 'boom': N({ dur: .6, vol: .26, f: 600, f2: 50, type: 'lowpass' }); T({ f: 90, f2: 30, dur: .45, type: 'sine', vol: .3 }); break;
      case 'leap': T({ f: 300, f2: 900, dur: .25, type: 'triangle', vol: .1 }); break;
      case 'blink': T({ f: 1400, f2: 300, dur: .15, type: 'sine', vol: .12 }); T({ f: 300, f2: 1600, dur: .15, type: 'sine', vol: .12, at: .1 }); break;
      case 'win': [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => T({ f: mtof(m), dur: .25, type: 'square', vol: .1, at: i * .11, rev: .3 })); break;
      case 'lose': [64, 62, 60, 55].forEach((m, i) => T({ f: mtof(m), dur: .35, type: 'triangle', vol: .13, at: i * .22, rev: .4 })); break;
      case 'damage': T({ f: 150, f2: 70, dur: .3, type: 'sawtooth', vol: .15 }); N({ dur: .25, vol: .14, f: 800, f2: 120, type: 'lowpass' }); break;
    }
  }

  // ---------- tiếng kêu Pokémon (tổng hợp, ổn định theo số Pokédex) ----------
  cry(dex, { vol = 1, quiet = false } = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime; if (now - this.lastCry < (quiet ? .35 : .08) || this.voices > 3) return; this.lastCry = now;
    if (this.user.cries[dex]) { this.playBuffer(this.user.cries[dex], { vol: .8 * vol }); return; }
    const f = FORMS[dex]; if (!f) return;
    const r = rng(dex * 7919 + 13);
    const size = Math.max(.2, Math.min(9, f.height)), heavy = Math.max(1, Math.min(300, f.weight));
    // nhỏ/nhẹ -> cao; to/nặng -> trầm
    let base = 880 / Math.pow(size + .4, .55) / Math.pow(heavy / 20 + 1, .12) * (.85 + r() * .4);
    base = Math.max(110, Math.min(1100, base));
    const types = f.types, wave = types.includes('Electric') || types.includes('Bug') ? 'square' : types.includes('Ghost') || types.includes('Psychic') || types.includes('Fairy') ? 'sine' : types.includes('Dragon') || types.includes('Fire') || types.includes('Dark') ? 'sawtooth' : r() < .5 ? 'triangle' : 'square';
    const syl = 1 + Math.floor(r() * 3), c = this.ctx, v = Math.min(.2, .16 * vol) * (quiet ? .6 : 1);
    this.voices++; setTimeout(() => this.voices--, 500 + syl * 150);
    let t = 0;
    for (let i = 0; i < syl; i++) {
      const dur = .12 + r() * .16 + (size > 2 ? .18 : 0), up = r() < .5;
      const f1 = base * (up ? .8 : 1.15) * (1 + i * .08), f2 = base * (up ? 1.3 : .75) * (1 + i * .1);
      const t0 = c.currentTime + t, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
      o.type = wave; o.frequency.setValueAtTime(f1, t0); o.frequency.linearRampToValueAtTime(f2, t0 + dur);
      fl.type = 'bandpass'; fl.Q.value = 2.2; fl.frequency.setValueAtTime(base * 2.2, t0); fl.frequency.linearRampToValueAtTime(base * (r() < .5 ? 3.4 : 1.6), t0 + dur);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 7 + r() * 8; lg.gain.value = base * .03; l.connect(lg); lg.connect(o.frequency);
      o.connect(fl); fl.connect(g); g.connect(this.sfxG); const rg = c.createGain(); rg.gain.value = .25; g.connect(rg); rg.connect(this.reverb);
      o.start(t0); l.start(t0); o.stop(t0 + dur + .05); l.stop(t0 + dur + .05); t += dur * .85;
    }
  }

  // ---------- nhạc nền (sáng tác riêng, tổng hợp theo thời gian thực) ----------
  music(mood) {
    if (this.mood === mood) return;
    this.mood = mood; if (!this.ctx) return;
    this.stopMusic();
    if (this.user.bgm[mood]) { this.cur = this.playBuffer(this.user.bgm[mood], { vol: 1, loop: !['victory', 'defeat'].includes(mood), bus: this.musicG }); return; }
    if (!SONGS[mood]) return;
    const song = SONGS[mood]; this.song = { def: song, step: 0, next: this.ctx.currentTime + .1, id: (this.songId = (this.songId || 0) + 1) };
    this.schedule(this.song.id);
  }
  stopMusic() {
    this.songId = (this.songId || 0) + 1; this.song = null; clearTimeout(this.timer);
    if (this.cur) { try { this.cur.g.gain.setTargetAtTime(0, this.ctx.currentTime, .15); this.cur.s.stop(this.ctx.currentTime + .6); } catch (e) { } this.cur = null; }
  }
  schedule(id) {
    const S = this.song; if (!S || S.id !== id || !this.ctx) return;
    const d = S.def, spb = 60 / d.bpm / 4;      // một bước = nốt móc kép
    while (S.next < this.ctx.currentTime + .35) {
      this.playStep(d, S.step, S.next, spb);
      S.step++; S.next += spb;
      if (d.once && S.step >= d.len * 16) { this.timer = setTimeout(() => { if (this.song && this.song.id === id) this.mood = null; }, 100); return; }
    }
    this.timer = setTimeout(() => this.schedule(id), 60);
  }
  mt({ f, dur, type, vol, at, lp }) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + .008); g.gain.exponentialRampToValueAtTime(.0001, at + dur);
    let out = g; o.connect(g); if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; g.connect(fl); out = fl; }
    out.connect(this.musicG); o.start(at); o.stop(at + dur + .03);
  }
  mdrum(kind, at, vol) {
    const c = this.ctx;
    if (kind === 'k') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(40, at + .12); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(.0001, at + .16); o.connect(g); g.connect(this.musicG); o.start(at); o.stop(at + .2); }
    else { const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; fl.type = kind === 'h' ? 'highpass' : 'bandpass'; fl.frequency.value = kind === 'h' ? 7000 : 1800; g.gain.setValueAtTime(vol * (kind === 'h' ? .5 : 1), at); g.gain.exponentialRampToValueAtTime(.0001, at + (kind === 'h' ? .04 : .12)); s.connect(fl); fl.connect(g); g.connect(this.musicG); s.start(at, Math.random() * .4); s.stop(at + .16); }
  }
  playStep(d, step, at, spb) {
    const bar = Math.floor(step / 16) % d.chords.length, st = step % 16, ch = d.chords[bar];
    // bass
    if (d.bass.includes(st)) this.mt({ f: mtof(ch[0] - 24), dur: spb * 3.2, type: 'triangle', vol: .24, at, lp: 600 });
    // rải hợp âm
    if (d.arp && st % d.arp.every === 0) { const k = (st / d.arp.every) % d.arp.pat.length; this.mt({ f: mtof(ch[d.arp.pat[k] % ch.length] + 12 + (d.arp.pat[k] >= ch.length ? 12 : 0)), dur: spb * 1.6, type: d.arp.wave || 'square', vol: d.arp.vol || .05, at, lp: 3000 }); }
    // giai điệu
    const mel = d.lead[bar % d.lead.length]; if (mel) { const n = mel[st]; if (n != null) this.mt({ f: mtof(n + (d.leadOct || 0)), dur: spb * (d.legato || 2.4), type: d.leadWave || 'square', vol: d.leadVol || .07, at, lp: 3500 }); }
    // trống
    if (d.drums) { const pat = d.drums; if (pat.k.includes(st)) this.mdrum('k', at, .3); if (pat.s.includes(st)) this.mdrum('s', at, .12); if (pat.h.includes(st)) this.mdrum('h', at, .1); }
  }
}

// Hợp âm: số MIDI gốc + loại. null = nghỉ
const maj = r => [r, r + 4, r + 7, r + 12], min = r => [r, r + 3, r + 7, r + 12];
const L = (...a) => { const o = Array(16).fill(null); for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; return o; };
const SONGS = {
  // Màn hình chính: ấm áp, phiêu lưu
  menu: {
    bpm: 96, chords: [maj(60), maj(55), min(57), maj(53), maj(60), maj(55), maj(53), maj(55)], bass: [0, 6, 8, 14],
    arp: { every: 2, pat: [0, 1, 2, 3, 2, 1], wave: 'triangle', vol: .05 }, leadWave: 'square', leadVol: .055, legato: 3,
    lead: [L(0, 76, 4, 74, 6, 72, 8, 79, 12, 76), L(0, 74, 4, 71, 6, 74, 8, 79, 14, 78), L(0, 72, 4, 76, 8, 81, 12, 79), L(0, 77, 6, 76, 8, 74, 12, 72), L(0, 76, 4, 79, 8, 84, 12, 83), L(0, 79, 4, 74, 8, 71, 12, 74), L(0, 77, 4, 81, 8, 77, 12, 72), L(0, 74, 4, 71, 8, 67, 12, 71)],
    drums: { k: [0, 8], s: [], h: [4, 12] }
  },
  // Chuẩn bị: nhẹ nhàng, tập trung
  prep: {
    bpm: 108, chords: [maj(57), min(62), maj(55), maj(60), maj(57), min(62), maj(55), maj(64)], bass: [0, 3, 8, 11],
    arp: { every: 2, pat: [0, 2, 1, 3, 2, 1, 3, 2], wave: 'triangle', vol: .045 }, leadWave: 'triangle', leadVol: .09, legato: 3.5,
    lead: [L(0, 81, 6, 79, 8, 76, 12, 79), L(0, 77, 4, 74, 8, 77, 14, 81), L(0, 79, 6, 76, 8, 72, 12, 76), L(0, 79, 4, 84, 8, 83, 12, 79), L(0, 81, 6, 84, 8, 81, 12, 79), L(0, 77, 4, 81, 8, 79, 12, 77), L(0, 76, 4, 79, 8, 76, 12, 72), L(0, 84, 8, 83, 12, 79)],
    drums: { k: [0, 8], s: [4, 12], h: [2, 6, 10, 14] }
  },
  // Chiến đấu: dồn dập
  combat: {
    bpm: 148, chords: [min(57), min(53), maj(48), maj(55), min(57), min(53), maj(55), maj(52)], bass: [0, 2, 4, 6, 8, 10, 12, 14],
    arp: { every: 1, pat: [0, 2, 1, 3, 0, 2, 3, 1], wave: 'sawtooth', vol: .03 }, leadWave: 'square', leadVol: .06, legato: 1.8,
    lead: [L(0, 81, 2, 81, 4, 84, 6, 83, 8, 81, 12, 76), L(0, 77, 2, 77, 4, 81, 6, 79, 8, 77, 12, 72), L(0, 72, 2, 76, 4, 79, 6, 84, 8, 79, 12, 76), L(0, 79, 2, 79, 4, 83, 6, 81, 8, 79, 12, 74), L(0, 81, 4, 84, 6, 88, 8, 86, 12, 84), L(0, 84, 2, 81, 4, 77, 6, 81, 8, 84, 12, 89), L(0, 83, 4, 79, 8, 83, 10, 86, 12, 83), L(0, 76, 4, 79, 8, 76, 12, 71)],
    drums: { k: [0, 4, 8, 12], s: [4, 12], h: [2, 6, 10, 14, 15] }
  },
  victory: { once: true, len: 2, bpm: 132, chords: [maj(60), maj(65)], bass: [0, 8], leadWave: 'square', leadVol: .08, legato: 3, lead: [L(0, 72, 3, 76, 6, 79, 8, 84, 12, 79, 14, 84), L(0, 83, 4, 84, 8, 88)], drums: { k: [0, 8], s: [], h: [] } },
  defeat: { once: true, len: 2, bpm: 72, chords: [min(57), min(52)], bass: [0, 8], leadWave: 'triangle', leadVol: .1, legato: 5, lead: [L(0, 72, 4, 71, 8, 69, 12, 65), L(0, 64, 8, 57)], drums: null }
};
