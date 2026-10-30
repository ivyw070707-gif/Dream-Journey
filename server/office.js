import * as XLSX from 'xlsx';
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import path from 'node:path';
import {readZip} from './archive.js';

const TEXT_LIMIT = 120000;
const orderedXML = new XMLParser({preserveOrder: true, ignoreAttributes: false, parseTagValue: false, trimValues: false, maxNestedTags: 100});
function xml(buffer) {
  if (!buffer) throw new Error('Missing Office XML');
  const text = buffer.toString('utf8');
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw new Error('Invalid Office XML');
  return orderedXML.parse(text);
}
function find(nodes, tag) {
  const output = [];
  for (const node of nodes || []) for (const [key, children] of Object.entries(node)) {
    if (key === tag) output.push(node);
    if (Array.isArray(children)) output.push(...find(children, tag));
  }
  return output;
}
function textNodes(nodes) {
  return (nodes || []).map(node => '#text' in node ? String(node['#text']) : Object.entries(node).filter(([key]) => key !== ':@').map(([, children]) => Array.isArray(children) ? textNodes(children) : '').join('')).join('');
}
function slideText(buffer) {
  // Paragraph boundaries and individual runs survive tables and rich-text spans.
  return find(xml(buffer), 'a:p').map(node => find(node['a:p'], 'a:t').map(run => textNodes(run['a:t'])).join('')).filter(value => value.trim()).join('\n');
}
function relationships(buffer, from) {
  return new Map(find(xml(buffer), 'Relationship').filter(node => node[':@']?.['@_TargetMode'] !== 'External').map(node => {
    const attrs = node[':@'];
    const target = attrs?.['@_Target'];
    return [attrs?.['@_Id'], {type: attrs?.['@_Type'], path: typeof target === 'string' ? path.posix.normalize(target.startsWith('/') ? target.slice(1) : path.posix.join(path.posix.dirname(from), target)) : ''}];
  }));
}
export async function readPptx(buffer) {
  const files = await readZip(buffer, {maxEntries: 5000, maxFileBytes: 50 * 1024 * 1024, include: name => name.endsWith('.xml') || name.endsWith('.rels')});
  const presentation = xml(files.get('ppt/presentation.xml'));
  const rels = relationships(files.get('ppt/_rels/presentation.xml.rels'), 'ppt/presentation.xml');
  const slides = find(presentation, 'p:sldId');
  const sections = [], warnings = [];
  if (slides.length > 100) warnings.push('Only the first 100 slides were read / 仅读取前 100 张幻灯片。');
  let length = 0;
  for (const [i, slide] of slides.slice(0, 100).entries()) {
    const target = rels.get(slide[':@']?.['@_r:id']);
    if (!target?.type?.endsWith('/slide') || !files.has(target.path)) throw new Error('Missing slide');
    const body = slideText(files.get(target.path));
    const chunks = [`[Slide ${i + 1}]\n${body}`];
    const slideRels = path.posix.join(path.posix.dirname(target.path), '_rels', `${path.posix.basename(target.path)}.rels`);
    if (files.has(slideRels)) for (const rel of relationships(files.get(slideRels), target.path).values()) {
      if (rel.type?.endsWith('/notesSlide')) chunks.push(`[Speaker notes ${i + 1}]\n${slideText(files.get(rel.path))}`);
    }
    const section = chunks.join('\n');
    if (body.trim() || chunks.length > 1) sections.push(section.slice(0, Math.max(0, TEXT_LIMIT - length)));
    length += section.length;
    if (length >= TEXT_LIMIT) { warnings.push('Slide text was truncated / 幻灯片文字超出上限，部分内容未读取。'); break; }
  }
  warnings.push('PowerPoint text and speaker notes were read; embedded images, charts and media were not analyzed / 已读取幻灯片文字和备注，未识别内嵌图片、图表和媒体。');
  return {text: sections.join('\n\n'), warnings};
}
export async function readWorkbook(buffer, ext) {
  if (ext === 'xlsx') {
    const files = await readZip(buffer, {maxEntries: 5000, maxFileBytes: 50 * 1024 * 1024, include: name => name === 'xl/workbook.xml'});
    if (!files.has('xl/workbook.xml')) throw new Error('Not an Excel workbook');
  }
  const workbook = XLSX.read(buffer, {type: 'buffer', dense: true, sheetRows: 1001, cellHTML: false, cellFormula: true, bookVBA: false});
  const sections = [], warnings = []; let length = 0, formulas = 0;
  if (workbook.SheetNames.length > 30) warnings.push('Only the first 30 sheets were read / 仅读取前 30 个工作表。');
  for (const [i, name] of workbook.SheetNames.slice(0, 30).entries()) {
    if (workbook.Workbook?.Sheets?.[i]?.Hidden) { warnings.push(`${name}: hidden sheet skipped / 已跳过隐藏工作表。`); continue; }
    const sheet = workbook.Sheets[name];
    if (!sheet?.['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    if (range.e.r > 999 || range.e.c > 63 || sheet['!fullref']) warnings.push(`${name}: limited to 1000 rows and 64 columns / 最多读取 1000 行、64 列。`);
    range.e.r = Math.min(range.e.r, 999); range.e.c = Math.min(range.e.c, 63);
    if (range.s.r > range.e.r || range.s.c > range.e.c) continue;
    // Do not evaluate formulas or external references; use stored display values only.
    for (const row of sheet['!data'] || []) if (row) for (const cell of row) if (cell?.f && cell.v === undefined) formulas++;
    const rows = XLSX.utils.sheet_to_json(sheet, {header: 1, raw: false, defval: '', blankrows: false, skipHidden: true, range});
    const lines = [`[Worksheet: ${name}]`];
    for (const row of rows) {
      const line = row.map(value => String(value).replace(/[\r\n\t]+/g, ' ')).join('\t');
      if (length + line.length > TEXT_LIMIT) { warnings.push('Workbook text was truncated / 表格文字超出上限，部分内容未读取。'); break; }
      lines.push(line); length += line.length;
    }
    if (lines.length > 1) sections.push(lines.join('\n'));
    if (length >= TEXT_LIMIT) break;
  }
  if (formulas) warnings.push('Some formulas have no cached values and were omitted / 部分公式没有已保存的计算结果，已留空。');
  warnings.push('Only saved visible cell values were read; formulas/macros were not run and embedded charts/images were not analyzed / 仅读取可见单元格的已保存值；不执行公式或宏，不识别内嵌图表与图片。');
  return {text: sections.join('\n\n'), warnings};
}
