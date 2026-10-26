'use client';

import React, { useState, useRef, useEffect } from 'react';
import familyIcon from '../assets/family-icon.png';
import sundreamerLogo from '../assets/logos/sundreamer.png';
import whateatLogo from '../assets/logos/whateat.png';
import aggrofilterLogo from '../assets/logos/aggrofilter.png';
import sensetalkLogo from '../assets/logos/sensetalk.png';
import zeyeLogo from '../assets/logos/zeye.svg';

const LOCAL_LOGOS: Record<string, any> = {
  sundreamer: sundreamerLogo,
  whateat: whateatLogo,
  aggrofilter: aggrofilterLogo,
  sensetalk: sensetalkLogo,
  zeye: zeyeLogo
};

import { getConfig } from '../CoreLogic/config';
import { hubFetch } from '../CoreLogic/client';
import { useHub } from '../react';

export interface FamilyApp {
  id: string;
  name: string;
  url: string;
  icon: React.ReactNode;
  description: string;
  isActive: boolean;
  isLinkActive?: boolean;
  openSchedule?: string;
  sortOrder: number;
  isJoined?: boolean;
}

export interface FamilyConfig {
  isFeatureLive: boolean;
  apps: FamilyApp[];
}

export interface HubAppSwitcherProps {
  currentAppId?: string; // 현재 실행중인 앱의 ID (예: 'aggrofilter', 'zeye', 'sundreamer')
  joinedAppIds?: string[]; // 유저가 가입한 패밀리 앱 ID 목록 (명시적 전달용)
  variant?: 'icon' | 'sidebar'; // 'icon'(헤더 원형 아이콘, 기본값) | 'sidebar'(노션형 좌측 사이드바 하단 버튼)
  placement?: 'top-down' | 'bottom-up'; // 'top-down'(아래로 펼침, 기본값) | 'bottom-up'(사이드바 하단에서 위로 펼침)
}

const DEFAULT_FAMILY_CONFIG: FamilyConfig = {
  isFeatureLive: true,
  apps: [
    {
      id: 'sundreamer',
      name: '썬드리머',
      url: 'https://sundreamer.app',
      icon: '☀️',
      description: '12년차 비타민D 자외선조사기 회원 전용 멤버십',
      isActive: true,
      isLinkActive: true,
      sortOrder: 1
    },
    {
      id: 'whateat',
      name: '뭐먹지?',
      url: 'https://whateat.sundreamer.app',
      icon: '🍱',
      description: '학교 급식과 식생활 기록 플랫폼',
      isActive: true,
      isLinkActive: true,
      sortOrder: 2
    },
    {
      id: 'aggrofilter',
      name: '어그로필터',
      url: 'https://aggrofilter.com',
      icon: '🛡️',
      description: '유튜브 영상 팩트 신뢰도 분석기',
      isActive: true,
      isLinkActive: true,
      sortOrder: 3
    },
    {
      id: 'sensetalk',
      name: '센스톡',
      url: 'https://sensetalk.netlify.app',
      icon: '💬',
      description: '1:1 맞춤 감성 메시지 고속 발송 비서',
      isActive: true,
      isLinkActive: true,
      sortOrder: 4
    },
    {
      id: 'zeye',
      name: '제트아이',
      url: 'https://z-eye.sundreamer.app',
      icon: '👁️',
      description: '1초 투시검색 · 클린몬스터 · 패밀리 사진/업무 공유',
      isActive: true,
      isLinkActive: true,
      sortOrder: 5
    }
  ]
};

