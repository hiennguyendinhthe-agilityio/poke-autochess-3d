// Hình học bàn cờ LỤC GIÁC (đỉnh nhọn hướng lên, các hàng lẻ lệch phải nửa ô). Thuần toán học, dùng chung cho engine và hiển thị.
// Ô (c, r): c = cột 0..7, r = hàng toàn cục 0..7 (hàng 0-3 là nửa của đội 1 ở trên, hàng 4-7 là nửa của người chơi ở dưới).
export const COLS = 8, ROWS = 8, CELLS = COLS * ROWS;
export const H = Math.sqrt(3) / 2;            // khoảng cách giữa hai hàng (khi cạnh ô = 1/√3)
export const RAD = 1 / Math.sqrt(3);          // bán kính ngoại tiếp của ô
export const Z0 = RAD;                        // toạ độ z của hàng 0
export const W = COLS + .5;                   // chiều rộng bàn cờ
export const MID_Z = Z0 + 3.5 * H;            // đường giữa sân (giữa hàng 3 và 4)
export const END_Z = Z0 + (ROWS - 1) * H + RAD; // mép dưới bàn cờ
export const BENCH_Z = END_Z + .95;

export const center = (c, r) => ({ x: c + .5 + (r & 1 ? .5 : 0), z: Z0 + r * H });
export const idx = (c, r) => r * COLS + c;

// Ô toàn cục từ toạ độ "của đội": hàng 0 = sát đối thủ. Đội 1 được xoay 180° quanh tâm bàn cờ.
export const toGlobal = (team, c, r) => team === 0 ? { c, r: 4 + r } : { c: COLS - 1 - c, r: 3 - r };

// Khoảng cách theo số ô (qua toạ độ khối)
export function dist(c1, r1, c2, r2) {
  const x1 = c1 - ((r1 - (r1 & 1)) >> 1), x2 = c2 - ((r2 - (r2 & 1)) >> 1);
  const dx = x1 - x2, dz = r1 - r2, dy = -dx - dz;
  return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
}

// 6 ô kề (chỉ số) của mọi ô
const EVEN = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]], ODD = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];
export const NB = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const out = [];
  for (const [dc, dr] of (r & 1 ? ODD : EVEN)) { const cc = c + dc, rr = r + dr; if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS) out.push(idx(cc, rr)); }
  NB[idx(c, r)] = out;
}

// Ô gần điểm (x, z) nhất: { c, r, d2 } (d2 = bình phương khoảng cách tới tâm ô)
export function nearestCell(x, z) {
  const r0 = Math.round((z - Z0) / H); let best = null;
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    if (r < 0 || r >= ROWS) continue;
    const c = Math.max(0, Math.min(COLS - 1, Math.round(x - .5 - (r & 1 ? .5 : 0)))), p = center(c, r);
    const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (!best || d2 < best.d2) best = { c, r, d2 };
  }
  return best;
}
