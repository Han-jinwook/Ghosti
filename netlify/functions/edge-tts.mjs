// 귀신같이 (Ghosti) — 클라우드/Netlify 무설치 웹 환경용 MS Neural TTS (현수 남 / 선희 여) 서버리스 합성 함수
// 외부 패키지 0개 (Node 내장 node:tls + node:crypto 사용)
// URL: POST /api/edge-tts (또는 /.netlify/functions/edge-tts)

import tls from 'node:tls';
import crypto from 'node:crypto';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = '143';
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;

const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
const SHA256_STATE = [
  0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a,
  0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2,
];
const SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba,
  0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6,
  0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33,
  0xd258b060, 0x72766564,
];
const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const SHA256_ADJUSTMENT = 0xc9dc06a7;
const SHA256_BLOCK_CONSTANTS = [
  ...SHA256_ROUND_CONSTANTS.slice(0, 14),
  SHA256_ADJUSTMENT,
  ...SHA256_ROUND_CONSTANTS.slice(15),
];
const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80;
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0;

const CS64_COEFFICIENTS = [
  [0xe82e91b1, 0xb32700d0],
  [0x44de24c6, 0x88dff51d],
  [0x3beb65bc, 0x29514038],
  [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5],
  [0x314ef5d5, 0x26e55f3c],
  [0xe92491b1, 0x607801c6],
  [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da],
  [0xda79fa60, 0x207cc464],
  [0xbed20560, 0x3c3c74f3],
  [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1],
  [0xcb49e3c6, 0xc5626167],
];
const CS64_FACTOR = 0x82893933;
const CS64_ADJUSTMENT0 = 0xf2f90b1a;
const CS64_ADJUSTMENT1 = 0x0b1a0000;

function u32(v) {
  return Number(BigInt(v) & 0xffffffffn);
}

function mul32(a, b) {
  return Number((BigInt(a >>> 0) * BigInt(b >>> 0)) & 0xffffffffn);
}

function add32(...vals) {
  let s = 0n;
  for (const v of vals) {
    s = (s + BigInt(v >>> 0)) & 0xffffffffn;
  }
  return Number(s);
}

function rotr32(v, n) {
  const x = v >>> 0;
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function rol16(v) {
  const x = v >>> 0;
  return ((x << 16) | (x >>> 16)) >>> 0;
}

function sigma0(v) {
  const x = v >>> 0;
  return (rotr32(x, 7) ^ rotr32(x, 18) ^ (x >>> 3)) >>> 0;
}

function sigma1(v) {
  const x = v >>> 0;
  return (rotr32(x, 17) ^ rotr32(x, 19) ^ (x >>> 10)) >>> 0;
}

function bigSigma0(v) {
  const x = v >>> 0;
  return (rotr32(x, 2) ^ rotr32(x, 13) ^ rotr32(x, 22)) >>> 0;
}

function bigSigma1(v) {
  const x = v >>> 0;
  return (rotr32(x, 6) ^ rotr32(x, 11) ^ rotr32(x, 25)) >>> 0;
}

function sha256Rounds(state, words, firstRound = 0) {
  let [a, b, c, d, e, f, g, h] = state.map((x) => x >>> 0);
  const constants = firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS;
  for (let i = firstRound; i < 64; i++) {
    const ch = (g ^ (e & (f ^ g))) >>> 0;
    const maj = ((a & b) | (c & (a | b))) >>> 0;
    const t1 = add32(h, bigSigma1(e), ch, constants[i], words[i]);
    const t2 = add32(bigSigma0(a), maj);
    h = g;
    g = f;
    f = e;
    e = add32(d, t1);
    d = c;
    c = b;
    b = a;
    a = add32(t1, t2);
  }
  return [a, b, c, d, e, f, g, h];
}

function expandSha256Schedule(words, firstWord = 16) {
  for (let i = firstWord; i < 64; i++) {
    words.push(add32(sigma1(words[i - 2]), words[i - 7], sigma0(words[i - 15]), words[i - 16]));
  }
}

function sha256Init(data7) {
  const w14 = (data7[0] << 16) | (data7[1] << 8) | data7[2];
  const w15 = data7.readUInt32BE(3);
  const words = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, w14 >>> 0, w15 >>> 0];
  for (let index = 16; index < 30; index++) {
    let value = SHA256_SCHEDULE[index - 16] >>> 0;
    if (index - 2 >= 14) {
      const s1 = index === 16 ? (sigma1(words[index - 2]) ^ SHA256_SIGMA1_ADJUSTMENT) >>> 0 : sigma1(words[index - 2]);
      value = add32(value, s1);
    }
    if (index - 7 >= 14) {
      value = add32(value, words[index - 7]);
    }
    if (index - 15 >= 14) {
      const s0 = index === 29 ? (sigma0(words[index - 15]) ^ SHA256_SIGMA0_ADJUSTMENT) >>> 0 : sigma0(words[index - 15]);
      value = add32(value, s0);
    }
    words.push(value);
  }
  const w30 = u32(
    BigInt(sigma1(words[28])) +
      BigInt(words[23]) +
      BigInt(sigma0(words[15])) +
      BigInt(words[14]) +
      BigInt(SHA256_ADJUSTMENT) -
      BigInt(SHA256_ROUND_CONSTANTS[14])
  );
  words.push(w30);
  expandSha256Schedule(words, 31);
  const working = sha256Rounds(SHA256_STATE, words, 14);
  return SHA256_INITIAL.map((x, idx) => add32(x, working[idx]));
}

