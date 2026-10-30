import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CFB} from 'xlsx';
import {extractSources, validateFiles} from '../server/files.js';
import {readZip} from '../server/archive.js';
import {readPpt} from '../server/legacy-ppt.js';

const file = async name => ({id: name.replaceAll('.', '-'), name, role: 'reference', data: (await readFile(new URL(`fixtures/${name}`, import.meta.url))).toString('base64')});
function zip(entries) { const cfb = CFB.utils.cfb_new(); for (const [name, buffer] of entries) CFB.utils.cfb_add(cfb, name, buffer); return Buffer.from(CFB.write(cfb, {type: 'buffer', fileType: 'zip', compression: true})); }
test('XLS/XLSX preserve sheet names and saved values while omitting hidden sheets', async () => {
  for (const ext of ['xls', 'xlsx']) {
    const parsed = await extractSources(validateFiles([await file(`research-sheet.${ext}`)]));
    const text = parsed.content.filter(part => part.type === 'text').map(part => part.text).join('\n');
    assert.ok(text.includes('Worksheet: 项目信息') && text.includes('Worksheet: 田野记录'));
    assert.ok(text.includes('壁画为何褪色') && text.includes('2026') && text.includes('42'));
    assert.ok(!text.includes('PRIVATE_HIDDEN_VALUE'));
    assert.ok(parsed.warnings.some(warning => warning.includes('隐藏工作表')));
  }
});
test('PPTX and a real LibreOffice-exported PPT contain slide text and speaker notes', async () => {
  for (const ext of ['pptx', 'ppt']) {
    const parsed = await extractSources(validateFiles([await file(`research-slides.${ext}`)]));
    const text = parsed.content.filter(part => part.type === 'text').map(part => part.text).join('\n');
    assert.ok(text.includes('Slide 1') && text.includes('壁画为何褪色'));
    assert.ok(text.includes('观察壁画保存现状'));
  }
});
test('legacy PPT does not read unreferenced/deleted slide records', async () => {
  const data = await readFile(new URL('fixtures/research-slides.ppt', import.meta.url));
  const cfb = CFB.read(data, {type: 'buffer'}), entry = CFB.find(cfb, 'PowerPoint Document');
  const text = Buffer.from('UNREFERENCED_DELETED_CONTENT', 'utf16le');
  const header = Buffer.alloc(8); header.writeUInt16LE(0x0fa0, 2); header.writeUInt32LE(text.length, 4);
  CFB.utils.cfb_add(cfb, 'PowerPoint Document', Buffer.concat([Buffer.from(entry.content), header, text]));
  assert.ok(!readPpt(Buffer.from(CFB.write(cfb, {type: 'buffer'}))).text.includes('UNREFERENCED_DELETED_CONTENT'));
});
test('ZIP parses nested Office files, attributes source paths and skips metadata/unsupported entries', async () => {
  const archive = zip([
    ['资料/research.xlsx', await readFile(new URL('fixtures/research-sheet.xlsx', import.meta.url))],
    ['资料/slides.pptx', await readFile(new URL('fixtures/research-slides.pptx', import.meta.url))],
    ['__MACOSX/._notes.docx', Buffer.from('metadata')], ['ignored.exe', Buffer.from('not executable')],
    ['broken.docx', Buffer.from('PK\x03\x04broken')]
  ]);
  const parsed = await extractSources(validateFiles([{id: 'archive-test', name: '资料.zip', data: archive.toString('base64'), role: 'reference'}]));
  assert.equal(parsed.sourceFiles.length, 2);
  assert.ok(parsed.sourceFiles.every(source => source.name.includes('资料.zip/') && source.parentId === 'archive-test'));
  assert.ok(parsed.warnings.some(warning => warning.includes('ignored.exe')));
  assert.ok(parsed.warnings.some(warning => warning.includes('broken.docx')));
  assert.ok(parsed.warnings.every(warning => !warning.includes('__MACOSX')));
});
test('ZIP size limits and malformed/unsafe archive data fail without reading file paths from disk', async () => {
  await assert.rejects(readZip(zip([['big.txt', Buffer.alloc(100)]]), {maxFileBytes: 20}), /archiveLimit/);
  await assert.rejects(readZip(Buffer.from('invalid zip')), /invalidArchive/);
  await assert.rejects(readZip(zip([['..\\escape.txt', Buffer.from('unsafe')]])), /invalidArchive/);
});
