import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import {
  isSharedPhotoLounge,
  resolveLoungePhotoCorpus,
} from '../../store/slices/storeSharedRefs';
import { jumpToGhostSecretary } from '../../components/GhostSecretaryFirstGuard';
import { aiRuntimeFlags } from '../../services/ai/aiSharedRuntime';
import { getZCoreUrl, zCoreBridge } from '../../services/zCoreBridge';
import { hasAuthenticatedHubAccountSession } from '../../services/supabaseClient';
import {
  consumeNativePendingDeepLink,
  isAndroidMobileBrowserOrApp,
  isCapacitorNativeMobileRuntime,
  isIosMobileBrowserOrApp,
} from '../../services/ghostiMobileCareBridge';
import {
  buildAndroidPlayStoreInviteUrl,
  buildAndroidSafeAppProbeIntentUrl,
  buildDeferredInviteClipboardToken,
  buildIosStoreInviteUrl,
  buildShareRoomNativeSchemeUrl,
  readActiveInviteToken,
  readCurrentInviteDisplayMeta,
} from '../../services/shareInviteDeepLinkBridge';
import { registerLocalPhotoPreviewDataUrl } from '../../services/sharedPhotoRoomSupabase';
import { loadPassportFlowState } from '../../services/passportRegistrationFlow';
import { parseWorkInviteInput } from '../../services/workRoomSyncService';

const PERSISTENT_BATCH_THUMB_CACHE = new Map<string, string>();
const INFLIGHT_BATCH_THUMB_IDS = new Set<string>();