function sha256Digest(dataBuf) {
  const length = 57 + dataBuf.length;
  const padZeros = ((55 - length) % 64 + 64) % 64;
  const tail = dataBuf.subarray(7);
  const padded = Buffer.alloc(tail.length + 1 + padZeros + 8);
  tail.copy(padded, 0);
  padded[tail.length] = 0x80;
  padded.writeBigUInt64BE(BigInt(length * 8), padded.length - 8);

  let state = sha256Init(dataBuf.subarray(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = [];
    for (let i = 0; i < 16; i++) {
      words.push(padded.readUInt32BE(offset + i * 4));
    }
    expandSha256Schedule(words, 16);
    const working = sha256Rounds(state, words, 0);
    state = state.map((x, idx) => add32(x, working[idx]));
  }
  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    out.writeUInt32BE(state[i] >>> 0, i * 4);
  }
  return out;
}

function wordsLe4Even(buf) {
  const rem = (4 - (buf.length % 4)) % 4;
  const padded = rem > 0 ? Buffer.concat([buf, Buffer.alloc(rem)]) : buf;
  const words = [];
  for (let i = 0; i < padded.length; i += 4) {
    words.push(padded.readUInt32LE(i));
  }
  if (words.length % 2 === 1) {
    words.push(0);
  }
  return words;
}

