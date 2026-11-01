'use client';

import React, { useState, useRef, useEffect } from 'react';
import familyIcon from '../assets/family-icon.png';
import sundreamerLogo from '../assets/logos/sundreamer.png';
import whateatLogo from '../assets/logos/whateat.png';
import aggrofilterLogo from '../assets/logos/aggrofilter.png';
import sensetalkLogo from '../assets/logos/sensetalk.png';
import ghostiLogo from '../assets/logos/ghosti.png';

const LOCAL_LOGOS: Record<string, any> = {
  sundreamer: sundreamerLogo,
  whateat: whateatLogo,
  aggrofilter: aggrofilterLogo,
  sensetalk: sensetalkLogo,
  ghosti: ghostiLogo,
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
  currentAppId?: string; // 현재 실행중인 앱의 ID (예: 'aggrofilter', 'ghosti', 'sundreamer')
  joinedAppIds?: string[]; // 유저가 가입한 패밀리 앱 ID 목록 (명시적 전달용)
  variant?: 'icon' | 'sidebar'; // 'icon'(상단 가로 헤더 F 세로 드롭다운) | 'sidebar'(좌측 세로 사이드바 하단 빈 공간 상시 노출 + F 팝업)
  placement?: 'top-down' | 'bottom-up'; // 'top-down'(F 버튼 바로 아래 세로 드롭다운) | 'bottom-up'(사이드바 하단에서 위로 펼침)
}

const VISITED_FAMILY_APPS_STORAGE_KEY = 'merlin_visited_family_apps_v1';
const DEFAULT_VISITED_APP_IDS = ['sensetalk', 'aggrofilter', 'sundreamer'];

export function getVisitedFamilyAppIds(): string[] {
  if (typeof window === 'undefined') return DEFAULT_VISITED_APP_IDS;
  try {
    const raw = localStorage.getItem(VISITED_FAMILY_APPS_STORAGE_KEY);
    if (!raw) return DEFAULT_VISITED_APP_IDS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((id) => String(id).toLowerCase());
    }
  } catch {
    // ignore
  }
  return DEFAULT_VISITED_APP_IDS;
}

export function recordVisitedFamilyApp(appId: string): string[] {
  const clean = String(appId || '').toLowerCase().trim();
  if (!clean) return getVisitedFamilyAppIds();
  const prev = getVisitedFamilyAppIds().filter((id) => id !== clean);
  const next = [clean, ...prev].slice(0, 8);
  try {
    localStorage.setItem(VISITED_FAMILY_APPS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('merlinVisitedAppsUpdated', { detail: next }));
  } catch {
    // ignore
  }
  return next;
}

export const DEFAULT_FAMILY_CONFIG: FamilyConfig = {
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
      sortOrder: 1,
    },
    {
      id: 'whateat',
      name: '뭐먹지?',
      url: 'https://whateat.sundreamer.app',
      icon: '🍱',
      description: '학교 급식과 식생활 기록 플랫폼',
      isActive: true,
      isLinkActive: true,
      sortOrder: 2,
    },
    {
      id: 'aggrofilter',
      name: '어그로필터',
      url: 'https://aggrofilter.com',
      icon: '🛡️',
      description: '유튜브 영상 팩트 신뢰도 분석기',
      isActive: true,
      isLinkActive: true,
      sortOrder: 3,
    },
    {
      id: 'sensetalk',
      name: '센스톡',
      url: 'https://sensetalk.netlify.app',
      icon: '💬',
      description: '1:1 맞춤 감성 메시지 고속 발송 비서',
      isActive: true,
      isLinkActive: true,
      sortOrder: 4,
    },
    {
      id: 'ghosti',
      name: '귀신같이',
      url: 'https://ghosti.sundreamer.app',
      icon: '👁️',
      description: '1초 투시검색 · 클린몬스터 · 패밀리 사진/업무 공유',
      isActive: true,
      isLinkActive: true,
      sortOrder: 5,
    },
  ],
};

export function buildFamilySsoUrl(url: string): string {
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
}

