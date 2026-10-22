// Model 3D tuỳ chọn (.glb) do người chơi tự thêm vào public/models/ (xem README ở đó).
// Nếu có `models/manifest.json` ({ "<số Pokédex>": "tên-file.glb" }) thì Pokémon đó dùng model 3D thay cho sprite.
import * as THREE from 'three';

let manifest = null, loaderP = null;
const cache = new Map();

export async function initModels() {
  try {
    const r = await fetch('models/manifest.json', { cache: 'no-cache' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && typeof j === 'object' && Object.keys(j).length) { manifest = j; console.info('[models] Tìm thấy model 3D tuỳ chọn cho', Object.keys(j).length, 'Pokémon'); }
  } catch (e) { /* không có model riêng: dùng sprite */ }
}
export const hasModel = dex => !!(manifest && manifest[dex]);

async function loaders() {
  if (!loaderP) loaderP = Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/utils/SkeletonUtils.js')]);
  const [g, s] = await loaderP; return { GLTFLoader: g.GLTFLoader, clone: s.clone };
}

// Trả về { scene, clips, clone } hoặc null nếu lỗi
export function loadModel(dex) {
  if (!hasModel(dex)) return Promise.resolve(null);
  if (cache.has(dex)) return cache.get(dex);
  const p = (async () => {
    try {
      const { GLTFLoader, clone } = await loaders();
      const gltf = await new GLTFLoader().loadAsync('models/' + manifest[dex]);
      return { scene: gltf.scene, clips: gltf.animations || [], clone };
    } catch (e) { console.warn('[models] Không nạp được model cho', dex, e.message); return null; }
  })();
  cache.set(dex, p); return p;
}

// Gán clip hoạt ảnh theo tên (các nguồn đặt tên khác nhau nên dùng so khớp tên gần đúng)
const PATTERNS = { Idle: /idle|stand|wait|breath|loop|default/i, Walk: /walk|run|move|trot/i, Attack: /attack|atk|strike|punch|bite|slash|kick|skill|cast|special/i, Hurt: /hurt|damage|flinch|hit|pain|react/i };
export function pickClips(clips) {
  const out = {};
  for (const k in PATTERNS) out[k] = clips.find(c => PATTERNS[k].test(c.name)) || null;
  if (!out.Idle) out.Idle = clips.find(c => c !== out.Walk && c !== out.Attack && c !== out.Hurt) || clips[0] || null;
  if (!out.Walk) out.Walk = out.Idle;
  return out;
}

// Dựng một thể hiện model, co/giãn cho cao `height` đơn vị, chân chạm đất
export function instantiate(m, height) {
  const root = m.clone(m.scene);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const s = size.y > 1e-6 ? height / size.y : 1;
  const wrap = new THREE.Group(); wrap.add(root);
  root.scale.multiplyScalar(s); root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root), c = b2.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -b2.min.y, -c.z);
  const mixer = new THREE.AnimationMixer(root);
  const clips = pickClips(m.clips), actions = {};
  for (const k in clips) if (clips[k]) actions[k] = mixer.clipAction(clips[k]);
  return { wrap, mixer, actions };
}
