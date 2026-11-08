/**
 * ⚡ 원패스 스캔 성능 등급 판정 (v1.3 마감 공문 20261108_2321 #4-3)
 *
 * 확정 기준 (Z-코어 plugin_ghosti_os.classify_scan_performance_tier 와 동일 상수 — 바꿀 때 양쪽 함께 변경):
 *  - 저사양(스텔스 스로틀 적용): CPU 논리 코어 4개 이하  또는  RAM 8GB 이하  또는  시스템 드라이브 HDD(비-SSD)
 *  - 고성능(멈칫 없이 즉시 고속 스캔): 코어 6개 이상  &&  RAM 8GB 초과  &&  SSD
 *  - 그 사이(코어 5개 등)나 값을 알 수 없는 경우는 보수적으로 저사양 보호를 적용
 *  ※ 브라우저 navigator.deviceMemory 는 최대 8 로 잘려 'RAM 8GB 초과'를 알 수 없으므로, 판정 입력은 Z-코어 실측값을 사용한다.
 */
export const LOW_SPEC_MAX_LOGICAL_CORES = 4;
export const LOW_SPEC_MAX_RAM_GB = 8;
export const HIGH_PERF_MIN_LOGICAL_CORES = 6;

export type ScanPerformanceTier = 'high' | 'low';

export interface ScanPerformanceInput {
  logicalCores: number | null;
  ramGb: number | null;
  systemDriveIsSsd: boolean | null;
}

export function classifyScanPerformanceTier(input: ScanPerformanceInput): ScanPerformanceTier {
  const { logicalCores, ramGb, systemDriveIsSsd } = input;
  if (logicalCores === null || ramGb === null || systemDriveIsSsd === null) return 'low';
  if (logicalCores <= LOW_SPEC_MAX_LOGICAL_CORES || ramGb <= LOW_SPEC_MAX_RAM_GB || !systemDriveIsSsd) return 'low';
  if (logicalCores >= HIGH_PERF_MIN_LOGICAL_CORES && ramGb > LOW_SPEC_MAX_RAM_GB && systemDriveIsSsd) return 'high';
  return 'low';
}
