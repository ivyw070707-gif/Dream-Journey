import {extension, extensions, fileRoles, isImage, isModel, MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES} from '../src/js/project-schema.js';
import {inspectGLB} from '../src/js/glb.js';
import {readZip, ARCHIVE_LIMITS, ArchiveError} from './archive.js';
import {readWorkbook, readPptx} from './office.js';
import {readPpt} from './legacy-ppt.js';

export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export function validateFiles(input) {
  if (!Array.isArray(input) || input.length > MAX_FILES) throw new HttpError(400, 'fileCount');
  let total = 0;
  const ids = new Set();
  return input.map(file => {
    if (!file || typeof file.name !== 'string' || file.name.length > 200 || !extensions.includes(extension(file.name))) throw new HttpError(400, 'fileType');
    if (typeof file.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(file.id) || ids.has(file.id)) throw new HttpError(400, 'invalidFile');
    ids.add(file.id);
    if (typeof file.data !== 'string' || file.data.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) throw new HttpError(400, 'fileSize');
    const buffer = Buffer.from(file.data, 'base64');
    total += buffer.length;
    if (!buffer.length || buffer.length > MAX_FILE_BYTES || total > MAX_TOTAL_BYTES) throw new HttpError(400, 'fileSize');
    const ext = extension(file.name);
    const signatures = {
      xlsx: () => buffer.subarray(0, 4).equals(Buffer.from([80,75,3,4])),
      pptx: () => buffer.subarray(0, 4).equals(Buffer.from([80,75,3,4])),
      zip: () => buffer.length >= 4 && [0x04034b50,0x06054b50,0x08074b50].includes(buffer.readUInt32LE(0)),
      xls: () => buffer.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225])),
      ppt: () => buffer.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225])),
      pdf: () => buffer.subarray(0, 5).toString() === '%PDF-',
      docx: () => buffer.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])),
      png: () => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      jpg: () => buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255,
      jpeg: () => buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255,
      webp: () => buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
    };
    if (signatures[ext] && !signatures[ext]()) throw new HttpError(400, 'invalidFile');
    if (ext === 'glb') {
      try { inspectGLB(buffer); } catch (error) { throw new HttpError(400, error.message); }
    } else if (!signatures[ext]) {
      try { new TextDecoder('utf-8', {fatal: true}).decode(buffer); } catch { throw new HttpError(400, 'textEncoding'); }
      if (buffer.includes(0)) throw new HttpError(400, 'invalidFile');
    }
    const role = isModel(file) ? 'model' : fileRoles.includes(file.role) ? file.role : 'reference';
    if (role === 'model' && !isModel(file)) throw new HttpError(400, 'invalidModel');
    if (['cover', 'field'].includes(role) && !isImage(file)) throw new HttpError(400, 'imageRequired');
    return {id: file.id, name: file.name, role, buffer, caption: file.caption, ext, mime: mimeType(ext)};
  });
}
export function mimeType(ext) {
  return {xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip: 'application/zip', glb: 'model/gltf-binary', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp'}[ext] || 'application/octet-stream';
}

export async function extractSources(input) {
  const expanded = await expandSources(input), files = expanded.files;
  const content = [], warnings = [...expanded.warnings], sourceFiles = [];
  let textRemaining = 120000;
  for (const file of files) {
    if (isModel(file)) continue;
    const label = `SOURCE ${file.id}: ${file.name}`;
    const contentStart = content.length;
    sourceFiles.push({id: file.id, name: file.name, parentId: file.parentId || file.id, role: file.role});
    if (isImage(file)) {
      content.push({type: 'text', text: label}, {type: 'image_url', image_url: {url: `data:${file.mime};base64,${file.buffer.toString('base64')}`}});
      continue;
    }
    let text = '';
    try {
      if (file.ext === 'pdf') {
        const {PDFParse} = await import('pdf-parse');
        const parser = new PDFParse({data: new Uint8Array(file.buffer)});
        try {
          const result = await parser.getText({first: 60});
          text = result.pages.map(page => `[Page ${page.num}]\n${page.text}`).join('\n');
          if (result.total > 60) warnings.push(`${file.name}: only the first 60 pages were read / 仅读取前 60 页。`);
          if (result.pages.every(page => page.text.trim().length < 20)) {
            const screenshots = await parser.getScreenshot({first: Math.min(result.total, 10), desiredWidth: 1200});
            content.push({type: 'text', text: `${label} (scanned PDF)`});
            for (const page of screenshots.pages) content.push({type: 'image_url', image_url: {url: page.dataUrl}});
            if (result.total > 10) warnings.push(`${file.name}: scanned PDF; only the first 10 pages were read / 扫描件仅读取前 10 页。`);
          }
        } finally { await parser.destroy(); }
      } else if (file.ext === 'docx') {
        await readZip(file.buffer, {maxEntries: 5000, maxFileBytes: 50 * 1024 * 1024, include: () => false});
        const mammoth = (await import('mammoth')).default;
        text = (await mammoth.extractRawText({buffer: file.buffer})).value;
        warnings.push(`${file.name}: text was read; embedded images were not analyzed / 已读取文字，未识别内嵌图片。`);
      } else if (['xls','xlsx','ppt','pptx'].includes(file.ext)) {
        const result = file.ext === 'ppt' ? readPpt(file.buffer) : file.ext === 'pptx' ? await readPptx(file.buffer) : await readWorkbook(file.buffer, file.ext);
        text = result.text; warnings.push(...result.warnings.map(warning => `${file.name}: ${warning}`));
      } else text = file.buffer.toString('utf8');
    } catch (error) {
      sourceFiles.pop(); content.length = contentStart;
      if (file.parentId && file.parentId !== file.id) { warnings.push(`${file.name}: unreadable file skipped / 无法解析，已跳过。`); continue; }
      throw new HttpError(422, error instanceof ArchiveError ? error.message : 'unreadableFile');
    }
    if (text.length > textRemaining) warnings.push(`${file.name}: text limit reached; content was truncated / 超出文字上限，部分内容未读取。`);
    if (textRemaining > 0 && text.trim()) content.push({type: 'text', text: `${label}\n${text.slice(0, textRemaining)}`});
    textRemaining = Math.max(0, textRemaining - text.length);
  }
  if (!content.length) throw new HttpError(422, input.some(file => file.ext === 'zip') ? 'archiveEmpty' : 'emptyFiles');
  return {content, warnings, sourceFiles};
}

const metadataFile = name => name.split('/').some(part => part === '__MACOSX' || part.startsWith('._') || part === '.DS_Store');
export async function expandSources(files) {
  const output = [], warnings = []; let expandedBytes = 0, sequence = 0;
  async function visit(file, depth = 0, parentId = file.id) {
    if (isModel(file)) return;
    if (file.ext !== 'zip') {
      if (output.length >= ARCHIVE_LIMITS.files) throw new HttpError(422, 'archiveLimit');
      output.push({...file, parentId}); return;
    }
    if (depth >= ARCHIVE_LIMITS.depth) { warnings.push(`${file.name}: nested ZIP skipped / ZIP 嵌套超过两层，已跳过。`); return; }
    let entries;
    try {
      entries = await readZip(file.buffer, {include: name => !metadataFile(name) && extensions.includes(extension(name)) && extension(name) !== 'glb', onSkip: (name, reason) => {
        if (!metadataFile(name)) warnings.push(`${file.name}/${name}: ${reason === 'encrypted' ? 'encrypted file skipped / 已跳过加密文件' : 'unsupported format skipped / 已跳过不支持的格式'}。`);
      }});
    } catch (error) { throw new HttpError(422, error instanceof ArchiveError ? error.message : 'invalidArchive'); }
    for (const [name, buffer] of entries) {
      expandedBytes += buffer.length;
      if (expandedBytes > ARCHIVE_LIMITS.bytes) throw new HttpError(422, 'archiveLimit');
      let parsed;
      try { parsed = validateFiles([{id: `${parentId}--entry${++sequence}`, name: name.split('/').pop(), data: buffer.toString('base64'), role: 'reference'}])[0]; }
      catch { warnings.push(`${file.name}/${name}: invalid file skipped / 文件无效，已跳过。`); continue; }
      await visit({...parsed, name: `${file.name}/${name}`}, depth + 1, parentId);
    }
  }
  for (const file of files) await visit(file);
  return {files: output, warnings};
}
