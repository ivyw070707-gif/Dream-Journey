import {CFB} from 'xlsx';

// MS-PPT: follow Current User -> UserEditAtom -> current persist directory.
// Reading every historical record can expose deleted slides and superseded text.
// https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-ppt/1fc22d56-28f9-4818-bd45-67c2bf721ccf
export function readPpt(buffer) {
  const cfb = CFB.read(buffer, {type: 'buffer'});
  const stream = name => {
    const entry = CFB.find(cfb, name);
    if (!entry?.content) throw new Error('Missing PowerPoint stream');
    return Buffer.from(entry.content);
  };
  const data = stream('PowerPoint Document'), current = stream('Current User');
  if (current.length < 20 || current.readUInt32LE(12) === 0xf3d1c4df) throw new Error('Encrypted or invalid presentation');
  let recordCount = 0;
  function record(offset, limit = data.length) {
    if (++recordCount > 200000 || !Number.isInteger(offset) || offset < 0 || offset + 8 > limit) throw new Error('Invalid PowerPoint record');
    const flags = data.readUInt16LE(offset), size = data.readUInt32LE(offset + 4);
    if (offset + 8 + size > limit) throw new Error('Invalid PowerPoint record size');
    return {type: data.readUInt16LE(offset + 2), version: flags & 15, instance: flags >>> 4, start: offset + 8, end: offset + 8 + size, size};
  }
  function children(parent) {
    const result = [];
    for (let offset = parent.start; offset < parent.end;) { const child = record(offset, parent.end); result.push(child); offset = child.end; }
    return result;
  }
  let editOffset = current.readUInt32LE(16), documentId; const persists = new Map(), edits = new Set();
  while (editOffset) {
    if (edits.has(editOffset) || edits.size > 1000) throw new Error('Invalid edit chain');
    edits.add(editOffset);
    const edit = record(editOffset);
    if (edit.type !== 0x0ff5 || edit.size < 28) throw new Error('Invalid user edit');
    if (edit.size >= 32 && data.readUInt32LE(edit.start + 28)) throw new Error('Encrypted presentation');
    documentId ??= data.readUInt32LE(edit.start + 16);
    const directory = record(data.readUInt32LE(edit.start + 12));
    if (directory.type !== 0x1772) throw new Error('Invalid persist directory');
    for (let offset = directory.start; offset < directory.end;) {
      if (offset + 4 > directory.end) throw new Error('Invalid persist entry');
      const header = data.readUInt32LE(offset), id = header & 0xfffff, count = header >>> 20;
      offset += 4;
      if (!count || offset + count * 4 > directory.end) throw new Error('Invalid persist offsets');
      for (let i = 0; i < count; i++) if (!persists.has(id + i)) persists.set(id + i, data.readUInt32LE(offset + i * 4));
      offset += count * 4;
    }
    const previous = data.readUInt32LE(edit.start + 8);
    if (previous >= editOffset) throw new Error('Invalid edit chain');
    editOffset = previous;
  }
  const document = record(persists.get(documentId));
  if (document.type !== 0x03e8 || document.version !== 15) throw new Error('Invalid document');
  function texts(parent, depth = 0) {
    if (depth > 60) throw new Error('Excessive PowerPoint nesting');
    const result = [];
    for (const child of children(parent)) {
      if (child.type === 0x0fa0 || child.type === 0x0fa8) {
        if (child.type === 0x0fa0 && child.size % 2) throw new Error('Invalid Unicode text');
        const value = data.subarray(child.start, child.end).toString(child.type === 0x0fa0 ? 'utf16le' : 'latin1').replace(/\r|\x0b/g, '\n').trim();
        if (value) result.push(value);
      } else if (child.version === 15) result.push(...texts(child, depth + 1));
    }
    return result;
  }
  const sections = [], warnings = []; let length = 0;
  for (const list of children(document).filter(item => item.type === 0x0ff0 && [0, 2].includes(item.instance))) {
    let group, index = 0;
    function flush() {
      if (!group) return;
      const offset = persists.get(group.id);
      if (offset === undefined) throw new Error('Missing slide reference');
      const slide = record(offset);
      if (slide.type !== (list.instance === 0 ? 0x03ee : 0x03f0)) throw new Error('Invalid slide reference');
      const lines = [...new Set([...group.text, ...texts(slide)])];
      if (lines.length) {
        const text = `[${list.instance === 0 ? 'Slide' : 'Notes'} ${index}]\n${lines.join('\n')}`;
        sections.push(text.slice(0, Math.max(0, 120000 - length))); length += text.length;
      }
    }
    for (const child of children(list)) {
      if (child.type === 0x03f3) {
        flush(); index++;
        if (index > 100 || length >= 120000) { group = null; warnings.push('Presentation text was truncated / 幻灯片文字超出读取上限。'); break; }
        if (child.size < 4) throw new Error('Invalid slide persist atom');
        group = {id: data.readUInt32LE(child.start), text: []};
      } else if (group && [0x0fa0, 0x0fa8].includes(child.type)) group.text.push(data.subarray(child.start, child.end).toString(child.type === 0x0fa0 ? 'utf16le' : 'latin1').replace(/\r|\x0b/g, '\n').trim());
    }
    flush();
  }
  warnings.push('Legacy PowerPoint text was read from current slides and notes only; embedded images and media were not analyzed / 已读取旧版 PPT 当前幻灯片及备注文字，未识别内嵌图片和媒体。');
  return {text: sections.filter(Boolean).join('\n\n'), warnings};
}
