import React, { useEffect, useState } from 'react';
import { playAppEnterGiggleSound } from '../services/babyGhostSound';

/**
 * 🌟 『귀신같이』 앱/웹 첫 실행 시 로딩 스플래시 화면
 * - 마스터 아트워크(/gwisinkachi_splash_master.jpg)를 딥 네이비(#070424 ~ #13254b) 배경과 무경계로 일체화
 * - 해나라 테스터님 QA 요청: 홈 들어갈 때 스플래시 나오는 시간을 0.5초로 수정
 * - 화면 아무 곳이나 클릭 시 즉시 닫힘
 */
export const GhostiLoadingSplash: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [unmounted, setUnmounted] = useState(false);

  useEffect(() => {
    // 요청 사항: 정확히 0.5초(500ms) 후 자동 페이드아웃 진입
    const timer = window.setTimeout(() => {
      setDismissed(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!dismissed) return;
    playAppEnterGiggleSound();
    const t = window.setTimeout(() => {
      setUnmounted(true);
    }, 300);
    return () => clearTimeout(t);
  }, [dismissed]);

  if (unmounted) return null;

  return (
    <div
      role="status"
      aria-label="귀신같이 로딩 스플래시 화면"
      onClick={() => { playAppEnterGiggleSound(); setDismissed(true); }}
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center px-4 select-none cursor-pointer transition-opacity duration-300 ease-out ${
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
            alt="귀신같이 — 1초 AI 파일·영상 찾기 및 용량청소"
            className="w-full h-auto object-contain block mx-auto"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};
