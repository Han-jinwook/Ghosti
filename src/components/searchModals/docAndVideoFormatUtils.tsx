import React from 'react';
import { stripKoSearchParticle } from '../../services/aiEngine';
import { formatQuickKoreanLabelCore } from '../../services/ai/aiSharedRuntime';

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

export function hasSensitiveDocInfo(_text: string): boolean {
  return false;
}

export function formatQuickKoreanLabelForFile(
  fileName: string,
  dateStr?: string,
  tagsOrTitle?: string | string[],
  options?: { mtimeMs?: number; existingNames?: string[] }
): string {
  return formatQuickKoreanLabelCore(fileName, dateStr, tagsOrTitle, options);
}
