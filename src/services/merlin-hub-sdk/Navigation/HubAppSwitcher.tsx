'use client';
import { GUISHINFAM_CAPSULE_BASE64, GUISHINFAM_CIRCLE_BASE64 } from '../assets/guishinfamCapsuleBase64';
import { GUISHINFAM_ICON_BASE64 } from '../assets/guishinfamIconBase64';

/**
 * Version: v3.3.1 (Merlin Hub SDK v2.22.2)
 * Last Updated: 2026-11-04
 * Merlin Hub SDK — Smart Roll-Screen '귀신팸' Family App Launcher (HubAppSwitcher)
 * - 상단 트리거(variant='icon'): '귀신' 아이콘 + '귀신팸' 텍스트 + 개폐 화살표(▴/▾) 일체형 캡슐 (프로필 경계 우측 바깥 안착)
 * - 원형 미니 트리거(variant='circle'): 좁은 헤더(센스톡 등) 전용 30px 갓 쓴 아기귀신 골드 원형 뱃지
 * - 세로형 사이드바 트리거(variant='sidebar', placement='bottom-up'): 24px 슬림 캡슐 + 좌하단에서 위쪽으로 스르륵 뻗어 올라오는 148px 컴팩트 롤스크린
 * - 초슬림 레이아웃(18px 로고 + 11.5px 앱 이름만 노출) + 마우스 오버(Hover) 시 앱 이름 우측(left-full)에 설명글 플로팅 말풍선 표시
 * - 최근 본(방문한) 패밀리 앱이 위에서 아래로 최우선 배치되는 단일 수직 리스트 구조
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  zeye: ghostiLogo,
  ghosti: ghostiLogo
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
  isRecent?: boolean;
}

export interface FamilyConfig {
  isFeatureLive: boolean;
  apps: FamilyApp[];
}

export interface HubAppSwitcherProps {
  currentAppId?: string; // 현재 실행중인 앱의 ID (예: 'aggrofilter', 'ghosti', 'sundreamer')
  joinedAppIds?: string[]; // 유저가 가입한 패밀리 앱 ID 목록 (명시적 전달용)
  variant?: 'icon' | 'sidebar' | 'circle'; // 'icon'(헤더 우측 귀신팸 캡슐, 기본값) | 'sidebar'(좌측 사이드바 하단 슬림 캡슐) | 'circle'(좁은 헤더용 30px 원형 아기귀신 아이콘)
  placement?: 'top-down' | 'bottom-up'; // 'top-down'(아래로 펼침, 기본값) | 'bottom-up'(사이드바 하단에서 위로 펼침)
  autoRollOnDesktop?: boolean; // 데스크톱 유휴/활성 상태에 따른 자동 스르륵 펼침·감기 활성화 여부 (기본값: true)
}

const RECENT_APPS_STORAGE_KEY = 'merlin_recent_family_apps';
const RECENT_APPS_COOKIE_KEY = 'merlin_recent_apps';
const FOLDED_DATE_KEY = 'merlin_family_folded_date';

function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isFoldedToday(): boolean {
  if (typeof window === 'undefined') return false;
  const today = getTodayDateStr();
  try {
    if (window.localStorage.getItem(FOLDED_DATE_KEY) === today) return true;
  } catch {}
  try {
    const rawCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${FOLDED_DATE_KEY}=`));
    if (rawCookie && decodeURIComponent(rawCookie.split('=')[1] || '') === today) {
      return true;
    }
  } catch {}
  return false;
}

function markFoldedToday(): void {
  if (typeof window === 'undefined') return;
  const today = getTodayDateStr();
  try {
    window.localStorage.setItem(FOLDED_DATE_KEY, today);
  } catch {}
  try {
    const isSundreamDomain = window.location.hostname.endsWith('sundreamer.app');
    const domainAttr = isSundreamDomain ? '; domain=.sundreamer.app' : '';
    document.cookie = `${FOLDED_DATE_KEY}=${encodeURIComponent(today)}; path=/; max-age=86400; SameSite=Lax${domainAttr}`;
  } catch {}
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
      id: 'ghosti',
      name: '귀신같이',
      url: 'https://z-eye.sundreamer.app',
      icon: '👻',
      description: '1초 AI 파일·영상 내용찾기 & 용량청소·공유방',
      isActive: true,
      isLinkActive: true,
      sortOrder: 5
    }
  ]
};

function normalizeAppId(rawId?: string): string {
  const lower = (rawId || '').trim().toLowerCase();
  if (lower === 'zeye' || lower === 'z-eye') return 'ghosti';
  if (lower === 'senstalk') return 'sensetalk';
  return lower;
}

function readRecentApps(): string[] {
  if (typeof window === 'undefined') return [];
  const merged: string[] = [];

  try {
    const rawCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${RECENT_APPS_COOKIE_KEY}=`));
    if (rawCookie) {
      const val = decodeURIComponent(rawCookie.split('=')[1] || '');
      val.split(',').map(normalizeAppId).filter(Boolean).forEach(id => {
        if (!merged.includes(id)) merged.push(id);
      });
    }
  } catch {}

  try {
    const rawLocal = window.localStorage.getItem(RECENT_APPS_STORAGE_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed)) {
        parsed.map(normalizeAppId).filter(Boolean).forEach(id => {
          if (!merged.includes(id)) merged.push(id);
        });
      }
    }
  } catch {}

  return merged;
}

function recordRecentApp(appId?: string): string[] {
  if (typeof window === 'undefined') return [];
  const clean = normalizeAppId(appId);
  if (!clean) return readRecentApps();

  const current = readRecentApps().filter(id => id !== clean);
  const updated = [clean, ...current].slice(0, 10);

  try {
    window.localStorage.setItem(RECENT_APPS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}

  try {
    const val = encodeURIComponent(updated.join(','));
    const isSundreamDomain = window.location.hostname.endsWith('sundreamer.app');
    const domainAttr = isSundreamDomain ? '; domain=.sundreamer.app' : '';
    document.cookie = `${RECENT_APPS_COOKIE_KEY}=${val}; path=/; max-age=2592000; SameSite=Lax${domainAttr}`;
  } catch {}

  return updated;
}

export function HubAppSwitcher({
  currentAppId,
  joinedAppIds = [],
  variant = 'icon',
  placement = 'top-down',
  autoRollOnDesktop = true
}: HubAppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredAppId, setHoveredAppId] = useState<string | null>(null);
  const [isDesktopWingAvailable, setIsDesktopWingAvailable] = useState(false);
  const [recentAppIds, setRecentAppIds] = useState<string[]>([]);
  const [config, setConfig] = useState<FamilyConfig>(DEFAULT_FAMILY_CONFIG);

  const containerRef = useRef<HTMLDivElement>(null);
  const isHoveringLauncherRef = useRef(false);
  const userManuallyClosedRef = useRef(false);
  const userManuallyPinnedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useHub();
  const normalizedCurrentId = normalizeAppId(currentAppId);

  // 1. 현재 접속 앱을 최근 본 앱 기록에 자동 반영
  useEffect(() => {
    const updated = recordRecentApp(normalizedCurrentId);
    setRecentAppIds(updated);
  }, [normalizedCurrentId]);

  // 2. 중앙 통제 설정 불러오기 (비동기 갱신 + 신규 패밀리 앱 누락 방지 병합)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await hubFetch<{ isFeatureLive: boolean; apps: FamilyApp[] }>('/api/family/config');
        if (res.ok && res.data && Array.isArray(res.data.apps) && res.data.apps.length > 0) {
          const remoteApps = res.data.apps.map(a => ({
            ...a,
            id: normalizeAppId(a.id)
          }));
          const remoteIds = new Set(remoteApps.map(a => a.id));
          const mergedApps = [
            ...remoteApps,
            ...DEFAULT_FAMILY_CONFIG.apps.filter(a => !remoteIds.has(normalizeAppId(a.id)))
          ];
          setConfig({
            isFeatureLive: res.data.isFeatureLive !== undefined ? Boolean(res.data.isFeatureLive) : true,
            apps: mergedApps
          });
        }
      } catch (err) {
        console.warn('[HubAppSwitcher] Using default config fallback:', err);
      }
    };
    loadConfig();
  }, []);

  // 3. 데스크톱 우측 여백(Wing) 가용 여부 체크 및 '눈치껏 스르륵' 동적 롤스크린 제어
  const checkViewport = useCallback(() => {
    if (typeof window === 'undefined') return false;
    // 가로형 아이콘 모드는 1120px 이상(800px 본문 + 우측 빈 날개 확보), 세로형 사이드바 모드는 1024px 이상일 때 자동 롤스크린 작동
    const minWidth = variant === 'sidebar' ? 1024 : 1120;
    const available = window.innerWidth >= minWidth;
    setIsDesktopWingAvailable(available);
    return available;
  }, [variant]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const available = checkViewport();

    const handleResize = () => {
      const nowAvailable = checkViewport();
      if (!nowAvailable && !userManuallyPinnedRef.current) {
        setIsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);

    if (!autoRollOnDesktop) {
      return () => window.removeEventListener('resize', handleResize);
    }

    if (isFoldedToday()) {
      userManuallyClosedRef.current = true;
    }

    // 초기 진입 후 4초(4000ms) 뒤 스르륵 펼침 (데스크톱 여백 확보 & 오늘 '접기' 안 누른 경우)
    let initTimer: ReturnType<typeof setTimeout> | null = null;
    if (available && !userManuallyClosedRef.current && !isFoldedToday()) {
      initTimer = setTimeout(() => {
        if (window.scrollY < 100 && !userManuallyClosedRef.current && !isFoldedToday()) {
          setIsOpen(true);
        }
      }, 4000);
    }

    // 3분(180,000ms) 이상 완전히 손을 놓고 쉴 때만 조용히 재등장 (오늘 '접기' 누른 경우 제외)
    const scheduleIdleUnroll = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (userManuallyClosedRef.current || isFoldedToday()) return;
      idleTimerRef.current = setTimeout(() => {
        if (!checkViewport() || userManuallyClosedRef.current || isFoldedToday()) return;
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const isTyping = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;
        if (!isTyping && window.scrollY < 120) {
          setIsOpen(true);
        }
      }, 180000);
    };

    // 유저가 본문을 사용하면 초기 타이머를 취소하고 조용히 눈치껏 감아 올라감
    const handleUserActiveUse = (e: Event) => {
      if (isHoveringLauncherRef.current) return;
      if (containerRef.current && e.target instanceof Node && containerRef.current.contains(e.target)) {
        return;
      }
      if (initTimer) {
        clearTimeout(initTimer);
        initTimer = null;
      }
      if (!userManuallyPinnedRef.current) {
        setIsOpen(false);
        setHoveredAppId(null);
      }
      scheduleIdleUnroll();
    };

    // 마우스 이동 시에는 열려 있는 상태를 강제로 닫지는 않되, 3분 휴식 타이머만 갱신(읽는 중 갑자기 튀어나옴 방지)
    let lastMoveReset = 0;
    const handleMouseMove = () => {
      const now = Date.now();
      if (now - lastMoveReset < 2000) return;
      lastMoveReset = now;
      if (!isOpen) {
        scheduleIdleUnroll();
      }
    };

    const handleScroll = () => {
      if (isHoveringLauncherRef.current) return;
      if (window.scrollY > 110) {
        if (initTimer) {
          clearTimeout(initTimer);
          initTimer = null;
        }
        if (!userManuallyPinnedRef.current) {
          setIsOpen(false);
          setHoveredAppId(null);
        }
      }
      scheduleIdleUnroll();
    };

    document.addEventListener('mousedown', handleUserActiveUse, { passive: true });
    document.addEventListener('keydown', handleUserActiveUse, { passive: true });
    document.addEventListener('focusin', handleUserActiveUse, { passive: true });
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (initTimer) clearTimeout(initTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleUserActiveUse);
      document.removeEventListener('keydown', handleUserActiveUse);
      document.removeEventListener('focusin', handleUserActiveUse);
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [autoRollOnDesktop, checkViewport]);

  // 4. 모바일/수동 오픈 시 바깥 터치 닫기
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (!isDesktopWingAvailable || userManuallyPinnedRef.current) {
          userManuallyPinnedRef.current = false;
          setIsOpen(false);
          setHoveredAppId(null);
        }
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
  }, [isOpen, isDesktopWingAvailable]);

  // 5. 최근 본 앱이 위에서 아래로 배치되는 단일 정렬 리스트 계산
  const sortedApps = useMemo(() => {
    if (!config || !config.isFeatureLive) return [];

    const launchedApps = config.apps.filter(
      app => app.isActive && normalizeAppId(app.id) !== normalizedCurrentId
    );

    const effectiveJoinedIds = (joinedAppIds.length > 0 ? joinedAppIds : (user?.registered_apps || []))
      .map(normalizeAppId);

    const joinDates: Record<string, number> = {};
    if (user && (user as any).app_join_dates && typeof (user as any).app_join_dates === 'object') {
      Object.entries((user as any).app_join_dates).forEach(([k, v]) => {
        const ts = new Date(String(v)).getTime();
        if (!isNaN(ts)) joinDates[normalizeAppId(k)] = ts;
      });
    }

    return launchedApps
      .map(app => {
        const cleanId = normalizeAppId(app.id);
        const recentIdx = recentAppIds.indexOf(cleanId);
        const isJoined = effectiveJoinedIds.includes(cleanId);
        const isRecent = recentIdx !== -1 || isJoined;
        return {
          ...app,
          id: cleanId,
          isJoined,
          isRecent,
          _recentRank: recentIdx !== -1 ? recentIdx : 999,
          _joinTs: joinDates[cleanId] || 0
        };
      })
      .sort((a, b) => {
        if (a._recentRank !== b._recentRank) return a._recentRank - b._recentRank;
        if (a._joinTs !== b._joinTs) return b._joinTs - a._joinTs;
        if (a.isJoined !== b.isJoined) return a.isJoined ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      });
  }, [config, normalizedCurrentId, joinedAppIds, user, recentAppIds]);

  if (!config || !config.isFeatureLive) return null;

  const currentAppConfig = config.apps.find(app => normalizeAppId(app.id) === normalizedCurrentId);
  if (currentAppConfig && !currentAppConfig.isActive) return null;

  if (sortedApps.length === 0) return null;

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

  const handleToggleManual = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(prev => {
      const next = !prev;
      if (next) {
        userManuallyPinnedRef.current = true;
      } else {
        // 유저가 직접 '접기' 또는 캡슐 닫기를 누르면 그날 하루 동안은 자동으로 튀어나오지 않음
        userManuallyClosedRef.current = true;
        userManuallyPinnedRef.current = false;
        markFoldedToday();
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
          idleTimerRef.current = null;
        }
        setHoveredAppId(null);
      }
      return next;
    });
  };

  const handleAppClick = (appId: string) => {
    const updated = recordRecentApp(appId);
    setRecentAppIds(updated);
  };

  const hubBaseUrl = (getConfig().hubUrl || "https://os.sundreamer.app").replace(/\/+$/, "");
  const resolvedGhostiIconSrc = GUISHINFAM_ICON_BASE64;
  const isBottomUp = placement === 'bottom-up' || variant === 'sidebar';

  const renderAppLogo = (app: FamilyApp) => {
    const cleanId = normalizeAppId(app.id);
    const localAsset = LOCAL_LOGOS[cleanId];
    if (localAsset) {
      const src = typeof localAsset === 'string' ? localAsset : (localAsset as any)?.src;
      return (
        <img
          src={src}
          alt={app.name}
          className="w-full h-full object-cover block"
          style={{ width: '26px', height: '26px', objectFit: 'cover', display: 'block' }}
        />
      );
    }
    if (typeof app.icon === 'string' && (app.icon.startsWith('http') || app.icon.startsWith('/') || app.icon.includes('.'))) {
      return (
        <img
          src={app.icon}
          alt={app.name}
          className="w-full h-full object-cover block"
          style={{ width: '26px', height: '26px', objectFit: 'cover', display: 'block' }}
        />
      );
    }
    return <span className="text-base leading-none">{app.icon}</span>;
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        isHoveringLauncherRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveringLauncherRef.current = false;
        setHoveredAppId(null);
      }}
      className={`relative text-left shrink-0 select-none ${variant === 'sidebar' ? 'w-full block' : 'inline-flex flex-col items-start'}`}
    >
      {/* 트리거 버튼: sidebar & icon(어그로필터 기준 동일 캡슐 규격) | circle(30px 원형 뱃지) */}
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleToggleManual}
          title="👻 귀신팸 — 귀신같이 똑똑한 가족 앱 모음"
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-2xl border transition-all cursor-pointer select-none focus:outline-none active:scale-95 shadow-sm ${
            isOpen
              ? 'bg-white border-amber-400 ring-2 ring-amber-400/30'
              : 'bg-white hover:bg-slate-50/90 border-amber-300/90 hover:border-amber-400'
          }`}
          aria-label="귀신팸 펼치기/접기"
        >
          <img
            src={GUISHINFAM_CAPSULE_BASE64}
            alt="귀신팸"
            className="h-9 sm:h-11 w-auto min-w-[100px] sm:min-w-[122px] object-contain pointer-events-none"
            style={{ height: '44px', minWidth: '122px', width: 'auto' }}
          />
          <span
            className={`text-xs leading-none font-black ml-0.5 transition-colors ${
              isOpen ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            {isOpen ? '▾' : '▴'}
          </span>
        </button>
      ) : variant === 'circle' ? (
        <button
          type="button"
          onClick={handleToggleManual}
          title="👻 귀신팸 — 귀신같이 똑똑한 가족 앱 모음"
          className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all cursor-pointer shrink-0 focus:outline-none active:scale-95 shadow-xs ${
            isOpen
              ? 'ring-2 ring-amber-400/60 scale-105'
              : 'hover:scale-105'
          }`}
          style={{ width: '30px', height: '30px' }}
          aria-label="귀신팸 펼치기/접기"
        >
          <img
            src={GUISHINFAM_CIRCLE_BASE64}
            alt="귀신팸"
            className="w-full h-full object-contain rounded-full pointer-events-none"
            style={{ width: '30px', height: '30px' }}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleToggleManual}
          title="👻 귀신팸 — 귀신같이 똑똑한 가족 앱 모음"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-2xl border transition-all cursor-pointer shrink-0 focus:outline-none active:scale-95 shadow-sm ${
            isOpen
              ? 'bg-white border-amber-400 ring-2 ring-amber-400/30'
              : 'bg-white hover:bg-slate-50/80 border-amber-300/90 hover:border-amber-400'
          }`}
          aria-label="귀신팸 펼치기/접기"
        >
          {/* 플로우에서 하나로 완성된 [갓 쓴 아기귀신 + 3D 귀신팸] 새 화이트 원본 타이트 크롭 로고 */}
          <img
            src={GUISHINFAM_CAPSULE_BASE64}
            alt="귀신팸"
            className="h-9 sm:h-11 w-auto min-w-[100px] sm:min-w-[122px] object-contain pointer-events-none"
            style={{ height: '44px', minWidth: '122px', width: 'auto' }}
          />
          <span
            className={`text-xs leading-none font-black ml-0.5 transition-colors ${
              isOpen ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            {isOpen ? '▴' : '▾'}
          </span>
        </button>
      )}

      {/* 스르륵 롤스크린 컨테이너: 어그로필터 표준 규격(156px 폭, 26px 로고, 12.5px 폰트) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '156px' }}
        className={`absolute z-[99999] transition-all duration-300 ease-out ${
          isBottomUp
            ? 'left-0 bottom-full mb-1.5 w-[156px] origin-bottom-left'
            : isDesktopWingAvailable && variant !== 'circle'
              ? 'left-0 top-full mt-1.5 w-[156px] origin-top-left'
              : 'right-0 top-full mt-1.5 w-[156px] origin-top-right'
        } ${
          isOpen
            ? 'opacity-100 scale-y-100 translate-y-0 pointer-events-auto'
            : isBottomUp
              ? 'opacity-0 scale-y-75 translate-y-2 pointer-events-none'
              : 'opacity-0 scale-y-75 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* 버튼과 롤스크린 사이 마우스 이동 브릿지 */}
        {!isBottomUp && <div className="absolute -top-2.5 left-0 right-0 h-2.5 bg-transparent" />}

        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/90 dark:border-zinc-700/80 rounded-2xl shadow-[0_12px_30px_rgba(15,23,42,0.12)] p-1.5 text-slate-800 dark:text-zinc-100">
          {/* 세로형(bottom-up)일 때는 상단 끝단에 접기 손잡이 바 배치 */}
          {isBottomUp && (
            <button
              type="button"
              onClick={handleToggleManual}
              className="w-full flex items-center justify-center gap-1 py-1 mb-1 rounded-lg bg-slate-50/80 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-[10px] font-extrabold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              title="귀신팸 접기"
            >
              <span>▾ 접기</span>
            </button>
          )}

          {/* 위에서 아래로: 최근 본 앱 -> 미방문 앱 단일 슬림 리스트 (로고 + 앱 이름만 노출) */}
          <div className="flex flex-col gap-0.5">
            {sortedApps.map((app, index) => {
              const isHovered = hoveredAppId === app.id;
              const Wrapper = app.isLinkActive !== false ? 'a' : 'div';
              const showDivider =
                index > 0 &&
                sortedApps[index - 1].isRecent &&
                !app.isRecent;

              return (
                <React.Fragment key={app.id}>
                  {showDivider && (
                    <div className="my-0.5 border-t border-dashed border-slate-200/70 dark:border-zinc-800" />
                  )}
                  <div
                    className="relative"
                    onMouseEnter={() => setHoveredAppId(app.id)}
                  >
                    <Wrapper
                      href={app.isLinkActive !== false ? getSsoUrl(app.url) : undefined}
                      target={app.isLinkActive !== false ? '_blank' : undefined}
                      rel={app.isLinkActive !== false ? 'noopener noreferrer' : undefined}
                      onClick={() => handleAppClick(app.id)}
                      className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl transition-all duration-150 group/item ${
                        app.isLinkActive !== false
                          ? 'hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 cursor-pointer active:scale-[0.98]'
                          : 'opacity-75 cursor-default'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="rounded-lg bg-white shadow-xs border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 group-hover/item:scale-105 transition-transform"
                          style={{ width: '26px', height: '26px', minWidth: '26px', maxWidth: '26px', maxHeight: '26px' }}
                        >
                          {renderAppLogo(app)}
                        </div>
                        <span className="text-[12.5px] font-extrabold text-slate-800 dark:text-zinc-100 group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 whitespace-nowrap">
                          {app.name}
                        </span>
                      </div>

                      {/* 우측 초소형 상태 표시 (최근 본 앱 에메랄드 점 vs 미방문 N) */}
                      {app.isRecent ? (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shrink-0"
                          title="최근 본 앱"
                        />
                      ) : (
                        <span className="text-[8.5px] font-black text-rose-500 bg-rose-50 border border-rose-200/80 px-1 py-0.2 rounded-full shrink-0">
                          N
                        </span>
                      )}
                    </Wrapper>

                    {/* 마우스 오버(Hover) 시 앱 이름 우측(left-full)에 나타나는 설명글 말풍선 */}
                    {isHovered && (
                      <div
                        className={`hidden sm:block absolute z-[100000] w-52 p-2.5 rounded-2xl bg-slate-900/95 text-white shadow-xl border border-slate-700/80 pointer-events-none animate-in fade-in duration-150 ${
                          isBottomUp
                            ? 'left-full ml-2 bottom-0'
                            : isDesktopWingAvailable && variant !== 'circle'
                              ? 'left-full ml-2 top-0'
                              : 'right-full mr-2 top-0'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="text-xs font-black text-white">{app.name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            app.isRecent
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {app.isRecent ? '최근 본 앱' : '패밀리 New'}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-200 leading-snug break-keep">
                          {app.description}
                        </p>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* 가로형(top-down)일 때는 롤스크린 하단 끝단에 접기 손잡이 바 배치 */}
          {!isBottomUp && (
            <button
              type="button"
              onClick={handleToggleManual}
              className="w-full flex items-center justify-center gap-1 py-1 mt-1 rounded-lg bg-slate-50/80 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-[10px] font-extrabold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              title="귀신팸 접기"
            >
              <span>▴ 접기</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
