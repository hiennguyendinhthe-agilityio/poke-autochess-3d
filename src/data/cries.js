import FORMS from './generated/forms.json';
// Lời thoại "tiếng kêu" hiển thị trên bong bóng khi Pokémon dùng chiêu (chữ, không dùng bản ghi âm)
const CUSTOM = {
  25: 'Pika Pika!', 172: 'Pi-chu!', 26: 'Rai Rai!', 52: 'Nyaa! Meowth!', 53: 'Nyaaa!', 360: 'Wobba!', 202: 'Wobbuffet!',
  1: 'Bulba!', 2: 'Ivy!', 3: 'Venu!', 4: 'Char!', 5: 'Chaaar!', 6: 'Gwaaaa!', 7: 'Squirtle!', 8: 'Warrr!', 9: 'Blaaas!',
  129: 'Tạch tạch...', 130: 'GWAAAA!', 143: 'Snooorr!', 446: 'Mun...', 150: 'Mew... two.', 151: 'Mew!', 132: 'Dit...',
  92: 'Gas Gas!', 93: 'Haun...', 94: 'Gen-gar!', 23: 'Sshhh!', 24: 'Arbok!', 109: 'Koff koff!', 110: 'Wee-zing!'
};
export function cryText(line, dex) {
  if (CUSTOM[dex]) return CUSTOM[dex];
  const f = FORMS[dex];
  return f ? f.name + '!' : null;
}
