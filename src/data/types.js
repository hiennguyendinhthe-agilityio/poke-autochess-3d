// 18 hệ Pokémon: màu, tên tiếng Việt, bảng tương khắc

export const TYPE_COL = { Normal: '#b8b78a', Fire: '#ee8130', Water: '#6390f0', Grass: '#7ac74c', Electric: '#f7d02c', Ice: '#96d9d6', Fighting: '#d0463a', Ground: '#e2bf65', Flying: '#a98ff3', Psychic: '#f95587', Rock: '#c4ae4a', Poison: '#b54fb3', Bug: '#a6b91a', Ghost: '#8a6ab8', Dragon: '#7a4cfc', Dark: '#8a6a58', Steel: '#b7b7ce', Fairy: '#e898c2' };
export const TYPE_VI = { Normal: 'Thường', Fire: 'Lửa', Water: 'Nước', Grass: 'Cỏ', Electric: 'Điện', Ice: 'Băng', Fighting: 'Giác Đấu', Ground: 'Đất', Flying: 'Bay', Psychic: 'Tâm Linh', Rock: 'Đá', Poison: 'Độc', Bug: 'Bọ', Ghost: 'Ma', Dragon: 'Rồng', Dark: 'Bóng Tối', Steel: 'Thép', Fairy: 'Tiên' };
export const TYPES = Object.keys(TYPE_COL);
// Chữ trên nền màu hệ: hệ tối dùng chữ trắng
export const TYPE_FG = t => ['Ghost', 'Dragon', 'Dark', 'Poison', 'Fighting'].includes(t) ? '#ffffff' : '#1a1020';

// Bảng tương khắc chuẩn (hệ tấn công -> hệ phòng thủ). Không ghi = 1
const CHART = {
  Normal: { Rock: .5, Ghost: 0, Steel: .5 },
  Fire: { Fire: .5, Water: .5, Grass: 2, Ice: 2, Bug: 2, Rock: .5, Dragon: .5, Steel: 2 },
  Water: { Fire: 2, Water: .5, Grass: .5, Ground: 2, Rock: 2, Dragon: .5 },
  Electric: { Water: 2, Electric: .5, Grass: .5, Ground: 0, Flying: 2, Dragon: .5 },
  Grass: { Fire: .5, Water: 2, Grass: .5, Poison: .5, Ground: 2, Flying: .5, Bug: .5, Rock: 2, Dragon: .5, Steel: .5 },
  Ice: { Fire: .5, Water: .5, Grass: 2, Ice: .5, Ground: 2, Flying: 2, Dragon: 2, Steel: .5 },
  Fighting: { Normal: 2, Ice: 2, Poison: .5, Flying: .5, Psychic: .5, Bug: .5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: .5 },
  Poison: { Grass: 2, Poison: .5, Ground: .5, Rock: .5, Ghost: .5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: .5, Poison: 2, Flying: 0, Bug: .5, Rock: 2, Steel: 2 },
  Flying: { Electric: .5, Grass: 2, Fighting: 2, Bug: 2, Rock: .5, Steel: .5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: .5, Dark: 0, Steel: .5 },
  Bug: { Fire: .5, Grass: 2, Fighting: .5, Poison: .5, Flying: .5, Psychic: 2, Ghost: .5, Dark: 2, Steel: .5, Fairy: .5 },
  Rock: { Fire: 2, Ice: 2, Fighting: .5, Ground: .5, Flying: 2, Bug: 2, Steel: .5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: .5 },
  Dragon: { Dragon: 2, Steel: .5, Fairy: 0 },
  Dark: { Fighting: .5, Psychic: 2, Ghost: 2, Dark: .5, Fairy: .5 },
  Steel: { Fire: .5, Water: .5, Electric: .5, Ice: 2, Rock: 2, Steel: .5, Fairy: 2 },
  Fairy: { Fire: .5, Fighting: 2, Poison: .5, Dragon: 2, Dark: 2, Steel: .5 }
};

// Hệ số gốc của chiêu hệ `t` đánh vào Pokémon có hệ `def` (tích của 2 hệ)
export const rawEff = (t, def) => def.reduce((m, d) => m * (CHART[t] && CHART[t][d] !== undefined ? CHART[t][d] : 1), 1);

// Trong auto chess, "miễn nhiễm" (0x) làm đòn đánh vô dụng nên được làm mềm:
// hệ số gốc -> hệ số sát thương thực tế
export function effMult(raw) {
  if (raw >= 4) return 1.6;
  if (raw >= 2) return 1.3;
  if (raw === 0) return .6;
  if (raw <= .25) return .7;
  if (raw <= .5) return .8;
  return 1;
}
export const effectiveness = (t, def) => effMult(rawEff(t, def));
// Nhãn hiển thị: 'super' | 'weak' | null
export const effLabel = raw => raw >= 2 ? 'super' : raw === 0 ? 'immune' : raw < 1 ? 'weak' : null;
