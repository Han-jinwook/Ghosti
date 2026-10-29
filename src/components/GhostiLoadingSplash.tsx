import React, { useEffect, useState } from 'react';
import { zCoreBridge } from '../services/zCoreBridge';
import { useSaySeeStore } from '../store/useSaySeeStore';

/**
 * 🌟 『귀신같이』 앱/웹 첫 실행 시 로딩 스플래시 화면
 * - 마스터 아트워크(/gwisinkachi_splash_master.jpg)를 딥 네이비(#070424 ~ #13254b) 배경과 무경계로 일체화
 * - 가짜 진행률 게이지 없이 실제 앱 초기화(initialized) 상태와 연동하여 부드럽게 페이드아웃
 * - 화면 아무 곳이나 클릭 시 즉시 닫혀 사용자 조작을 단 0.1초도 가로막지 않음
 */
export const GhostiLoadingSplash: React.FC = () => {
  const initialized = useSaySeeStore((s) => s.initialized);
  const zCoreConnected = zCoreBridge.isConnected;
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [unmounted, setUnmounted] = useState(false);

  useEffect(() => {
    // 첫 실행 시 브랜드 스플래시를 인지할 수 있는 최소 노출 시간 (1.1초)
    const minTimer = window.setTimeout(() => {
      setMinTimePassed(true);
    }, 1100);

    // 네트워크 지연 시에도 최대 3.2초 후에는 자동 진입 보장
    const maxTimer = window.setTimeout(() => {
      setDismissed(true);
    }, 3200);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  useEffect(() => {
    if (minTimePassed && initialized) {
      setDismissed(true);
    }
  }, [minTimePassed, initialized]);

  useEffect(() => {
    if (!dismissed) return;
    const t = window.setTimeout(() => {
      setUnmounted(true);
    }, 480);
    return () => clearTimeout(t);
  }, [dismissed]);

  if (unmounted) return null;

  return (
    <div
      role="status"
      aria-label="귀신같이 로딩 스플래시 화면"
      onClick={() => setDismissed(true)}
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center px-4 select-none cursor-pointer transition-opacity duration-500 ease-out ${
        dismissed ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(circle at 50% 46%, #13254b 0%, #0b1331 52%, #070424 100%)',
      }}
    >
      {/* 메인 스플래시 일러스트 & 3D 『귀신같이』 로고 */}
      <div className="relative w-full max-w-[680px] flex flex-col items-center">
        <div className="relative w-full overflow-hidden rounded-3xl shadow-[0_0_80px_rgba(45,212,191,0.18)]">
          <img
            src="/gwisinkachi_splash_master.jpg"
            alt="귀신같이 — 1초 AI 파일·영상 찾기 & 용량청소"
            className="w-full h-auto object-contain block mx-auto"
            draggable={false}
          />
        </div>

        {/* 하단 상태 배지 & 3대 핵심 리듬 안내 */}
        <div className="mt-5 flex flex-col items-center gap-2.5 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-950/75 border border-teal-400/35 shadow-[0_0_24px_rgba(45,212,191,0.2)]">
            <span className="w-2 h-2 rounded-full bg-teal-300 animate-ping" />
            <span className="text-[12.5px] md:text-[13.5px] font-extrabold text-teal-100 tracking-tight">
              {initialized
                ? zCoreConnected
                  ? '✨ 멀린 Z-코어(5199) 직결 완료! 내 PC 파일을 불러왔습니다'
                  : '✨ 준비 완료! 귀신같이 찾고, 치우고, 고칠 준비가 끝났습니다'
                : '귀신같이 찾고 · 치우고 · 고치는 AI 엔진을 깨우는 중...'}
            </span>
          </div>

          <p className="text-[11.5px] md:text-[12px] font-bold text-teal-200/75 tracking-tight">
            🎯 1초 내용찾기 · 🧹 안전 휴지통 청소 · ⚙️ 3초 포렌식 복구
          </p>
        </div>
      </div>
    </div>
  );
};