export function HubAppSwitcher({
  currentAppId,
  joinedAppIds = [],
  variant = 'icon',
  placement = 'top-down',
}: HubAppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<FamilyConfig>(DEFAULT_FAMILY_CONFIG);
  const [visitedIds, setVisitedIds] = useState<string[]>(() => getVisitedFamilyAppIds());
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useHub();

  // 모바일 바탕화면 아이콘 0.5초 꾹 누르기(롱프레스 shortcuts)로 진입한 `?family_jump=<appId>` 자동 점프 처리
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const jumpTarget = params.get('family_jump')?.toLowerCase().trim();
      if (!jumpTarget) return;
      const targetApp = DEFAULT_FAMILY_CONFIG.apps.find((a) => a.id.toLowerCase() === jumpTarget);
      if (targetApp && targetApp.id.toLowerCase() !== currentAppId?.toLowerCase()) {
        recordVisitedFamilyApp(targetApp.id);
        params.delete('family_jump');
        const cleanSearch = params.toString();
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`
        );
        window.location.href = buildFamilySsoUrl(targetApp.url);
      }
    } catch {
      // ignore
    }
  }, [currentAppId]);

  useEffect(() => {
    const onVisitedUpdated = () => setVisitedIds(getVisitedFamilyAppIds());
    window.addEventListener('merlinVisitedAppsUpdated', onVisitedUpdated);
    return () => window.removeEventListener('merlinVisitedAppsUpdated', onVisitedUpdated);
  }, []);

  // 중앙 통제 설정 불러오기 (비동기 갱신 + 신규 패밀리 앱 누락 방지 병합)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await hubFetch<{ isFeatureLive: boolean; apps: FamilyApp[] }>('/api/family/config');
        if (res.ok && res.data && Array.isArray(res.data.apps) && res.data.apps.length > 0) {
          const remoteApps = res.data.apps;
          const remoteIds = new Set(remoteApps.map((a) => String(a.id).toLowerCase()));
          const mergedApps = [
            ...remoteApps,
            ...DEFAULT_FAMILY_CONFIG.apps.filter((a) => !remoteIds.has(String(a.id).toLowerCase())),
          ];
          setConfig({
            isFeatureLive: true,
            apps: mergedApps,
          });
        }
      } catch (err) {
        console.warn('[HubAppSwitcher] Using default config fallback:', err);
      }
    };
    loadConfig();
  }, []);

  // 외부 클릭/터치 시 닫기
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

  if (!config || !config.isFeatureLive) {
    return null;
  }

  const currentAppConfig = config.apps.find((app) => app.id.toLowerCase() === currentAppId?.toLowerCase());
  if (currentAppConfig && !currentAppConfig.isActive) {
    return null;
  }

  const launchedApps = config.apps
    .filter((app) => app.isActive && app.id.toLowerCase() !== currentAppId?.toLowerCase())
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const effectiveJoinedIds = Array.from(
    new Set([
      ...(joinedAppIds.length > 0 ? joinedAppIds : user?.registered_apps || []),
      ...visitedIds,
    ].map((id) => String(id).toLowerCase()))
  );

  const appsWithStatus = launchedApps.map((app) => ({
    ...app,
    isJoined: effectiveJoinedIds.includes(app.id.toLowerCase()),
  }));

  // 내가 다녀간 패밀리 앱 (최근 방문 순서 우선 정렬)
  const visitedApps = [
    ...visitedIds
      .map((id) => appsWithStatus.find((a) => a.id.toLowerCase() === id))
      .filter((a): a is FamilyApp & { isJoined: boolean } => Boolean(a)),
    ...appsWithStatus.filter((a) => a.isJoined && !visitedIds.includes(a.id.toLowerCase())),
  ];

  const unjoinedApps = appsWithStatus.filter(
    (app) => !visitedApps.some((v) => v.id.toLowerCase() === app.id.toLowerCase())
  );

  if (visitedApps.length === 0 && unjoinedApps.length === 0) {
    return null;
  }

  const resolvedFamilyIconSrc =
    typeof familyIcon === 'string'
      ? familyIcon
      : (familyIcon as any)?.src || `${getConfig().hubUrl}/family-icon.png`;

  const renderAppLogo = (app: FamilyApp, sizeClass = 'w-6 h-6') => {
    const cleanId = app.id.toLowerCase();
    return (
      <div
        className={`${sizeClass} rounded-lg bg-white shadow-xs border border-slate-200 flex items-center justify-center overflow-hidden shrink-0`}
      >
        {LOCAL_LOGOS[cleanId] ? (
          <img
            src={typeof LOCAL_LOGOS[cleanId] === 'string' ? LOCAL_LOGOS[cleanId] : (LOCAL_LOGOS[cleanId] as any)?.src}
            alt={app.name}
            className="w-full h-full object-cover"
          />
        ) : typeof app.icon === 'string' &&
          (app.icon.startsWith('http') || app.icon.startsWith('/') || app.icon.includes('.')) ? (
          <img src={app.icon} alt={app.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm">{app.icon}</span>
        )}
      </div>
    );
  };

  return (
    <div
      className={`relative text-left shrink-0 ${variant === 'sidebar' ? 'w-full block' : 'inline-block'}`}
      ref={containerRef}
    >
      {/* [강화 ②] 좌측 세로 사이드바 모드일 때: 하단 빈 공간에 '내가 다녀간 패밀리 앱'을 상시 펼쳐 두어 F를 누르지 않고도 원터치로 즉시 이동 */}
      {variant === 'sidebar' && visitedApps.length > 0 && (
        <div className="mb-2 p-2 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/8 dark:border-white/10">
          <div className="px-1.5 pb-1.5 flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold text-slate-600 dark:text-zinc-400 tracking-tight flex items-center gap-1">
              <span>🕘 내가 다녀간 패밀리 앱</span>
            </span>
            <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
              원터치 이동
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {visitedApps.slice(0, 3).map((app) => (
              <a
                key={app.id}
                href={buildFamilySsoUrl(app.url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordVisitedFamilyApp(app.id)}
                className="px-2 py-1.5 rounded-xl hover:bg-black/6 dark:hover:bg-white/8 flex items-center justify-between gap-2 transition-all group cursor-pointer"
                title={`${app.name} (${app.description}) — 클릭 시 자동 로그인(SSO) 상태로 바로 이동`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {renderAppLogo(app, 'w-5.5 h-5.5')}
                  <span className="text-[12px] font-extrabold text-slate-800 dark:text-zinc-200 group-hover:text-teal-600 dark:group-hover:text-primary-container truncate">
                    {app.name}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 group-hover:text-teal-600 dark:group-hover:text-primary-container shrink-0">
                  이동 ↗
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 트리거 버튼 (sidebar 모드 vs 상단 가로 헤더 F 아이콘 모드) */}
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="w-full px-2.5 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between text-[12.5px] font-extrabold text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer group"
          aria-label="패밀리 앱 전체 열기"
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
            <span>썬드리머 패밀리 전체 보기</span>
          </span>
          <span className="text-[10px] opacity-60 group-hover:opacity-100">{isOpen ? '▴' : '▾'}</span>
        </button>
      ) : (
        /* [강화 ③] 상단 가로 헤더 F 버튼: 클릭 시 바로 아래쪽으로 세로 드롭다운(내가 다녀간 패밀리 앱 + 전체 패밀리 앱) 펼침 */
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          title="썬드리머 패밀리 앱 런처 (클릭 시 아래로 내가 다녀간 앱 세로 드롭다운 펼침)"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all group active:scale-95 cursor-pointer shrink-0 ${
            isOpen
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
              : 'bg-white/90 dark:bg-zinc-900/90 hover:bg-indigo-50 dark:hover:bg-zinc-800 border-slate-200 dark:border-white/15 text-slate-800 dark:text-zinc-200'
          }`}
          aria-label="패밀리 앱 세로 드롭다운 열기"
        >
          <img
            src={resolvedFamilyIconSrc}
            alt="Family Apps"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent && !parent.querySelector('.fallback-f')) {
                const fallback = document.createElement('span');
                fallback.className = 'fallback-f font-black text-xs sm:text-sm text-indigo-600';
                fallback.innerText = 'F';
                parent.appendChild(fallback);
              }
            }}
            className="w-4 h-4 sm:w-4.5 sm:h-4.5 object-contain pointer-events-none"
          />
          <span className="font-label-sm text-[11.5px] font-extrabold hidden sm:inline">패밀리</span>
          <span className="text-[10px] opacity-75">{isOpen ? '▴' : '▾'}</span>
        </button>
      )}

      {/* 공식 드롭다운 메뉴 (상단 가로 헤더 F 클릭 시 바로 아래 세로 드롭다운 / 사이드바 하단 클릭 시 위로 팝업) */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${
            placement === 'bottom-up'
              ? 'left-0 bottom-full mb-2 origin-bottom-left'
              : 'right-0 top-full mt-2 origin-top-right'
          } w-72 sm:w-80 bg-white border border-slate-200 rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.28)] p-4 z-[99999] transform transition-all animate-in fade-in zoom-in duration-200 select-none text-slate-800`}
        >
          {/* 1) 내가 다녀간 패밀리 앱 (세로 드롭다운 & 3열 그리드 겸용) */}
          {visitedApps.length > 0 && (
            <div className="mb-3.5">
              <div className="flex items-center justify-between px-1.5 mb-2">
                <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <span>🕘 내가 다녀간 패밀리 앱</span>
                </span>
                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  SSO 자동연결
                </span>
              </div>
              <div className="space-y-1">
                {visitedApps.map((app) => {
                  const Wrapper = app.isLinkActive !== false ? 'a' : 'div';
                  return (
                    <Wrapper
                      key={app.id}
                      href={app.isLinkActive !== false ? buildFamilySsoUrl(app.url) : undefined}
                      target={app.isLinkActive !== false ? '_blank' : undefined}
                      rel={app.isLinkActive !== false ? 'noopener noreferrer' : undefined}
                      onClick={() => {
                        recordVisitedFamilyApp(app.id);
                        setIsOpen(false);
                      }}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-2xl transition-all ${
                        app.isLinkActive !== false
                          ? 'hover:bg-indigo-50/80 border border-transparent hover:border-indigo-200/80 cursor-pointer active:scale-[0.99]'
                          : 'opacity-80 cursor-default'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {renderAppLogo(app, 'w-9 h-9')}
                        <div className="min-w-0">
                          <div className="text-sm font-black text-slate-900 truncate">{app.name}</div>
                          <div className="text-[11px] font-medium text-slate-500 truncate">
                            {app.description}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-extrabold text-indigo-600 shrink-0">
                        열기 ↗
                      </span>
                    </Wrapper>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2) 새로운 패밀리 앱 (Discovery) */}
          {unjoinedApps.length > 0 && (
            <div className={`${visitedApps.length > 0 ? 'pt-3 border-t border-slate-200/70' : ''}`}>
              <h3 className="text-[11px] font-black text-indigo-600/90 tracking-widest mb-2 px-1.5 flex items-center justify-between">
                <span>✨ 썬드리머 패밀리 전체 앱</span>
                <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[9px] px-1.5 py-0.5 rounded-full shadow-xs">
                  New
                </span>
              </h3>
              <div className="space-y-1">
                {unjoinedApps.map((app) => {
                  const Wrapper = app.isLinkActive !== false ? 'a' : 'div';
                  return (
                    <Wrapper
                      key={app.id}
                      href={app.isLinkActive !== false ? buildFamilySsoUrl(app.url) : undefined}
                      target={app.isLinkActive !== false ? '_blank' : undefined}
                      rel={app.isLinkActive !== false ? 'noopener noreferrer' : undefined}
                      onClick={() => {
                        recordVisitedFamilyApp(app.id);
                        setIsOpen(false);
                      }}
                      className={`flex items-center gap-3 p-2 rounded-2xl transition-all group ${
                        app.isLinkActive !== false
                          ? 'hover:bg-slate-100/80 cursor-pointer active:scale-[0.99]'
                          : 'opacity-80 cursor-default'
                      }`}
                    >
                      {renderAppLogo(app, 'w-8.5 h-8.5')}
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900">{app.name}</span>
                          {app.openSchedule && (
                            <span className="text-[9.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                              {app.openSchedule}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 truncate">
                          {app.description}
                        </span>
                      </div>
                    </Wrapper>
                  );
                })}
              </div>
            </div>
          )}

          {/* 모바일 0.5초 꾹 누르기(롱프레스) 팁 안내 */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 px-1.5 flex items-center justify-between text-[10.5px] text-slate-500">
            <span>📱 폰 바탕화면 앱 아이콘을 0.5초 꾹 누르면 바로가기 메뉴가 뜹니다</span>
          </div>
        </div>
      )}
    </div>
  );
}
