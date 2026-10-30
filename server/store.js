import {mkdir, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {normalizeDraft, validateDraft} from '../src/js/project-schema.js';
import {HttpError} from './files.js';
import {applyImportedAssets} from './imported-assets.js';

export const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export function projectStore(directory) {
  const root = path.resolve(directory, 'projects');
  async function get(id) {
    try { return JSON.parse(await readFile(path.join(root, id, 'project.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  return {
    async list() {
      let entries;
      try { entries = await readdir(root); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
      const records = await Promise.all(entries.filter(validId).map(get));
      return records.filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async publish({idempotencyKey: id, project: input, ownerId}, files) {
      if (!validId(id)) throw new HttpError(400, 'invalidProject');
      const existing = await get(id);
      if (existing) { if (existing.ownerId !== ownerId) throw new HttpError(409, 'publicationConflict'); return existing; }
      let draft;
      try { draft = validateDraft(input); } catch (error) { throw new HttpError(400, error.message); }
      for (const role of ['cover', 'report', 'notebook', 'reflection', 'model']) if (files.filter(file => file.role === role).length > 1) throw new HttpError(400, 'duplicateRole');
      await mkdir(root, {recursive: true});
      const staging = path.join(root, `.pending-${randomUUID()}`);
      await mkdir(path.join(staging, 'media'), {recursive: true});
      const project = {...draft, ownerId, id: `journey-${id}`, createdAt: new Date().toISOString(), cover: '', color: '#68734d', fieldPhotos: [], finalOutcomes: [null, null, null], model: null};
      try {
        for (const file of files.filter(file => file.role !== 'reference')) {
          const filename = `${file.id}.${file.ext}`;
          await writeFile(path.join(staging, 'media', filename), file.buffer, {flag: 'wx'});
          const src = `uploads/${id}/${filename}`;
          const caption = normalizeDraft({note: file.caption}).note;
          if (file.role === 'cover') project.cover = src;
          else if (file.role === 'model') project.model = {src, caption, name: file.name, mime: file.mime};
          else if (file.role === 'field') project.fieldPhotos.push({src, alt: caption, caption});
          else {
            const index = ['report', 'notebook', 'reflection'].indexOf(file.role);
            project.finalOutcomes[index] = {src, caption, name: file.name, mime: file.mime};
          }
        }
        applyImportedAssets(project, files);
        await writeFile(path.join(staging, 'project.json'), JSON.stringify(project), {flag: 'wx'});
        try { await rename(staging, path.join(root, id)); }
        catch (error) {
          // Windows reports an existing directory as EPERM/EACCES. Only accept a verified committed record.
          if (!['EEXIST', 'ENOTEMPTY', 'EPERM', 'EACCES'].includes(error.code)) throw error;
          const concurrent = await get(id);
          if (!concurrent) throw error;
          if (concurrent.ownerId !== ownerId) throw new HttpError(409, 'publicationConflict');
          return concurrent;
        }
        return project;
      } finally {
        if (path.dirname(path.resolve(staging)) !== root || !/^\.pending-[0-9a-f-]+$/.test(path.basename(staging))) throw new Error('Invalid staging cleanup path');
        await rm(staging, {recursive: true, force: true});
      }
    },
    async media(id, filename) {
      if (!validId(id) || !/^[a-zA-Z0-9-]{1,80}\.(pdf|docx|xls|xlsx|ppt|pptx|zip|txt|md|json|png|jpg|jpeg|webp|glb)$/.test(filename)) throw new HttpError(404, 'notFound');
      try { return await readFile(path.join(root, id, 'media', filename)); }
      catch (error) { if (error.code === 'ENOENT') throw new HttpError(404, 'notFound'); throw error; }
    }
  };
}
