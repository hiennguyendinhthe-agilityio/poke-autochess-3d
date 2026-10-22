import './ui/base.css';
import { App } from './app.js';

const boot = document.getElementById('boot');
function fatal(msg) {
  boot.style.opacity = 1; boot.style.display = 'grid';
  boot.innerHTML = `<div style="max-width:420px;padding:20px"><div style="font-size:22px;color:#ff8a8a">Không chạy được trò chơi</div><div style="margin-top:12px;font-weight:600;opacity:.9">${msg}</div></div>`;
}
try {
  const app = new App(document.getElementById('app'));
  window.__app = app;       // phục vụ kiểm thử và gỡ lỗi
  boot.style.pointerEvents = 'none'; boot.style.opacity = 0; setTimeout(() => boot.remove(), 450);
} catch (e) {
  console.error(e);
  const gl = !!document.createElement('canvas').getContext('webgl2') || !!document.createElement('canvas').getContext('webgl');
  fatal(gl ? 'Đã xảy ra lỗi khi khởi động: ' + String(e.message || e) : 'Trình duyệt hoặc thiết bị của bạn không hỗ trợ WebGL. Hãy thử trình duyệt khác (Chrome, Safari, Edge, Firefox) hoặc bật tăng tốc phần cứng.');
}

// Service worker: lưu game để chơi offline (chỉ khi chạy bản build)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
