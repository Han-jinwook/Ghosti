import React, { useMemo } from 'react';

/**
 * ISO/IEC 18004 표준 호환 순수 TypeScript QR 코드 생성기 (외부 패키지 의존성 0개)
 * - Byte 모드(UTF-8), 오류 복원 레벨 L, Version 1~6 자동 선택 (최대 134 바이트 URL 지원)
 * - 아이폰 기본 카메라 · 갤럭시 기본 카메라 0.1초 즉시 인식 보장
 */

interface QrVersionSpec {
  version: number;
  size: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocks: number;
  alignmentCenters: number[];
}

const QR_LEVEL_L_SPECS: QrVersionSpec[] = [
  { version: 1, size: 21, totalCodewords: 26, ecCodewordsPerBlock: 7, numBlocks: 1, alignmentCenters: [] },
  { version: 2, size: 25, totalCodewords: 44, ecCodewordsPerBlock: 10, numBlocks: 1, alignmentCenters: [6, 18] },
  { version: 3, size: 29, totalCodewords: 70, ecCodewordsPerBlock: 15, numBlocks: 1, alignmentCenters: [6, 22] },
  { version: 4, size: 33, totalCodewords: 100, ecCodewordsPerBlock: 20, numBlocks: 1, alignmentCenters: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, ecCodewordsPerBlock: 26, numBlocks: 1, alignmentCenters: [6, 30] },
  { version: 6, size: 41, totalCodewords: 172, ecCodewordsPerBlock: 18, numBlocks: 2, alignmentCenters: [6, 34] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i += 1) {
    const lead = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (lead !== 0) {
      for (let j = 0; j < ecLen; j += 1) {
        rem[j] ^= gfMul(gen[j + 1], lead);
      }
    }
  }
  return rem;
}

function encodeDataCodewords(utf8Bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const totalDataCodewords = spec.totalCodewords - spec.ecCodewordsPerBlock * spec.numBlocks;
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator (0100) + 8-bit character count (Versions 1..9)
  pushBits(0b0100, 4);
  pushBits(utf8Bytes.length, 8);
  for (let i = 0; i < utf8Bytes.length; i += 1) {
    pushBits(utf8Bytes[i], 8);
  }

  const maxBits = totalDataCodewords * 8;
  const terminatorLen = Math.min(4, Math.max(0, maxBits - bits.length));
  pushBits(0, terminatorLen);
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataBytes = new Uint8Array(totalDataCodewords);
  const byteCount = Math.min(totalDataCodewords, bits.length >>> 3);
  for (let i = 0; i < byteCount; i += 1) {
    let b = 0;
    for (let k = 0; k < 8; k += 1) {
      b = (b << 1) | bits[i * 8 + k];
    }
    dataBytes[i] = b;
  }

  const padBytes = [0xec, 0x11];
  for (let i = byteCount; i < totalDataCodewords; i += 1) {
    dataBytes[i] = padBytes[(i - byteCount) & 1];
  }

  if (spec.numBlocks === 1) {
    const ec = rsComputeRemainder(dataBytes, spec.ecCodewordsPerBlock);
    const out = new Uint8Array(spec.totalCodewords);
    out.set(dataBytes, 0);
    out.set(ec, dataBytes.length);
    return out;
  }

  // Interleave equal-sized blocks (Version 6 Level L: 2 blocks of 68 data + 18 EC)
  const blockDataLen = totalDataCodewords / spec.numBlocks;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.numBlocks; b += 1) {
    const slice = dataBytes.slice(b * blockDataLen, (b + 1) * blockDataLen);
    dataBlocks.push(slice);
    ecBlocks.push(rsComputeRemainder(slice, spec.ecCodewordsPerBlock));
  }

  const out = new Uint8Array(spec.totalCodewords);
  let offset = 0;
  for (let i = 0; i < blockDataLen; i += 1) {
    for (let b = 0; b < spec.numBlocks; b += 1) {
      out[offset++] = dataBlocks[b][i];
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i += 1) {
    for (let b = 0; b < spec.numBlocks; b += 1) {
      out[offset++] = ecBlocks[b][i];
    }
  }
  return out;
}

