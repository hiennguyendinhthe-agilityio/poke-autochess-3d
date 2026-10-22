// Chọn / kéo-thả Pokémon trên cảnh 3D (chuột + cảm ứng) và phím tắt.
import { sellValue } from '../game/state.js';
import { LINE } from '../data/roster.js';

export class Input {
  constructor(app) {
    this.app = app; this.cand = null; this.dragging = false;
    const c = app.world.canvas;
    c.addEventListener('pointerdown', e => this.down(e));
    addEventListener('pointermove', e => this.move(e));
    addEventListener('pointerup', e => this.up(e));
    addEventListener('pointercancel', e => this.up(e, true));
    addEventListener('keydown', e => this.key(e));
  }

  canGrab(v) {
    const a = this.app; if (!v || !v.unit) return false;
    if (a.phase === 'prep') return true;
    return v.zone === 'bench';       // lúc đang đánh chỉ chỉnh được băng ghế
  }

  down(e) {
    const a = this.app; if (a.screenOpen) return;
    a.audio.init();
    if (e.button === 2) return;
    const v = a.world.pickUnit(e.clientX, e.clientY, 0);
    if (v && v.unit) { this.cand = { v, x: e.clientX, y: e.clientY }; }
    else {
      const ev = a.world.pickUnit(e.clientX, e.clientY, 1);
      this.cand = null;
      if (ev && ev.key[0] === 'e') { const id = +ev.key.slice(1); a.hud.showInfo({ enemy: id }); return; }
      a.hud.hideInfo(true);
    }
  }
  move(e) {
    const a = this.app, w = a.world;
    if (!this.cand) {
      if (!a.screenOpen && e.target === w.canvas) { const v = w.pickUnit(e.clientX, e.clientY, 0); a.hoverId = v && v.unit ? v.unit.id : 0; w.canvas.style.cursor = v ? 'grab' : 'default'; }
      return;
    }
    const dx = e.clientX - this.cand.x, dy = e.clientY - this.cand.y;
    if (!this.dragging && Math.hypot(dx, dy) > 7 && this.canGrab(this.cand.v)) {
      this.dragging = true; w.startDrag(this.cand.v.key); a.audio.sfx('pick'); a.hud.hideTip();
      a.hud.setSell(true, false, 0); a.hud.hideInfo(false);
    }
    if (this.dragging) {
      const cell = w.moveDrag(e.clientX, e.clientY);
      const r = a.hud.sellRect(), onSell = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      const u = this.cand.v.unit;
      a.hud.setSell(true, !!onSell, sellValue(LINE[u.key].cost, u.star));
      this.target = onSell ? { sell: true } : cell;
      const ok = cell && (onSell || this.dropOk(u, cell));
      w.highlightCell(onSell ? null : cell, ok);
      w.canvas.style.cursor = 'grabbing';
    }
  }
  dropOk(u, cell) {
    const a = this.app, g = a.match.g;
    if (a.phase !== 'prep' && cell.zone === 'board') return false;
    const p = g.find(u.id); if (!p) return false;
    if (cell.zone === 'board' && p.zone === 'bench' && !g.board[cell.idx] && g.boardCount() >= g.cap) return false;
    return true;
  }
  up(e, cancel) {
    const a = this.app, w = a.world;
    if (!this.cand) return;
    const { v } = this.cand, u = v.unit; this.cand = null;
    if (this.dragging) {
      this.dragging = false; const t = this.target; this.target = null;
      w.endDrag(); a.hud.setSell(false, false, 0); w.canvas.style.cursor = 'default';
      if (cancel) return a.refreshView();
      if (t && t.sell) return a.sell(u.id);
      if (t && this.dropOk(u, t)) return a.moveUnit(u.id, { zone: t.zone, idx: t.idx });
      if (t && t.zone === 'board' && a.phase === 'prep') { a.audio.sfx('error'); a.hud.toast(`Cấp ${a.match.g.level}: tối đa ${a.match.g.cap} Pokémon trên sân`); }
      return a.refreshView();
    }
    // chỉ bấm: chọn
    a.hud.showInfo({ id: u.id }); a.audio.sfx('click');
    a.audio.cry(v.actor.dex, { quiet: true });
  }

  key(e) {
    const a = this.app; if (a.screenOpen || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (a.screen) return;
    const k = e.key.toLowerCase();
    if (k === 'd') a.reroll();
    else if (k === 'f') a.buyXp();
    else if (k === 'l') a.toggleLock();
    else if (k === 'e') { const id = a.hoverId || (a.hud.sel && a.hud.sel.id); if (id) a.sell(id); }
    else if (k === ' ') { e.preventDefault(); a.ready(); }
    else if (k === 'escape') a.openMenu();
    else if (k >= '1' && k <= '5') a.buy(+k - 1);
  }
}
