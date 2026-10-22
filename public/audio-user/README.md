# Âm thanh riêng của bạn (tuỳ chọn)

Mặc định game **tự tổng hợp** toàn bộ nhạc nền, hiệu ứng và tiếng kêu Pokémon bằng Web Audio, nên không cần file nào ở đây.

Nếu bạn muốn dùng nhạc hoặc âm thanh riêng (ví dụ bản ghi bạn tự có), hãy thả file vào thư mục này và tạo file
`manifest.json` theo mẫu bên dưới. Game sẽ tự nhận và **ưu tiên dùng** chúng thay cho âm thanh tổng hợp.

```json
{
  "bgm": {
    "menu": "menu.mp3",
    "prep": "chuan-bi.mp3",
    "combat": "chien-dau.mp3",
    "victory": "thang.mp3",
    "defeat": "thua.mp3"
  },
  "cries": {
    "25": "pikachu.ogg",
    "6": "charizard.ogg"
  },
  "sfx": {
    "hit": "hit.wav",
    "buy": "buy.wav"
  }
}
```

- `bgm`: nhạc nền theo màn hình (`menu`, `prep`, `combat`, `victory`, `defeat`). Nhạc lặp lại, trừ `victory` và `defeat`.
- `cries`: tiếng kêu theo **số Pokédex** của dạng đang hiển thị (ví dụ 25 là Pikachu, 26 là Raichu).
- `sfx`: ghi đè hiệu ứng: `click pick drop error buy sell roll xp levelup item combine star2 star3 ready fight tick swing hit cast faint quake boom leap blink win lose damage`.
- Định dạng mp3, ogg, wav đều được (trình duyệt hỗ trợ).

## Lưu ý bản quyền

Thư mục này đã được đưa vào `.gitignore` (trừ file này): **file của bạn sẽ không bị đẩy lên GitHub**.
Nhạc game, bản ghi âm từ phim hoặc lồng tiếng thuộc quyền của chủ sở hữu. Chỉ dùng cho mục đích cá nhân,
đừng đăng công khai, và nên giữ repo ở chế độ **private** nếu bạn triển khai bản có chứa chúng.
