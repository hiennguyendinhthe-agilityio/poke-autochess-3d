// Tạo file .glb tối thiểu (1 tam giác + clip "Idle" xoay + clip "Attack") để kiểm thử cơ chế model 3D: node tools/make-test-glb.mjs <out.glb>
import fs from 'node:fs';
const pos = new Float32Array([-.5, 0, 0, .5, 0, 0, 0, 1, 0]);
const times = new Float32Array([0, 1]), rot = new Float32Array([0, 0, 0, 1, 0, .7071, 0, .7071]);
const buf = Buffer.concat([Buffer.from(pos.buffer), Buffer.from(times.buffer), Buffer.from(rot.buffer)]);
const json = {
  asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'tri' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, .3, .3, 1] }, doubleSided: true }],
  buffers: [{ byteLength: buf.length }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 8 }, { buffer: 0, byteOffset: 44, byteLength: 32 }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-.5, 0, 0], max: [.5, 1, 0] }, { bufferView: 1, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] }, { bufferView: 2, componentType: 5126, count: 2, type: 'VEC4' }],
  animations: ['Idle', 'Attack'].map(name => ({ name, samplers: [{ input: 1, output: 2 }], channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }] }))
};
let j = Buffer.from(JSON.stringify(json)); while (j.length % 4) j = Buffer.concat([j, Buffer.from(' ')]);
let b = buf; while (b.length % 4) b = Buffer.concat([b, Buffer.alloc(1)]);
const total = 12 + 8 + j.length + 8 + b.length, h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(total, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(j.length, 0); c1.writeUInt32LE(0x4E4F534A, 4);
const c2 = Buffer.alloc(8); c2.writeUInt32LE(b.length, 0); c2.writeUInt32LE(0x004E4942, 4);
fs.writeFileSync(process.argv[2], Buffer.concat([h, c1, j, c2, b]));
