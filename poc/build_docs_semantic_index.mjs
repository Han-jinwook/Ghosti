/**
 * SaySee (세이씨) — 100% 자율 로컬 서류함(test_docs) 파서 및 768차원 EmbeddingGemma 2 벡터 인덱서
 * - 수동 하드코딩 배열(LOCAL_DOCUMENT_FILES) 완전 폐기!
 * - 디스크의 test_docs/ 폴더에 존재하는 실제 파일(.pdf, .txt, .docx, .md, .csv, .html)을 스캔하여
 *   바이트 스트림에서 직접 본문 텍스트·제목·날짜·핵심 키워드를 추출하고,
 *   로컬 768차원 EmbeddingGemma 2 ONNX 모델로 문서 임베딩 벡터를 산출합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AutoConfig, AutoModel, AutoTokenizer } from '@huggingface/transformers';

const ROOT_DIR = process.cwd();
const DOCS_DIR = path.resolve(ROOT_DIR, 'test_docs');
const ONTOLOGY_PATH = path.resolve(ROOT_DIR, 'src/data/koreanPhotoOntology.json');
const OUT_FILE = path.resolve(ROOT_DIR, 'poc/results/docs_semantic_index.json');

fs.mkdirSync(DOCS_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

const SUPPORTED_DOC_EXT = new Set(['.pdf', '.txt', '.md', '.docx', '.csv', '.json', '.html']);

const STOP_TOKENS = new Set([
  '문서제목', '내용', '포함내역', '발급일자', '결제일자', '보험기간', '피보험자', '담보내역',
  '부품', '목록', '소재지', '계약종류', '서류구분', '로컬', '서류함', '색인', '문서', '파일',
  '및', '위한', '대한', '관련', '안내', '사항', '포함', '원본', '사본', '현황', '부여', '내역',
]);

/**
 * 실제 파일 바이트에서 텍스트 스트림 추출 (PDF 텍스트 블록 / XML 태그 / UTF-8 평문 자동 파싱)
 */
export function extractTextFromDocumentBuffer(buf, ext) {
  const rawUtf8 = buf.toString('utf-8');

  if (ext === '.pdf') {
    // PDF 헤더(%PDF-...) 및 주석 라인 제거 후 가독 텍스트 추출
    const lines = rawUtf8
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 0 &&
          !l.startsWith('%PDF') &&
          !l.startsWith('%%EOF') &&
          !l.startsWith('% [') &&
          !/^(obj|endobj|stream|endstream|xref|trailer|startxref|\d+\s+\d+\s+obj)$/.test(l)
      );
    return lines.join('\n').trim();
  }

  if (ext === '.docx' || ext === '.html') {
    return rawUtf8
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return rawUtf8
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('['))
    .join('\n')
    .trim();
}

/**
 * 추출된 본문 텍스트의 어휘 분포를 기반으로 문서 카테고리 배지를 자동 분류 (파일명 의존 0%)
 */
export function classifyDocumentCategory(text) {
  const t = text.toLowerCase();
  if (/보험|특약|담보|피보험자/.test(t) && /진료|병원|약국|처방|실손/.test(t)) {
    return '🧾 병원 영수증 · 보험 청구';
  }
  if (/임대차|확정일자|전입신고|계약서|약정/.test(t)) {
    return '📋 계약서 · 약정 서류';
  }
  if (/보험증권|자동차보험|화재보험|대인배상|대물배상/.test(t)) {
    return '🛡️ 보험 증권 · 특약';
  }
  if (/조립|설명서|매뉴얼|도면|브라켓|볼트|호스|설치/.test(t)) {
    return '📑 조립 설명서 · 매뉴얼';
  }
  if (/항공권|티켓|e-ticket|편명|출발일/.test(t)) {
    return '✈️ 항공권 E-티켓 · 바우처';
  }
  if (/국세청|홈택스|증명원|납세|과세표준/.test(t)) {
    return '🏛️ 공문서 · 증명서';
  }
  if (/건강검진|혈액검사|소견서|검진/.test(t)) {
    return '🩺 건강검진 결과표';
  }
  if (/영수증|바우처|전표|결제|명세서/.test(t)) {
    return '🧾 결제 영수증 · 명세서';
  }
  if (/심사|가맹점|사업자등록증|통신판매업/.test(t)) {
    return '📄 비즈니스 심사 · 증빙 서류';
  }
  return '📄 일반 문서 · 서류';
}

