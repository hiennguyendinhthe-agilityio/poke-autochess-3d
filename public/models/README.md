# Model 3D riêng của bạn (tuỳ chọn)

Mặc định nhân vật là sprite 2D đặt trong không gian 3D (billboard). Nếu bạn **tự có** model 3D `.glb`, thả vào thư mục này
và tạo `manifest.json` (khóa là số Pokédex của dạng hiển thị):

```json
{ "25": "pikachu.glb", "6": "charizard.glb" }
```

- Model nên quay mặt về hướng +Z, đơn vị bất kỳ (game tự co giãn theo chiều cao Pokémon, chân chạm đất).
- Hoạt ảnh được nhận theo tên clip: `idle`/`stand`, `walk`/`run`, `attack`/`strike`/`bite`..., `hurt`/`damage`. Thiếu clip thì dùng `idle`.
- Pokémon không có trong manifest vẫn dùng sprite.

Thư mục này đã `.gitignore` (trừ file này): model của bạn không bị đẩy lên GitHub. Chỉ dùng model bạn có quyền sử dụng.
