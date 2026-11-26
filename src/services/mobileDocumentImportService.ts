import { openDB } from 'idb';
import type { LocalDocumentFile } from '../types/saysee';

const MOBILE_DOCS_DB_NAME = 'ghosti_mobile_docs_db_v1';
const MOBILE_DOCS_STORE = 'docs';

async function getMobileDocsDb() {
  return openDB(MOBILE_DOCS_DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(MOBILE_DOCS_STORE)) {
        db.createObjectStore(MOBILE_DOCS_STORE, { keyPath: 'id' });
      }
    },
  });
}

export async function loadPersistedMobileImportedDocuments(): Promise<LocalDocumentFile[]> {
  try {
    const db = await getMobileDocsDb();
    const all = (await db.getAll(MOBILE_DOCS_STORE)) as LocalDocumentFile[];
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

export async function savePersistedMobileImportedDocuments(
  docs: LocalDocumentFile[]
): Promise<void> {
  if (!docs.length) return;
  try {
    const db = await getMobileDocsDb();
    const tx = db.transaction(MOBILE_DOCS_STORE, 'readwrite');
    for (const d of docs) {
      await tx.store.put(d);
    }
    await tx.done;
  } catch {
    /* ignore quota errors */
  }
}

function decodeTextWithFallback(bytes: Uint8Array): string {
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const badCount = (utf8.match(/\uFFFD/g) || []).length;
    if (badCount > Math.max(4, utf8.length * 0.05)) {
      try {
        return new TextDecoder('euc-kr', { fatal: false }).decode(bytes);
      } catch {
        return utf8;
      }
    }
    return utf8;
  } catch {
    return '';
  }
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const slice = compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength
    ) as ArrayBuffer;
    void writer.write(new Uint8Array(slice)).then(() => writer.close());
    const resp = new Response(ds.readable);
    const ab = await resp.arrayBuffer();
    return new Uint8Array(ab);
  } catch {
    return null;
  }
}

async function extractTextFromZipOfficeFile(
  buffer: ArrayBuffer,
  extLower: string
): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const chunks: string[] = [];
  let offset = 0;

  while (offset + 30 < bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    if (dataStart > bytes.length) break;

    const entryName = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.subarray(nameStart, nameStart + nameLen))
      .toLowerCase();

    // If data descriptor bit is set and compSize is 0, bail cleanly
    if ((flags & 0x08) !== 0 && compSize === 0) break;
    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.length) break;

    const isTargetXml =
      (extLower === 'docx' && (entryName === 'word/document.xml' || entryName.startsWith('word/header'))) ||
      (extLower === 'xlsx' && (entryName === 'xl/sharedstrings.xml' || entryName.startsWith('xl/worksheets/sheet'))) ||
      (extLower === 'pptx' && entryName.startsWith('ppt/slides/slide')) ||
      (extLower === 'hwpx' && entryName.startsWith('contents/section') && entryName.endsWith('.xml'));

    if (isTargetXml && compSize > 0 && compSize < 8 * 1024 * 1024) {
      let xmlBytes: Uint8Array | null = null;
      const rawSlice = bytes.subarray(dataStart, dataEnd);
      if (method === 0) {
        xmlBytes = rawSlice;
      } else if (method === 8) {
        xmlBytes = await inflateRawBytes(rawSlice);
      }
      if (xmlBytes) {
        const xmlText = new TextDecoder('utf-8', { fatal: false }).decode(xmlBytes);
        const plain = xmlText
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        if (plain) chunks.push(plain);
      }
    }

    offset = dataEnd;
  }
  return chunks.join('\n').slice(0, 40000);
}

function extractLightweightPdfText(buffer: ArrayBuffer): string {
  const raw = new TextDecoder('latin1').decode(new Uint8Array(buffer.slice(0, 2 * 1024 * 1024)));
  const matches: string[] = [];
  const rx = /\(([^()\\]{2,200})\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(raw)) !== null && matches.length < 400) {
    const cleaned = m[1].replace(/[^\x20-\x7E가-힣\s]/g, '').trim();
    if (cleaned.length >= 2) matches.push(cleaned);
  }
  return matches.join(' ').slice(0, 20000);
}

function tokenizeKeywords(title: string, text: string): string[] {
  const combined = `${title} ${text.slice(0, 1500)}`
    .replace(/[^\w가-힣\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 24);
  return Array.from(new Set(combined)).slice(0, 40);
}

export async function importMobileDocumentFiles(
  fileList: FileList | File[]
): Promise<LocalDocumentFile[]> {
  const files = Array.from(fileList || []);
  const results: LocalDocumentFile[] = [];

  for (const file of files) {
    if (!file || !file.name) continue;
    const rawName = file.name.trim();
    const dotIdx = rawName.lastIndexOf('.');
    const extLower = dotIdx > 0 ? rawName.slice(dotIdx + 1).toLowerCase() : 'txt';
    const extUpper = extLower.toUpperCase();
    const title = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName;

    let extractedText = '';
    try {
      const ab = await file.arrayBuffer();
      if (['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'log'].includes(extLower)) {
        extractedText = decodeTextWithFallback(new Uint8Array(ab)).slice(0, 40000);
      } else if (['docx', 'xlsx', 'pptx', 'hwpx'].includes(extLower)) {
        extractedText = await extractTextFromZipOfficeFile(ab, extLower);
      } else if (extLower === 'pdf') {
        extractedText = extractLightweightPdfText(ab);
      }
    } catch {
      /* fallback to filename metadata */
    }

    const finalBody =
      extractedText.trim() ||
      `[내 폰 파일 앱 문서] ${rawName} (${Math.max(1, Math.round(file.size / 1024))} KB)\n※ 파일명과 본문 키워드로 검색할 수 있습니다.`;

    const dt = new Date(file.lastModified || Date.now());
    const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
      dt.getDate()
    ).padStart(2, '0')}`;

    results.push({
      id: `mobile_doc_${rawName}_${file.size}`,
      fileName: rawName,
      path: `내 폰 파일 앱/${rawName}`,
      ext: extUpper,
      title,
      categoryBadge: '내 폰 문서',
      extractedText: finalBody,
      keywords: tokenizeKeywords(title, finalBody),
      date: dateStr,
      sizeKB: Math.max(1, Math.round(file.size / 1024)),
      deviceSource: '스마트폰 파일 앱',
    });
  }

  if (results.length > 0) {
    await savePersistedMobileImportedDocuments(results);
  }
  return results;
}
