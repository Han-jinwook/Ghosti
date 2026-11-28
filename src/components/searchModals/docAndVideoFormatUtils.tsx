import React from 'react';
import { stripKoSearchParticle } from '../../services/aiEngine';
import { formatQuickKoreanLabelCore } from '../../services/ai/aiSharedRuntime';
import { executeRealOsAction } from '../../services/setupMonsterEngine';
import { copyTextSafeToClipboard } from '../../services/proFeatureGate';
import { getZCoreUrl } from '../../services/zCoreBridge';
import { useSaySeeStore } from '../../store/useSaySeeStore';

const DOC_SNIPPET_STOP_WORDS = new Set([
  '찾아줘',
  '보여줘',
  '사진',
  '문서',
  '파일',
  '서류함',
  '최근',
  '서류',
  '내역',
  '전체',
  '통합',
  '로컬',
]);

function escapeRegExpChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractDocHighlightTokens(query: string, fallbackKeywords: string[] = []): string[] {
  const rawQ = (query || '').trim();
  const rawWords = rawQ
    .replace(/[.,!?'"“”‘’()[\]{}]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1 && !DOC_SNIPPET_STOP_WORDS.has(t));
  const isSingleWord = rawWords.length === 1;

  const out: string[] = [];
  for (const w of rawWords) {
    const stem = stripKoSearchParticle(w, isSingleWord);
    if (stem && !DOC_SNIPPET_STOP_WORDS.has(stem) && (stem.length >= 2 || isSingleWord)) {
      out.push(stem);
      const koPart = stem.match(/^[가-힣]{2,}(?=[a-zA-Z0-9]+)/)?.[0];
      if (koPart && koPart.length >= 2) {
        out.push(koPart);
      }
    }
  }

  // 사용자가 입력한 검색어에서 토큰이 1개 이상 추출되었으면 오직 검색어만 하이라이트합니다.
  // (fallbackKeywords는 검색어가 비어 있거나 불용어뿐일 때만 보조 하이라이트로 사용)
  if (out.length === 0) {
    for (const fk of fallbackKeywords) {
      const cleanFk = (fk || '').trim();
      if (cleanFk.length >= 2 && !DOC_SNIPPET_STOP_WORDS.has(cleanFk)) {
        out.push(cleanFk);
      }
    }
  }

  return Array.from(new Set(out));
}

function findBestKeywordMatchRange(
  cleanText: string,
  tokens: string[]
): { startIdx: number; endIdx: number } | null {
  if (!cleanText || tokens.length === 0) return null;
  const lowClean = cleanText.toLowerCase();

  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  for (const tk of sorted) {
    const idx = lowClean.indexOf(tk.toLowerCase());
    if (idx >= 0) {
      return { startIdx: idx, endIdx: idx + tk.length };
    }
  }

  for (const tk of sorted) {
    if (tk.length < 2) continue;
    const spacedPattern = Array.from(tk)
      .map((ch) => escapeRegExpChars(ch))
      .join('\\s*');
    const m = new RegExp(spacedPattern, 'i').exec(cleanText);
    if (m && m.index >= 0) {
      return { startIdx: m.index, endIdx: m.index + m[0].length };
    }
  }

  return null;
}

export function resolveDocExtBadge(doc: { fileName?: string; ext?: string }): string {
  const fname = (doc.fileName || '').trim();
  const dot = fname.lastIndexOf('.');
  if (dot > 0 && dot < fname.length - 1) {
    return fname.slice(dot + 1).toUpperCase();
  }
  return (doc.ext || 'DOC').toUpperCase();
}

export function formatVideoCardOcrSummary(
  ocrLines?: Array<{ text: string }>,
  query?: string
): string {
  if (!Array.isArray(ocrLines) || ocrLines.length === 0) return '';
  const cleaned = ocrLines
    .map((l) => (l?.text || '').trim())
    .filter(Boolean);
  if (cleaned.length === 0) return '';
  const koFirst = [
    ...cleaned.filter((t) => /[가-힣]{2,}/.test(t)),
    ...cleaned.filter((t) => !/[가-힣]{2,}/.test(t)),
  ];
  const joined = koFirst.join(' · ');
  if (query && query.trim()) {
    return buildDocPreviewSnippet(joined, query, 140);
  }
  return joined;
}

export function buildDocPreviewSnippet(
  text: string,
  query: string,
  maxLen = 180,
  fallbackKeywords: string[] = []
): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const tokens = extractDocHighlightTokens(query, fallbackKeywords);
  const hitRange = findBestKeywordMatchRange(clean, tokens);

  if (hitRange && hitRange.startIdx > 16) {
    let start = Math.max(0, hitRange.startIdx - 14);
    if (start > 0) {
      const nextSpace = clean.indexOf(' ', start);
      if (nextSpace > start && nextSpace <= hitRange.startIdx - 4) {
        start = nextSpace + 1;
      }
    }
    const end = Math.min(clean.length, Math.max(hitRange.endIdx + 60, start + maxLen));
    return `${start > 0 ? '…' : ''}${clean.slice(start, end).trim()}${end < clean.length ? '…' : ''}`;
  }

  return clean.length > maxLen ? `${clean.slice(0, maxLen).trim()}…` : clean;
}

export function renderHighlightedDocText(
  text: string,
  query: string,
  fallbackKeywords: string[] = []
): React.ReactNode {
  if (!text) return text;

  // [확정 ①] 비밀번호·계정 문서 ID/PW 인라인 복사 아이콘(📋) 지원:
  // 텍스트 내 "아이디: xxx", "비밀번호: yyy", "ID: xxx", "PW: yyy" 등 계정/암호 패턴이 있는 경우
  // 복사 느낌을 살린 📋 인라인 복사 버튼을 부착하여 0.1초 원클릭 복사를 지원합니다.
  const credRegex = /(?:(아이디|ID|계정|이메일|ID\/이메일|Email|User|Username)[\s:=]+([^\s,;]+))|(?:(비밀번호|비번|패스워드|PW|Password)[\s:=]+([^\s,;]+))/gi;
  if (credRegex.test(text)) {
    credRegex.lastIndex = 0;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    let keyIdx = 0;
    while ((match = credRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(renderHighlightedDocTextSimple(text.slice(lastIdx, match.index), query, fallbackKeywords));
      }
      const label = match[1] || match[3] || '';
      const val = match[2] || match[4] || '';
      const fullMatch = match[0];
      const sep = fullMatch.slice(label.length, fullMatch.length - val.length);
      parts.push(
        <span key={`cred-${keyIdx++}`} className="inline-flex items-center gap-1 font-medium">
          <span>{label}{sep}</span>
          <span className="font-mono bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-[11.5px] font-semibold">{val}</span>
          <button
            type="button"
            title={`${label} 복사`}
            aria-label={`${label} 복사`}
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard?.writeText(val);
              useSaySeeStore.setState({
                lastQuarantineToast: `[${label}] ${val} 클립보드에 복사되었습니다!`,
              });
            }}
            className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors text-[12px]"
          >
            📋
          </button>
        </span>
      );
      lastIdx = credRegex.lastIndex;
    }
    if (lastIdx < text.length) {
      parts.push(renderHighlightedDocTextSimple(text.slice(lastIdx), query, fallbackKeywords));
    }
    return <>{parts}</>;
  }

  return renderHighlightedDocTextSimple(text, query, fallbackKeywords);
}