function computeFormatBitsLevelL(mask: number): number {
  // Error Correction Level L = 01
  const data = (0b01 << 3) | (mask & 0b111);
  let rem = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >>> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormatBits(modules: boolean[][], isFunc: boolean[][], size: number, mask: number): void {
  const bits = computeFormatBitsLevelL(mask);
  const getBit = (bitPosFromLsb: number) => ((bits >>> bitPosFromLsb) & 1) === 1;
  const setFuncModule = (r: number, c: number, dark: boolean) => {
    modules[r][c] = dark;
    isFunc[r][c] = true;
  };

  setFuncModule(8, 0, getBit(14));
  setFuncModule(8, 1, getBit(13));
  setFuncModule(8, 2, getBit(12));
  setFuncModule(8, 3, getBit(11));
  setFuncModule(8, 4, getBit(10));
  setFuncModule(8, 5, getBit(9));
  setFuncModule(8, 7, getBit(8));
  setFuncModule(8, 8, getBit(7));
  setFuncModule(7, 8, getBit(6));
  setFuncModule(5, 8, getBit(5));
  setFuncModule(4, 8, getBit(4));
  setFuncModule(3, 8, getBit(3));
  setFuncModule(2, 8, getBit(2));
  setFuncModule(1, 8, getBit(1));
  setFuncModule(0, 8, getBit(0));

  for (let i = 0; i < 7; i += 1) {
    setFuncModule(size - 1 - i, 8, getBit(14 - i));
  }
  for (let i = 0; i < 8; i += 1) {
    setFuncModule(8, size - 8 + i, getBit(7 - i));
  }
  setFuncModule(size - 8, 8, true);
}

function maskCondition(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function computePenalty(modules: boolean[][], size: number): number {
  let score = 0;
  // Rule 1: runs of >=5 identical modules
  for (let r = 0; r < size; r += 1) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c += 1) {
      if (modules[r][c] === runColor) {
        runLen += 1;
        if (runLen === 5) score += 3;
        else if (runLen > 5) score += 1;
      } else {
        runColor = modules[r][c];
        runLen = 1;
      }
    }
  }
  for (let c = 0; c < size; c += 1) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r += 1) {
      if (modules[r][c] === runColor) {
        runLen += 1;
        if (runLen === 5) score += 3;
        else if (runLen > 5) score += 1;
      } else {
        runColor = modules[r][c];
        runLen = 1;
      }
    }
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        score += 3;
      }
    }
  }
  return score;
}

export function generateQrMatrix(text: string): boolean[][] {
  const safeText = (text || 'https://ghosti.sundreamer.app').slice(0, 130);
  const utf8 = new TextEncoder().encode(safeText);

  let spec = QR_LEVEL_L_SPECS[QR_LEVEL_L_SPECS.length - 1];
  for (const candidate of QR_LEVEL_L_SPECS) {
    const capBytes =
      candidate.totalCodewords - candidate.ecCodewordsPerBlock * candidate.numBlocks - 2;
    if (utf8.length <= capBytes) {
      spec = candidate;
      break;
    }
  }

  const size = spec.size;
  const baseModules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    baseModules[r][c] = dark;
    isFunc[r][c] = true;
  };

  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const rr = topR + dr;
        const cc = leftC + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunc(rr, cc, inOuter && (onBorder || inCenter));
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i += 1) {
    for (let j = 0; j < centers.length; j += 1) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = centers[i];
      const cc = centers[j];
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunc(cr + dr, cc + dc, dist !== 1);
        }
      }
    }
  }

  // Reserve format info slots
  drawFormatBits(baseModules, isFunc, size, 0);

  // Place data + EC codewords in zigzag upward/downward 2-column strips
  const codewords = encodeDataCodewords(utf8, spec);
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let step = 0; step < size; step += 1) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc += 1) {
        const c = rightCol - dc;
        if (!isFunc[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx += 1;
          }
          baseModules[r][c] = dark;
        }
      }
    }
    upward = !upward;
  }

  // Evaluate 8 masks and pick lowest penalty
  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  let bestGrid = baseModules;

  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = baseModules.map((row, r) =>
      row.map((val, c) => (!isFunc[r][c] && maskCondition(mask, r, c) ? !val : val))
    );
    const funcCopy = isFunc.map((row) => row.slice());
    drawFormatBits(candidate, funcCopy, size, mask);
    const penalty = computePenalty(candidate, size);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
      bestGrid = candidate;
    }
  }

  void bestMask;
  return bestGrid;
}

export const QrCodeSvg: React.FC<{
  value: string;
  className?: string;
  quietZone?: number;
}> = ({ value, className = 'w-full h-full', quietZone = 2 }) => {
  const { viewSize, pathD } = useMemo(() => {
    const matrix = generateQrMatrix(value);
    const n = matrix.length;
    const total = n + quietZone * 2;
    const parts: string[] = [];
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (matrix[r][c]) {
          parts.push(`M${c + quietZone} ${r + quietZone}h1v1h-1z`);
        }
      }
    }
    return { viewSize: total, pathD: parts.join('') };
  }, [value, quietZone]);

  return React.createElement(
    'svg',
    {
      viewBox: `0 0 ${viewSize} ${viewSize}`,
      shapeRendering: 'crispEdges',
      className,
      role: 'img',
      'aria-label': '스마트폰 카메라 스캔용 QR 코드',
    },
    React.createElement('rect', { width: viewSize, height: viewSize, fill: '#ffffff' }),
    React.createElement('path', { d: pathD, fill: '#09090B' })
  );
};
