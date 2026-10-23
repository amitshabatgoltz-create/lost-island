// Frees GPU memory held by a zone. Anything marked userData.shared (object, material or texture) survives.
export function disposeTree(root) {
  const textures = new Set(), materials = new Set(), geometries = new Set();
  root.traverse((o) => {
    if (o.userData.shared) return;
    if (o.geometry) geometries.add(o.geometry);
    for (const m of [].concat(o.material || [])) materials.add(m);
    if (o.isInstancedMesh) o.dispose();
  });
  for (const m of materials) {
    if (m.userData.shared) continue;
    for (const v of Object.values(m)) if (v && v.isTexture && !v.userData.shared) textures.add(v);
    if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture && !u.value.userData.shared) textures.add(u.value);
    m.dispose();
  }
  for (const g of geometries) g.dispose();
  for (const t of textures) t.dispose();
  root.removeFromParent();
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}
