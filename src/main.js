import './ui/base.css';
import { App } from './app.js';

const app = new App(document.getElementById('app'));
window.__app = app;       // phục vụ kiểm thử và gỡ lỗi