function renderHighlightedDocTextSimple(
  text: string,
  query: string,
  fallbackKeywords: string[] = []
): React.ReactNode {
  if (!text) return text;
  const activeTokens = extractDocHighlightTokens(query, fallbackKeywords);
  if (activeTokens.length === 0) return text;

  const patterns = Array.from(new Set(activeTokens))
    .sort((a, b) => b.length - a.length)
    .map((t) =>
      t.length >= 2
        ? Array.from(t)
            .map((ch) => escapeRegExpChars(ch))
            .join('\\s*')
        : escapeRegExpChars(t)
    );
  if (patterns.length === 0) return text;

  const captureRx = new RegExp(`(${patterns.join('|')})`, 'gi');
  const exactCheckRx = new RegExp(`^(?:${patterns.join('|')})$`, 'i');
  const parts = text.split(captureRx);

  return parts.map((part, idx) =>
    part && exactCheckRx.test(part) ? (
      <mark
        key={idx}
        className="bg-amber-300 text-zinc-950 font-extrabold px-1 py-0 rounded"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

export function maskSensitiveDocText(text: string, _forVoice = false): string {
  return text || '';
}

const CREDENTIAL_INLINE_RX =
  /((?:아이디|계정|ID|이메일|비밀번호|비번|패스워드|PW|Password)\s*[:：=]\s*)([^\s,;|/()[\]{}]+)/gi;

export function renderDocTextWithInlineCredentialCopy(
  text: string,
  query: string,
  fallbackKeywords: string[] = []
): React.ReactNode {
  if (!text) return text;
  CREDENTIAL_INLINE_RX.lastIndex = 0;
  if (!CREDENTIAL_INLINE_RX.test(text)) {
    return renderHighlightedDocText(text, query, fallbackKeywords);
  }
  CREDENTIAL_INLINE_RX.lastIndex = 0;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = CREDENTIAL_INLINE_RX.exec(text)) !== null) {
    const start = match.index;
    const prefix = match[1] || '';
    const value = match[2] || '';
    const end = start + match[0].length;
    if (start > lastIdx) {
      nodes.push(
        <React.Fragment key={`txt_${k++}`}>
          {renderHighlightedDocText(text.slice(lastIdx, start), query, fallbackKeywords)}
        </React.Fragment>
      );
    }
    const isPw = /(?:비밀번호|비번|패스워드|PW|Password)/i.test(prefix);
    const labelKo = isPw ? '비밀번호' : '아이디';
    nodes.push(
      <React.Fragment key={`cred_${k++}`}>
        {renderHighlightedDocText(prefix, query, fallbackKeywords)}
        <span className="font-semibold text-slate-900">
          {renderHighlightedDocText(value, query, fallbackKeywords)}
        </span>
        <button
          type="button"
          title={`${labelKo} 복사`}
          aria-label={`${labelKo} 복사`}
          onClick={(e) => {
            e.stopPropagation();
            void copyTextSafeToClipboard(value).then(() => {
              useSaySeeStore.setState({
                lastQuarantineToast: `${labelKo}가 클립보드에 복사되었습니다.`,
              });
            });
          }}
          className="inline-flex items-center justify-center ml-0.5 px-1 py-0 rounded hover:bg-slate-200/80 text-[11px] leading-none align-baseline cursor-pointer transition-colors"
        >
          📋
        </button>
      </React.Fragment>
    );
    lastIdx = end;
  }

  if (lastIdx < text.length) {
    nodes.push(
      <React.Fragment key={`tail_${k++}`}>
        {renderHighlightedDocText(text.slice(lastIdx), query, fallbackKeywords)}
      </React.Fragment>
    );
  }
  return nodes;
}

export function hasSensitiveDocInfo(_text: string): boolean {
  return false;
}

export function formatQuickKoreanLabelForFile(
  fileName: string,
  dateStr?: string,
  tagsOrTitle?: string | string[],
  options?: { takenAtMs?: number; mtimeMs?: number; existingNames?: string[] }
): string {
  return formatQuickKoreanLabelCore(fileName, dateStr, tagsOrTitle, options);
}

const SMART_ARCHIVE_EXT_RE = /\.(?:zip|7z|rar|tar|gz|tgz)$/i;

export function isSmartArchiveDoc(doc: { fileName?: string; path?: string; ext?: string }): boolean {
  const target = (doc.fileName || doc.path || '').trim();
  if (SMART_ARCHIVE_EXT_RE.test(target)) return true;
  const extUp = (doc.ext || '').trim().toUpperCase();
  return ['ZIP', '7Z', 'RAR', 'TAR', 'GZ', 'TGZ'].includes(extUp);
}

export async function extractLocalArchiveOneClick(doc: {
  fileName: string;
  path?: string;
}): Promise<void> {
  const targetPath = (doc.path || '').trim();
  if (!targetPath) {
    useSaySeeStore.setState({
      lastQuarantineToast: '실제 내 컴퓨터 파일 경로가 없어 압축을 풀 수 없습니다.',
    });
    return;
  }
  useSaySeeStore.setState({
    lastQuarantineToast: `⏳ '${doc.fileName}' 압축을 안전 폴더에 푸는 중입니다...`,
  });
  try {
    const res = await fetch(getZCoreUrl('/__archive/extract'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: targetPath,
        interactivePasswordPrompt: true,
        openExplorer: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      extractedFolder?: string;
      extractedCount?: number;
      cancelled?: boolean;
      message?: string;
      error?: string;
    };
    if (data.ok) {
      const folderName =
        String(data.extractedFolder || '')
          .split(/[\\/]/)
          .filter(Boolean)
          .pop() || doc.fileName;
      const countLabel = typeof data.extractedCount === 'number' ? ` (${data.extractedCount}개 파일)` : '';
      useSaySeeStore.setState({
        lastQuarantineToast: `✅ '${folderName}' 폴더에 깔끔하게 압축을 풀었습니다${countLabel}! 풀린 문서도 바로 검색됩니다.`,
      });
      void useSaySeeStore.getState().refreshLiveLocalFilesInSearchWindow();
      return;
    }
    if (data.cancelled) {
      useSaySeeStore.setState({
        lastQuarantineToast: '암호 입력이 취소되었습니다.',
      });
      return;
    }
    useSaySeeStore.setState({
      lastQuarantineToast: data.message || data.error || '압축 해제 중 오류가 발생했습니다.',
    });
  } catch {
    useSaySeeStore.setState({
      lastQuarantineToast: 'PC 엔진 연결 상태를 확인한 뒤 다시 시도해 주세요.',
    });
  }
}

export async function openLocalDocWithMissingGuard(doc: {
  id?: string;
  fileName: string;
  path?: string;
}): Promise<void> {
  const target = (doc.path || doc.fileName || '').trim();
  const res = await executeRealOsAction('open_file_search', target);
  if (res.ok) {
    useSaySeeStore.setState({
      lastQuarantineToast: res.summaryKo || `[${doc.fileName}] 파일을 열었습니다.`,
    });
    return;
  }
  const normPath = (doc.path || '').trim().toLowerCase();
  useSaySeeStore.setState((s) => {
    const isSameDoc = (d: { id?: string; path?: string; fileName?: string }) =>
      (doc.id && d.id === doc.id) ||
      (normPath && (d.path || '').trim().toLowerCase() === normPath);
    const shouldCloseModal = s.selectedDocModal ? isSameDoc(s.selectedDocModal) : false;
    return {
      localDocuments: s.localDocuments.filter((d) => !isSameDoc(d)),
      matchedLocalDocs: s.matchedLocalDocs.filter((d) => !isSameDoc(d)),
      ...(shouldCloseModal ? { selectedDocModal: null } : {}),
      lastQuarantineToast: `[${doc.fileName}] 파일이 이미 삭제되었거나 이동되어 목록에서 정리했습니다.`,
    };
  });
  void useSaySeeStore.getState().refreshLiveLocalFilesInSearchWindow();
}