export function HubAppSwitcher({
  currentAppId,
  joinedAppIds = [],
  variant = 'icon',
  placement = 'top-down'
}: HubAppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<FamilyConfig>(DEFAULT_FAMILY_CONFIG);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useHub();

  // 중앙 통제 설정 불러오기 (비동기 갱신 + 신규 패밀리 앱 누락 방지 병합)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await hubFetch<{ isFeatureLive: boolean; apps: FamilyApp[] }>('/api/family/config');
        if (res.ok && res.data && Array.isArray(res.data.apps) && res.data.apps.length > 0) {
          const remoteApps = res.data.apps;
          const remoteIds = new Set(remoteApps.map(a => String(a.id).toLowerCase()));
          const mergedApps = [
            ...remoteApps,
            ...DEFAULT_FAMILY_CONFIG.apps.filter(a => !remoteIds.has(String(a.id).toLowerCase()))
          ];
          setConfig({
            isFeatureLive: true,
            apps: mergedApps
          });
        }
      } catch (err) {
        console.warn('[HubAppSwitcher] Using default config fallback:', err);
      }
    };
    loadConfig();
  }, []);

  // 외부 클릭/터치 시 닫기 (Radix/Shadcn 표준: isOpen 일 때만 지연 등록하여 버튼 터치 이벤트와의 충돌 100% 방어)
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchend', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, [isOpen]);

  // 🚀 설정이 로드되지 않았거나, 중앙 스위치가 꺼져있으면 렌더링하지 않음
  if (!config || !config.isFeatureLive) {
    return null;
  }

  // 현재 내 앱(currentAppId)이 대시보드에서 '활성(isActive)' 상태가 아니라면 스위처를 아예 감춤
  const currentAppConfig = config.apps.find(app => app.id.toLowerCase() === currentAppId?.toLowerCase());
  if (currentAppConfig && !currentAppConfig.isActive) {
    return null;
  }

  // 활성화된 앱만 정렬하여 필터링 (현재 접속중인 앱은 목록에서 아예 제외)
  const launchedApps = config.apps
    .filter(app => app.isActive && app.id.toLowerCase() !== currentAppId?.toLowerCase())
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 명시적으로 전달된 joinedAppIds가 없으면 현재 로그인된 유저의 정보 사용
  const effectiveJoinedIds = joinedAppIds.length > 0 ? joinedAppIds : (user?.registered_apps || []);
  const lowercaseJoinedIds = effectiveJoinedIds.map(id => id.toLowerCase());

  // 가입 상태 매핑
  const appsWithStatus = launchedApps.map(app => ({
    ...app,
    isJoined: lowercaseJoinedIds.includes(app.id.toLowerCase())
  }));

  const joinedApps = appsWithStatus.filter(app => app.isJoined);
  const unjoinedApps = appsWithStatus.filter(app => !app.isJoined);

  // 현재 접속중인 앱 하나만 있거나 가입/미가입 앱이 모두 없으면 스위처를 그리지 않음
  if (joinedApps.length === 0 && unjoinedApps.length === 0) {
    return null;
  }

  // SSO 토큰 파라미터가 포함된 URL 생성 유틸 (다른 서브도메인 앱으로 넘어갈 때 로그인 상태 유지)
  const getSsoUrl = (url: string) => {
    if (typeof window === 'undefined') return url;
    const token = localStorage.getItem('merlin_session_token');
    if (!token) return url;
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('token', token);
      urlObj.searchParams.set('sso_token', token);
      return urlObj.toString();
    } catch {
      return `${url}${url.includes('?') ? '&' : '?'}token=${token}&sso_token=${token}`;
    }
  };

  const resolvedFamilyIconSrc =
    typeof familyIcon === 'string'
      ? familyIcon
      : (familyIcon as any)?.src || `${getConfig().hubUrl}/family-icon.png`;

  return (
    <div
      className={`relative text-left shrink-0 ${variant === 'sidebar' ? 'w-full block' : 'inline-block'}`}
      ref={containerRef}
    >
      {/* 트리거 버튼 (icon 모드 vs sidebar 모드) */}
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          className="w-full px-2.5 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between text-[12.5px] font-extrabold text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer group"
          aria-label="패밀리 앱 열기"
        >
          <span className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-white shadow-xs border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
              <img
                src={resolvedFamilyIconSrc}
                alt="Family Apps"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.fallback-f')) {
                    const fallback = document.createElement('span');
                    fallback.className = 'fallback-f font-black text-xs text-indigo-600';
                    fallback.innerText = 'F';
                    parent.appendChild(fallback);
                  }
                }}
                className="w-4 h-4 object-contain pointer-events-none"
              />
            </span>
            <span>썬드리머 패밀리 앱</span>
          </span>
          <span className="text-[10px] opacity-60 group-hover:opacity-100">{isOpen ? '▴' : '▾'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          className="flex items-center justify-center w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full hover:bg-slate-100/90 active:bg-slate-200 transition-all group active:scale-95 cursor-pointer shrink-0"
          aria-label="패밀리 앱 열기"
        >
          <img
            src={resolvedFamilyIconSrc}
            alt="Family Apps"
            onError={(e) => {
              // 이미지 로드 실패 시 깔끔한 SVG/텍스트 Fallback 렌더링
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent && !parent.querySelector('.fallback-f')) {
                const fallback = document.createElement('span');
                fallback.className = 'fallback-f font-black text-xs sm:text-sm text-indigo-600';
                fallback.innerText = 'F';
                parent.appendChild(fallback);
              }
            }}
            className="w-5 h-5 sm:w-5.5 sm:h-5.5 object-contain opacity-85 group-hover:opacity-100 drop-shadow-xs transition-all pointer-events-none"
          />
        </button>
      )}

      {/* 공식 드롭다운 메뉴 (가입된 앱 3열 그리드 + 미가입 앱 상세 리스트) */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${
            placement === 'bottom-up'
              ? 'left-0 bottom-full mb-2 origin-bottom-left'
              : 'right-0 top-full mt-2 origin-top-right'
          } w-72 sm:w-80 bg-white border border-slate-200 rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.25)] p-4 z-[99999] transform transition-all animate-in fade-in zoom-in duration-200 select-none text-slate-800`}
        >
          {/* My Apps (가입된 앱) - 3열 콤팩트 그리드 */}
          {joinedApps.length > 0 && (
            <div className="mb-4">
              <div className="grid grid-cols-3 gap-2">
                {joinedApps.map((app) => {
                  const cleanId = app.id.toLowerCase();
                  const Wrapper = app.isLinkActive !== false ? 'a' : 'div';
                  return (
                    <Wrapper
                      key={app.id}
                      href={app.isLinkActive !== false ? getSsoUrl(app.url) : undefined}
                      target={app.isLinkActive !== false ? '_blank' : undefined}
                      rel={app.isLinkActive !== false ? 'noopener noreferrer' : undefined}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 ${
                        app.isLinkActive !== false ? 'hover:bg-slate-100/60 hover:shadow-sm cursor-pointer active:scale-95' : 'opacity-80 cursor-default'
                      }`}
                    >
                      <div className={`text-3xl mb-2 flex items-center justify-center w-10 h-10 overflow-hidden rounded-xl bg-white shadow-sm border border-slate-100 ${
                        app.isLinkActive !== false ? 'transition-transform duration-300 hover:scale-110' : ''
                      }`}>
                        {LOCAL_LOGOS[cleanId] ? (
                          <img src={typeof LOCAL_LOGOS[cleanId] === 'string' ? LOCAL_LOGOS[cleanId] : (LOCAL_LOGOS[cleanId] as any)?.src} alt={app.name} className="w-full h-full object-cover" />
                        ) : typeof app.icon === 'string' && (app.icon.startsWith('http') || app.icon.startsWith('/') || app.icon.includes('.')) ? (
                          <img src={app.icon} alt={app.name} className="w-full h-full object-cover" />
                        ) : (
                          app.icon
                        )}
                      </div>
                      <span className="text-xs font-bold whitespace-nowrap text-slate-800">
                        {app.name}
                      </span>
                    </Wrapper>
                  );
                })}
              </div>
            </div>
          )}

          {/* Discovery (미가입 앱) - 상세 설명 리스트 */}
          {unjoinedApps.length > 0 && (
            <div className={`${joinedApps.length > 0 ? 'pt-4 border-t border-slate-200/60' : ''}`}>
              <h3 className="text-[11px] font-black text-indigo-600/90 tracking-widest mb-3 px-2 flex items-center justify-between">
                <span>썬드리머 패밀리 앱</span>
                <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[9px] px-1.5 py-0.5 rounded-full shadow-sm">New</span>
              </h3>
              <div className="space-y-1">
                {unjoinedApps.map((app) => {
                  const cleanId = app.id.toLowerCase();
                  const Wrapper = app.isLinkActive !== false ? 'a' : 'div';
                  return (
                    <Wrapper
                      key={app.id}
                      href={app.isLinkActive !== false ? getSsoUrl(app.url) : undefined}
                      target={app.isLinkActive !== false ? '_blank' : undefined}
                      rel={app.isLinkActive !== false ? 'noopener noreferrer' : undefined}
                      className={`flex items-center gap-3.5 p-2.5 rounded-2xl transition-all duration-300 group ${
                        app.isLinkActive !== false ? 'hover:bg-slate-100/60 cursor-pointer active:scale-[0.98]' : 'opacity-80 cursor-default'
                      }`}
                    >
                      <div className={`text-2xl bg-white w-11 h-11 rounded-xl shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 ${
                        app.isLinkActive !== false ? 'group-hover:scale-110 transition-transform duration-300' : ''
                      }`}>
                        {LOCAL_LOGOS[cleanId] ? (
                          <img src={typeof LOCAL_LOGOS[cleanId] === 'string' ? LOCAL_LOGOS[cleanId] : (LOCAL_LOGOS[cleanId] as any)?.src} alt={app.name} className="w-full h-full object-cover" />
                        ) : typeof app.icon === 'string' && (app.icon.startsWith('http') || app.icon.startsWith('/') || app.icon.includes('.')) ? (
                          <img src={app.icon} alt={app.name} className="w-full h-full object-cover" />
                        ) : (
                          app.icon
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-slate-900 whitespace-normal break-keep">{app.name}</span>
                          {app.openSchedule && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0 shadow-sm">
                              {app.openSchedule}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-500 mt-0.5 whitespace-normal break-keep line-clamp-1">
                          {app.description}
                        </span>
                      </div>
                    </Wrapper>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
