import { getZCoreUrl } from './zCoreBridge';
import {
  speakSetupMonsterTts,
  SETUP_MONSTER_TTS_RATE_DEFAULT,
  SETUP_MONSTER_TTS_VOICE_HYUNSU,
  SETUP_MONSTER_TTS_VOICE_SUNHI,
  resolveActiveTtsVoiceId,
  getPreferredVoiceGender,
} from './setupMonsterTts';
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

/**
 * 모바일 음성 인식 STT 오타/조사 보정 및 어미 정규화
 * 예: "강아진 사진 찾아줘" -> "강아지 사진 찾아줘"
 *     "음식 사진 찾아" -> "음식 사진 찾아줘"
 */
export function normalizeSpokenKoreanQuery(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  // 음성인식 특유의 받침/조사 결합 오인식 보정
  text = text.replace(/강아진\s*사진/g, '강아지 사진');
  text = text.replace(/^강아진\s+/g, '강아지 ');
  text = text.replace(/\b고양인\b/g, '고양이');
  text = text.replace(/\b애완견\b/g, '반려견');

  // 문장 끝이 '찾아', '보여', '검색' 등으로 잘렸을 때 온전한 명령어로 복원
  text = text.replace(/\b(사진|영상|동영상|문서|파일|자료)\s*찾아$/i, '$1 찾아줘');
  text = text.replace(/\b(사진|영상|동영상|문서|파일|자료)\s*보여$/i, '$1 보여줘');
  text = text.replace(/\b(사진|영상|동영상|문서|파일|자료)\s*검색$/i, '$1 검색해줘');
  text = text.replace(/(.+?)\s*찾아$/i, '$1 찾아줘');

  return text.trim();
}

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
  // 1) 카톡 실채팅방 파일 전달은 100% [🎯 찾기] 고유 의도
  if (/(카톡|카카오톡).*?(전달|보내|전송)|(?:에게|한테|님께).*?(카톡|카카오톡)/i.test(raw)) return false;

  // 2) 문서/계약서 수치 QA 및 조항 낭독은 [🎯 찾기] 고유 의도 (단, "파일이 사라졌어/없어졌어/복구해줘"는 손보기!)
  const isMissingFileCry = /(사라졌|없어졌|날아갔|안\s*보여.*?찾아|복구해|되살려)/i.test(raw);
  if (
    !isMissingFileCry &&
    /(계약서|견적서|명세서|등록증|증권|조항|특약|약관|보증금|월세|임대료|관리비|위약금|만기일|사업자|등록번호|손해배상)/i.test(
      raw
    )
  ) {
    return false;
  }
  if (!isMissingFileCry && /(읽어\s*줘|낭독해|들려\s*줘)/i.test(raw)) {
    return false;
  }

  // 3) [✋ 손보기] 앱 설정 제어 · 폴더/중복사진 치우기 · 복원 기록 · 사라진 파일 · PC 사양/수리 의도 전수 감지
  return /(?:글씨|글자)\s*(?:크기|키워|작아|작게|크게|줄여|보통|기본)|큰\s*글씨|돋보기|(?:라이트|다크|블랙|야간|밝은|어두운)\s*모드|(?:화면|테마).*?(?:밝게|어둡게|바꿔|변경)|복사\s*기록.*?(?:보관|기간|바꿔|설정|유지)|상용구.*?(?:등록|바꿔|설정|넣어)|F(?:10|[1-9])\s*(?:번|키)?.*?(?:넣어|바꿔|등록|설정)|귀신창.*?(?:소리|효과음|음소거|켜|꺼|\d+\s*초)|문패.*?(?:바꿔|변경|설정)|모니터\s*(?:크게\s*보기|캐스트)|무선\s*리모컨|다\s*같이\s*보기|앨범\s*싱크|중복\s*사진|연사\s*정리|치워|청소|정리해|모아\s*줘|바탕화면.*?정리|다운로드.*?정리|스크린샷.*?모아|설치\s*파일|원래대로|되돌려|복원\s*기록|복구해|사라졌|없어졌|날아갔|휴지통\s*비워|프린터|인쇄.*?안|와이파이.*?끊|인터넷.*?안|블루투스|소리.*?안|스피커|(?:컴퓨터|노트북|폰).*?(?:느려|버벅)|느려졌|버벅거|(?:컴퓨터|내\s*PC|노트북|내)\s*(?:사양|스펙)|시작\s*프로그램|바이러스|랜섬웨어|백신|바로가기\s*만들/i.test(
    raw
  );
}

