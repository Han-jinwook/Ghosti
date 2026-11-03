import { getZCoreUrl } from './zCoreBridge';
import { speakSetupMonsterTts, SETUP_MONSTER_TTS_RATE_DEFAULT } from './setupMonsterTts';
import type { LocalDocumentFile } from '../types/saysee';

/**
 * 🎙️ 귀신같이(Ghosti) 전 영역 무료 무제한 TTS ('현수 & 선희' 투톱) · 무토큰 문서 요약/키워드 발췌 낭독 ·
 *    실제 카톡 대화방 직행 장전 · 고난도 질문 시 단골 AI(기본값: 제미나이) 라이브 음성 바톤터치 ·
 *    [🎯 찾기] ↔ [✋ 손보기] 양방향 0토큰 통합 음성 라우터 엔진
 *
 * - 유료 Typecast 전면 배제 -> 100% 무료 MS 신경망(edge-tts) '현수(ko-KR-HyunsuNeural) & 선희(ko-KR-SunHiNeural)' 투톱 일원화
 * - 일일 10회 제한 등 횟수 제한 전면 폐지 ("내 폰·PC 속 내용검색·Z몬스터는 언제나 0원")
 * - 최근 열어본 AI 기록이 0건인 초기 유저는 기본값으로 '제미나이(Gemini, https://gemini.google.com/app)' 오픈
 */

export type GhostiNeuralVoiceRole = 'hyunsu_briefing' | 'sunhi_doc_reader';

export const GHOSTI_VOICE_ACTORS = {
  hyunsu_briefing: {
    voiceId: 'ko-KR-HyunsuNeural',
    nameKo: '현수',
    roleDesc: '귀신같이 손보기 안내, Z-코어 브리핑, 내용검색 짧은 결과 답변, AI 바톤터치 안내',
  },
  sunhi_doc_reader: {
    voiceId: 'ko-KR-SunHiNeural',
    nameKo: '선희',
    roleDesc: '스마트 서류함 문서 사전 요약본 낭독, 키워드 포함 문장 연속 낭독, 문서 본문 전체 낭독',
  },
} as const;

export type ZeroLlmVoiceDocIntentType =
  | 'DOC_SUMMARY_READ'
  | 'DOC_KEYWORD_SENTENCE_READ'
  | 'DOC_FACT_QA_READ'
  | 'KAKAO_REAL_CHATROOM_SEND'
  | 'HIGH_DIFFICULTY_AI_BATON_TOUCH'
  | 'SIMPLE_PERSPECTIVE_SEARCH';

export interface ParsedVoiceDocCommand {
  intentType: ZeroLlmVoiceDocIntentType;
  targetDocKeyword: string;
  extractKeywords: string[];
  kakaoRecipientName: string;
  rawQuestion: string;
  serverTokenCostWon: 0;
}

/**
 * [🎯 찾기] 화면에서 말했을 때 '[✋ 손보기(치우기/고치기/복원/요금·기능)]' 의도인지 0.001초 만에 판별하는 양방향 0토큰 라우터
 */
export function isMonsterCareIntentFromSearch(utterance: string): boolean {
  const raw = (utterance || '').trim();
  if (!raw) return false;
  // 카톡 전달, 문서 보증금/월세/금액 질문, 사진/영상 찾아줘 등은 [🎯 찾기] 고유 의도
  if (/(카톡|카카오톡).*?(전달|보내|전송)|(?:에게|한테|님께).*?(카톡|카카오톡)/i.test(raw)) return false;
  if (
    /(보증금|월세|임대료|관리비|위약금|만기일|계약금|잔금|계좌\s*번호|비밀번호|비번).*?(얼마|언제|알려|읽어|뭐야|어떻게)/i.test(
      raw
    )
  ) {
    return false;
  }
  return /(중복\s*사진|연사\s*정리|치워|청소|바탕화면\s*정리|다운로드.*?정리|설치\s*파일|글씨\s*(크기|키워|작아|크게)|원래대로|되돌려|복원\s*기록|복구해|사라졌|없어졌|날아갔|프린터|인쇄.*?안|와이파이.*?끊|인터넷.*?안|블루투스|소리.*?안|스피커|느려|버벅|사양\s*봐|스펙\s*봐|바이러스|랜섬웨어|백신|바로가기\s*만들)/i.test(
    raw
  );
}

/**
 * 100% 무토큰(Zero-LLM) 로컬 자연어 발화 의도 해석기 (0.001초 정규식/형태소 규칙)
 */
