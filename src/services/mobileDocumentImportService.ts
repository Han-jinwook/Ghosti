import { openDB } from 'idb';
import type { LocalDocumentFile } from '../types/saysee';
import { extractNativeIosPdfText } from './ghostiMobileCareBridge';

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

async function inflateBytes(
  compressed: Uint8Array,
  format: 'deflate-raw' | 'deflate' = 'deflate-raw'
): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const ds = new DecompressionStream(format);
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

interface ZipEntryMeta {
  nameLower: string;
  method: number;
  compSize: number;
  localHeaderOffset: number;
}

function parseZipEntriesViaCentralDirectory(buffer: ArrayBuffer): ZipEntryMeta[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries: ZipEntryMeta[] = [];

  // 1) ZIP 끝부분에서 End of Central Directory (0x06054b50) 탐색 -> Data Descriptor(flags & 0x08) 문서 100% 지원!
  const searchStart = Math.max(0, bytes.length - 65558);
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset >= 0) {
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let pos = cdOffset;
    for (let idx = 0; idx < totalEntries && pos + 46 <= bytes.length; idx++) {
      if (view.getUint32(pos, true) !== 0x02014b50) break;
      const method = view.getUint16(pos + 10, true);
      const compSize = view.getUint32(pos + 20, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localHeaderOffset = view.getUint32(pos + 42, true);
      if (pos + 46 + nameLen > bytes.length) break;
      const nameLower = new TextDecoder('utf-8', { fatal: false })
        .decode(bytes.subarray(pos + 46, pos + 46 + nameLen))
        .toLowerCase();
      entries.push({ nameLower, method, compSize, localHeaderOffset });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    if (entries.length > 0) return entries;
  }

  // 2) EOCD 누락 시 Local File Header 선형 폴백
  let offset = 0;
  while (offset + 30 < bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const dataStart = offset + 30 + nameLen + extraLen;
    if (dataStart > bytes.length || ((flags & 0x08) !== 0 && compSize === 0)) break;
    const nameLower = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.subarray(offset + 30, offset + 30 + nameLen))
      .toLowerCase();
    entries.push({ nameLower, method, compSize, localHeaderOffset: offset });
    offset = dataStart + compSize;
  }
  return entries;
}

async function extractTextFromZipOfficeFile(
  buffer: ArrayBuffer,
  extLower: string
): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const chunks: string[] = [];
  const entries = parseZipEntriesViaCentralDirectory(buffer);

  for (const ent of entries) {
    const entryName = ent.nameLower;
    const isTargetXml =
      (extLower === 'docx' &&
        (entryName === 'word/document.xml' ||
          entryName.startsWith('word/header') ||
          entryName.startsWith('word/footer'))) ||
      (extLower === 'xlsx' &&
        (entryName === 'xl/sharedstrings.xml' || entryName.startsWith('xl/worksheets/sheet'))) ||
      (extLower === 'pptx' && entryName.startsWith('ppt/slides/slide')) ||
      (extLower === 'hwpx' &&
        entryName.startsWith('contents/section') &&
        entryName.endsWith('.xml'));

    if (!isTargetXml || ent.compSize <= 0 || ent.compSize >= 10 * 1024 * 1024) continue;
    const lh = ent.localHeaderOffset;
    if (lh + 30 > bytes.length || view.getUint32(lh, true) !== 0x04034b50) continue;
    const lhNameLen = view.getUint16(lh + 26, true);
    const lhExtraLen = view.getUint16(lh + 28, true);
    const dataStart = lh + 30 + lhNameLen + lhExtraLen;
    const dataEnd = dataStart + ent.compSize;
    if (dataEnd > bytes.length) continue;

    let xmlBytes: Uint8Array | null = null;
    const rawSlice = bytes.subarray(dataStart, dataEnd);
    if (ent.method === 0) {
      xmlBytes = rawSlice;
    } else if (ent.method === 8) {
      xmlBytes = await inflateBytes(rawSlice, 'deflate-raw');
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
  return chunks.join('\n').slice(0, 45000);
}

function decodePdfLiteralString(raw: string): string {
  const unescaped = raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
  if (unescaped.length >= 2 && unescaped.charCodeAt(0) === 0xfe && unescaped.charCodeAt(1) === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < unescaped.length; i += 2) {
      const code = (unescaped.charCodeAt(i) << 8) | unescaped.charCodeAt(i + 1);
      if (code >= 0x20) out += String.fromCharCode(code);
    }
    return out.trim();
  }
  return unescaped.replace(/[^\x20-\x7E가-힣\s]/g, '').trim();
}

function extractTextTokensFromPdfContent(content: string, out: string[]): void {
  const rxTj = /\(([^()]{1,300})\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = rxTj.exec(content)) !== null && out.length < 1200) {
    const cleaned = decodePdfLiteralString(m[1]);
    if (cleaned.length >= 1) out.push(cleaned);
  }
  const rxTJ = /\[([^\]]{1,1200})\]\s*TJ/g;
  while ((m = rxTJ.exec(content)) !== null && out.length < 1200) {
    const inner = m[1];
    const subParts: string[] = [];
    const rxSub = /\(([^()]{1,200})\)/g;
    let sm: RegExpExecArray | null;
    while ((sm = rxSub.exec(inner)) !== null) {
      const c = decodePdfLiteralString(sm[1]);
      if (c) subParts.push(c);
    }
    if (subParts.length > 0) out.push(subParts.join(''));
  }
}

async function extractPdfTextBestEffort(buffer: ArrayBuffer): Promise<string> {
  // 1순위: iOS 네이티브 PDFKit (한글·CID폰트·CMap·표 100% 완벽 본문 추출)
  const nativeIosText = await extractNativeIosPdfText(buffer);
  if (nativeIosText.length >= 2) {
    return nativeIosText.slice(0, 45000);
  }

  // 2순위: 범용 JS FlateDecode(zlib) 압축 해제 + PDF 텍스트 스트림 파싱
  const bytes = new Uint8Array(buffer.slice(0, 4 * 1024 * 1024));
  const raw = new TextDecoder('latin1').decode(bytes);
  const matches: string[] = [];
  extractTextTokensFromPdfContent(raw, matches);

  let pos = 0;
  let streamCount = 0;
  while (streamCount < 80 && matches.length < 1200) {
    const sIdx = raw.indexOf('stream', pos);
    if (sIdx < 0) break;
    let dataStart = sIdx + 6;
    if (raw[dataStart] === '\r' && raw[dataStart + 1] === '\n') dataStart += 2;
    else if (raw[dataStart] === '\n' || raw[dataStart] === '\r') dataStart += 1;
    const eIdx = raw.indexOf('endstream', dataStart);
    if (eIdx < 0) break;
    pos = eIdx + 9;
    streamCount++;
    const streamLen = eIdx - dataStart;
    if (streamLen <= 8 || streamLen > 512 * 1024) continue;
    const slice = bytes.subarray(dataStart, eIdx);
    const inflated =
      (await inflateBytes(slice, 'deflate')) || (await inflateBytes(slice, 'deflate-raw'));
    if (inflated) {
      const dec = new TextDecoder('latin1').decode(inflated);
      extractTextTokensFromPdfContent(dec, matches);
    }
  }
  return matches.join(' ').replace(/\s+/g, ' ').trim().slice(0, 30000);
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
        extractedText = await extractPdfTextBestEffort(ab);
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