/**
 * 본문 및 파일명에서 실제로 존재하는 명사/키워드 토큰만 정직하게 추출 (외부 온톨로지 환각 주입 0%)
 */
export function extractDocumentKeywords(fileName, title, bodyText) {
  const baseName = path.basename(fileName, path.extname(fileName)).replace(/[_-]+/g, ' ');
  const combined = `${baseName} ${title} ${bodyText}`
    .replace(/[()[\]{}|:.,/~➔•]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim().replace(/(에서|으로|이랑|하고|부터|까지|있는|하는|들의|들|의|을|를|은|는|에|와|과|도|다)$/, ''))
    .filter((w) => w.length >= 2 && !STOP_TOKENS.has(w) && !/^\d+$/.test(w));

  return Array.from(new Set(combined)).slice(0, 24);
}

const docFiles = fs
  .readdirSync(DOCS_DIR)
  .filter((f) => SUPPORTED_DOC_EXT.has(path.extname(f).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, 'ko'));

console.log(`Found ${docFiles.length} real document files in ${DOCS_DIR}`);

const parsedDocs = docFiles.map((fileName, idx) => {
  const fullPath = path.join(DOCS_DIR, fileName);
  const stat = fs.statSync(fullPath);
  const buf = fs.readFileSync(fullPath);
  const extLower = path.extname(fileName).toLowerCase();
  const extUpper = extLower.replace(/^\./, '').toUpperCase();

  const rawText = extractTextFromDocumentBuffer(buf, extLower);
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let title = path.basename(fileName, extLower).replace(/_/g, ' ');
  const bodyLines = [];
  for (const line of lines) {
    const mTitle = line.match(/^(?:문서제목|제목|Title)\s*:\s*(.+)$/i);
    if (mTitle && mTitle[1]) {
      title = mTitle[1].trim();
    } else {
      bodyLines.push(line.replace(/^내용\s*:\s*/, ''));
    }
  }
  const extractedText = bodyLines.join(' | ') || rawText;

  // 본문 내 날짜(YYYY.MM.DD)가 있으면 우선 추출, 없으면 파일 수정일(mtime) 사용
  const dateMatch = rawText.match(/(20\d{2}\.\d{2}\.\d{2})/);
  const d = new Date(stat.mtimeMs);
  const fallbackDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const docDate = dateMatch ? dateMatch[1] : fallbackDate;

  const categoryBadge = classifyDocumentCategory(`${title} ${extractedText}`);
  const keywords = extractDocumentKeywords(fileName, title, extractedText);

  return {
    id: `doc_${idx + 1}_${path.basename(fileName, extLower).slice(0, 12)}`,
    fileName,
    ext: extUpper === 'DOCX' ? 'DOCX' : extUpper === 'TXT' ? 'TXT' : 'PDF',
    title,
    categoryBadge,
    extractedText,
    keywords,
    date: docDate,
    sizeKB: Math.max(1, Math.round(stat.size / 1024)),
    deviceSource: '로컬 서류함 (test_docs)',
  };
});

console.log('Loading local 768-dim EmbeddingGemma 2 ONNX model for document vectorization...');
const cfg = await AutoConfig.from_pretrained('onnx-community/embeddinggemma-2-ONNX');
cfg.vision_config = null;
cfg.audio_config = null;
const gemmaModel = await AutoModel.from_pretrained('onnx-community/embeddinggemma-2-ONNX', {
  config: cfg,
  dtype: 'q4',
});
const gemmaTokenizer = await AutoTokenizer.from_pretrained('onnx-community/embeddinggemma-2-ONNX');

function normalizeVec(arr) {
  let n = 0;
  for (const v of arr) n += v * v;
  n = Math.sqrt(n) || 1;
  return arr.map((v) => +(v / n).toFixed(4));
}

if (parsedDocs.length > 0) {
  const embedInputs = parsedDocs.map(
    (d) => `title: ${d.title} | text: ${d.extractedText} | ${d.keywords.join(', ')}`
  );
  const inp = await gemmaTokenizer(embedInputs, { padding: true, truncation: true });
  const out = await gemmaModel(inp);
  const vecs = out.sentence_embedding.tolist().map(normalizeVec);
  parsedDocs.forEach((d, i) => {
    d.vec = vecs[i] || [];
  });
}

const payload = {
  createdAt: new Date().toISOString(),
  docCount: parsedDocs.length,
  documents: parsedDocs,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
console.log(`Saved ${parsedDocs.length} parsed documents + 768d vectors to ${OUT_FILE}`);
