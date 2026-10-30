import yauzl from 'yauzl';

export class ArchiveError extends Error {}
export const ARCHIVE_LIMITS = {entries: 200, files: 100, bytes: 50 * 1024 * 1024, depth: 2};

// Read streams sequentially and never write archive paths to the filesystem.
export function readZip(buffer, {maxEntries = ARCHIVE_LIMITS.entries, maxBytes = ARCHIVE_LIMITS.bytes, maxFileBytes = 8 * 1024 * 1024, include = () => true, onSkip = () => {}} = {}) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, {lazyEntries: true, validateEntrySizes: true, strictFileNames: true}, (error, zip) => {
      if (error) { reject(new ArchiveError('invalidArchive')); return; }
      const files = new Map(); let count = 0, declared = 0, actual = 0, done = false;
      const fail = code => { if (done) return; done = true; zip.close(); reject(new ArchiveError(code)); };
      zip.on('error', () => fail('invalidArchive'));
      zip.on('end', () => { if (!done) { done = true; zip.close(); resolve(files); } });
      zip.on('entry', entry => {
        if (done) return;
        if (++count > maxEntries) { fail('archiveLimit'); return; }
        let name = entry.fileName;
        if (!(entry.generalPurposeBitFlag & 0x800)) {
          try { name = new TextDecoder('utf-8', {fatal: true}).decode(entry.fileNameRaw); } catch { /* Preserve the archive's legacy encoding. */ }
        }
        if (name.includes('\0') || name.split('/').some(part => part === '..') || /^(\/|[A-Za-z]:)/.test(name) || ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) { fail('invalidArchive'); return; }
        declared += entry.uncompressedSize;
        if (declared > maxBytes || entry.uncompressedSize > maxFileBytes) { fail('archiveLimit'); return; }
        if (name.endsWith('/')) { zip.readEntry(); return; }
        if (entry.isEncrypted()) { onSkip(name, 'encrypted'); zip.readEntry(); return; }
        if (!include(name)) { onSkip(name, 'unsupported'); zip.readEntry(); return; }
        if (files.has(name)) { fail('invalidArchive'); return; }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) { fail('invalidArchive'); return; }
          let size = 0; const chunks = [];
          stream.on('data', chunk => {
            size += chunk.length; actual += chunk.length;
            if (size > maxFileBytes || actual > maxBytes) { stream.destroy(); fail('archiveLimit'); return; }
            chunks.push(chunk);
          });
          stream.on('error', () => fail('invalidArchive'));
          stream.on('end', () => { if (!done) { files.set(name, Buffer.concat(chunks)); zip.readEntry(); } });
        });
      });
      zip.readEntry();
    });
  });
}