export function parseZeroLlmVoiceDocCommand(utterance: string): ParsedVoiceDocCommand {
  const raw = (utterance || '').trim();

  // 1) 카톡 실채팅방 파일 전달 ("사무실 계약서 찾아서 이쁜이에게 카톡 전달해줘" / "계약서 찾아서 카톡 이쁜이에게 전달해줘")
  const kakaoMatchA = raw.match(
    /^(.+?)\s*(?:찾아서\s*)?(?:카톡|카카오톡)(?:으로)?\s*['"]?([가-힣a-zA-Z0-9_]+?)['"]?(?:에게|한테|님께|방에)\s*(?:전달|보내|전송)/i
  );
  const kakaoMatchB = raw.match(
    /^(.+?)\s*(?:찾아서\s*)?['"]?([가-힣a-zA-Z0-9_]+?)['"]?(?:에게|한테|님께|방에)\s*(?:카톡|카카오톡)(?:으로)?\s*(?:전달|보내|전송)/i
  );
  const kakaoMatch = kakaoMatchA || kakaoMatchB;
  if (kakaoMatch) {
    return {
      intentType: 'KAKAO_REAL_CHATROOM_SEND',
      targetDocKeyword: kakaoMatch[1].replace(/(파일|문서|서류|좀)\s*$/, '').trim() || '계약서',
      extractKeywords: [],
      kakaoRecipientName: kakaoMatch[2].trim(),
      rawQuestion: raw,
      serverTokenCostWon: 0,
    };
  }

  // 1-B) 문서 내 핵심 수치/조건 즉답 ("보증금 얼마야?", "사무실 계약서 보증금이 얼마야?", "만기일 언제야?", "월세 얼마야?")
  const factQaMatch = raw.match(
    /(?:(.+?)\s*(?:에서|의)?\s*)?(보증금|월세|임대료|관리비|위약금|계약금|잔금|만기일|계약\s*기간|특약|계좌\s*번호|비밀번호|비번)(?:이|은|는|가)?\s*(얼마|언제|뭐야|어떻게|알려|읽어|몇)/i
  );
  if (factQaMatch) {
    const docHint =
      (factQaMatch[1] || '').replace(/(이|그|저|우리|내)\s*/g, '').trim() || '계약서';
    const factKey = factQaMatch[2].replace(/\s+/g, '').trim();
    return {
      intentType: 'DOC_FACT_QA_READ',
      targetDocKeyword: docHint,
      extractKeywords: [factKey],
      kakaoRecipientName: '',
      rawQuestion: raw,
      serverTokenCostWon: 0,
    };
  }

  // 2) 고난도 심층 분석/법률·유불리 상담 질문 ("이 계약서에서 나한테 불리한 조항 있어?", "독소조항 분석해줘", "어떻게 대응해야 해?")
  const highDifficultyRegex =
    /(불리한|유리한|독소\s*조항|위험한|문제\s*될|법적으로|검토해|분석해|해석해|상담|어떻게\s*해야|주의할\s*점|의견)/i;
  if (highDifficultyRegex.test(raw)) {
    const docHintMatch = raw.match(/([가-힣a-zA-Z0-9_]+(?:계약서|합의서|견적서|명세서|규약|문서|서류))/);
    return {
      intentType: 'HIGH_DIFFICULTY_AI_BATON_TOUCH',
      targetDocKeyword: docHintMatch ? docHintMatch[1] : '계약서',
      extractKeywords: [],
      kakaoRecipientName: '',
      rawQuestion: raw,
      serverTokenCostWon: 0,
    };
  }

  // 3) 특정 단어가 나오는 문장 전수 발췌 낭독 ("계약서에서 '위약금'이나 '해지' 나오는 문장 다 읽어줘")
  const kwReadMatch = raw.match(
    /(?:(.+?)(?:에서|중에서)\s*)?['"]?([가-힣a-zA-Z0-9_,\s·]+?)['"]?\s*(?:나오는|들어간|포함된|관련)\s*(?:문장|부분|구절).*?(?:읽어|들려|찾아)/i
  );
  if (kwReadMatch) {
    const docTarget = (kwReadMatch[1] || '계약서').trim();
    const kwRaw = kwReadMatch[2] || '';
    const kws = kwRaw
      .split(/(?:이나|나|또는|이랑|하고|,|\s)+/)
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    return {
      intentType: 'DOC_KEYWORD_SENTENCE_READ',
      targetDocKeyword: docTarget,
      extractKeywords: kws.length > 0 ? kws : [kwRaw.trim()],
      kakaoRecipientName: '',
      rawQuestion: raw,
      serverTokenCostWon: 0,
    };
  }

  // 4) 문서 사전 요약본 즉시 낭독 ("이 문서 요약해서 읽어줘", "핵심만 읽어줘")
  if (/(요약해\s*서?\s*읽어|핵심만\s*읽어|요약\s*낭독|간단히\s*읽어)/i.test(raw)) {
    const docHint = raw.replace(/(이\s*문서|요약해서|핵심만|읽어줘|들려줘)/gi, '').trim() || '계약서';
    return {
      intentType: 'DOC_SUMMARY_READ',
      targetDocKeyword: docHint,
      extractKeywords: [],
      kakaoRecipientName: '',
      rawQuestion: raw,
      serverTokenCostWon: 0,
    };
  }

  return {
    intentType: 'SIMPLE_PERSPECTIVE_SEARCH',
    targetDocKeyword: raw,
    extractKeywords: [],
    kakaoRecipientName: '',
    rawQuestion: raw,
    serverTokenCostWon: 0,
  };
}

/**
 * LLM 없이 로컬 텍스트에서 특정 키워드가 포함된 문장들만 0.001초 만에 전수 발췌 + 노란 형광펜 하이라이트 생성
 */
export function extractKeywordSentencesZeroLlm(
  fullText: string,
  keywords: string[]
): {
  matchedCount: number;
  hyunsuIntroText: string;
  sunhiReadScript: string;
  highlightedSentences: Array<{ index: number; sentence: string; matchedKeywords: string[] }>;
} {
  const cleanKeywords = (keywords || []).map((k) => k.trim()).filter(Boolean);
  const rawSentences = (fullText || '')
    .split(/(?<=[.?!다요함음])\s+|\r?\n+|\s*\|\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  const matched: Array<{ index: number; sentence: string; matchedKeywords: string[] }> = [];
  rawSentences.forEach((sent, idx) => {
    const hitKws = cleanKeywords.filter((kw) => sent.toLowerCase().includes(kw.toLowerCase()));
    if (hitKws.length > 0) {
      matched.push({
        index: idx + 1,
        sentence: sent,
        matchedKeywords: hitKws,
      });
    }
  });

  const kwLabel = cleanKeywords.join(', ');
  const hyunsuIntroText =
    matched.length > 0
      ? `요청하신 '${kwLabel}' 단어가 포함된 문장 총 ${matched.length}개를 찾았습니다. 선희 아나운서가 차례대로 읽어드립니다.`
      : `문서 본문에서 '${kwLabel}' 단어가 포함된 문장을 찾지 못했습니다.`;

  const sunhiReadScript = matched.map((m, i) => `${i + 1}번째 문장입니다. ${m.sentence}`).join(' ');

  return {
    matchedCount: matched.length,
    hyunsuIntroText,
    sunhiReadScript,
    highlightedSentences: matched,
  };
}

/**
 * 로컬 서류함 목록에서 발화 키워드와 가장 잘 매칭되는 문서를 찾고,
 * 보증금·월세·만기일·계좌번호 등 핵심 수치 즉답 브리핑 문장을 0토큰으로 생성합니다.
 */
export function resolveTargetDocAndBuildFactAnswer(
  docs: LocalDocumentFile[],
  targetDocKeyword: string,
  extractKeywords: string[] = []
): {
  matchedDoc: LocalDocumentFile | null;
  factAnswerKo: string;
  voiceRole: GhostiNeuralVoiceRole;
} {
  const kwLower = (targetDocKeyword || '').toLowerCase();
  const findBestDoc = (): LocalDocumentFile | null => {
    if (!docs || docs.length === 0) return null;
    for (const d of docs) {
      const hay = `${d.fileName} ${d.title} ${d.extractedText} ${(d.keywords || []).join(' ')}`.toLowerCase();
      if (kwLower && hay.includes(kwLower)) return d;
      if (/계약서|사무실|임대차|보증금|월세/.test(kwLower) && /계약서|임대차/.test(hay)) return d;
      if (/계좌|비밀번호|비번|아이디/.test(kwLower) && /계좌|계정관리표/.test(hay)) return d;
    }
    return (
      docs.find((d) => /계약서|임대차/.test(`${d.fileName} ${d.title}`)) ||
      docs[0] ||
      null
    );
  };

  const doc = findBestDoc();
  if (!doc) {
    return {
      matchedDoc: null,
      factAnswerKo: '스마트 서류함에서 관련 문서를 찾지 못했습니다.',
      voiceRole: 'hyunsu_briefing',
    };
  }

  const factKey = extractKeywords[0] || '';
  const text = doc.extractedText || '';
  const segments = text
    .split(/\s*\|\s*|\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (factKey) {
    const matchedSegs = segments.filter((seg) => seg.includes(factKey));
    if (matchedSegs.length > 0) {
      return {
        matchedDoc: doc,
        factAnswerKo: `찾으신 '${doc.title}' 확인 결과, ${matchedSegs.join(' · ')}입니다. (전체 내용: ${text})`,
        voiceRole: 'hyunsu_briefing',
      };
    }
  }

  return {
    matchedDoc: doc,
    factAnswerKo: `찾으신 '${doc.title}'의 핵심 내용입니다. ${text}`,
    voiceRole: 'sunhi_doc_reader',
  };
}

/**
 * 무료 MS 신경망 '현수(ko-KR-HyunsuNeural)' 또는 '선희(ko-KR-SunHiNeural)' 음성으로 즉시 발화 (횟수 제한 없음 · 평생 0원)
 * - PC/모바일 공통 3단 캐시 + 구형 기계음(Microsoft Heami) 100% 원천 차단 + 경쾌한 속도(+15%)
 */
export async function speakWithHyunsuOrSunhi(
  text: string,
  role: GhostiNeuralVoiceRole = 'hyunsu_briefing',
  rate: string = SETUP_MONSTER_TTS_RATE_DEFAULT
): Promise<{ ok: boolean; voiceId: string; audioUrl?: string }> {
  const voiceId = GHOSTI_VOICE_ACTORS[role].voiceId;
  const res = await speakSetupMonsterTts(text, { voice: voiceId, rate });
  return {
    ok: res.ok,
    voiceId,
    audioUrl: res.audioUrl,
  };
}

/**
 * "계약서 찾아서 카톡 '이쁜이'에게 전달해줘" — 실제 카카오톡 대화방 직행 장전 & 전송 후 귀신같이 복귀
 */
export async function dispatchFileToKakaoRealChatroom(params: {
  recipientName: string;
  fileName: string;
  filePath?: string;
}): Promise<{
  ok: boolean;
  recipientName: string;
  fileName: string;
  hyunsuAnnouncement: string;
  floatingReturnPillLabel: string;
}> {
  const announcement = `찾으신 '${params.fileName}' 파일을 카카오톡 '${params.recipientName}' 대화방에 바로 올려두었습니다. 실제 카톡 화면에서 대화방을 눈으로 확인하신 뒤 엔터만 한 번 눌러주세요! 전송이 확인되면 1초 뒤 귀신같이 화면으로 자동 복귀합니다.`;
  void speakWithHyunsuOrSunhi(announcement, 'hyunsu_briefing');

  try {
    await fetch('/api/senstalk/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.recipientName,
        channel: 'kakao',
        msg: `[귀신같이 파일 전달] ${params.fileName}${params.filePath ? `\n경로: ${params.filePath}` : ''}`,
      }),
    });
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    recipientName: params.recipientName,
    fileName: params.fileName,
    hyunsuAnnouncement: announcement,
    floatingReturnPillLabel: '⬅️ 전송 완료 후 귀신같이 화면으로 즉시 복귀',
  };
}

/**
 * 무료 범위를 넘는 고난도 질문 시 — 유저가 최근 열어본 AI(ChatGPT/Gemini/Claude, 기록 0건 시 기본값: 제미나이)
 * 입력창 자동 채움 & [① 전송 ↑ ➔ ② 라이브 음성 🎧] 2단계 손가락 바톤터치
 */
export async function triggerUserFavoriteAiLiveVoiceBatonTouch(params: {
  docTitle: string;
  docText: string;
  userQuestion: string;
}): Promise<{
  ok: boolean;
  detectedAiService: string;
  detectedAiLabel: string;
  targetUrl: string;
  detectionSource: string;
  ttsBriefingKo: string;
  twoStepFingerGuide: Array<{ step: number; label: string; desc: string }>;
  floatingReturnPill: string;
}> {
  try {
    const res = await fetch(getZCoreUrl('/__zcore/ai-baton-touch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data?.ok) {
      void speakWithHyunsuOrSunhi(data.ttsBriefingKo, 'hyunsu_briefing');
      return data;
    }
  } catch {
    /* fallback to default Gemini */
  }

  const fallbackBriefing =
    '깊은 분석이 필요한 질문이네요! 평소 쓰시는 제미나이(Gemini) 입력창에 이 문서와 질문을 바로 넣어 띄워드릴게요. [전송] 버튼을 누르신 뒤, 바로 옆 [라이브 음성] 버튼을 누르시면 말로 편하게 상담하실 수 있습니다!';
  void speakWithHyunsuOrSunhi(fallbackBriefing, 'hyunsu_briefing');

  return {
    ok: true,
    detectedAiService: 'gemini',
    detectedAiLabel: '제미나이 (Gemini)',
    targetUrl: 'https://gemini.google.com/app',
    detectionSource: 'DEFAULT_GEMINI_FALLBACK',
    ttsBriefingKo: fallbackBriefing,
    twoStepFingerGuide: [
      { step: 1, label: '① [전송 (↑)] 버튼 클릭', desc: '이미 채워진 문서+질문을 즉시 전송합니다.' },
      { step: 2, label: '② 바로 옆 [라이브 음성 🎧] 버튼 클릭', desc: '운전·이동 중에도 말로 편하게 심층 상담을 이어갑니다.' },
    ],
    floatingReturnPill: '⬅️ 대화 종료 후 귀신같이 복귀',
  };
}
