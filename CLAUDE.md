# Hướng dẫn cho AI làm việc trên dự án này

Game auto chess 3D (Three.js + Vite, JavaScript thuần ES module, không TypeScript). Người dùng nói tiếng Việt: giải thích ngắn, dễ hiểu.

## Quy tắc
- Đọc `README.md` để nắm cấu trúc. Dữ liệu Pokémon gốc nằm ở `src/data/lines.js`; **không sửa tay** `src/data/generated/forms.json` và `CREDITS.md` (chạy `npm run assets`).
- `src/sim/*` và `src/game/*` phải **thuần logic** (không dùng DOM/Three.js) để chạy được trong Node (test, bot, cân bằng). Đừng phá điều này.
- Chiến đấu phải **xác định**: chỉ dùng `this.rng` (seed) trong engine, không dùng `Math.random()` ở `src/sim` và `src/game`.
- Trước khi commit: `npm test` (logic) và `npm run build && npm run test:e2e` khi đụng giao diện/luồng chơi. Báo kết quả thật cho người dùng.
- Thêm tính năng thì thêm test vào `tests/unit.mjs` (logic) hoặc `tests/e2e.mjs` (giao diện).
- Đổi chỉ số/chiêu/giá: chạy `node tools/balance-teams.mjs` và đảm bảo tỉ lệ thắng từng Pokémon trong cùng bậc giá nằm trong khoảng ~40-65%. Tinh chỉnh bằng `tune` trong `lines.js`.
- Sau khi sửa giao diện, **chụp màn hình để tự xem** (`node tools/shot.mjs <url> <out.png> <w> <h> <chờ ms> "<js>"`); nhiều lỗi hiển thị (chữ, bố cục, căn chân sprite) chỉ lộ ra qua ảnh.
- Không đưa nhạc/hình/âm thanh có bản quyền vào repo. Nhạc, hiệu ứng, tiếng kêu đều tự tổng hợp. File âm thanh riêng của người chơi chỉ nằm trong `public/audio-user/` (đã `.gitignore`).
- Mọi chuỗi giao diện bằng tiếng Việt; tên Pokémon và tên chiêu giữ nguyên tiếng Anh.

## Bài học đã gặp (đừng lặp lại)
- Căn chân sprite PMD phải dùng `foot`/`cx` **đo theo từng anim** (`forms.json`), vị trí quad = `(foot - fh/2) * s` (dấu ngược làm nhân vật chìm xuống gạch).
- Kỹ năng nổ quanh bản thân (`nova`, `quake`) phải **đi vào tầm** rồi mới tung, nếu không bị lãng phí (xem `castRange` trong `battle.js`).
- Test trong trình duyệt phần mềm (SwiftShader) chạy chậm: dùng `__app.skipBattle()` và đợi (`settle`) hoạt ảnh trượt xong trước khi lấy toạ độ chuột.
- Đừng dùng `pkill -f "<mẫu có trong lệnh của chính mình>"` trong shell: nó giết cả shell.
- Chỉ số lấy theo "hình dáng" của dạng cuối của dòng (trừ dòng có `own: true`, như Magikarp) để Pokémon chưa tiến hóa không bị thiệt so với cùng bậc giá.
- Bàn cờ là lục giác (`src/sim/hex.js`): đội 1 = xoay 180° của đội 0 (`toGlobal`). Mọi vị trí đơn vị phải qua `center`/`toGlobal`, không dùng toạ độ thế giới cứng. Mỗi ô chỉ một Pokémon (`Battle.grid`); `leap`/`blink` phải `claim` ô đích. Có test bất biến trong `tests/unit.mjs`.
- `tools/balance.mjs` đổi độ khó qua `DIFFICULTY[1].income`; đừng đo bằng `BOT_TUNE` đơn thuần.
