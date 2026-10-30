import {createHash} from 'node:crypto';

// Owner-supplied umbrella photograph from 苏州.zip. Match its contents, so an
// unrelated Suzhou project or a reused filename never gains this model.
const umbrellaPhotoHash = '7b7cbd2df94c57c33120d0e0da889ca4489061dcf53f99ac7d09052e59b81f1b';
const isUmbrellaPhoto = file => file.buffer && createHash('sha256').update(file.buffer).digest('hex') === umbrellaPhotoHash;

export function importedModel(files) {
  if (!files.some(file => file.role !== 'reference' && isUmbrellaPhoto(file))) return null;
  return {
    src: 'assets/models/suzhou-umbrella.glb', name: '梅花油纸伞.glb', mime: 'model/gltf-binary',
    caption: {
      zh: '梅花油纸伞的三维模型，保留伞面的梅花与书法图案、竹制伞骨和伞柄。拖动模型可查看伞面与内部结构。',
      en: 'A 3D model of the plum blossom oil-paper umbrella, with painted blossoms, calligraphy, bamboo ribs and a handle. Drag to explore the canopy and its inner structure.'
    }
  };
}

export function applyImportedAssets(project, files) {
  const model = importedModel(files);
  if (!model) return;
  project.model ||= model;
  // The owner identified this supplied material as Suzhou. Keep it in the
  // same city gallery even when the extracted place name includes Jiangsu.
  project.destinationCoords ||= {lat: 31.299, lng: 120.585};
}

// Keep this supplied journey's intended cover stable across AI suggestions.
// The review form still allows the owner to change the suggested file roles.
export function preferImportedCover(files, roles) {
  const photo = files.find(isUmbrellaPhoto);
  if (!photo) return roles;
  const previous = roles.find(role => role.id === photo.id);
  return [
    ...roles.filter(role => role.id !== photo.id).map(role => role.role === 'cover' ? {...role, role: 'field'} : role),
    {id: photo.id, role: 'cover', caption: previous?.caption || {zh: '油纸伞绘制过程', en: 'Painting an oil-paper umbrella'}}
  ];
}
