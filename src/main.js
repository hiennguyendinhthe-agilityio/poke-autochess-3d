import './ui/base.css';
import { App } from './app.js';

const app = new App(document.getElementById('app'));
window.__app = app;       // phục vụ kiểm thử và gỡ lỗi

// Service worker: lưu game để chơi offline (chỉ khi chạy bản build)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