function cs64Digest(dataBuf, digestBuf) {
  const keyA = (digestBuf.readUInt32LE(0) | 1) >>> 0;
  const keyB = (digestBuf.readUInt32LE(4) | 1) >>> 0;
  const factors = [mul32(keyA, CS64_FACTOR), mul32(keyB, CS64_FACTOR)];
  const terms = CS64_COEFFICIENTS.map(([coeff], idx) => mul32(coeff, factors[idx % 2]));
  const offsets = CS64_COEFFICIENTS.map(([, off]) => off >>> 0);

  const inputWords = wordsLe4Even(Buffer.concat([Buffer.from([0x00]), dataBuf]));
  for (let index = 0; index < inputWords.length; index++) {
    const word = inputWords[index] >>> 0;
    let term = BigInt(word) * BigInt(index % 2 === 0 ? keyA : keyB);
    let offset = BigInt(rol16(word)) * BigInt(index % 2 === 0 ? 0xef0569fb : 0xc31713db);
    if (index === 0) {
      term += BigInt(CS64_ADJUSTMENT0) * BigInt(factors[0]);
      offset += BigInt(CS64_ADJUSTMENT1);
    }
    terms.push(Number(term & 0xffffffffn));
    offsets.push(Number(offset & 0xffffffffn));
  }

  let swapAcc = 0;
  let swapLast = 0;
  let state = 0;
  let acc = 0;
  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index] >>> 0;
    const y = terms[index + 1] >>> 0;
    let t = rol16(add32(offsets[index], x));
    let q = mul32(t, 0x76f50f34);
    swapAcc = add32(swapAcc, add32(mul32(rol16(q), 0xc3efea97), q));

    t = rol16(add32(offsets[index + 1], y));
    q = mul32(t, 0x1881ce3c);
    swapLast = add32(mul32(rol16(q), 0x35bd1ec9), q);
    swapAcc = add32(swapAcc, swapLast);

    state = add32(mul32(state, keyA), x);
    state = mul32(rol16(state), 0xcf98b111);
    state = mul32(rol16(state), 0x87085b9f);
    state = mul32(rol16(state), 0x12ceb96d);
    state = mul32(rol16(state), 0x257e1d83);
    acc = add32(acc, state);

    t = add32(mul32(state, keyB), y);
    t = mul32(rol16(t), 0xa27416f5);
    t = mul32(rol16(t), 0xd38396ff);
    state = mul32(rol16(mul32(rol16(t), 0x7c932b89)), 0xbfa49f69);
    acc = add32(acc, state);
  }
  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0];
}

