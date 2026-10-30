export const textFields = ['title', 'destination', 'researchQuestion', 'studentName', 'origin', 'theme', 'note', 'transport', 'fieldNotes'];
export const fileRoles = ['reference', 'cover', 'field', 'report', 'notebook', 'reflection', 'model'];
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 10;
export const extensions = ['pdf', 'docx', 'txt', 'md', 'json', 'png', 'jpg', 'jpeg', 'webp', 'glb'];
export const imageExtensions = ['png', 'jpg', 'jpeg', 'webp'];
export const extension = name => String(name).split('.').pop().toLowerCase();
export const isImage = file => imageExtensions.includes(extension(file.name));
export const isModel = file => extension(file.name) === 'glb';
export const allowedFileRoles = file => isModel(file) ? ['model'] : fileRoles.filter(role => role !== 'model' && (isImage(file) || !['cover', 'field'].includes(role)));
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

function bilingual(value) {
  if (typeof value === 'string') return {zh: value.trim().slice(0, 12000), en: ''};
  return Object.fromEntries(['zh', 'en'].map(lang => [lang, typeof value?.[lang] === 'string' ? value[lang].trim().slice(0, 12000) : '']));
}
export function emptyDraft() {
  return {...Object.fromEntries(textFields.map(key => [key, {zh: '', en: ''}])), year: null, destinationCoords: null, researchNotes: Array(13).fill(null), unansweredQuestions: []};
}
export function normalizeDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalidProject');
  const draft = emptyDraft();
  for (const field of textFields) draft[field] = bilingual(input[field]);
  draft.year = input.year === null || input.year === '' || input.year === undefined ? null : Number(input.year);
  if (draft.year !== null && (!Number.isInteger(draft.year) || draft.year < 1900 || draft.year > 2200)) throw new Error('invalidYear');
  const coords = input.destinationCoords;
  if (coords !== null && coords !== undefined) {
    if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number' || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng) || coords.lat < 18 || coords.lat > 53 || coords.lng < 73 || coords.lng > 135) throw new Error('invalidCoordinates');
    draft.destinationCoords = {lat: coords.lat, lng: coords.lng};
  }
  if (Array.isArray(input.researchNotes)) draft.researchNotes = Array.from({length: 13}, (_, i) => input.researchNotes[i] ? bilingual(input.researchNotes[i]) : null);
  if (Array.isArray(input.unansweredQuestions)) draft.unansweredQuestions = input.unansweredQuestions.slice(0, 20).map(bilingual).filter(value => value.zh || value.en);
  return draft;
}
export function validateDraft(input) {
  const draft = normalizeDraft(input);
  if (!draft.title.zh && !draft.title.en) throw new Error('titleRequired');
  if (!draft.destination.zh && !draft.destination.en) throw new Error('destinationRequired');
  return draft;
}
export function localizeProject(project, language) {
  const text = value => typeof value === 'string' ? value : value?.[language] || value?.zh || value?.en || '';
  return {
    ...project,
    ...Object.fromEntries(textFields.map(field => [field, text(project[field])])),
    researchNotes: project.researchNotes.map(text),
    unansweredQuestions: project.unansweredQuestions.map(text),
    fieldPhotos: (project.fieldPhotos || []).map(photo => ({...photo, alt: text(photo.alt), caption: text(photo.caption)}))
  };
}