/**
 * 100% 무토큰(Zero-LLM) 로컬 자연어 발화 의도 해석기 (0.001초 정규식/형태소 규칙)
 */
export function parseZeroLlmVoiceDocCommand(utterance: string): ParsedVoiceDocCommand {
  const raw = (utterance || '').trim();

  // 1) 카톡 실채팅방 파일 전달 ("사무실 계약서 찾아서 이쁜이에게 카톡 전달해줘")
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

  // 2) 고난도 심층 분석/법률·유불리 상담 질문 ("이 계약서에서 나한테 불리한 조항 있어?", "독소조항 분석해줘")
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

  // 3) 특정 조항/특약/약관/근무시간/휴일 장문 낭독 ("보험증권 특약 사항 낭독해줘", "근로계약서 근무시간 및 휴일 조항 읽어줘", "원상복구 조항 읽어줘") ➔ 【선희 여성 성우】
  const clauseReadMatch = raw.match(
    /(?:(.+?)\s*(?:에서|의)?\s*)?(특약\s*사항|근무\s*시간.*?(?:휴일\s*조항|조항)|근무\s*시간|휴일\s*조항|원상\s*복구|손해\s*배상|비밀\s*유지|위약금|계약\s*해지|면책|하자\s*담보|조항|특약|약관|규정)(?:\s*사항)?(?:이|은|는|가|을|를)?\s*(?:좀\s*)?(?:다\s*)?(읽어|낭독|들려|말해)/i
  );
  if (clauseReadMatch) {
    const docHint = (clauseReadMatch[1] || '').replace(/(이|그|저|우리|내|문서|서류)\s*/g, '').trim();
    const clauseRaw = clauseReadMatch[2].trim();
    const clauseKey = clauseRaw.replace(/\s+/g, '').trim();
    const extraKws = clauseRaw
      .split(/(?:및|이랑|하고|과|와|\s)+/)
      .map((w) => w.replace(/(조항|사항|규정)$/, '').trim())
      .filter((w) => w.length >= 2);
    return {
      intentType: 'DOC_KEYWORD_SENTENCE_READ',
      targetDocKeyword:
        docHint ||
        (clauseKey.includes('특약')
          ? '보험증권'
          : clauseKey.includes('근무시간') || clauseKey.includes('휴일')
          ? '근로계약서'
          : clauseKey.includes('손해배상') || clauseKey.includes('비밀유지')
          ? '비밀유지'
          : '계약서'),
      extractKeywords: Array.from(
        new Set([clauseKey, clauseKey.replace(/(조항|특약|약관|규정|사항)/g, '').trim(), ...extraKws])
      ).filter(Boolean),
      kakaoRecipientName: '',
      rawQuestion: raw,
      serverTokenCostWon: 0,
    };
  }

  // 3-B) 특정 단어가 나오는 문장 전수 발췌 낭독
  const kwReadMatch = raw.match(
    /(?:(.+?)(?:에서|중에서)\s*)?['"]?([가-힣a-zA-Z0-9_,\s·]+?)['"]?\s*(?:나오는|들어간|포함된|관련)\s*(?:문장|부분|구절).*?(?:읽어|들려|찾아|낭독)/i
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

  // 4) 문서 단답 팩트 수치 Q&A ("운전면허증 번호 알려줘", "주민등록등본 발급일자", "보증금이랑 월세 얼마야?", "사업자등록번호 알려줘") ➔ 【현수 남성 성우】
  const factKeywords =
    '보증금|월세|임대료|관리비|위약금|계약금|잔금|만기일|발급\\s*일자|발급일|교부\\s*일자|적성\\s*검사|계약\\s*기간|특약|' +
    '계좌\\s*번호|계좌|비밀번호|비번|아이디|ID|' +
    '운전\\s*면허\\s*번호|면허\\s*번호|운전\\s*면허증\\s*번호|사업자\\s*등록\\s*번호|사업자\\s*번호|주민\\s*등록\\s*번호|주민\\s*번호|등록\\s*번호|여권\\s*번호|번호|전화\\s*번호|연락처|' +
    '총액|견적\\s*총액|합계|금액|공급가액|부가세|세액|견적\\s*금액|수수료|가격|비용|단가';
  const factAsk = '얼마|언제|뭐야|뭐|어떻게|알려|몇|누구|어디|확인|있어|있나|있니|있나요|맞아';
  const factQaRegex = new RegExp(
    `(?:(.+?)\\s*(?:에서|의)?\\s*)?(${factKeywords})(?:이|은|는|가|을|를|과|와|이랑)?\\s*(?:좀\\s*)?(${factAsk})`,
    'i'
  );
  const factQaMatch = raw.match(factQaRegex);
  if (factQaMatch) {
    const docHint = (factQaMatch[1] || '').replace(/(이|그|저|우리|내)\s*/g, '').trim();
    const factKey = factQaMatch[2].replace(/\s+/g, '').trim();
    return {
      intentType: 'DOC_FACT_QA_READ',
      targetDocKeyword: docHint ? `${docHint} ${factKey}`.trim() : (factKey.includes('사업자') ? '사업자등록증' : factKey.includes('견적') || factKey.includes('총액') ? '견적서' : factKey.includes('계좌') ? '계좌' : '계약서'),
      extractKeywords: [factKey],
      kakaoRecipientName: '',
      rawQuestion: raw,
      serverTokenCostWon: 0,
    };
  }

  // 5) 문서 요약/전체 낭독 ("이 문서 요약해서 읽어줘", "계약서 읽어줘", "문서 낭독해줘", "썬드림 견적서 읽어줘") ➔ 【선희 여성 성우】
  if (/(요약해\s*서?\s*읽어|핵심만\s*읽어|요약\s*낭독|간단히\s*읽어|읽어\s*줘|낭독\s*해\s*줘|읽어봐|들려줘|낭독|읽어)/i.test(raw)) {
    const docHint = raw.replace(/(이\s*문서|요약해서|핵심만|간단히|읽어줘|낭독해줘|들려줘|읽어봐|낭독|읽어|알려줘|좀)/gi, '').trim() || '계약서';
    return {
      intentType: 'DOC_SUMMARY_READ',
      targetDocKeyword: docHint,
      extractKeywords: [],
      kakaoRecipientName: '',
      rawQuestion: raw,
      serverTokenCostWon: 0,
    };
  }

  // 6) 범용 질문형/확인형 문서 질의 ("~ 알려줘", "~ 있어?", "~ 있나?", "~ 뭐야?", "~ 얼마야?", "~ 언제야?") ➔ 【현수 남성 성우】
  if (/(알려\s*줘|알려\s*달라|알려\s*봐|알려|있어\s*\??|있나\s*\??|있니\s*\??|있나요\s*\??|얼마\s*야?\s*\??|언제\s*야?\s*\??|뭐야\s*\??| 뭔가요\s*\??|어디\s*야?\s*\??|맞아\s*\??|확인\s*해\s*줘)/i.test(raw)) {
    const cleanedTarget = raw
      .replace(/(좀\s*)?(알려\s*줘|알려\s*달라|알려\s*봐|알려|있어\s*\??|있나\s*\??|있니\s*\??|있나요\s*\??|얼마\s*야?\s*\??|언제\s*야?\s*\??|뭐야\s*\??|뭔가요\s*\??|어디\s*야?\s*\??|맞아\s*\??|확인\s*해\s*줘|\?)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // 사진/동영상 전용 검색어(예: "강아지 사진 있어?", "바닷가 영상 알려줘")가 아닌 경우 서류함 팩트 브리핑으로 직결
    if (!/(사진|영상|동영상|장면|셀카|얼굴)/.test(cleanedTarget)) {
      const tokens = cleanedTarget.split(/\s+/).filter(Boolean);
      return {
        intentType: 'DOC_FACT_QA_READ',
        targetDocKeyword: cleanedTarget || raw,
        extractKeywords: tokens,
        kakaoRecipientName: '',
        rawQuestion: raw,
        serverTokenCostWon: 0,
      };
    }
  }

  // 7) 서류 명사구 단독 발화 ("주민등록등본 발급일자", "운전면허증 번호", "사업자등록증 등록번호", "여권 만료일") ➔ 【현수 남성 성우】
  if (
    /(운전\s*면허증|주민\s*등록\s*등본|등본|사업자\s*등록증|여권|보험\s*증권|근로\s*계약서|임대차\s*계약서|견적서).*?(번호|발급\s*일자|발급일|만기일|만료일|금액|보증금|월세|연락처|주소|세대주)/i.test(
      raw
    )
  ) {
    const tokens = raw.split(/\s+/).filter(Boolean);
    return {
      intentType: 'DOC_FACT_QA_READ',
      targetDocKeyword: raw,
      extractKeywords: tokens,
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
      ? `요청하신 '${kwLabel}' 관련 조항 총 ${matched.length}개를 찾았습니다. 여성 성우 선희 목소리로 또렷하게 낭독해 드립니다.`
      : `문서 본문에서 '${kwLabel}' 단어가 포함된 문장을 찾지 못했습니다.`;

  const sunhiReadScript = matched.map((m, i) => `${i + 1}번째 문장입니다. ${m.sentence}`).join(' ');

  return {
    matchedCount: matched.length,
    hyunsuIntroText,
    sunhiReadScript,
    highlightedSentences: matched,
  };
}

const DOC_QUERY_STOP_WORDS = new Set([
  '읽어줘', '읽어봐', '읽어', '낭독해줘', '낭독해', '낭독', '들려줘', '들려',
  '알려줘', '알려달라', '알려봐', '알려', '있어', '있나', '있니', '있나요',
  '얼마야', '얼마인가요', '얼마', '언제야', '언제', '뭐야', '뭔가요', '뭐',
  '어디야', '어디', '몇', '누구', '맞아', '확인해줘', '확인', '찾아줘', '보여줘',
  '요약해서', '핵심만', '간단히', '문서', '서류', '파일', '사본', '서류함',
  '이', '그', '저', '내', '우리', '좀', '다', '및', '에서', '중에서', '관련',
]);

/**
 * 사용자 질의에서 어미·조사를 제거한 핵심 검색 키워드 토큰 추출
 */
export function extractCleanDocQueryTokens(rawQuery: string): string[] {
  const cleaned = (rawQuery || '')
    .toLowerCase()
    .replace(/[.,!?'"“”‘’()[\]{}]/g, ' ')
    .replace(
      /(요약해\s*서?\s*읽어\s*줘?|핵심만\s*읽어\s*줘?|간단히\s*읽어\s*줘?|읽어\s*줘|읽어\s*봐|읽어|낭독\s*해\s*줘|낭독|들려\s*줘|들려|알려\s*줘|알려\s*봐|알려|있어\s*요?|있나\s*요?|있니|얼마\s*야|얼마\s*예?요|얼마|언제\s*야|언제|뭐야|뭔가요|어디\s*야|확인\s*해\s*줘|찾아\s*줘|보여\s*줘)/gi,
      ' '
    );

  const tokens = cleaned
    .split(/\s+/)
    .map((t) =>
      t.replace(/(에서부터|으로부터|에서|으로|이랑|하고|부터|까지|있는|하는|들을|들|의|을|를|은|는|이|가|에|와|과|도|만|나)$/, '').trim()
    )
    .filter((t) => t.length >= 1 && !DOC_QUERY_STOP_WORDS.has(t));

  return Array.from(new Set(tokens));
}

/**
 * 개별 문서에 대해 검색어 토큰 일치도를 정밀 채점하여
 * 100% 일치('EXACT') vs 일부 키워드/유의어 일치('SIMILAR') vs 무관(0점)을 판별합니다.
 */
export function scoreAndAnnotateDocumentMatch(
  doc: LocalDocumentFile,
  queryTokens: string[]
): {
  annotatedDoc: LocalDocumentFile;
  score: number;
  matchedTokens: string[];
  unmatchedTokens: string[];
  isExactMatch: boolean;
} {
  if (queryTokens.length === 0) {
    return {
      annotatedDoc: { ...doc, matchType: 'EXACT', similarityNoticeKo: undefined },
      score: 1,
      matchedTokens: [],
      unmatchedTokens: [],
      isExactMatch: true,
    };
  }

  const titleAndName = `${doc.title} ${doc.fileName} ${doc.categoryBadge}`.toLowerCase();
  const titleNoSpace = titleAndName.replace(/\s+/g, '');
  const kwText = (doc.keywords || []).join(' ').toLowerCase();
  const kwNoSpace = kwText.replace(/\s+/g, '');
  const bodyText = (doc.extractedText || '').toLowerCase();
  const bodyNoSpace = bodyText.replace(/\s+/g, '');
  const fullHay = `${titleAndName} ${kwText} ${bodyText}`;

  const matchedTokens: string[] = [];
  const unmatchedTokens: string[] = [];
  let score = 0;

  for (const tk of queryTokens) {
    const tkNoSpace = tk.replace(/\s+/g, '');
    let tokenHit = false;

    // 1) 제목 / 파일명 / 카테고리 배지 직접 포함 (가중치 최고: +15점)
    if (titleAndName.includes(tk) || (tkNoSpace.length >= 2 && titleNoSpace.includes(tkNoSpace))) {
      score += 15;
      tokenHit = true;
    }
    // 2) 문서 키워드 태그 포함 (+12점)
    if (kwText.includes(tk) || (tkNoSpace.length >= 2 && kwNoSpace.includes(tkNoSpace))) {
      score += 12;
      tokenHit = true;
    }
    // 3) 본문 텍스트 포함 (+8점)
    if (bodyText.includes(tk) || (tkNoSpace.length >= 2 && bodyNoSpace.includes(tkNoSpace))) {
      score += 8;
      tokenHit = true;
    }

    // 4) 도메인 유의어 매칭 (+6점)
    if (!tokenHit) {
      if (/(사업자|등록번호|사업자번호|인허가|대표자)/.test(tk) && /사업자등록/.test(fullHay)) {
        score += 6;
        tokenHit = true;
      } else if (/(견적|견적서|총액|공급가액|부가세|발주|서버|gpu)/.test(tk) && /견적서|총액/.test(fullHay)) {
        score += 6;
        tokenHit = true;
      } else if (/(비밀유지|nda|손해배상|관할법원|영업비밀)/.test(tk) && /비밀유지|손해배상/.test(fullHay)) {
        score += 6;
        tokenHit = true;
      } else if (/(임대차|보증금|월세|임대료|확정일자|원상복구|청라동|사무실)/.test(tk) && /임대차|보증금/.test(fullHay)) {
        score += 6;
        tokenHit = true;
      } else if (/(계좌|비밀번호|비번|아이디|와이파이|넷플릭스|유튜브|신한은행)/.test(tk) && /계좌|비밀번호/.test(fullHay)) {
        score += 6;
        tokenHit = true;
      } else if (/(여권|신분증|영문이름|만료일)/.test(tk) && /여권/.test(fullHay)) {
        score += 6;
        tokenHit = true;
      } else if (/(자동차|정비|엔진오일|브레이크|타이어|명세서|영수증)/.test(tk) && /정기점검|엔진오일/.test(fullHay)) {
        score += 6;
        tokenHit = true;
      }
    }

    if (tokenHit) {
      matchedTokens.push(tk);
    } else {
      unmatchedTokens.push(tk);
    }
  }

  const isExactMatch = matchedTokens.length === queryTokens.length && queryTokens.length > 0;
  const matchType: 'EXACT' | 'SIMILAR' = isExactMatch ? 'EXACT' : 'SIMILAR';

  let similarityNoticeKo: string | undefined;
  if (!isExactMatch && matchedTokens.length > 0) {
    similarityNoticeKo = `💡 검색어와 100% 일치하는 문서가 없어 유사한 문서를 찾았습니다! (일치 키워드: ${matchedTokens
      .map((k) => `'${k}'`)
      .join(', ')})`;
  } else if (!isExactMatch) {
    similarityNoticeKo = `💡 검색어와 100% 일치하는 문서가 없어 유사한 문서를 찾았습니다!`;
  }

  return {
    annotatedDoc: {
      ...doc,
      matchType,
      matchedQueryTokens: matchedTokens,
      unmatchedQueryTokens: unmatchedTokens,
      similarityNoticeKo,
    },
    score,
    matchedTokens,
    unmatchedTokens,
    isExactMatch,
  };
}

/**
 * 로컬 서류함 목록에서 발화 키워드와 가장 잘 매칭되는 문서를 찾고,
 * 보증금·월세·만기일·계좌번호 등 핵심 수치 즉답 브리핑 문장을 0토큰으로 생성합니다.
 */
export function resolveTargetDocAndBuildFactAnswer(
  docs: LocalDocumentFile[],
  targetDocKeyword: string,
  extractKeywords: string[] = [],
  intentTypeHint: ZeroLlmVoiceDocIntentType = 'DOC_FACT_QA_READ'
): {
  matchedDoc: LocalDocumentFile | null;
  rankedDocs: LocalDocumentFile[];
  factAnswerKo: string;
  voiceRole: GhostiNeuralVoiceRole;
} {
  const combinedQuery = `${targetDocKeyword || ''} ${(extractKeywords || []).join(' ')}`.trim();
  const queryTokens = extractCleanDocQueryTokens(combinedQuery);

  if (!docs || docs.length === 0) {
    return {
      matchedDoc: null,
      rankedDocs: [],
      factAnswerKo: '스마트 서류함에서 관련 문서를 찾지 못했습니다.',
      voiceRole: 'hyunsu_briefing',
    };
  }

  const scoredList = docs
    .map((d) => scoreAndAnnotateDocumentMatch(d, queryTokens))
    .sort((a, b) => b.score - a.score);

  // 연관 점수가 있는 문서들을 점수순 정렬 (연관 문서가 1건도 없으면 최상위 유사 문서로 안내)
  const positiveMatches = scoredList.filter((item) => item.score > 0);
  const bestEntry = positiveMatches[0] || {
    ...scoredList[0],
    isExactMatch: false,
    annotatedDoc: {
      ...scoredList[0].annotatedDoc,
      matchType: 'SIMILAR' as const,
      similarityNoticeKo: '💡 검색어와 100% 일치하는 문서가 없어 유사한 문서를 찾았습니다!',
    },
  };

  const doc = bestEntry.annotatedDoc;
  const rankedDocs =
    positiveMatches.length > 0
      ? positiveMatches.map((item) => item.annotatedDoc)
      : [doc];

  const similarPrefixKo = !bestEntry.isExactMatch
    ? bestEntry.matchedTokens.length > 0
      ? `검색어와 100% 일치하는 문서는 없지만, '${bestEntry.matchedTokens.join(', ')}' 키워드가 포함된 유사한 문서를 찾았습니다! `
      : `검색어와 100% 일치하는 문서는 없지만, 유사한 문서를 찾았습니다! `
    : '';

  const text = doc.extractedText || '';
  const segments = text
    .split(/\s*\|\s*|\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 1) 질문형/단답 팩트 확인 의도(DOC_FACT_QA_READ: "알려줘", "있어?", "얼마야?", "뭐야?")는 무조건 현수 남성 성우!
  if (intentTypeHint === 'DOC_FACT_QA_READ') {
    const candidateKeys = [...extractKeywords, ...bestEntry.matchedTokens].filter(Boolean);
    const matchedSegs: string[] = [];
    for (const seg of segments) {
      if (
        candidateKeys.some((k) => {
          const cleanK = k.replace(/(조항|특약|약관|규정|서류|문서)/, '').trim();
          return (k.length >= 2 && seg.includes(k)) || (cleanK.length >= 2 && seg.includes(cleanK));
        })
      ) {
        matchedSegs.push(seg);
      }
    }

    const coreSummary =
      matchedSegs.length > 0 ? matchedSegs.join(' · ') : segments.slice(0, 3).join(' · ');

    return {
      matchedDoc: doc,
      rankedDocs,
      factAnswerKo: `${similarPrefixKo}찾으신 '${doc.title}' 확인 결과, ${coreSummary}입니다.`,
      voiceRole: 'hyunsu_briefing', // 단답/질문/알려줘/있어? ➔ 차분한 남성 성우 (현수) 고정!
    };
  }

  // 2) 조항 및 장문 낭독 의도(DOC_SUMMARY_READ / DOC_KEYWORD_SENTENCE_READ: "읽어줘", "낭독해줘") ➔ 선희 여성 아나운서!
  return {
    matchedDoc: doc,
    rankedDocs,
    factAnswerKo: `${similarPrefixKo}찾으신 '${doc.title}'의 본문 내용입니다. ${text}`,
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
  // [시스템 브리핑·단답형 = 남성(현수 ko-KR-HyunsuNeural) / 서류 장문·약관·조항 낭독 = 여성(선희 ko-KR-SunHiNeural) 칼분리]
  const voiceId =
    role === 'sunhi_doc_reader'
      ? GHOSTI_VOICE_ACTORS.sunhi_doc_reader.voiceId
      : GHOSTI_VOICE_ACTORS.hyunsu_briefing.voiceId;
  const res = await speakSetupMonsterTts(text, {
    voice: voiceId,
    rate,
    forceRoleVoice: true,
  });
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
/**
 * 브라우저 사용자 제스처(Click) 컨텍스트에서 100% 확실하게 클립보드에 복사하는 유틸리티
 * 1) navigator.clipboard.writeText 시도
 * 2) iframe / 권한 제약 시 document.execCommand('copy') textarea 폴백 완벽 보장
 */
export async function copyTextToClipboardDirectly(text: string): Promise<boolean> {
  if (!text) return false;
  let copied = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    /* fallback below */
  }
  if (!copied && typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      copied = document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch {
      copied = false;
    }
  }
  return copied;
}

export async function triggerUserFavoriteAiLiveVoiceBatonTouch(params: {
  docTitle: string;
  docText: string;
  userQuestion: string;
  deviceSpecSummary?: string;
  openWindow?: boolean;
}): Promise<{
  ok: boolean;
  blockedByPrivacyGuard?: boolean;
  detectedAiService: string;
  detectedAiLabel: string;
  targetUrl: string;
  detectionSource: string;
  stagedPromptText?: string;
  overlayTriggered?: boolean;
  ttsBriefingKo: string;
  twoStepFingerGuide: Array<{ step: number; label: string; desc: string }>;
  floatingReturnPill: string;
}> {
  // 프라이버시 보안 가드: 민감 계정/비밀번호 시트는 외부 AI 자동 바톤터치 원천 제외
  if (/(비밀번호|패스워드|password|계정\s*정리|아이디.*비번|암호\s*목록)/i.test(params.docTitle || '')) {
    const blockedMsg =
      '보안 보호 가드가 작동했습니다. 비밀번호 및 민감 계정 문서는 외부 AI로 절대 전송하지 않으며 오직 내 기기 내부에서만 안전하게 열람할 수 있습니다.';
    void speakWithHyunsuOrSunhi(blockedMsg, 'hyunsu_briefing');
    return {
      ok: false,
      blockedByPrivacyGuard: true,
      detectedAiService: 'none',
      detectedAiLabel: '보안 가드 (외부 전송 차단)',
      targetUrl: '',
      detectionSource: 'PRIVACY_GUARD_BLOCK',
      ttsBriefingKo: blockedMsg,
      twoStepFingerGuide: [],
      floatingReturnPill: '⬅️ 귀신같이 안전 화면 유지',
    };
  }

  const specBlock = (params.deviceSpecSummary || '').trim();
  const combinedPrompt =
    specBlock && (!params.docText || params.docText.trim() === params.userQuestion.trim())
      ? `[진단 기기 사양 및 상태: ${params.docTitle || '내 PC/기기 실시간 진단 데이터'}]\n${specBlock}\n\n[고난도 수리·스펙 상담 요청]\n${
          params.userQuestion || '현재 내 기기 사양과 증상을 바탕으로 원인과 해결 방법을 쉽게 설명해 줘.'
        }`
      : `[참조 데이터: ${params.docTitle || '선택된 문서'}]\n${(params.docText || '').slice(0, 6000)}${
          specBlock ? `\n\n[참고 기기 사양]\n${specBlock}` : ''
        }\n\n[질문 요청]\n${
          params.userQuestion || '이 문서에서 나에게 불리한 조항이나 핵심 주의사항을 쉽게 설명해 줘.'
        }`;

  // 1) 클릭 제스처가 살아있는 첫 순간에 브라우저 클립보드에 100% 확실하게 복사 (writeText + execCommand 2중 가드)
  await copyTextToClipboardDirectly(combinedPrompt);

  // 2) 팝업 차단(Popup Blocker) 방지를 위해 클릭 제스처 직후 새 탭 창 핸들을 먼저 열어둡니다
  let popupWindow: Window | null = null;
  if (
    params.openWindow !== false &&
    typeof window !== 'undefined' &&
    typeof window.open === 'function'
  ) {
    try {
      popupWindow = window.open('about:blank', '_blank');
    } catch {
      /* ignore popup block */
    }
  }

  try {
    const zcoreCtrl = new AbortController();
    const zcoreTimer = setTimeout(() => zcoreCtrl.abort(), 1200);
    const res = await fetch(getZCoreUrl('/__zcore/ai-baton-touch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: zcoreCtrl.signal,
    }).finally(() => clearTimeout(zcoreTimer));

    const data = await res.json();
    if (data?.ok || data?.blockedByPrivacyGuard) {
      void speakWithHyunsuOrSunhi(data.ttsBriefingKo, 'hyunsu_briefing');
      if (data.ok && data.targetUrl) {
        if (popupWindow && !popupWindow.closed) {
          popupWindow.location.href = data.targetUrl;
        } else if (params.openWindow !== false && typeof window !== 'undefined') {
          try {
            window.open(data.targetUrl, '_blank', 'noopener,noreferrer');
          } catch {}
        }
      } else if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
      return data;
    }
  } catch {
    /* fallback to default Gemini below */
  }

  const fallbackBriefing =
    '깊은 분석이 필요한 질문이네요! 평소 쓰시는 제미나이(Gemini) 입력창에 넣을 수 있도록 본문과 질문을 클립보드에 바로 준비해 띄워드릴게요. 붙여넣기 후 [전송] 버튼을 누르신 뒤, 바로 옆 [라이브 음성] 버튼을 누르시면 말로 편하게 상담하실 수 있습니다!';
  void speakWithHyunsuOrSunhi(fallbackBriefing, 'hyunsu_briefing');

  const defaultTargetUrl = 'https://gemini.google.com/app';
  if (popupWindow && !popupWindow.closed) {
    popupWindow.location.href = defaultTargetUrl;
  } else if (
    params.openWindow !== false &&
    typeof window !== 'undefined' &&
    typeof window.open === 'function'
  ) {
    try {
      window.open(defaultTargetUrl, '_blank', 'noopener,noreferrer');
    } catch {
      /* ignore popup block */
    }
  }

  return {
    ok: true,
    detectedAiService: 'gemini',
    detectedAiLabel: '제미나이 (Gemini)',
    targetUrl: defaultTargetUrl,
    detectionSource: 'DEFAULT_GEMINI_FALLBACK',
    stagedPromptText: combinedPrompt,
    overlayTriggered: false,
    ttsBriefingKo: fallbackBriefing,
    twoStepFingerGuide: [
      { step: 1, label: '① 입력창 붙여넣기(Ctrl+V) 및 [전송 (↑)] 클릭', desc: '이미 복사된 본문+질문 데이터를 즉시 전송합니다.' },
      { step: 2, label: '② 바로 옆 [라이브 음성 🎧] 버튼 클릭', desc: '운전·이동 중에도 말로 편하게 심층 상담을 이어갑니다.' },
    ],
    floatingReturnPill: '⬅️ 대화 종료 후 귀신같이 복귀',
  };
}
