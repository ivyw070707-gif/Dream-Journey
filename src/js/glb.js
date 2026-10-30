// GLB 2.0 with embedded resources only: one upload remains one portable model.
export function inspectGLB(data) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 20) throw new Error('invalidModel');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) throw new Error('invalidModel');
  let manifest, offset = 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('invalidModel');
    const size = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    if (size % 4 || offset + 8 + size > bytes.length) throw new Error('invalidModel');
    if (offset === 12) {
      if (type !== 0x4e4f534a) throw new Error('invalidModel');
      try { manifest = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(offset + 8, offset + 8 + size))); }
      catch { throw new Error('invalidModel'); }
    }
    offset += 8 + size;
  }
  if (manifest?.asset?.version !== '2.0' || !Array.isArray(manifest.meshes) || !manifest.meshes.length) throw new Error('invalidModel');
  for (const items of [manifest.buffers, manifest.images]) {
    if (items !== undefined && !Array.isArray(items)) throw new Error('invalidModel');
    for (const item of items || []) if (item.uri !== undefined && (typeof item.uri !== 'string' || !item.uri.startsWith('data:'))) throw new Error('modelResources');
  }
  const unsupported = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'];
  if (Array.isArray(manifest.extensionsRequired) && manifest.extensionsRequired.some(name => unsupported.includes(name))) throw new Error('modelResources');
  return manifest;
}
