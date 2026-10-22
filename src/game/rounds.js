// Lịch các vòng: vòng PvE (Pokémon hoang dã) và vòng PvP (đấu với đối thủ).

// Vòng PvE: 1, 2, 3, rồi cứ 5 vòng một lần kể từ vòng 6 (6, 11, 16, ...)
export const isPve = r => r <= 3 || (r >= 6 && (r - 6) % 5 === 0);

const W = (key, cost, mult, star = 1) => ({ wild: key, cost, mult, star });
const PVE = {
  1: { name: 'Rattata hoang dã', units: [W('rattata', 1, .55), W('rattata', 1, .55)], drop: 1 },
  2: { name: 'Bầy chim non', units: [W('rattata', 1, .8), W('spearow', 1, .8), W('spearow', 1, .8)], drop: 1 },
  3: { name: 'Ổ sâu bọ', units: [W('weedle', 1, .9), W('weedle', 1, .9), W('kakuna', 1, .9), W('beedrill', 1, .9)], drop: 1 },
  6: { name: 'Đàn thú hoang', units: [W('tauros', 3, 1), W('miltank', 3, 1), W('kangaskhan', 3, 1)], drop: 2 },
  11: { name: 'Thú hoang hung dữ', units: [W('rhydon', 4, 1.1), W('tauros', 4, 1.1), W('kangaskhan', 4, 1.1), W('miltank', 4, 1.1)], drop: 2 },
  16: { name: 'Chúa tể hoang dã', units: [W('rhydon', 5, 1.15), W('tauros', 5, 1.15), W('kangaskhan', 5, 1.15), W('miltank', 5, 1.15), W('beedrill', 5, 1.15)], drop: 2 }
};

// Trả về mô tả vòng đấu
export function roundInfo(r) {
  const pve = isPve(r);
  let prep = r === 1 ? 45 : r <= 3 ? 30 : 32;
  if (!pve) return { round: r, pve: false, prep, drop: r % 3 === 0 ? 1 : 0 };
  const def = PVE[r] || { name: 'Chúa tể hoang dã', units: PVE[16].units.map(u => ({ ...u, mult: 1.15 + (r - 16) * .02 })), drop: 2 };
  return { round: r, pve: true, prep, name: def.name, units: def.units, drop: def.drop };
}

// Sát thương gây cho bên thua ở vòng PvP: nền theo vòng + số Pokémon còn sống của bên thắng
export function baseDamage(r) { return r <= 5 ? 1 : r <= 8 ? 2 : r <= 12 ? 3 : r <= 16 ? 5 : r <= 20 ? 7 : 9; }

// Thế giới (sân đấu) đổi theo vòng cho đỡ nhàm
export const ARENAS = ['grass', 'cave', 'water', 'volcano', 'ice', 'psychic'];