export function generateSecMsGecV2(unixTimestampSec = Math.floor(Date.now() / 1000)) {
  let ticks = unixTimestampSec + WIN_EPOCH;
  ticks -= ticks % 300;
  const ticks100ns = BigInt(ticks) * 10000000n;
  const strToHash = `${ticks100ns.toString()}${TRUSTED_CLIENT_TOKEN}`;
  const dataBuf = Buffer.from(strToHash, 'ascii');
  const digest = sha256Digest(dataBuf);
  const [cs0, cs1] = cs64Digest(dataBuf, digest);
  const csBuf = Buffer.alloc(8);
  csBuf.writeUInt32LE(cs0, 0);
  csBuf.writeUInt32LE(cs1, 4);
  return `${csBuf.toString('hex').toUpperCase()}-${digest.toString('hex').toUpperCase()}`;
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createWsTextFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const mask = crypto.randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = 0x80 | payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    masked[i] = payload[i] ^ mask[i % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

export function synthesizeEdgeNeuralMp3({ text, voice, rate = '+15%' }) {
  return new Promise((resolve, reject) => {
    const connectionId = crypto.randomBytes(16).toString('hex');
    const muid = crypto.randomBytes(16).toString('hex').toUpperCase();
    const secMsGec = generateSecMsGecV2();
    const wsKey = crypto.randomBytes(16).toString('base64');
    const host = 'speech.platform.bing.com';
    const pathUrl = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    const socket = tls.connect({ host, port: 443, servername: host }, () => {
      const reqLines = [
        `GET ${pathUrl} HTTP/1.1`,
        `Host: ${host}`,
        `Pragma: no-cache`,
        `Cache-Control: no-cache`,
        `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
        `Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold`,
        `Accept-Encoding: gzip, deflate, br, zstd`,
        `Accept-Language: en-US,en;q=0.9`,
        `Cookie: muid=${muid};`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${wsKey}`,
        `Sec-WebSocket-Version: 13`,
        `\r\n`,
      ];
      socket.write(reqLines.join('\r\n'));
    });

    let upgraded = false;
    let rxBuf = Buffer.alloc(0);
    const audioChunks = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error('Edge TTS synthesis timeout'));
      }
    }, 8500);

    const finishOk = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      const fullAudio = Buffer.concat(audioChunks);
      if (fullAudio.length < 128) {
        reject(new Error('Empty audio buffer'));
      } else {
        resolve(fullAudio);
      }
    };

    const finishErr = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    };

    socket.on('error', finishErr);
    socket.on('end', () => {
      if (!settled) {
        if (audioChunks.length > 0) finishOk();
        else finishErr(new Error('Socket closed before turn.end'));
      }
    });

    socket.on('data', (chunk) => {
      rxBuf = Buffer.concat([rxBuf, chunk]);

      if (!upgraded) {
        const idx = rxBuf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        const headerStr = rxBuf.subarray(0, idx).toString('utf8');
        rxBuf = rxBuf.subarray(idx + 4);
        if (!headerStr.startsWith('HTTP/1.1 101')) {
          finishErr(new Error(`Handshake failed: ${headerStr.split('\r\n')[0]}`));
          return;
        }
        upgraded = true;

        const nowStr = new Date().toString();
        const configMsg =
          `X-Timestamp:${nowStr}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`;
        socket.write(createWsTextFrame(configMsg));

        const reqId = crypto.randomBytes(16).toString('hex');
        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ko-KR'>` +
          `<voice name='${voice}'>` +
          `<prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody>` +
          `</voice></speak>`;
        const ssmlMsg =
          `X-RequestId:${reqId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${nowStr}Z\r\n` +
          `Path:ssml\r\n\r\n` +
          ssml;
        socket.write(createWsTextFrame(ssmlMsg));
      }

      while (rxBuf.length >= 2) {
        const byte0 = rxBuf[0];
        const byte1 = rxBuf[1];
        const opcode = byte0 & 0x0f;
        const isMasked = (byte1 & 0x80) !== 0;
        let payloadLen = byte1 & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (rxBuf.length < 4) return;
          payloadLen = rxBuf.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (rxBuf.length < 10) return;
          payloadLen = Number(rxBuf.readBigUInt64BE(2));
          offset = 10;
        }

        if (isMasked) offset += 4;
        if (rxBuf.length < offset + payloadLen) return;

        let payload = rxBuf.subarray(offset, offset + payloadLen);
        if (isMasked) {
          const maskKey = rxBuf.subarray(offset - 4, offset);
          payload = Buffer.from(payload);
          for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maskKey[i % 4];
          }
        }
        rxBuf = rxBuf.subarray(offset + payloadLen);

        if (opcode === 0x01) {
          const textFrame = payload.toString('utf8');
          if (textFrame.includes('Path:turn.end')) {
            finishOk();
            return;
          }
        } else if (opcode === 0x02 && payload.length >= 2) {
          const headerLen = payload.readUInt16BE(0);
          if (headerLen + 2 <= payload.length) {
            const headerPart = payload.subarray(2, 2 + headerLen).toString('utf8');
            if (headerPart.includes('Path:audio')) {
              const audioData = payload.subarray(2 + headerLen);
              if (audioData.length > 0) {
                audioChunks.push(audioData);
              }
            }
          }
        } else if (opcode === 0x08) {
          finishOk();
          return;
        }
      }
    });
  });
}

export default async (req) => {
  const corsHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('{}', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST only' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawText = String(body?.text || '').trim().replace(/\s+/g, ' ').slice(0, 600);
    if (!rawText) {
      return new Response(JSON.stringify({ ok: false, error: 'EMPTY_TEXT' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const reqVoice = String(body?.voice || '').toLowerCase();
    const isFemale = reqVoice.includes('sunhi') || reqVoice.includes('female') || reqVoice.includes('yujin');
    const voice = isFemale ? 'ko-KR-SunHiNeural' : 'ko-KR-HyunsuNeural';
    const rate = String(body?.rate || '+15%');

    const t0 = Date.now();
    const mp3Buffer = await synthesizeEdgeNeuralMp3({ text: rawText, voice, rate });
    const elapsedMs = Date.now() - t0;

    return new Response(
      JSON.stringify({
        ok: true,
        voice,
        voiceActor: isFemale
          ? '선희 (ko-KR-SunHiNeural · 여성 성우)'
          : '현수 (ko-KR-HyunsuNeural · 남성 성우)',
        audioDataUrl: `data:audio/mpeg;base64,${mp3Buffer.toString('base64')}`,
        byteLength: mp3Buffer.length,
        elapsedMs,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message || err) }),
      { status: 500, headers: corsHeaders }
    );
  }
};
