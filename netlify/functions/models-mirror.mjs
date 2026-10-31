/**
 * ❖ GitHub Releases 무제한 무료 AI 모델 미러 브릿지 (/api/models-mirror/*)
 * - 카드 등록이 전혀 필요 없는 당사 GitHub Releases(`Han-jinwook/Ghosti`, tag: `models-embeddinggemma2-v1`)에
 *   영구 보관된 EmbeddingGemma 2 (8비트 q8 + 4비트 q4) 마스터 사본으로 브라우저를 연결합니다.
 */

const GH_RELEASE_BASE =
  'https://github.com/Han-jinwook/Ghosti/releases/download/models-embeddinggemma2-v1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const rawPath = String(event.path || '')
    .replace(/^\/\.netlify\/functions\/models-mirror\/?/, '')
    .replace(/^\/api\/models-mirror\/?/, '')
    .replace(/^onnx-community\/embeddinggemma-2-ONNX\/resolve\/[^/]+\//, '')
    .replace(/^\/+/, '');

  if (!rawPath) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'MISSING_MODEL_PATH' }),
    };
  }

  const assetName = rawPath.replace(/\//g, '__');
  const ghUrl = `${GH_RELEASE_BASE}/${encodeURIComponent(assetName)}`;

  try {
    // JSON 메타데이터/토크나이저는 직접 프록시하여 CORS 100% 보장
    if (rawPath.endsWith('.json') && !rawPath.endsWith('tokenizer.json')) {
      const res = await fetch(ghUrl, { redirect: 'follow' });
      if (!res.ok) {
        return { statusCode: res.status, headers: CORS_HEADERS, body: '' };
      }
      const text = await res.text();
      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
        body: text,
      };
    }

    // 대용량 ONNX 및 토크나이저는 GitHub Releases 글로벌 CDN(objects.githubusercontent.com) 서명 URL로 302 직결
    const headRes = await fetch(ghUrl, { method: 'GET', redirect: 'manual' });
    const cdnLocation = headRes.headers.get('location') || ghUrl;

    return {
      statusCode: 302,
      headers: {
        ...CORS_HEADERS,
        Location: cdnLocation,
        'Cache-Control': 'public, max-age=3600',
      },
      body: '',
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
    };
  }
};