export const FreePhotoShareOverlays: React.FC = () => {
  const activeLoungeType = useSaySeeStore((s) => s.activeLoungeType);
  const photos = useSaySeeStore((s) => s.photos);
  const activeFamilyRoom = useSaySeeStore((s) => s.activeFamilyRoom);
  const activeSharedRoomId = useSaySeeStore((s) => s.activeSharedRoomId);
  const activeJoinedRoomMeta = useSaySeeStore((s) => s.activeJoinedRoomMeta);
  const isGuestPreviewMode = useSaySeeStore((s) => s.isGuestPreviewMode);
  const isLoadingSharedRoomPhotos = useSaySeeStore((s) => s.isLoadingSharedRoomPhotos);
  const guestJoinWallReason = useSaySeeStore((s) => s.guestJoinWallReason);
  const triggerGuestJoinWall = useSaySeeStore((s) => s.triggerGuestJoinWall);
  const completeGuestOneSecJoin = useSaySeeStore((s) => s.completeGuestOneSecJoin);
  const applyShareInviteDeepLink = useSaySeeStore((s) => s.applyShareInviteDeepLink);
  const syncActiveSharedRoomFromSupabase = useSaySeeStore((s) => s.syncActiveSharedRoomFromSupabase);
  const showSharedPhotoUploadModal = useSaySeeStore((s) => s.showSharedPhotoUploadModal);
  const setShowSharedPhotoUploadModal = useSaySeeStore((s) => s.setShowSharedPhotoUploadModal);
  const addLocalPhotosToSharedRoom = useSaySeeStore((s) => s.addLocalPhotosToSharedRoom);
  const sharedRoomHostPhotos = useSaySeeStore((s) => s.sharedRoomHostPhotos);
  const sharedRoomAddedPhotos = useSaySeeStore((s) => s.sharedRoomAddedPhotos);
  const faceClusters = useSaySeeStore((s) => s.faceClusters);
  const importMobileLocalPhotos = useSaySeeStore((s) => s.importMobileLocalPhotos);
  const layout = useSaySeeStore((s) => s.layout);
  const isStoreAppMode = useSaySeeStore((s) => s.isStoreAppMode);
  const isNativeApp = isCapacitorNativeMobileRuntime();
  const isMobileEnv = layout === 'mobile' || Boolean(isStoreAppMode) || isNativeApp;
  const isMobileWebBrowser = isMobileEnv && !isNativeApp;

  const [guestNicknameDraft, setGuestNicknameDraft] = useState('');
  const [guestEmailDraft, setGuestEmailDraft] = useState('');
  const [selectedSharedUploadIds, setSelectedSharedUploadIds] = useState<string[]>([]);
  const [recentPickedNames, setRecentPickedNames] = useState<string[]>([]);
  const [uploadModalFilterMode, setUploadModalFilterMode] = useState<'all' | 'passport_recommended'>('all');
  const [, setThumbCacheTick] = useState(0);
  const scrollWrapRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    viewportH: 560,
    containerW: 780,
  });
  const wasUploadModalOpenRef = useRef(false);

  const selectedSharedUploadSet = useMemo(
    () => new Set(selectedSharedUploadIds),
    [selectedSharedUploadIds]
  );

  const activeSharedRoomTitle = activeJoinedRoomMeta
    ? `${activeJoinedRoomMeta.masterNickname} · ${activeJoinedRoomMeta.roomTitle}`
    : activeLoungeType === 'club'
    ? '동호회·모임 앨범'
    : activeLoungeType === 'student'
    ? '동창회 앨범'
    : `${activeFamilyRoom} 패밀리 앨범`;

  const uploadableLocalPhotos = useMemo(() => {
    const currentRoomCorpus = resolveLoungePhotoCorpus({
      activeLoungeType,
      activeFamilyRoom,
      activeSharedRoomId,
      photos,
      sharedRoomHostPhotos,
      sharedRoomAddedPhotos,
    });
    const existingSharedNameSizes = new Set(currentRoomCorpus.map((p) => `${p.name}__${p.size}`));
    const existingDhashSizes = new Set(
      currentRoomCorpus.filter((p) => p.dhash).map((p) => `${p.dhash}__${p.size}`)
    );
    const recentSet = new Set(recentPickedNames);
    return photos.filter(
      (p) =>
        !p.quarantined &&
        !p.isVaultDocument &&
        (!p.trashCategory || recentSet.has(p.name)) &&
        !existingSharedNameSizes.has(`${p.name}__${p.size}`) &&
        !(p.dhash && existingDhashSizes.has(`${p.dhash}__${p.size}`)) &&
        !/^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(p.name)
    );
  }, [
    activeLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
    recentPickedNames,
  ]);

  // [Step 1 — 여권(나·가족·반려견) 일치 사진 자동 추출 & 추천 배지 매핑]
  const passportRecommendationByPhotoId = useMemo(() => {
    const map = new Map<string, string>();
    const flow = loadPassportFlowState();
    const myFileSet = new Set<string>();
    const familyFileSet = new Set<string>();
    const registeredNames: string[] = [];

    if (flow.userRealName?.trim()) {
      registeredNames.push(flow.userRealName.trim());
    }
    for (const alias of flow.userAliases || []) {
      if (alias?.trim()) registeredNames.push(alias.trim());
    }

    for (const fc of faceClusters) {
      if (fc.excludedAsPasserby) continue;
      const isMyCluster =
        (flow.myClusterId && fc.clusterId === flow.myClusterId) ||
        fc.clusterId === 'face_member_5';
      const isRegFamily =
        (flow.familyClusterIds || []).includes(fc.clusterId) ||
        Boolean(fc.registeredName?.trim());
      if (fc.registeredName?.trim()) {
        registeredNames.push(fc.registeredName.trim());
      }
      if (isMyCluster) {
        for (const fn of fc.matchedPhotoFiles || []) myFileSet.add(fn);
      } else if (isRegFamily) {
        for (const fn of fc.matchedPhotoFiles || []) familyFileSet.add(fn);
      }
    }

    const escapedNames = Array.from(new Set(registeredNames))
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);
    const nameRegex =
      escapedNames.length > 0 ? new RegExp(`(${escapedNames.join('|')})`, 'i') : null;
    const themeRegex =
      activeLoungeType === 'family'
        ? /(가족|아내|남편|아이|딸|아들|부모|어머니|아버지|반려견|강아지|고양이|여행|나들이|인물)/i
        : activeLoungeType === 'student'
        ? /(동창|졸업|학창|수학여행|소풍|추억|단체|친구|인물)/i
        : /(모임|동호회|산행|라운딩|번개|단체|여행|인물)/i;

    for (const p of uploadableLocalPhotos) {
      const hay = `${p.name} ${p.captionKo || ''} ${(p.tags || []).join(' ')} ${(p.keywordsKo || []).join(' ')}`;
      if (myFileSet.has(p.name)) {
        map.set(p.id, `${flow.userRealName?.trim() || '내'} 여권 매칭`);
      } else if (familyFileSet.has(p.name)) {
        map.set(p.id, '가족 여권 매칭');
      } else if (nameRegex && nameRegex.test(hay)) {
        map.set(p.id, '여권 이름 매칭');
      } else if (themeRegex.test(hay)) {
        map.set(
          p.id,
          activeLoungeType === 'family'
            ? '가족·반려견 추천'
            : activeLoungeType === 'student'
            ? '동창·추억 추천'
            : '모임·인물 추천'
        );
      }
    }
    return map;
  }, [uploadableLocalPhotos, faceClusters, activeLoungeType]);

  const recommendedLocalPhotos = useMemo(
    () => uploadableLocalPhotos.filter((p) => passportRecommendationByPhotoId.has(p.id)),
    [uploadableLocalPhotos, passportRecommendationByPhotoId]
  );

  const displayedModalPhotos = useMemo(
    () =>
      uploadModalFilterMode === 'passport_recommended' && recommendedLocalPhotos.length > 0
        ? recommendedLocalPhotos
        : uploadableLocalPhotos,
    [uploadModalFilterMode, recommendedLocalPhotos, uploadableLocalPhotos]
  );

  const handlePickedFilesForSharedModal = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const pickedNames = files.map((f) => f.name);
    const pickedNameSizes = new Set(files.map((f) => `${f.name}__${f.size}`));
    const pickedSizes = new Set(files.map((f) => f.size).filter((sz) => sz > 0));
    await importMobileLocalPhotos(files, { skipSearchResultsUpdate: true });
    const latestPhotos = useSaySeeStore.getState().photos;
    const pickedNameSet = new Set(pickedNames);
    let matched = latestPhotos.filter(
      (p) =>
        !p.quarantined &&
        (pickedNameSet.has(p.name) || pickedNameSizes.has(`${p.name}__${p.size}`))
    );
    if (matched.length === 0 && pickedSizes.size > 0) {
      matched = latestPhotos.filter((p) => !p.quarantined && pickedSizes.has(p.size));
    }
    const matchedNames = matched.map((p) => p.name);
    setRecentPickedNames((prev) => Array.from(new Set([...prev, ...pickedNames, ...matchedNames])));
    const matchedIds = matched.map((p) => p.id);
    if (matchedIds.length > 0) {
      setSelectedSharedUploadIds((prev) => Array.from(new Set([...prev, ...matchedIds])));
    }
  };

  useEffect(() => {
    aiRuntimeFlags.priorityModalGalleryOpen = showSharedPhotoUploadModal;
    if (showSharedPhotoUploadModal && !wasUploadModalOpenRef.current) {
      setSelectedSharedUploadIds([]);
      setRecentPickedNames([]);
      setUploadModalFilterMode('all');
      setScrollState((prev) => ({ ...prev, scrollTop: 0 }));
      if (scrollWrapRef.current) {
        scrollWrapRef.current.scrollTop = 0;
      }
    }
    wasUploadModalOpenRef.current = showSharedPhotoUploadModal;
    return () => {
      aiRuntimeFlags.priorityModalGalleryOpen = false;
    };
  }, [showSharedPhotoUploadModal]);

  useEffect(() => {
    if (!showSharedPhotoUploadModal) return;
    const el = scrollWrapRef.current;
    if (!el) return;
    const syncMeasure = () => {
      setScrollState((prev) => ({
        scrollTop: el.scrollTop,
        viewportH: el.clientHeight || prev.viewportH,
        containerW: el.clientWidth || prev.containerW,
      }));
    };
    syncMeasure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncMeasure);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [showSharedPhotoUploadModal, displayedModalPhotos.length]);

  const gridCols = useMemo(() => {
    if (typeof window === 'undefined') return 6;
    const vw = window.innerWidth;
    if (vw >= 768) return 6;
    if (vw >= 640) return 4;
    return 3;
  }, [scrollState.containerW]);

  const gapPx = 10;
  const cardSidePx = Math.max(
    84,
    Math.floor((Math.max(280, scrollState.containerW - 6) - (gridCols - 1) * gapPx) / gridCols)
  );
  const rowHeightPx = cardSidePx + gapPx;
  const totalRows = Math.ceil(displayedModalPhotos.length / gridCols);
  const startRow = Math.max(0, Math.floor(scrollState.scrollTop / rowHeightPx) - 4);
  const endRow = Math.min(
    totalRows,
    Math.ceil((scrollState.scrollTop + scrollState.viewportH) / rowHeightPx) + 6
  );
  const startIndex = startRow * gridCols;
  const endIndex = Math.min(displayedModalPhotos.length, endRow * gridCols);
  const topSpacerPx = startRow * rowHeightPx;
  const bottomSpacerPx = Math.max(0, (totalRows - endRow) * rowHeightPx);

  // [수백·수천 장 초고속 무지연 배치 프리페처]:
  // 브라우저 6-소켓 병목 없이 1회 HTTP 요청으로 48장씩 묶어 가져오고, 현재 스크롤 위치 앞쪽으로 144장을 선행 캐싱합니다.
  useEffect(() => {
    if (!showSharedPhotoUploadModal || !zCoreBridge.isConnected || displayedModalPhotos.length === 0) {
      return;
    }
    let cancelled = false;
    const windowStart = Math.max(0, startIndex - 24);
    const lookaheadEnd = Math.min(displayedModalPhotos.length, endIndex + 72);
    const prioritySlice = displayedModalPhotos.slice(windowStart, lookaheadEnd);

    const pumpBatches = async () => {
      for (let cursor = 0; cursor < prioritySlice.length; ) {
        if (cancelled || !showSharedPhotoUploadModal) return;
        const batch: typeof uploadableLocalPhotos = [];
        while (cursor < prioritySlice.length && batch.length < 48) {
          const item = prioritySlice[cursor++];
          if (
            item.thumbUrl?.startsWith('http://127.0.0.1') &&
            !PERSISTENT_BATCH_THUMB_CACHE.has(item.id) &&
            !INFLIGHT_BATCH_THUMB_IDS.has(item.id)
          ) {
            batch.push(item);
            INFLIGHT_BATCH_THUMB_IDS.add(item.id);
          }
        }
        if (batch.length === 0) continue;
        try {
          const res = await fetch(getZCoreUrl('/__photos/thumbs-batch'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: batch.map((b) => ({
                id: b.id,
                path: b.name,
                fullPath: b.fullPath || '',
              })),
            }),
          });
          if (!res.ok) {
            batch.forEach((b) => INFLIGHT_BATCH_THUMB_IDS.delete(b.id));
            return;
          }
          const json = await res.json();
          const thumbsObj = (json?.thumbs || {}) as Record<string, string>;
          let added = 0;
          for (const b of batch) {
            INFLIGHT_BATCH_THUMB_IDS.delete(b.id);
            if (thumbsObj[b.id]) {
              PERSISTENT_BATCH_THUMB_CACHE.set(b.id, thumbsObj[b.id]);
              registerLocalPhotoPreviewDataUrl(b.id, thumbsObj[b.id]);
              added += 1;
            }
          }
          if (added > 0 && !cancelled) {
            setThumbCacheTick((t) => t + 1);
          }
        } catch {
          batch.forEach((b) => INFLIGHT_BATCH_THUMB_IDS.delete(b.id));
          return;
        }
      }
    };

    void pumpBatches();
    return () => {
      cancelled = true;
    };
  }, [showSharedPhotoUploadModal, startIndex, endIndex, uploadableLocalPhotos]);

  // [사진 공유방 모바일 초대링크 3단계 황금 흐름 — Step 1 OS App Links/Universal Links & Step 2 1초 웹 구경 & Step 3 Deferred Deep Link 소비]:
  // 1) 네이티브 모바일 앱(안드로이드·아이폰): 앱 실행 시 대기 중인 딥링크(ghosti:// / App Links / Play InstallReferrer)를 즉시 읽어 해당 공유방으로 직행
  // 2) 웹/인앱 브라우저(PC·안드로이드 카톡 인앱·아이폰): 페이지 로드 중 무클릭 intent:// 강제 리다이렉트(카톡 인앱 ERR_UNKNOWN_URL_SCHEME 및 RPC fetch 취소 유발) 없이
  //    즉시 공유방 사진 RPC를 호출해 0.3초 만에 사진을 화면에 띄우며, 상단 [설치된 앱으로 열기] 클릭 시 안전하게 네이티브 앱으로 전환합니다.
  const nativeDeepLinkBootCheckedRef = React.useRef(!isCapacitorNativeMobileRuntime());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isCapacitorNativeMobileRuntime()) {
      const LAST_CONSUMED_DEEPLINK_KEY = 'ghosti_last_consumed_native_deeplink_v1';
      void consumeNativePendingDeepLink()
        .then(async (res) => {
          if (res.ok && res.deepLinkUrl) {
            // 기기 연결(pairCode) 딥링크는 연결 해제 후 동일 코드 재연결 시에도 항상 즉시 실행
            if (/pairCode=\d{6}/i.test(res.deepLinkUrl)) {
              window.dispatchEvent(
                new CustomEvent('ghostiNativePairDeepLink', {
                  detail: { url: res.deepLinkUrl },
                })
              );
              return;
            }
            if (parseWorkInviteInput(res.deepLinkUrl)) {
              window.dispatchEvent(
                new CustomEvent('ghostiNativeWorkDeepLink', {
                  detail: { url: res.deepLinkUrl },
                })
              );
              return;
            }
            // 3초 이내 동일 딥링크 중복 수신(예: launch + appUrlOpen 동시 발화)만 방지하고,
            // 사용자가 다시 초대 링크를 눌러 앱을 연 경우에는 정상적으로 초대방에 입장·멤버 등록되도록 허용합니다.
            let isStaleReplayedIntent = false;
            try {
              const prevRaw = localStorage.getItem(LAST_CONSUMED_DEEPLINK_KEY);
              if (prevRaw) {
                const prev = JSON.parse(prevRaw) as { url?: string; ts?: number } | null;
                if (
                  prev?.url === res.deepLinkUrl &&
                  typeof prev.ts === 'number' &&
                  Date.now() - prev.ts < 3000
                ) {
                  isStaleReplayedIntent = true;
                }
              }
            } catch {
              /* ignore */
            }
            if (!isStaleReplayedIntent) {
              try {
                localStorage.setItem(
                  LAST_CONSUMED_DEEPLINK_KEY,
                  JSON.stringify({ url: res.deepLinkUrl, ts: Date.now() })
                );
              } catch {
                /* ignore */
              }
              await applyShareInviteDeepLink(res.deepLinkUrl, { fromNativeApp: true });
            }
          } else if (isSharedPhotoLounge(useSaySeeStore.getState().activeLoungeType)) {
            void useSaySeeStore.getState().syncActiveSharedRoomFromSupabase();
          }
        })
        .finally(() => {
          nativeDeepLinkBootCheckedRef.current = true;
        });

      const onLiveDeepLink = (ev: Event) => {
        const detail = (ev as CustomEvent<{ url?: string }>).detail;
        if (detail?.url) {
          if (/pairCode=\d{6}/i.test(detail.url)) {
            window.dispatchEvent(
              new CustomEvent('ghostiNativePairDeepLink', {
                detail: { url: detail.url },
              })
            );
            return;
          }
          if (parseWorkInviteInput(detail.url)) {
            window.dispatchEvent(
              new CustomEvent('ghostiNativeWorkDeepLink', {
                detail: { url: detail.url },
              })
            );
            return;
          }
          try {
            localStorage.setItem(
              LAST_CONSUMED_DEEPLINK_KEY,
              JSON.stringify({ url: detail.url, ts: Date.now() })
            );
          } catch {
            /* ignore */
          }
          void applyShareInviteDeepLink(detail.url, { fromNativeApp: true });
        }
      };
      window.addEventListener('ghostiNativeDeepLink', onLiveDeepLink);
      return () => {
        window.removeEventListener('ghostiNativeDeepLink', onLiveDeepLink);
      };
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const urlHasInviteParam =
        params.has('invite') || params.has('inviteToken') || params.has('token');
      if (urlHasInviteParam) {
        const hasRealToken = Boolean(
          (params.get('inviteToken') || params.get('token') || readActiveInviteToken() || '').trim()
        );
        if (hasRealToken || !hasAuthenticatedHubAccountSession()) {
          void applyShareInviteDeepLink(window.location.href, { fromNativeApp: false });
        }
      } else if (params.get('preview') !== 'guest') {
        // ?invite / ?inviteToken이 전혀 없는 일반 경로(?lounge=family&room=처가, ?lounge=club 등)로 접속했을 때
        // 이전 세션의 본가 초대 토큰이 현재 페이지를 본가로 강제 리다이렉트하지 않도록 sessionStorage 잔재 즉시 정리
        sessionStorage.removeItem('ghosti_active_invite_room');
        sessionStorage.removeItem('ghosti_active_invite_token');
      }
    } catch {
      /* ignore */
    }
  }, [applyShareInviteDeepLink]);

  // 공유방 탭 전환 또는 로그인 완료(ghostiSupabaseUserSynced) 시 현재 계정·초대토큰 기준의 공유방 사진만 자동 동기화
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isSharedPhotoLounge(activeLoungeType) && nativeDeepLinkBootCheckedRef.current) {
      const params = new URLSearchParams(window.location.search);
      const hasUrlInvite =
        Boolean((params.get('inviteToken') || params.get('token') || '').trim()) ||
        (!hasAuthenticatedHubAccountSession() && params.has('invite'));
      // 초기 URL 초대 진입 시에는 위 applyShareInviteDeepLink가 단일 검증 RPC를 수행하므로 중복 호출·경합 방지
      if (!hasUrlInvite || !useSaySeeStore.getState().isLoadingSharedRoomPhotos) {
        void syncActiveSharedRoomFromSupabase();
      }
    }
    const onUserSynced = () => {
      useSaySeeStore.setState({ isGuestPreviewMode: false, guestJoinWallReason: null });
      void useSaySeeStore.getState().syncActiveSharedRoomFromSupabase();
    };
    window.addEventListener('ghostiSupabaseUserSynced', onUserSynced);
    return () => {
      window.removeEventListener('ghostiSupabaseUserSynced', onUserSynced);
    };
  }, [activeLoungeType, activeFamilyRoom, activeSharedRoomId, syncActiveSharedRoomFromSupabase]);

  const inviteMeta = readCurrentInviteDisplayMeta(
    isSharedPhotoLounge(activeLoungeType) ? activeLoungeType : 'family',
    activeFamilyRoom
  );

  const handleInstallAppAndAutoJoinRoom = async () => {
    const targetLounge = isSharedPhotoLounge(activeLoungeType) ? activeLoungeType : 'family';
    const deferredToken = buildDeferredInviteClipboardToken({
      loungeType: targetLounge,
      familyRoom: activeFamilyRoom,
      inviteToken: inviteMeta.inviteToken,
      hostName: inviteMeta.hostName,
      roomTitle: inviteMeta.roomTitle,
      nicknameHint: guestNicknameDraft,
    });
    try {
      await navigator.clipboard?.writeText(deferredToken);
    } catch {
      /* ignore clipboard error */
    }

    if (isIosMobileBrowserOrApp()) {
      const iosUrls = buildIosStoreInviteUrl();
      window.location.href = iosUrls.primaryUrl;
      if (iosUrls.fallbackWebUrl && iosUrls.fallbackWebUrl !== iosUrls.primaryUrl) {
        window.setTimeout(() => {
          if (document.visibilityState === 'visible') {
            window.location.href = iosUrls.fallbackWebUrl;
          }
        }, 700);
      }
      return;
    }

    const playUrl = buildAndroidPlayStoreInviteUrl({
      loungeType: targetLounge,
      familyRoom: activeFamilyRoom,
      inviteToken: inviteMeta.inviteToken,
      hostName: inviteMeta.hostName,
      roomTitle: inviteMeta.roomTitle,
      nicknameHint: guestNicknameDraft,
    });
    window.location.href = playUrl;
  };

  const handleOpenInstalledNativeAppDirect = () => {
    const targetLounge = isSharedPhotoLounge(activeLoungeType) ? activeLoungeType : 'family';
    if (isAndroidMobileBrowserOrApp()) {
      const safeIntentUrl = buildAndroidSafeAppProbeIntentUrl(window.location.href);
      if (safeIntentUrl) {
        window.location.href = safeIntentUrl;
        return;
      }
    }
    const schemeUrl = buildShareRoomNativeSchemeUrl({
      loungeType: targetLounge,
      familyRoom: activeFamilyRoom,
      inviteToken: inviteMeta.inviteToken,
      hostName: inviteMeta.hostName,
      roomTitle: inviteMeta.roomTitle,
      nicknameHint: guestNicknameDraft,
    });
    window.location.href = schemeUrl;
  };

  return (
    <>
      {/* 🔔 모바일 웹 구경 중 비간섭 하단 슬림 바 — Step 3: 3대 본능 스위치 (새 사진 알림 / 사진 올리기 / 원본 일괄 저장) */}
      {isGuestPreviewMode &&
        isMobileWebBrowser &&
        isSharedPhotoLounge(activeLoungeType) &&
        !guestJoinWallReason && (
          <div className="fixed bottom-3 inset-x-3 z-[95] pointer-events-none flex justify-center pb-safe">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-zinc-950/95 backdrop-blur-md border border-amber-400/50 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.45)] flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={() => triggerGuestJoinWall('새 사진 올라오면 카톡·푸시 알림 받기')}
                className="flex-1 py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-label-sm text-[11.5px] font-semibold cursor-pointer truncate"
              >
                새 사진 올라오면 알림 받기
              </button>
              <button
                type="button"
                onClick={() => triggerGuestJoinWall('내 폰 사진도 이 방에 올리기')}
                className="py-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-teal-300 font-label-sm text-[11px] font-extrabold cursor-pointer shrink-0"
              >
                사진 올리기
              </button>
              <button
                type="button"
                onClick={() => triggerGuestJoinWall('고화질 원본 내 폰에 일괄 저장')}
                className="py-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-emerald-300 font-label-sm text-[11px] font-extrabold cursor-pointer shrink-0"
              >
                원본 저장
              </button>
            </div>
          </div>
        )}

      {/* 📱 사진 공유방 3단계 황금 흐름 — Step 3: 모바일 웹 [양대 스토어 무료 앱 설치 & 이 방 자동 입장] / PC 웹 [1초 합류] 모달 */}
      {guestJoinWallReason && (
        <div
          onClick={() => useSaySeeStore.setState({ guestJoinWallReason: null })}
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-zinc-950 border border-slate-200/60 p-5 sm:p-6 shadow-lg flex flex-col gap-4 my-auto"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#FEE500] text-[#191919] font-label-sm text-[11.5px] font-semibold">
                {inviteMeta.isHostVerified && inviteMeta.hostName
                  ? `${inviteMeta.hostName}님의 초대장 적용됨`
                  : '공유 사진방 초대장 적용됨'}
              </span>
              <button
                type="button"
                onClick={() => useSaySeeStore.setState({ guestJoinWallReason: null })}
                className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isMobileWebBrowser ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <div className="text-[12px] font-extrabold text-amber-300 break-keep">
                    선택하신 기능: [{guestJoinWallReason}]
                  </div>
                  <h3 className="font-headline-sm text-[18px] text-white font-semibold leading-snug break-keep">
                    무료 『귀신같이』 모바일 앱으로 『{inviteMeta.roomTitle}』에 바로 입장하세요!
                  </h3>
                  <p className="text-[12px] text-emerald-300 font-bold leading-relaxed break-keep">
                    초대받은 멤버는 별도 구독 없이 참여할 수 있습니다. 무료 모바일 앱을 설치하면 보고 계시던 이 공유방으로 자동 입장되어 내 폰 사진 올리기·무압축 원본 일괄 저장·새 사진 알림을 바로 쓰실 수 있습니다.
                  </p>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[11.5px] text-zinc-300 font-bold">
                    이 방에서 표시할 내 이름 또는 별명 (선택)
                  </span>
                  <input
                    type="text"
                    value={guestNicknameDraft}
                    onChange={(e) => setGuestNicknameDraft(e.target.value)}
                    placeholder="예: 큰삼촌, 은지엄마, 박총무"
                    className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-[13px] font-bold outline-none focus:border-amber-400"
                  />
                </label>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleInstallAppAndAutoJoinRoom()}
                    className="w-full py-3 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-label-md text-[13px] font-semibold cursor-pointer shadow-md break-keep"
                  >
                    {isIosMobileBrowserOrApp()
                      ? `${buildIosStoreInviteUrl().storeLabelKo}에서 무료 설치하고 이 방 바로 입장`
                      : 'Google Play에서 무료 앱 설치하고 이 방 바로 입장'}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInstalledNativeAppDirect}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/50 text-teal-200 font-label-sm text-[12.5px] font-extrabold cursor-pointer break-keep"
                  >
                    이미 모바일 앱이 깔려 있어요 앱으로 이 방 즉시 열기
                  </button>
                  <button
                    type="button"
                    onClick={() => useSaySeeStore.setState({ guestJoinWallReason: null })}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 text-[12px] font-bold cursor-pointer"
                  >
                    계속 웹 화면에서 사진 구경하기
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <div className="text-[12px] font-extrabold text-amber-300 break-keep">
                    선택하신 기능: [{guestJoinWallReason}]
                  </div>
                  <h3 className="font-headline-sm text-[18px] text-white font-semibold leading-snug break-keep">
                    내 사진 업로드 및 고화질 원본 저장은 이메일 로그인 후 바로 이용하실 수 있습니다!
                  </h3>
                  <p className="text-[12px] text-emerald-300 font-bold break-keep">
                    초대받으신 분은 평생 100% 무료입니다. 비로그인 상태에서는 방 구경만 가능하며, 10초 이메일 인증 후 『{inviteMeta.roomTitle}』 정식 멤버로 합류됩니다.
                  </p>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[11.5px] text-zinc-300 font-bold">
                    이 방에서 쓰실 이름 또는 별명 (선택)
                  </span>
                  <input
                    type="text"
                    value={guestNicknameDraft}
                    onChange={(e) => setGuestNicknameDraft(e.target.value)}
                    placeholder="예: 큰삼촌, 박총무"
                    className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-[13px] font-bold outline-none focus:border-amber-400"
                  />
                </label>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => completeGuestOneSecJoin(guestNicknameDraft, guestEmailDraft)}
                    className="flex-1 py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-label-md text-[13px] font-semibold cursor-pointer shadow-md break-keep"
                  >
                    이메일 인증 후 공유방 합류하기
                  </button>
                  <button
                    type="button"
                    onClick={() => useSaySeeStore.setState({ guestJoinWallReason: null })}
                    className="px-3.5 py-2.5 sm:py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[12px] font-bold cursor-pointer shrink-0"
                  >
                    더 구경하기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 📸 공유 사진방(가족방/모임방) — 내 기기 사진 골라 올리기 모달 */}
      {showSharedPhotoUploadModal && (
        <div
          onClick={() => setShowSharedPhotoUploadModal(false)}
          className="fixed inset-0 z-[120] bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[88dvh] rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 md:p-6 shadow-2xl flex flex-col gap-3.5 overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 font-label-sm text-[11px] font-semibold">
                    내 기기 사진 골라 올리기
                  </span>
                </div>
                <h3 className="font-headline-sm text-[16px] sm:text-[18px] text-slate-900 font-bold break-keep">
                  『{activeSharedRoomTitle}』에 추가할 {isMobileEnv ? '내 스마트폰 사진' : '내 컴퓨터 사진'}을 선택해 주세요
                </h3>
                <p className="text-[12px] text-slate-500 break-keep">
                  중복·흔들린 사진과 신분증 서류는 자동으로 걸러낸 깔끔한 새 사진{' '}
                  <strong className="text-slate-800">{uploadableLocalPhotos.length}장</strong>이 준비되어 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSharedPhotoUploadModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-200">
              {/* [Step 1 — 여권·인물 자동 추출 추천 필터 탭] */}
              {uploadableLocalPhotos.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setUploadModalFilterMode('all')}
                      className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        uploadModalFilterMode === 'all' || recommendedLocalPhotos.length === 0
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      내 기기 전체 새 사진 ({uploadableLocalPhotos.length}장)
                    </button>
                    {recommendedLocalPhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setUploadModalFilterMode('passport_recommended')}
                        className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          uploadModalFilterMode === 'passport_recommended'
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'text-teal-700 hover:text-teal-900'
                        }`}
                      >
                        여권·인물 매칭 추천 ({recommendedLocalPhotos.length}장)
                      </button>
                    )}
                  </div>
                  {recommendedLocalPhotos.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedSharedUploadIds(recommendedLocalPhotos.map((p) => p.id))
                      }
                      className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 font-label-sm text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
                    >
                      여권 매칭 추천 {recommendedLocalPhotos.length}장 한 번에 선택
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-label-sm text-[11.5px] font-semibold cursor-pointer whitespace-nowrap">
                    {isMobileEnv ? '내 폰 갤러리에서 사진 고르기' : '파일 탐색기에서 직접 사진 고르기'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void handlePickedFilesForSharedModal(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedSharedUploadIds(displayedModalPhotos.map((p) => p.id))}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-label-sm text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    전체 선택 ({displayedModalPhotos.length}장)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSharedUploadIds([])}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 font-label-sm text-[11.5px] font-medium cursor-pointer whitespace-nowrap"
                  >
                    선택 해제
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSharedPhotoUploadModal(false);
                    useSaySeeStore.setState({
                      pendingReturnShareRoom: {
                        loungeType: activeLoungeType,
                        familyRoom: activeFamilyRoom,
                        roomTitle: activeSharedRoomTitle,
                      },
                    });
                    jumpToGhostSecretary();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-teal-50/70 hover:bg-teal-50 border border-teal-200/80 text-teal-700 font-label-sm text-[11.5px] font-semibold cursor-pointer break-keep text-left sm:text-center self-start sm:self-auto"
                >
                  올리기 전에 귀신비서에서 중복·흔들린 사진 먼저 점검하기
                </button>
              </div>
            </div>

            <div
              ref={scrollWrapRef}
              className="flex-1 overflow-y-auto pr-1"
              onScroll={(e) => {
                const el = e.currentTarget;
                setScrollState((prev) => ({
                  scrollTop: el.scrollTop,
                  viewportH: el.clientHeight || prev.viewportH,
                  containerW: el.clientWidth || prev.containerW,
                }));
              }}
            >
              {uploadableLocalPhotos.length === 0 ? (
                <div className="py-10 sm:py-12 px-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center gap-3">
                  <p className="text-[14px] text-slate-900 font-bold break-keep">
                    {isMobileEnv
                      ? '아래 버튼을 눌러 공유방에 추가할 내 스마트폰 사진을 선택해 주세요!'
                      : '새로 추가할 내 컴퓨터 사진이 아직 보이지 않아요.'}
                  </p>
                  <p className="text-[12px] text-slate-500 max-w-md break-keep">
                    {isMobileEnv
                      ? '내 폰 갤러리에서 원하는 사진들을 고르면 중복·흐린 사진은 자동으로 구분하여 깔끔하게 올릴 수 있어요.'
                      : '내 PC의 사진 폴더(`Pictures`)에 사진을 넣어두셨다면 로컬 엔진을 새로고침하거나 직접 사진을 골라 올릴 수 있어요.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                    {!isMobileEnv && (
                      <button
                        type="button"
                        onClick={() => void useSaySeeStore.getState().initApp(true)}
                        className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-label-sm text-[12px] font-semibold cursor-pointer"
                      >
                        내 컴퓨터 사진 폴더 다시 스캔하기
                      </button>
                    )}
                    <label className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-label-sm text-[12.5px] font-semibold cursor-pointer shadow-xs">
                      {isMobileEnv ? '내 폰 갤러리에서 사진 고르기' : '파일 탐색기에서 직접 사진 고르기'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void handlePickedFilesForSharedModal(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    paddingTop: topSpacerPx,
                    paddingBottom: bottomSpacerPx,
                  }}
                >
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {displayedModalPhotos.slice(startIndex, endIndex).map((p) => {
                      const checked = selectedSharedUploadSet.has(p.id);
                      const resolvedSrc = PERSISTENT_BATCH_THUMB_CACHE.get(p.id) || p.thumbUrl;
                      const passportBadge = passportRecommendationByPhotoId.get(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setSelectedSharedUploadIds((prev) =>
                              prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            )
                          }
                          className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-colors cursor-pointer group ${
                            checked
                              ? 'border-[#2DD4BF] ring-2 ring-[#2DD4BF]/40'
                              : 'border-white/10 hover:border-white/30 opacity-85 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={resolvedSrc}
                            alt={p.name}
                            crossOrigin={resolvedSrc?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                            loading="eager"
                            decoding="async"
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (p.fullUrl && img.src !== p.fullUrl) {
                                img.src = p.fullUrl;
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                          {passportBadge && (
                            <span className="absolute top-1.5 left-1.5 max-w-[72%] truncate px-1.5 py-0.5 rounded-md bg-zinc-950/85 border border-amber-400/50 text-amber-300 text-[9.5px] font-extrabold">
                              {passportBadge}
                            </span>
                          )}
                          <div
                            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold shadow ${
                              checked
                                ? 'bg-teal-600 text-white'
                                : 'bg-black/45 border border-white/60 text-white'
                            }`}
                          >
                            {checked ? '✓' : ''}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent text-left">
                            <span className="block text-[10px] text-white font-medium truncate">
                              {p.date.split(' ')[0]}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <span className="text-[12px] text-slate-600 font-semibold">
                선택됨: <strong className="text-teal-700">{selectedSharedUploadIds.length}장</strong> / 전체 새 사진 {uploadableLocalPhotos.length}장
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSharedPhotoUploadModal(false)}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-label-md text-[12.5px] font-semibold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={selectedSharedUploadIds.length === 0}
                  onClick={() => addLocalPhotosToSharedRoom(selectedSharedUploadIds)}
                  className="px-4 sm:px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-label-md text-[12.5px] sm:text-[13px] font-semibold shadow-xs cursor-pointer"
                >
                  {selectedSharedUploadIds.length > 0
                    ? `선택한 ${selectedSharedUploadIds.length}장 공유방에 올리기`
                    : '올릴 사진을 선택해 주세요'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
