import {extension, extensions, fileRoles, isImage, isModel, MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES} from '../src/js/project-schema.js';
import {inspectGLB} from '../src/js/glb.js';

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
  return {glb: 'model/gltf-binary', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp'}[ext] || 'application/octet-stream';
}

export async function extractSources(files) {
  const content = [], warnings = [];
  let textRemaining = 120000;
  for (const file of files) {
    if (isModel(file)) continue;
    const label = `SOURCE ${file.id}: ${file.name}`;
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
        const mammoth = (await import('mammoth')).default;
        text = (await mammoth.extractRawText({buffer: file.buffer})).value;
        warnings.push(`${file.name}: text was read; embedded images were not analyzed / 已读取文字，未识别内嵌图片。`);
      } else text = file.buffer.toString('utf8');
    } catch { throw new HttpError(422, 'unreadableFile'); }
    if (text.length > textRemaining) warnings.push(`${file.name}: text limit reached; content was truncated / 超出文字上限，部分内容未读取。`);
    if (textRemaining > 0 && text.trim()) content.push({type: 'text', text: `${label}\n${text.slice(0, textRemaining)}`});
    textRemaining = Math.max(0, textRemaining - text.length);
  }
  if (!content.length) throw new HttpError(422, 'emptyFiles');
  return {content, warnings};
}
