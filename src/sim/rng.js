// Bộ sinh số ngẫu nhiên có seed (mulberry32): cùng seed -> cùng kết quả, dùng cho trận đấu và lưu/tải game.
export function mulberry32(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.state = () => a;
  f.setState = s => { a = s >>> 0; };
  f.int = n => Math.floor(f() * n);
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  return f;
}
