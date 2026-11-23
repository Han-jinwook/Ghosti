import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Lock, RefreshCw, Send, Users } from 'lucide-react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { hasAuthenticatedHubAccountSession } from '@shared/services/supabaseClient';
import { zCoreBridge } from '@shared/services/zCoreBridge';
import {
  DEFAULT_TEAM_SNIPPETS_PLACEHOLDERS,
  loadCachedTeamSnippets,
  pullTeamSnippetsFromBridge,
  pushTeamSnippetsToBridge,
  resolveMyWorkTeamRooms,
  subscribeWorkTeamSnippetsRealtime,
  TEAM_SNIPPET_KEYS,
  type WorkTeamRoomOption,
} from '../services/teamSnippetsService';

export const GhostKeyTeamSnippetsPanel: React.FC = () => {
  const { merlinAuth, deviceEntitlement, setLastQuarantineToast } = useSaySeeStore();
  const [rooms, setRooms] = useState<WorkTeamRoomOption[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [role, setRole] = useState<'host' | 'editor' | 'viewer'>('viewer');
  const [snippets, setSnippets] = useState<Record<string, string>>(() =>
    loadCachedTeamSnippets(null)
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>('');
  const [statusReason, setStatusReason] = useState<string>('');
  const [isZCoreConnected, setIsZCoreConnected] = useState(zCoreBridge.isConnected);

  const isLoggedIn = Boolean(merlinAuth?.email && hasAuthenticatedHubAccountSession());
  const workUnlocked = Boolean(deviceEntitlement?.workSubscriptionUnlocked);

  useEffect(() => {
    setIsZCoreConnected(zCoreBridge.isConnected);
    return zCoreBridge.subscribe((conn) => setIsZCoreConnected(conn));
  }, []);

  const loadRoomsAndSnippets = useCallback(
    async (explicitRoomId?: string) => {
      if (!isLoggedIn) {
        setRooms([]);
        setSelectedRoomId('');
        setStatusReason('AUTH_REQUIRED');
        return;
      }
      setLoading(true);
      try {
        const foundRooms = await resolveMyWorkTeamRooms({
          workSubscriptionUnlocked: workUnlocked,
        });
        setRooms(foundRooms);
        const targetRoomId = explicitRoomId || foundRooms[0]?.roomId || '';

        const pulled = await pullTeamSnippetsFromBridge(targetRoomId || undefined);
        if (pulled.ok && pulled.roomId) {
          setSelectedRoomId(pulled.roomId);
          setSnippets(pulled.snippets);
          if (pulled.role) setRole(pulled.role);
          setStatusReason('');
          if (foundRooms.length === 0) {
            setRooms([
              {
                roomId: pulled.roomId,
                roomTitle: pulled.roomTitle || '업무 공유방 (S:)',
                role: pulled.role || 'editor',
                masterEmail: '',
              },
            ]);
          }
          if (pulled.updatedAt) {
            const byWho = pulled.updatedByNickname || pulled.updatedByEmail || '관리자';
            setLastUpdatedLabel(
              `${new Date(pulled.updatedAt).toLocaleString('ko-KR')} · ${byWho} 배포`
            );
          } else {
            setLastUpdatedLabel('');
          }
        } else {
          setSelectedRoomId(targetRoomId);
          if (targetRoomId) {
            const matched = foundRooms.find((r) => r.roomId === targetRoomId);
            if (matched) setRole(matched.role);
          }
          setStatusReason(pulled.reason || 'WORK_ROOM_NOT_FOUND');
        }
      } finally {
        setLoading(false);
      }
    },
    [isLoggedIn, workUnlocked]
  );

  useEffect(() => {
    void loadRoomsAndSnippets();
  }, [loadRoomsAndSnippets]);

  useEffect(() => {
    if (!isLoggedIn || !selectedRoomId || statusReason) return;
    return subscribeWorkTeamSnippetsRealtime(selectedRoomId, (updated) => {
      setSnippets(updated.snippets);
      if (updated.role) setRole(updated.role);
      if (updated.updatedAt) {
        const byWho = updated.updatedByNickname || updated.updatedByEmail || '관리자';
        setLastUpdatedLabel(`${new Date(updated.updatedAt).toLocaleString('ko-KR')} · ${byWho} 배포`);
      }
      setLastQuarantineToast('⚡ 팀 공유 상용구(F7~F12)가 실시간 동기화되었습니다!');
    });
  }, [isLoggedIn, selectedRoomId, statusReason, setLastQuarantineToast]);

  const canEdit = Boolean(selectedRoomId && !statusReason && (role === 'host' || role === 'editor'));
  const isActiveMember = Boolean(selectedRoomId && !statusReason);

  const handleDeployTeamSnippets = async () => {
    if (!selectedRoomId || !canEdit) return;
    setSaving(true);
    try {
      const pushed = await pushTeamSnippetsToBridge(selectedRoomId, snippets);
      if (pushed.ok) {
        setSnippets(pushed.snippets);
        if (pushed.updatedAt) {
          const byWho = pushed.updatedByNickname || merlinAuth?.email || '관리자';
          setLastUpdatedLabel(
            `${new Date(pushed.updatedAt).toLocaleString('ko-KR')} · ${byWho} 배포`
          );
        }
        setLastQuarantineToast(
          isZCoreConnected
            ? '✅ F7~F12 팀 상용구가 전 직원 실시간 배포 및 내 PC 귀신Key에 즉시 반영되었습니다!'
            : '✅ F7~F12 팀 상용구가 전 직원에게 실시간 배포되었습니다!'
        );
      } else {
        setLastQuarantineToast(
          pushed.message || `⚠️ 팀 상용구 배포에 실패했습니다. (${pushed.reason || '오류'})`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base sm:text-lg font-black flex items-center gap-2 text-slate-900">
              <Users className="w-5 h-5 text-amber-600" />
              <span>F7~F12 팀 공유 상용구 설정 · 실시간 배포</span>
            </h2>
            {isActiveMember && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px] font-extrabold">
                실시간 동기화 연결됨 ({role === 'host' ? '대표/방장' : role === 'editor' ? '편집 멤버' : '읽기 전용'})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            F1~F6 내 개인 상용구는 그대로 보존되며, F7~F12 6칸만 같은 업무 공유방 팀원 전원에게 1초 동기화됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {rooms.length > 1 && (
            <select
              value={selectedRoomId}
              onChange={(e) => void loadRoomsAndSnippets(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
            >
              {rooms.map((r) => (
                <option key={r.roomId} value={r.roomId}>
                  {r.roomTitle} ({r.role === 'host' ? '방장' : r.role === 'editor' ? '편집' : '열람'})
                </option>
              ))}
            </select>
          )}

          {isLoggedIn && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadRoomsAndSnippets(selectedRoomId || undefined)}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleDeployTeamSnippets()}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {saving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>전 직원 일괄 배포 · 저장</span>
            </button>
          )}
        </div>
      </div>

      {!isLoggedIn && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-[13px] text-slate-700 font-semibold">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>로그인하면 소속된 업무 공유방의 F7~F12 팀 상용구가 내 PC에 자동 연결됩니다.</span>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
            className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
          >
            로그인하기
          </button>
        </div>
      )}

      {isLoggedIn && !isActiveMember && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs sm:text-[13px] text-slate-700 leading-relaxed">
          현재 계정에 활성화된 <strong>업무 공유방(S:)</strong>이 없습니다. 위에서 <strong>업무 공유(소호 월 9,900원~)</strong>를 구독하시거나, 회사 대표님께 받은 업무 공유방 초대 링크를 수락하시면 F7~F12 팀 상용구 6칸이 즉시 개통됩니다.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TEAM_SNIPPET_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-12 py-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-800 text-xs font-black text-center shrink-0">
              {key}
            </span>
            <input
              type="text"
              value={snippets[key] || ''}
              disabled={!canEdit}
              placeholder={DEFAULT_TEAM_SNIPPETS_PLACEHOLDERS[key]}
              onChange={(e) =>
                setSnippets((prev) => ({
                  ...prev,
                  [key]: e.target.value,
                }))
              }
              maxLength={2000}
              className={`flex-1 px-3 py-2 rounded-xl border text-xs sm:text-[13px] outline-none transition ${
                canEdit
                  ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500'
                  : 'bg-slate-100/80 border-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            />
          </div>
        ))}
      </div>

      {isActiveMember && (
        <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {lastUpdatedLabel ? `최근 배포: ${lastUpdatedLabel}` : '아직 배포된 팀 상용구가 없습니다.'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              {isZCoreConnected
                ? '내 PC Z-Core(Ctrl+0 → F7~F12) 즉시 반영 중'
                : 'Z-Core 연결 시 내 PC 단축키에 자동 반영'}
            </span>
          </span>
        </div>
      )}
    </section>
  );
};
