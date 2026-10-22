// Các kiểu kỹ năng. `pow` = sức mạnh kỹ năng đã nhân theo giá, sao và sức mạnh kỹ năng (ap).
// nums(pow) cho ra con số dùng cho cả mô phỏng lẫn mô tả -> không bao giờ lệch nhau.
const r = Math.round;

export const ABILITY_KINDS = {
  bolt: {
    mana: 50, cast: .45, nums: p => ({ dmg: r(p * 1.3) }),
    desc: n => `Gây ${n.dmg} sát thương phép lên mục tiêu.`
  },
  stun: {
    mana: 60, cast: .45, nums: p => ({ dmg: r(p * .9), stun: 1.5 }),
    desc: n => `Gây ${n.dmg} sát thương và làm choáng mục tiêu ${n.stun}s.`
  },
  chain: {
    mana: 60, cast: .45, nums: p => ({ dmg: r(p * .85), hits: 4, decay: .8 }),
    desc: n => `Tia điện nảy qua ${n.hits} kẻ địch, gây ${n.dmg} sát thương (giảm dần mỗi lần nảy).`
  },
  beam: {
    mana: 70, cast: .6, nums: p => ({ dmg: r(p * .95), width: .9 }),
    desc: n => `Bắn tia xuyên thẳng, gây ${n.dmg} sát thương cho mọi kẻ địch trên đường.`
  },
  burst: {
    mana: 60, cast: .5, nums: p => ({ dmg: r(p * .85), radius: 1.5, slow: .4, dur: 3, dot: p * .45 }),
    desc: (n, fx) => `Nổ vùng quanh mục tiêu, gây ${n.dmg} sát thương${fx === 'web' ? ' và làm chậm ' + Math.round(n.slow * 100) + '%' : fx === 'poison' ? ', kèm độc ' + n.dot + '/5s' : fx === 'burn' ? ', kèm bỏng ' + n.dot + '/5s' : ''}.`
  },
  nova: {
    mana: 60, cast: .5, nums: p => ({ dmg: r(p * .85), radius: 2.1, slow: .3, dur: 3 }),
    desc: n => `Sóng năng lượng quanh mình: ${n.dmg} sát thương, làm chậm ${Math.round(n.slow * 100)}% trong ${n.dur}s.`
  },
  volley: {
    mana: 60, cast: .5, nums: p => ({ dmg: r(p * .34), n: 5 }),
    desc: n => `Bắn ${n.n} viên đạn vào các kẻ địch ngẫu nhiên, mỗi viên ${n.dmg} sát thương.`
  },
  leap: {
    mana: 50, cast: .35, nums: p => ({ dmg: r(p * 1.05), stun: 1, radius: 1.3 }),
    desc: n => `Nhảy vào kẻ địch xa nhất, gây ${n.dmg} sát thương vùng và choáng ${n.stun}s.`
  },
  blink: {
    mana: 60, cast: .3, nums: p => ({ dmg: r(p * 1.6) }),
    desc: n => `Dịch chuyển ra sau lưng kẻ địch yếu nhất, gây ${n.dmg} sát thương.`
  },
  quake: {
    mana: 60, cast: .5, nums: p => ({ dmg: r(p * .95), radius: 1.8, stun: 1 }),
    desc: n => `Dậm đất: ${n.dmg} sát thương vùng quanh mình và choáng ${n.stun}s.`
  },
  heal: {
    mana: 70, cast: .5, nums: p => ({ heal: r(p * 1.5), ally: r(p * 1.0) }),
    desc: n => `Hồi ${n.heal} máu cho bản thân và ${n.ally} cho đồng đội yếu nhất.`
  },
  shield: {
    mana: 60, cast: .4, nums: p => ({ shield: r(p * 2.8), ally: r(p * 1.5), radius: 2.2, dur: 5 }),
    desc: n => `Tạo khiên ${n.shield} cho bản thân và ${n.ally} cho đồng đội gần (${n.dur}s).`
  },
  poison: {
    mana: 50, cast: .4, nums: p => ({ dmg: r(p * .3), dps: r(p * .26), dur: 5, radius: 1.6 }),
    desc: n => `Gây ${n.dmg} sát thương và độc ${n.dps}/giây trong ${n.dur}s, lan sang kẻ địch kề bên.`
  },
  drain: {
    mana: 50, cast: .4, nums: p => ({ dmg: r(p * 1.15) }),
    desc: n => `Gây ${n.dmg} sát thương và hồi lại bằng ấy máu.`
  },
  rally: {
    mana: 80, cast: .5, nums: p => ({ as: .3, atk: .15, dur: 6, radius: 3.6 }),
    desc: n => `Tăng ${Math.round(n.as * 100)}% tốc đánh và ${Math.round(n.atk * 100)}% công cho đồng đội gần trong ${n.dur}s.`
  },
  counter: {
    mana: 70, cast: .3, nums: p => ({ shield: r(p * 1.8), thorns: .5, dr: .3, dur: 3.5 }),
    desc: n => `Thủ thế ${n.dur}s: khiên ${n.shield}, giảm ${Math.round(n.dr * 100)}% sát thương, phản ${Math.round(n.thorns * 100)}% đòn nhận.`
  },
  meteor: {
    mana: 100, cast: .6, nums: p => ({ dmg: r(p * 1.15), n: 3, radius: 1.5, delay: 1.0, stun: .6 }),
    desc: n => `Gọi ${n.n} thiên thạch rơi xuống kẻ địch, mỗi quả ${n.dmg} sát thương vùng, choáng ${n.stun}s.`
  },
  splash: {
    mana: 40, cast: .5, nums: () => ({}),
    desc: () => 'Chẳng có chuyện gì xảy ra cả... (Magikarp chỉ đang vẫy vẫy)'
  }
};
