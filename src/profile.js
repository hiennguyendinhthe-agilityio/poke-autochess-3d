// Hồ sơ người chơi lưu TRÊN THIẾT BỊ (localStorage): tên, avatar Pokémon, thống kê, ván lưu riêng cho từng hồ sơ.
// Không có mật khẩu và không có máy chủ: ai dùng chung thiết bị đều đổi được hồ sơ. Không thu thập dữ liệu cá nhân.
const KEY = 'pac3d.profiles';
export const MAX_PROFILES = 8, MAX_NAME = 16;
// Avatar: số Pokédex (dạng có trong game, có sẵn ảnh chân dung)
export const AVATARS = [25, 6, 9, 3, 94, 131, 134, 196, 448, 150, 143, 149];

// Làm sạch tên: bỏ ký tự điều khiển và dấu < >, gộp khoảng trắng, cắt tối đa 16 ký tự
export const sanitizeName = s => [...String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim()].slice(0, MAX_NAME).join('').trim();

export class Profiles {
  // st: đối tượng có getItem / setItem / removeItem (localStorage hoặc bản giả khi test)
  constructor(st) {
    this.st = st; let d = null;
    try { d = JSON.parse(st.getItem(KEY) || 'null'); } catch (e) { d = null; }
    this.d = d && Array.isArray(d.list) ? d : { active: null, list: [] };
    if (!this.d.list.some(p => p.id === this.d.active)) this.d.active = null;
  }
  save() { try { this.st.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* bộ nhớ đầy hoặc bị chặn: bỏ qua */ } }
  get list() { return this.d.list; }
  get active() { return this.d.list.find(p => p.id === this.d.active) || null; }

  create(name, dex) {
    const nm = sanitizeName(name);
    if (!nm) return { ok: false, err: 'Hãy nhập tên' };
    if (this.d.list.length >= MAX_PROFILES) return { ok: false, err: `Tối đa ${MAX_PROFILES} hồ sơ` };
    if (this.d.list.some(p => p.name.toLowerCase() === nm.toLowerCase())) return { ok: false, err: 'Tên này đã có' };
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const p = { id, name: nm, dex: AVATARS.includes(dex) ? dex : AVATARS[0], created: Date.now(), stats: { games: 0, wins: 0, top4: 0, best: 0, rounds: 0 } };
    this.d.list.push(p); this.d.active = id; this.save();
    return { ok: true, profile: p };
  }
  update(id, { name, dex }) {
    const p = this.d.list.find(x => x.id === id); if (!p) return { ok: false, err: 'Không thấy hồ sơ' };
    if (name !== undefined) {
      const nm = sanitizeName(name); if (!nm) return { ok: false, err: 'Hãy nhập tên' };
      if (this.d.list.some(x => x.id !== id && x.name.toLowerCase() === nm.toLowerCase())) return { ok: false, err: 'Tên này đã có' };
      p.name = nm;
    }
    if (dex !== undefined && AVATARS.includes(dex)) p.dex = dex;
    this.save(); return { ok: true, profile: p };
  }
  select(id) { if (id === null || this.d.list.some(p => p.id === id)) { this.d.active = id; this.save(); return true; } return false; }
  remove(id) {
    const i = this.d.list.findIndex(p => p.id === id); if (i < 0) return false;
    try { this.st.removeItem(this.saveKey(id)); } catch (e) { }
    this.d.list.splice(i, 1); if (this.d.active === id) this.d.active = null; this.save(); return true;
  }
  // Khóa lưu ván: mỗi hồ sơ một ô riêng; chơi khách dùng ô cũ (tương thích bản trước)
  saveKey(id = this.d.active) { return id ? 'pac3d.save.' + id : 'pac3d.save'; }

  // Ghi nhận một ván đã kết thúc cho hồ sơ đang dùng. Trả về { newBest } hoặc null nếu đang chơi khách.
  record({ placement, rounds }) {
    const p = this.active; if (!p) return null;
    const s = p.stats; s.games++; s.rounds += Math.max(0, rounds | 0);
    if (placement === 1) s.wins++; if (placement <= 4) s.top4++;
    const newBest = !s.best || placement < s.best; if (newBest) s.best = placement;
    this.save(); return { newBest };
  }
  resetStats(id = this.d.active) { const p = this.d.list.find(x => x.id === id); if (p) { p.stats = { games: 0, wins: 0, top4: 0, best: 0, rounds: 0 }; this.save(); } }
}
