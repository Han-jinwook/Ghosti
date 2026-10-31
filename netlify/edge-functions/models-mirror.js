/**
 * ❖ Netlify Edge Function: GitHub Releases 무제한 무료 AI 모델 CORS-Free 스트리밍 프록시 (/api/models-mirror/*)
 * - 브라우저에서 GitHub Releases URL을 302 리다이렉트로 따라가면 release-assets.githubusercontent.com에
 *   Access-Control-Allow-Origin 헤더가 없어 CORS 차단이 발생합니다.
 * - 따라서 엣지 단에서 302 리다이렉트를 따라간 뒤 ReadableStream 바디를 무버퍼(용량 제한 0)로 직접 파이프하며
 *   Access-Control-Allow-Origin: * 헤더를 부착해 브라우저 CORS 문제를 100% 원천 해결합니다.
 */

const GH_RELEASE_BASE =
  'https://github.com/Han-jinwook/Ghosti/releases/download/models-embeddinggemma2-v1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const rawPath = url.pathname
    .replace(/^\/api\/models-mirror\/?/, '')
    .replace(/^onnx-community\/embeddinggemma-2-ONNX\/resolve\/[^/]+\//, '')
    .replace(/^\/+/, '');

  if (!rawPath) {
    return new Response(JSON.stringify({ ok: false, error: 'MISSING_MODEL_PATH' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const assetName = rawPath.replace(/\//g, '__');
  const ghUrl = `${GH_RELEASE_BASE}/${encodeURIComponent(assetName)}`;

  const forwardHeaders = new Headers();
  const range = request.headers.get('range');
  if (range) {
    forwardHeaders.set('Range', range);
  }

  try {
    const upstream = await fetch(ghUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: forwardHeaders,
      redirect: 'follow',
    });

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(null, { status: upstream.status, headers: CORS_HEADERS });
    }

    const resHeaders = new Headers(CORS_HEADERS);
    const contentType = rawPath.endsWith('.json')
      ? 'application/json; charset=utf-8'
      : upstream.headers.get('content-type') || 'application/octet-stream';
    resHeaders.set('Content-Type', contentType);

    for (const h of ['content-length', 'content-range', 'accept-ranges', 'etag']) {
      const val = upstream.headers.get(h);
      if (val) resHeaders.set(h, val);
    }
    resHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: '/api/models-mirror/*',
};
