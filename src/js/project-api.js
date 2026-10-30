function apiRoot() {
  const configured = document.querySelector('meta[name="journey-api-base"]')?.content.trim();
  return new URL(configured ? `${configured.replace(/\/$/, '')}/` : './', document.baseURI);
}
export async function apiRequest(route, {token, body, signal} = {}) {
  let response;
  try {
    response = await fetch(new URL(route, apiRoot()), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {...(body === undefined ? {} : {'Content-Type': 'application/json'}), ...(token ? {Authorization: `Bearer ${token}`} : {})},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: signal || AbortSignal.timeout(60000), cache: 'no-store'
    });
  } catch (error) { if (error.name === 'AbortError') throw error; throw new Error('connectionError'); }
  let payload;
  try { payload = await response.json(); } catch { throw new Error('connectionError'); }
  if (!response.ok) throw new Error(payload.error || 'serverError');
  return payload;
}
export function resolveProjectMedia(project) {
  const url = src => src ? new URL(src, apiRoot()).href : '';
  return {...project, cover: url(project.cover), model: project.model?.src ? {...project.model, src: url(project.model.src)} : null, fieldPhotos: (project.fieldPhotos || []).map(photo => ({...photo, src: url(photo.src)})), finalOutcomes: (project.finalOutcomes || [null, null, null]).map(outcome => outcome ? {...outcome, src: url(outcome.src)} : null)};
}
export async function loadPublishedProjects() {
  const payload = await apiRequest('api/projects');
  if (!Array.isArray(payload.projects)) throw new Error('connectionError');
  return payload.projects.map(resolveProjectMedia);
}
