# Đấu Trường Pokémon 3D

Game **auto chess 3D** chạy ngay trên trình duyệt (máy tính và điện thoại), lấy cảm hứng từ Đấu Trường Chân Lý / Teamfight Tactics với Pokémon từ anime.
Mua Pokémon, xếp đội hình, gộp 3 con để **lên sao và tiến hóa**, kích hoạt hệ và tộc, rồi xem trận đấu tự động diễn ra trên đấu trường 3D.

> Dự án **fan phi thương mại**, làm vì đam mê, không thu phí. Pokémon và tên Pokémon thuộc Nintendo / Game Freak / The Pokémon Company; dự án không liên kết với họ.
> Xem mục [Bản quyền](#bản-quyền-và-lưu-ý-pháp-lý) trước khi chia sẻ công khai.

## Tính năng

| Hạng mục | Chi tiết |
|---|---|
| Lối chơi | Ván 8 người (bạn + 7 bot AI), mỗi bot mang tên nhân vật anime. Mua, bán, làm mới, khóa cửa hàng, mua XP, lãi suất, chuỗi thắng/thua, vòng PvE rơi vật phẩm |
| Roster | **79 dòng Pokémon / 181 dạng**, 5 bậc giá. Lên 2★ và 3★ là **tiến hóa thật** (Charmander → Charmeleon → Charizard; Magikarp chỉ thành Gyarados ở 3★) |
| Hệ & Tộc | 18 hệ có tương khắc chuẩn ("Hiệu quả!") + 5 tộc anime: Đội Satoshi, Hỏa Tiễn, Khởi Đầu, Họ Eevee, Huyền Thoại |
| Chiêu thức | 18 kiểu kỹ năng (tia điện nảy, tia xuyên, thiên thạch, nhảy, dịch chuyển, hồi máu, khiên, độc...), mỗi Pokémon có chiêu riêng theo hệ |
| Vật phẩm | 6 nguyên liệu, ghép thành 21 vật phẩm (Đai Sức Mạnh, Khăn Trụ Vững, Túi Thức Ăn...), kéo-thả lên Pokémon |
| 3D | Three.js: đảo nổi, **bàn cờ lục giác** 8x8 (di chuyển từng ô, tầm đánh đo bằng số ô), hàng ghế chờ, sprite 8 hướng, hiệu ứng hạt/tia/vòng sóng theo hệ, 6 chủ đề sân đấu |
| Model 3D | Nhân vật mặc định là sprite billboard trong cảnh 3D. Nếu bạn tự có model `.glb`, thả vào `public/models/` + `manifest.json` để thay sprite ([hướng dẫn](public/models/README.md)) |
| Âm thanh | **Tự tổng hợp** bằng Web Audio: nhạc nền theo giai đoạn, hiệu ứng theo hệ, tiếng kêu riêng cho từng Pokémon. Hỗ trợ thả file âm thanh riêng ([hướng dẫn](public/audio-user/README.md)) |
| Giao diện | Thẻ cửa hàng kiểu TFT (cột huy hiệu hệ/tộc, khung theo giá). **Chạm = mua, giữ = xem thông tin** (cảm ứng); **bấm vào hệ/tộc** để xem mọi Pokémon thuộc hệ/tộc đó (đang có ở sân/ghế/cửa hàng) và viền sáng các con liên quan trên sân. Bloom nhẹ và vignette ở chế độ "Sắc nét" |
| Màn mở đầu | Camera lao xuống, ô lục giác trồi lên theo sóng, Pokémon nhảy vào, logo hiện từng chữ kèm pháo hoa hạt và âm thanh bừng sáng khi chạm. Bỏ qua bằng `?nosplash` hoặc tắt trong Cài đặt; tôn trọng `prefers-reduced-motion` |
| Hồ sơ người chơi | Tên + avatar Pokémon, tối đa 8 hồ sơ trên một thiết bị, mỗi hồ sơ có **ván lưu riêng** và thống kê (số ván, vô địch, top 4, hạng tốt nhất). Lưu trên thiết bị, **không mật khẩu, không máy chủ, không thu thập dữ liệu**; có chế độ chơi khách |
| Tiện ích | Danh mục Pokémon, 3 mức độ khó, tự lưu và tiếp tục, tăng tốc trận x1/x2/x4, cài như app (PWA) và chơi offline, hỗ trợ cảm ứng |

## Chơi thế nào

1. Chọn Pokémon khởi đầu và độ khó.
2. **Chuẩn bị** (~30 giây): mua Pokémon (phím `1`-`5`), kéo từ băng ghế xuống nửa dưới bàn cờ. Cấp N chứa tối đa N Pokémon trên sân. Đặt kẻ cận chiến phía trước, kẻ đánh xa phía sau.
3. **Chiến đấu** tự động. Bên thua mất máu (nền theo vòng + số Pokémon còn sống của bên thắng). Hết máu là bị loại; đứng cuối cùng là vô địch.
4. Gom **3 con giống nhau** để lên sao. Có nhiều Pokémon cùng hệ/tộc để kích hoạt thưởng sức mạnh (rê chuột vào cột bên trái xem chi tiết).
5. Giữ vàng để nhận **lãi** (1 vàng mỗi 10 vàng, tối đa 5). Vòng Pokémon hoang dã (1, 2, 3, 6, 11, 16...) rơi nguyên liệu vật phẩm.

Phím tắt: `D` làm mới · `F` mua XP · `L` khóa · `E` bán · `Space` sẵn sàng · `Esc` menu.

## Chạy trên máy

Cần Node.js 20 trở lên.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # bản triển khai trong dist/
npm run preview      # xem thử bản build
```

## Kiểm thử

```bash
npm test             # test logic (46 test): dữ liệu, hình học lục giác, kho chung, gộp sao, kinh tế, chiến đấu, bot, lưu/tải, cả ván tự động
npm run test:e2e     # test trình duyệt thật (Playwright): click, kéo-thả, chiến đấu, lưu/tiếp tục, giao diện điện thoại
npm run test:all     # tất cả (cần build trước)
```

Công cụ cân bằng (mô phỏng hàng nghìn trận):

```bash
node tools/balance-teams.mjs 1500   # tỉ lệ thắng từng Pokémon trong đội hình ngẫu nhiên, theo bậc giá
node tools/balance-units.mjs        # đấu vòng tròn 1v1
node tools/balance.mjs 30 --income=0.65   # độ khó của bot so với người chơi tự động
```

## Cấu trúc

```
src/
  data/       lines.js (NGUỒN DỮ LIỆU Pokémon: dòng, giá, tộc, chiêu), roster.js (chỉ số chiến đấu),
              traits.js (hệ & tộc), items.js, types.js (tương khắc), cries.js, generated/forms.json (tự sinh)
  sim/        battle.js (engine chiến đấu thuần logic, chạy được trong Node), hex.js (hình học lục giác), ability-kinds.js, rng.js
  game/       state.js (kinh tế, cửa hàng, kho chung, gộp sao), match.js (vòng đấu, xếp hạng), bots.js, rounds.js
  render/     world.js (cảnh 3D + chọn/kéo), arena.js (đấu trường), sprites.js (billboard 8 hướng), fx.js (hiệu ứng)
  ui/         hud.js, screens.js, input.js, icons.js, describe.js, base.css
  audio/      audio.js (nhạc + hiệu ứng + tiếng kêu tổng hợp)
  app.js      điều phối: vòng đời ván, lưu/tải
tools/        fetch-assets.mjs, balance*.mjs, autoplay.mjs, make-icons.mjs, shot.mjs
tests/        unit.mjs, e2e.mjs
public/       assets/pokemon/<dex>/*.png (sprite), manifest, sw.js, icon, audio-user/
```

Bàn cờ lục giác: mỗi Pokémon chiếm một ô, bước từng ô theo đường ngắn nhất (BFS qua ô trống), đánh khi mục tiêu nằm trong tầm (đo bằng số ô); đội đối thủ là bản xoay 180° của đội bạn nên hai phía công bằng.

Engine chiến đấu (`src/sim`) không phụ thuộc trình duyệt nên bot, test và công cụ cân bằng dùng chung đúng một bộ luật với game thật.

## Thêm Pokémon

1. Thêm một dòng `L(...)` vào `src/data/lines.js` (khóa, giá, 3 số Pokédex ứng với 1★/2★/3★, tộc, chiêu, tầm đánh).
2. `npm run assets` tải sprite (PMD SpriteCollab), chỉ số (PokeAPI) và cập nhật `CREDITS.md`.
3. `npm test`, rồi `node tools/balance-teams.mjs` để xem tỉ lệ thắng; chỉnh `tune: 0.9` (nerf) / `1.1` (buff) trên dòng đó nếu lệch xa 50%.

## Triển khai (GitHub Pages)

Workflow `.github/workflows/pages.yml` tự build và đăng lên GitHub Pages mỗi khi có thay đổi trên nhánh `main`.
Bật một lần trong repo: **Settings → Pages → Source: GitHub Actions**.

## Bản quyền và lưu ý pháp lý

- **Mã nguồn**: MIT (xem `LICENSE`). Giấy phép này **chỉ áp dụng cho mã**, không áp dụng cho Pokémon hay sprite.
- **Sprite Pokémon**: [PMD SpriteCollab](https://github.com/PMDCollab/SpriteCollab), giấy phép **CC BY-NC 4.0** (ghi công tác giả, không thương mại). Danh sách tác giả nằm trong [`CREDITS.md`](CREDITS.md).
- **Pokémon, tên, nhân vật**: tài sản của Nintendo / Game Freak / The Pokémon Company. Fan game phi thương mại vẫn có thể bị yêu cầu gỡ; nên chia sẻ trong nhóm bạn bè, không quảng bá rộng rãi, không thu phí, không quảng cáo.
- **Nhạc và âm thanh**: toàn bộ được tự tổng hợp trong code nên không vướng bản quyền. Nếu bạn tự thêm nhạc game hoặc lời thoại lấy từ phim vào `public/audio-user/`, đó là tài sản có bản quyền của bên khác: thư mục này **không được đưa vào git**, và nếu triển khai bản có chứa chúng bạn nên để repo/trang ở chế độ **riêng tư**.

## Trạng thái và việc có thể làm tiếp

Hoàn chỉnh và chơi được: toàn bộ vòng lặp ván chơi, 79 Pokémon, 7 bot, vật phẩm, 3D, âm thanh, lưu/tải, PWA, test.

Ý tưởng mở rộng: PvP online (WebRTC, bot hiện đã dùng chung engine nên có thể thay bằng người), thêm "Augment" giữa ván,
vòng "carousel" chọn vật phẩm, thêm Pokémon/tộc mới (xem mục Thêm Pokémon), bộ model 3D đầy đủ (cơ chế nạp `.glb` đã có sẵn).
