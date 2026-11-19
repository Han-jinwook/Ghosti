-- ============================================================================
-- ⚡ 귀신같이 (Ghosti) — Zero-Cloud 초경량 Supabase DB 스키마 (v2.0 · 2026-10-26)
-- ============================================================================
-- [핵심 아키텍처 & 평생권 수익성 방어 원칙 — 2026-11-19 『방식 A』 최종 확정 반영]
-- 1. 무압축 고화질 원본 사진·동영상(5~20MB) 및 업무 문서 원본 파일은 중앙 DB/스토리지에 절대 저장하지 않음!
--    (원본 파일은 마스터 PC 로컬 디스크 및 멤버 단말에서 WebRTC / Z코어 아웃바운드 터널 P2P 직결로만 동기화 ➔ 원본 클라우드 비용 0원)
--    단, 『📸 사진 공유방(가족·동호회·동창회)』은 방장이 밤에 PC를 끄거나 폰 화면이 잠겨 있어도 초대받은 가족·회원이 카톡 초대 링크 클릭 즉시
--    24시간 언제든 0.3~0.8초 만에 전체 사진과 검색·댓글을 열람할 수 있도록 『방식 A — 24시간 무중단 열람형』을 적용함:
--    ➔ 유저가 공유방에 직접 올린 사진에 한해 『13KB 초경량 WebP 썸네일 + 검색 키워드/인물 문패 인덱스 + 댓글·하트 + 친근한 촬영일·대표 지역명』을
--      본 Supabase 정식 테이블(ghosti_room_shared_photos 등, 향후 대용량 확장 시 보유 Cloudflare R2 무료 10GB 연동)에 room_id·invite_token 단위로 엄격 격리 보관함!
--      (1만 장 = 약 130MB 수준으로 무료 1GB 내 약 7.5만 장 수용, R2 10GB 시 75만 장 트래픽 비용 0원)
-- 2. WebRTC 시그널링(SDP/ICE)은 테이블 INSERT 없이 Supabase Realtime Broadcast(메모리 패스스루)만 사용.
--    (채널 토픽 규칙: `ghosti:room:<room_id>` / `ghosti:pair:<owner_email>` — 하단 9번 Realtime 인가 정책 참조)
-- 3. 계정·로그인·코인 지갑은 Ghosti가 따로 만들지 않고 멀린허브OS(os.sundreamer.app) SSO 단일 원장을 따름.
--    ➔ 본 스키마는 Ghosti 단독 Supabase 프로젝트에 설치하며, 허브 SDK 표준(CoreLogic/가이드.md)에 따라
--      로컬 `users` 테이블의 id = 허브 `family_users.id`(UUID)를 그대로 연동 키로 사용함.
--    ➔ [인증 브릿지] 허브 JWT(merlin_session_token)는 우리 프로젝트가 직접 검증할 수 없으므로,
--      Ghosti 서버 함수(Netlify Function)가 ① 허브 `GET /api/auth/me`로 토큰을 검증하고
--      ② service_role로 `users`를 Upsert한 뒤 ③ 우리 프로젝트 JWT 시크릿으로 단기(1시간) 토큰을 발급함
--      (클레임: sub = 허브 userId, email, role = 'authenticated').
--    ➔ 본 스키마의 모든 RLS는 이 단기 토큰의 이메일 클레임(`auth.jwt() ->> 'email'`) 하나로 판별하며,
--      코인 잔액·결제 테이블은 본 스키마에 절대 두지 않음 (허브 family_wallet_balances 단일 원장, 중복 원장 금지).
-- 4. 본 스키마에는 오직 아래 초경량 메타데이터만 저장하여 평생권 회원 1만 명 유입 시에도 유지비 0원 달성:
--    ⓪ users                     : 허브 계정 연동 로컬 유저 (id = 허브 family_users.id, 앱 전용 설정만)
--    ① ghosti_face_passports       : 이메일 귀속 만국공통 귀신같이 여권 안면 시드 (1인당 5슬롯 × 768d ≈ 15KB)
--    ② ghosti_devices              : 내 기기 등록부 (PC 마스터 1 + 모바일 1 무료) & PC 아웃바운드 터널 주소
--    ③ ghosti_pairing_codes        : PC ↔ 폰 1회용 연결 코드(QR/6자리, 10분 만료)
--    ④ ghosti_lounge_rooms         : 3대 메뉴(내 기기 / 사진 공유 / 업무 공유) 라운지 방 메타데이터
--    ⑤ ghosti_lounge_members       : 방별 멤버 권한 & 방별 독립 호칭(room_persona_nickname)
--    ⑥ ghosti_room_invites         : 방 초대 링크 토큰 (만료·사용 횟수 제한 · 무가입 1초 프리뷰 검증 키)
--    ⑦ ghosti_room_shared_folders  : 업무방(S:) 등에 공유된 PC 폴더 별칭 포인터 기록 (문서·원본 파일 자체는 P2P 직결)
--    ⑦-B ghosti_room_shared_photos : [방식 A 확정] 사진 공유방 24시간 무중단 열람용 13KB 초경량 썸네일·검색 인덱스·촬영일시 (원본 미저장, 정밀 GPS는 게스트 비노출)
--    ⑦-C ghosti_room_photo_comments / reactions : 사진 공유방 댓글 본문 및 하트 반응 (무가입 프리뷰에서 '읽기' 공개, '쓰기'는 정식 합류 멤버만)
--    ⑧ ghosti_setup_playbooks      : 설정 몬스터 표준 정답 경로 캐시(토큰 0원화) & Multi-LLM 최단 지름길 OTA
--    ⑨ ghosti_setup_audit_logs     : 설정 몬스터 정산 결과 기록 · 초행길 2회 헤맴 100% 쿨 환불 · 실패 블랙박스 로그
--       (실제 코인 차감/환불 집행은 멀린허브OS 지갑 API가 수행하고, 여기에는 결과 사본만 남김)
-- 5. [v2.0 변경] 구버전 'student(스쿨)' 라운지 유형 폐기 ➔ 1차 출시 3대 메뉴 체계로 정렬
--    - personal(내 기기) / family·club(사진 공유: 우리집·본가·처가 / 동호회 / 동창회) / work(업무 공유 S:)
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ----------------------------------------------------------------------------
-- 0. 공통 헬퍼: 허브 SSO JWT 이메일 & updated_at 자동 갱신
-- ----------------------------------------------------------------------------
-- ============================================================================
-- 0-A. [레거시 Z-Eye -> Ghosti 완벽 전환] 기존 zeye_* 테이블 및 함수를 ghosti_*로 자동 전환
-- ============================================================================
do $$
begin
  if to_regclass('public.zeye_face_passports') is not null and to_regclass('public.ghosti_face_passports') is null then
    alter table public.zeye_face_passports rename to ghosti_face_passports;
  end if;
  if to_regclass('public.zeye_devices') is not null and to_regclass('public.ghosti_devices') is null then
    alter table public.zeye_devices rename to ghosti_devices;
  end if;
  if to_regclass('public.zeye_pairing_codes') is not null and to_regclass('public.ghosti_pairing_codes') is null then
    alter table public.zeye_pairing_codes rename to ghosti_pairing_codes;
  end if;
  if to_regclass('public.zeye_lounge_rooms') is not null and to_regclass('public.ghosti_lounge_rooms') is null then
    alter table public.zeye_lounge_rooms rename to ghosti_lounge_rooms;
  end if;
  if to_regclass('public.zeye_lounge_members') is not null and to_regclass('public.ghosti_lounge_members') is null then
    alter table public.zeye_lounge_members rename to ghosti_lounge_members;
  end if;
  if to_regclass('public.zeye_room_invites') is not null and to_regclass('public.ghosti_room_invites') is null then
    alter table public.zeye_room_invites rename to ghosti_room_invites;
  end if;
  if to_regclass('public.zeye_room_shared_folders') is not null and to_regclass('public.ghosti_room_shared_folders') is null then
    alter table public.zeye_room_shared_folders rename to ghosti_room_shared_folders;
  end if;
  if to_regclass('public.zeye_setup_playbooks') is not null and to_regclass('public.ghosti_setup_playbooks') is null then
    alter table public.zeye_setup_playbooks rename to ghosti_setup_playbooks;
  end if;
  if to_regclass('public.zeye_setup_audit_logs') is not null and to_regclass('public.ghosti_setup_audit_logs') is null then
    alter table public.zeye_setup_audit_logs rename to ghosti_setup_audit_logs;
  end if;
end $$;

drop function if exists public.zeye_accept_room_invite(text, text) cascade;
drop function if exists public.zeye_consume_pairing_code(text, text, text) cascade;
drop function if exists public.zeye_create_room(text, text, text, text, text, uuid) cascade;
drop function if exists public.zeye_is_room_admin(text) cascade;
drop function if exists public.zeye_is_room_member(text) cascade;
drop function if exists public.zeye_current_email() cascade;
drop function if exists public.zeye_touch_updated_at() cascade;

create or replace function public.ghosti_current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.ghosti_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 0-1. 허브 계정 연동 로컬 유저 (허브 SDK CoreLogic 표준: 테이블 users / 연동 컬럼 id)
--      - 쓰기: Ghosti 서버 함수(service_role)가 허브 토큰 검증 후 Upsert
--      - 읽기: 본인 행만 (RLS 12-0)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key,                    -- 허브 family_users.id 그대로 저장
  email text not null unique,
  nickname text,
  native_push_token text,
  push_channel_id text not null default 'ghosti',
  signup_source text,
  launch_notify_opt_in boolean,
  device_platform text check (
    device_platform is null or device_platform in ('windows', 'macos', 'android', 'ios', 'web')
  ),
  app_settings jsonb not null default '{}'::jsonb,
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- [제18조 정규화 마이그레이션] 기존 운영 DB에서 app_settings JSONB에 기생하던 푸시·가입출처·사전알림 컬럼을 정식 컬럼으로 무중단 승격
alter table public.users add column if not exists native_push_token text;
alter table public.users add column if not exists push_channel_id text not null default 'ghosti';
alter table public.users add column if not exists signup_source text;
alter table public.users add column if not exists launch_notify_opt_in boolean;
alter table public.users add column if not exists device_platform text;

update public.users
   set native_push_token    = coalesce(native_push_token, nullif(app_settings ->> 'native_push_token', '')),
       push_channel_id      = coalesce(nullif(push_channel_id, ''), nullif(app_settings ->> 'push_channel_id', ''), 'ghosti'),
       signup_source        = coalesce(signup_source, nullif(app_settings ->> 'signup_source', '')),
       launch_notify_opt_in = coalesce(
         launch_notify_opt_in,
         case
           when (app_settings ->> 'launch_notify_opt_in') in ('true', 'false')
           then (app_settings ->> 'launch_notify_opt_in')::boolean
           else null
         end
       ),
       device_platform      = coalesce(device_platform, nullif(app_settings ->> 'device_platform', '')),
       app_settings         = app_settings - 'native_push_token' - 'push_channel_id' - 'signup_source' - 'launch_notify_opt_in' - 'device_platform' - 'last_synced_at'
 where app_settings ?| array['native_push_token', 'push_channel_id', 'signup_source', 'launch_notify_opt_in', 'device_platform', 'last_synced_at'];

drop trigger if exists trg_users_touch on public.users;
create trigger trg_users_touch
  before update on public.users
  for each row execute function public.ghosti_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 1. 만국공통 귀신같이 여권 (Face Passport) — 1인당 약 15KB 고정
-- ----------------------------------------------------------------------------
create table if not exists public.ghosti_face_passports (
  passport_id uuid primary key default gen_random_uuid(),
  email text not null unique,
  owner_user_id text not null,
  anchor_creation_year integer not null default 2026,
  is_minor boolean not null default false,
  -- 대표 통합 768차원 안면 시드 벡터
  representative_seed_768d vector(768),
  -- 5대 스타일 슬롯(정면·선명, 측면·미소, 야외·노을, 선글라스·역광, 야간·실내) 압축 메타 및 슬롯별 시드
  five_style_slots_json jsonb not null default '[]'::jsonb,
  -- 방별 독립 별명 기본 매핑 (예: {"우리집": "👑 멀린", "처가(친정)": "👑 둘째사위", "본가(친가)": "👑 큰아들(진욱)"})
  default_room_personas jsonb not null default '{}'::jsonb,
  seed_version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_ghosti_face_passports_email
  on public.ghosti_face_passports (email);

-- ----------------------------------------------------------------------------
-- 2. 내 기기 등록부 — PC 마스터(원본 보관·AI 인덱싱) + 모바일(13KB 섀도우 캐시 뷰어)
--    - 무료 기준: PC 1대 + 모바일 1대 (초과 대수 제한은 앱/허브 요금제에서 판정)
--    - bridge_url: 폰이 외부 LTE/5G에서 PC에 닿기 위한 마스터 PC 아웃바운드 HTTPS 터널 주소
-- ----------------------------------------------------------------------------
create table if not exists public.ghosti_devices (
  device_id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  device_kind text not null check (device_kind in ('pc_master', 'mobile')),
  display_name text not null,
  platform text check (platform in ('windows', 'macos', 'android', 'ios', 'web')),
  bridge_url text,
  app_version text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ghosti_devices_owner
  on public.ghosti_devices (owner_email, device_kind);

drop trigger if exists trg_ghosti_devices_touch on public.ghosti_devices;
create trigger trg_ghosti_devices_touch
  before update on public.ghosti_devices
  for each row execute function public.ghosti_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 3. PC ↔ 폰 1회용 연결 코드 (PC 화면 QR / 6자리 숫자, 10분 만료, 1회 사용)
-- ----------------------------------------------------------------------------
create table if not exists public.ghosti_pairing_codes (
  code text primary key check (code ~ '^[0-9]{6}$'),
  owner_email text not null,
  pc_device_id uuid not null references public.ghosti_devices(device_id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  consumed_by_device_id uuid references public.ghosti_devices(device_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ghosti_pairing_codes_owner
  on public.ghosti_pairing_codes (owner_email, expires_at desc);

-- ----------------------------------------------------------------------------
-- 4. 라운지 방 메타데이터 — 1차 출시 3대 메뉴 체계
--    lounge_type : personal(내 기기) / family·club(사진 공유) / work(업무 공유 S:)
--    sub_type    : family ➔ 우리집 / 본가(친가) / 처가(친정)
--                  club   ➔ 동호회 / 동창회 (동창회는 '우리반 타임캡슐' 메뉴를 UI에서 제공)
-- ----------------------------------------------------------------------------
create table if not exists public.ghosti_lounge_rooms (
  room_id text primary key,
  lounge_type text not null check (lounge_type in ('personal', 'family', 'club', 'work')),
  sub_type text,
  room_title text not null,
  master_user_id text not null,
  master_email text not null,
  pricing_plan text not null default 'free_trial',
  -- 원본을 보관하는 마스터 PC (P2P 1순위 WebRTC 실패 시 이 기기의 bridge_url로 2순위 자동 폴백)
  master_pc_device_id uuid references public.ghosti_devices(device_id) on delete set null,
  -- [호환 유지] v1 필드: 마스터 PC 아웃바운드 터널 주소 직접 기록 (master_pc_device_id 미사용 시)
  master_outbound_tunnel_url text,
  master_pc_online boolean not null default true,
  gpu_cloud_helper_until timestamptz,
  custom_watermark_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ghosti_lounge_rooms_sub_type_chk check (
    (lounge_type = 'family' and sub_type in ('우리집', '본가(친가)', '처가(친정)'))
    or (lounge_type = 'club' and sub_type in ('동호회', '동창회'))
    or (lounge_type in ('personal', 'work') and sub_type is null)
  )
);

create index if not exists idx_ghosti_lounge_rooms_master
  on public.ghosti_lounge_rooms (master_email);

drop trigger if exists trg_ghosti_lounge_rooms_touch on public.ghosti_lounge_rooms;
create trigger trg_ghosti_lounge_rooms_touch
  before update on public.ghosti_lounge_rooms
  for each row execute function public.ghosti_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. 라운지 멤버 권한 & 방별 독립 별명(Persona) 매핑
-- ----------------------------------------------------------------------------
create table if not exists public.ghosti_lounge_members (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.ghosti_lounge_rooms(room_id) on delete cascade,
  member_email text not null,
  passport_id uuid references public.ghosti_face_passports(passport_id) on delete set null,
  role text not null default 'member' check (role in ('master', 'admin', 'member')),
  -- 해당 방에서 불릴 독립 호칭 (예: 처가방에서는 '👑 둘째사위', 동창회방에서는 '지우짱')
  room_persona_nickname text not null,
  joined_at timestamptz not null default now(),
  unique (room_id, member_email)
);

create index if not exists idx_ghosti_lounge_members_room
  on public.ghosti_lounge_members (room_id);
create index if not exists idx_ghosti_lounge_members_email
  on public.ghosti_lounge_members (member_email);

-- ----------------------------------------------------------------------------
-- 6. 방 초대 링크 토큰 (카톡/문자로 전달, 만료·최대 사용 횟수 제한)
-- ----------------------------------------------------------------------------
create table if not exists public.ghosti_room_invites (
  -- URL에 그대로 붙일 수 있도록 hex 36자 (base64의 +,/ 문자로 링크가 깨지는 문제 방지)
  token text primary key default encode(gen_random_bytes(18), 'hex'),
  room_id text not null references public.ghosti_lounge_rooms(room_id) on delete cascade,
  created_by_email text not null,
  default_role text not null default 'member' check (default_role in ('admin', 'member')),
  max_uses integer not null default 10 check (max_uses between 1 and 500),
  used_count integer not null default 0,
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ghosti_room_invites_room
  on public.ghosti_room_invites (room_id);

-- ----------------------------------------------------------------------------
-- 7. 방에 공유된 PC 폴더 별칭 포인터 (업무방 S: 등 폴더 단위 연결 메타데이터 · 무압축 원본 파일은 P2P 직결)
--    - 사진 공유방의 개별 공유 사진 13KB 썸네일·인덱스 14일(2주) 초대 골든타임 마중물 버퍼는 하단 ghosti_room_shared_photos 테이블이 담당
-- ----------------------------------------------------------------------------
create table if not exists public.ghosti_room_shared_folders (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.ghosti_lounge_rooms(room_id) on delete cascade,
  pc_device_id uuid not null references public.ghosti_devices(device_id) on delete cascade,
  -- PC 실제 경로는 노출하지 않고 별칭만 저장 (예: '2026 가족여행')
  folder_alias text not null,
  item_count integer not null default 0,
  photo_count integer not null default 0,
  video_count integer not null default 0,
  shared_by_email text not null,
  last_indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, pc_device_id, folder_alias)
);

drop trigger if exists trg_ghosti_room_shared_folders_touch on public.ghosti_room_shared_folders;
create trigger trg_ghosti_room_shared_folders_touch
  before update on public.ghosti_room_shared_folders
  for each row execute function public.ghosti_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 8. 설정 몬스터 Playbook DB (표준 경로 0원 캐시 & Multi-LLM 최단 직행 지름길 OTA)
-- ----------------------------------------------------------------------------
create table if not exists public.ghosti_setup_playbooks (
  scenario_id text primary key,
  platform text not null check (platform in ('mobile', 'pc')),
  difficulty_level smallint not null default 1 check (difficulty_level in (1, 2, 3)),
  coin_cost integer not null default 100 check (coin_cost in (100, 300, 500)),
  symptom_keywords text[] not null default '{}',
  target_window_signature text not null,
  -- 사전 답사(Pre-Scout) 정답 구역 핀셋 컨테이너 및 최단 직행 스텝 배열
  pinset_container_selector text,
  pruned_shortest_steps_json jsonb not null default '[]'::jsonb,
  ota_version integer not null default 1,
  updated_by_self_healing boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9. 설정 몬스터 정산 결과 · 초행길 2회 헤맴 100% 쿨 환불 · 실패 블랙박스 감사 로그
-- ----------------------------------------------------------------------------
create table if not exists public.ghosti_setup_audit_logs (
  audit_id text primary key,
  user_email text not null,
  platform text not null check (platform in ('mobile', 'pc')),
  scenario_id text not null,
  escrow_status text not null check (
    escrow_status in ('SETTLED', 'EMPATHY_REFUNDED_100', 'FAILURE_REFUNDED_100', 'ROLLED_BACK')
  ),
  held_coins integer not null default 100,
  refunded_coins integer not null default 0,
  backtrack_count integer not null default 0,
  before_snapshot_json jsonb not null default '{}'::jsonb,
  after_snapshot_json jsonb not null default '{}'::jsonb,
  failure_error_code text,
  raw_trajectory_steps_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ghosti_setup_audit_user
  on public.ghosti_setup_audit_logs (user_email, created_at desc);

-- ============================================================================
-- 10. 권한 판별 헬퍼 (SECURITY DEFINER — RLS 재귀 방지)
-- ============================================================================
create or replace function public.ghosti_is_room_member(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ghosti_lounge_members m
    where m.room_id = p_room_id
      and lower(m.member_email) = public.ghosti_current_email()
  );
$$;

create or replace function public.ghosti_is_room_admin(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ghosti_lounge_members m
    where m.room_id = p_room_id
      and lower(m.member_email) = public.ghosti_current_email()
      and m.role in ('master', 'admin')
  ) or exists (
    select 1 from public.ghosti_lounge_rooms r
    where r.room_id = p_room_id
      and lower(r.master_email) = public.ghosti_current_email()
  );
$$;

-- ============================================================================
-- 11. 원자적 RPC (클라이언트가 직접 테이블을 조작하지 않고 검증된 함수로만 처리)
-- ============================================================================

-- 11-1. 방 생성: 방 + 마스터 멤버 행을 한 번에 생성
create or replace function public.ghosti_create_room(
  p_room_id text,
  p_lounge_type text,
  p_sub_type text,
  p_room_title text,
  p_master_nickname text,
  p_master_pc_device_id uuid default null
)
returns public.ghosti_lounge_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.ghosti_current_email();
  v_room public.ghosti_lounge_rooms;
begin
  if v_email = '' then
    raise exception 'GHOSTI_AUTH_REQUIRED';
  end if;
  if p_master_pc_device_id is not null and not exists (
    select 1 from public.ghosti_devices d
    where d.device_id = p_master_pc_device_id
      and lower(d.owner_email) = v_email
      and d.device_kind = 'pc_master'
      and d.revoked_at is null
  ) then
    raise exception 'GHOSTI_PC_NOT_OWNED';
  end if;

  insert into public.ghosti_lounge_rooms (
    room_id, lounge_type, sub_type, room_title, master_user_id, master_email, master_pc_device_id
  ) values (
    p_room_id, p_lounge_type, p_sub_type, p_room_title,
    coalesce(auth.uid()::text, v_email), v_email, p_master_pc_device_id
  )
  returning * into v_room;

  insert into public.ghosti_lounge_members (room_id, member_email, role, room_persona_nickname)
  values (p_room_id, v_email, 'master', coalesce(nullif(p_master_nickname, ''), '방장'));

  return v_room;
end;
$$;

-- 11-2. PC ↔ 폰 연결: 6자리 코드 1회 소비 + 모바일 기기 등록
create or replace function public.ghosti_consume_pairing_code(
  p_code text,
  p_mobile_display_name text,
  p_mobile_platform text default 'web'
)
returns table (pc_device_id uuid, pc_display_name text, bridge_url text, mobile_device_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_email text := public.ghosti_current_email();
  v_pc_id uuid;
  v_mobile_id uuid;
begin
  if v_email = '' then
    raise exception 'GHOSTI_AUTH_REQUIRED';
  end if;

  update public.ghosti_pairing_codes c
     set consumed_at = now()
   where c.code = p_code
     and lower(c.owner_email) = v_email
     and c.consumed_at is null
     and c.expires_at > now()
  returning c.pc_device_id into v_pc_id;

  if v_pc_id is null then
    raise exception 'GHOSTI_PAIRING_CODE_INVALID_OR_EXPIRED';
  end if;

  insert into public.ghosti_devices (owner_email, device_kind, display_name, platform)
  values (v_email, 'mobile', coalesce(nullif(p_mobile_display_name, ''), '내 휴대폰'), p_mobile_platform)
  returning device_id into v_mobile_id;

  update public.ghosti_pairing_codes set consumed_by_device_id = v_mobile_id where code = p_code;

  return query
    select d.device_id, d.display_name, d.bridge_url, v_mobile_id
      from public.ghosti_devices d
     where d.device_id = v_pc_id;
end;
$$;

-- 11-3. 초대 링크 수락: 토큰 검증 + 사용 횟수 증가 + 멤버 등록 (이미 멤버면 그대로 반환)
create or replace function public.ghosti_accept_room_invite(
  p_token text,
  p_nickname text
)
returns public.ghosti_lounge_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.ghosti_current_email();
  v_invite public.ghosti_room_invites;
  v_member public.ghosti_lounge_members;
begin
  if v_email = '' then
    raise exception 'GHOSTI_AUTH_REQUIRED';
  end if;

  select * into v_invite
    from public.ghosti_room_invites i
   where i.token = p_token
   for update;

  if v_invite.token is null
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or v_invite.used_count >= v_invite.max_uses then
    raise exception 'GHOSTI_INVITE_INVALID_OR_EXPIRED';
  end if;

  select * into v_member
    from public.ghosti_lounge_members m
   where m.room_id = v_invite.room_id and lower(m.member_email) = v_email;

  if v_member.id is not null then
    return v_member;
  end if;

  insert into public.ghosti_lounge_members (room_id, member_email, role, room_persona_nickname)
  values (v_invite.room_id, v_email, v_invite.default_role, coalesce(nullif(p_nickname, ''), '새 멤버'))
  returning * into v_member;

  update public.ghosti_room_invites set used_count = used_count + 1 where token = p_token;

  return v_member;
end;
$$;

-- ============================================================================
-- 12. RLS (Row Level Security) — 허브 SSO 이메일 기준 최소 권한
-- ============================================================================
alter table public.users                    enable row level security;
alter table public.ghosti_face_passports      enable row level security;
alter table public.ghosti_devices             enable row level security;
alter table public.ghosti_pairing_codes       enable row level security;
alter table public.ghosti_lounge_rooms        enable row level security;
alter table public.ghosti_lounge_members      enable row level security;
alter table public.ghosti_room_invites        enable row level security;
alter table public.ghosti_room_shared_folders enable row level security;
alter table public.ghosti_setup_playbooks     enable row level security;
alter table public.ghosti_setup_audit_logs    enable row level security;

-- 12-0. 로컬 유저: 본인 행만 읽기 / 앱 설정만 본인 수정 (생성·이메일 변경은 서버 함수 전용)
drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users
  for select using (lower(email) = public.ghosti_current_email());

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update using (lower(email) = public.ghosti_current_email())
  with check (lower(email) = public.ghosti_current_email());

-- 12-1. 여권: 본인 것만 읽기/쓰기 (같은 방 멤버의 시드 조회는 추후 RPC로 별도 제공)
drop policy if exists ghosti_passports_own on public.ghosti_face_passports;
create policy ghosti_passports_own on public.ghosti_face_passports
  for all using (lower(email) = public.ghosti_current_email())
  with check (lower(email) = public.ghosti_current_email());

-- 12-2. 기기: 본인 기기만 / 같은 방 멤버는 그 방 마스터 PC의 bridge_url 읽기 허용
drop policy if exists ghosti_devices_own on public.ghosti_devices;
create policy ghosti_devices_own on public.ghosti_devices
  for all using (lower(owner_email) = public.ghosti_current_email())
  with check (lower(owner_email) = public.ghosti_current_email());

drop policy if exists ghosti_devices_room_master_pc_read on public.ghosti_devices;
create policy ghosti_devices_room_master_pc_read on public.ghosti_devices
  for select using (
    exists (
      select 1 from public.ghosti_lounge_rooms r
      where r.master_pc_device_id = ghosti_devices.device_id
        and public.ghosti_is_room_member(r.room_id)
    )
  );

-- 12-3. 연결 코드: 본인 PC가 발급·조회만 (소비는 RPC 11-2로만)
drop policy if exists ghosti_pairing_codes_own_select on public.ghosti_pairing_codes;
create policy ghosti_pairing_codes_own_select on public.ghosti_pairing_codes
  for select using (lower(owner_email) = public.ghosti_current_email());

drop policy if exists ghosti_pairing_codes_own_insert on public.ghosti_pairing_codes;
create policy ghosti_pairing_codes_own_insert on public.ghosti_pairing_codes
  for insert with check (
    lower(owner_email) = public.ghosti_current_email()
    and exists (
      select 1 from public.ghosti_devices d
      where d.device_id = pc_device_id
        and lower(d.owner_email) = public.ghosti_current_email()
        and d.device_kind = 'pc_master'
    )
  );

-- 12-4. 방: 멤버만 읽기 / 방장·관리자만 수정 / 생성은 RPC 11-1로만
drop policy if exists ghosti_rooms_member_read on public.ghosti_lounge_rooms;
create policy ghosti_rooms_member_read on public.ghosti_lounge_rooms
  for select using (public.ghosti_is_room_member(room_id) or lower(master_email) = public.ghosti_current_email());

drop policy if exists ghosti_rooms_admin_update on public.ghosti_lounge_rooms;
create policy ghosti_rooms_admin_update on public.ghosti_lounge_rooms
  for update using (public.ghosti_is_room_admin(room_id))
  with check (public.ghosti_is_room_admin(room_id));

drop policy if exists ghosti_rooms_master_delete on public.ghosti_lounge_rooms;
create policy ghosti_rooms_master_delete on public.ghosti_lounge_rooms
  for delete using (lower(master_email) = public.ghosti_current_email());

-- 12-5. 멤버: 같은 방 멤버끼리 명단 읽기 / 본인 호칭 수정 / 방장·관리자는 내보내기 / 본인은 나가기
drop policy if exists ghosti_members_room_read on public.ghosti_lounge_members;
create policy ghosti_members_room_read on public.ghosti_lounge_members
  for select using (public.ghosti_is_room_member(room_id));

drop policy if exists ghosti_members_self_update on public.ghosti_lounge_members;
create policy ghosti_members_self_update on public.ghosti_lounge_members
  for update using (lower(member_email) = public.ghosti_current_email() or public.ghosti_is_room_admin(room_id))
  with check (lower(member_email) = public.ghosti_current_email() or public.ghosti_is_room_admin(room_id));

drop policy if exists ghosti_members_leave_or_kick on public.ghosti_lounge_members;
create policy ghosti_members_leave_or_kick on public.ghosti_lounge_members
  for delete using (
    (lower(member_email) = public.ghosti_current_email() and role <> 'master')
    or (public.ghosti_is_room_admin(room_id) and role <> 'master')
  );

-- 12-6. 초대: 방장·관리자만 발급·조회·회수 (수락은 RPC 11-3으로만)
drop policy if exists ghosti_invites_admin_all on public.ghosti_room_invites;
create policy ghosti_invites_admin_all on public.ghosti_room_invites
  for all using (public.ghosti_is_room_admin(room_id))
  with check (public.ghosti_is_room_admin(room_id) and lower(created_by_email) = public.ghosti_current_email());

-- 12-7. 공유 폴더 포인터: 멤버 읽기 / PC 소유자이자 방 멤버만 등록·수정·삭제
drop policy if exists ghosti_shared_folders_member_read on public.ghosti_room_shared_folders;
create policy ghosti_shared_folders_member_read on public.ghosti_room_shared_folders
  for select using (public.ghosti_is_room_member(room_id));

drop policy if exists ghosti_shared_folders_owner_write on public.ghosti_room_shared_folders;
create policy ghosti_shared_folders_owner_write on public.ghosti_room_shared_folders
  for all using (
    public.ghosti_is_room_member(room_id)
    and exists (
      select 1 from public.ghosti_devices d
      where d.device_id = pc_device_id and lower(d.owner_email) = public.ghosti_current_email()
    )
  )
  with check (
    public.ghosti_is_room_member(room_id)
    and lower(shared_by_email) = public.ghosti_current_email()
    and exists (
      select 1 from public.ghosti_devices d
      where d.device_id = pc_device_id and lower(d.owner_email) = public.ghosti_current_email()
    )
  );

-- 12-8. 설정 몬스터 Playbook: 로그인 사용자 읽기 전용 (쓰기는 service_role 서버 전용)
drop policy if exists ghosti_playbooks_read on public.ghosti_setup_playbooks;
create policy ghosti_playbooks_read on public.ghosti_setup_playbooks
  for select using (public.ghosti_current_email() <> '');

-- 12-9. 감사 로그: 본인 기록만 읽기 (쓰기는 service_role 서버 전용)
drop policy if exists ghosti_audit_own_read on public.ghosti_setup_audit_logs;
create policy ghosti_audit_own_read on public.ghosti_setup_audit_logs
  for select using (lower(user_email) = public.ghosti_current_email());

-- RPC 실행 권한: 로그인 사용자만
revoke all on function public.ghosti_create_room(text, text, text, text, text, uuid) from public, anon;
revoke all on function public.ghosti_consume_pairing_code(text, text, text) from public, anon;
revoke all on function public.ghosti_accept_room_invite(text, text) from public, anon;
grant execute on function public.ghosti_create_room(text, text, text, text, text, uuid) to authenticated;
grant execute on function public.ghosti_consume_pairing_code(text, text, text) to authenticated;
grant execute on function public.ghosti_accept_room_invite(text, text) to authenticated;

-- ============================================================================
-- 13. Realtime Broadcast 인가 (Private Channel) — 시그널링 DB Write 0 Byte
--     - 토픽 `ghosti:room:<room_id>` : 해당 방 멤버만 송수신 (WebRTC SDP/ICE 패스스루)
--     - 토픽 `ghosti:pair:<email>`   : 본인 기기끼리만 송수신 (PC ↔ 폰 연결 핸드셰이크)
--     ※ realtime.messages 는 Broadcast 인가 판정에만 쓰이며 메시지 본문은 DB에 저장되지 않음
-- ============================================================================
drop policy if exists ghosti_realtime_receive on realtime.messages;
create policy ghosti_realtime_receive on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      (realtime.topic() like 'ghosti:room:%'
        and public.ghosti_is_room_member(substring(realtime.topic() from 11)))
      or realtime.topic() = 'ghosti:pair:' || public.ghosti_current_email()
    )
  );

drop policy if exists ghosti_realtime_send on realtime.messages;
create policy ghosti_realtime_send on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and (
      (realtime.topic() like 'ghosti:room:%'
        and public.ghosti_is_room_member(substring(realtime.topic() from 11)))
      or realtime.topic() = 'ghosti:pair:' || public.ghosti_current_email()
    )
  );

-- ============================================================================
-- 🪪 귀신계 여권 (Ghost Passport) 계정 간 무료 동기화 테이블 — v1.3 (공문 20261108_1600 #7)
-- ----------------------------------------------------------------------------
-- 원칙
--  - 사진 원본은 절대 올리지 않는다. [실제 이름 + 128차원 얼굴 특징 벡터(약 2KB) + 여권 도장 미니 썸네일(10KB 이하)]만 저장.
--  - 관계도 꼬리표('와이프','아들' 등) 컬럼은 의도적으로 두지 않는다 (실명 원칙).
--  - '나(본인)' 행만 is_self = true 이며 nickname 을 가질 수 있다.
--  - 같은 계정(email)이면 PC ↔ 모바일 어디서 만들어도 서로 내려받는다 (기기 통합 유료 구독과 무관하게 무료).
-- 적용: Supabase SQL Editor 에서 1회 실행 (pgvector 확장은 기존 ghosti_zero_cloud_schema.sql 에서 이미 사용 중)
-- ============================================================================

create table if not exists public.ghost_passports (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  real_name text not null check (char_length(real_name) between 1 and 20),
  is_self boolean not null default false,
  nickname text check (nickname is null or char_length(nickname) <= 12),
  face_vector_128d vector(128),
  stamp_thumb_data_url text check (stamp_thumb_data_url is null or char_length(stamp_thumb_data_url) <= 14000),
  source_device text not null default 'pc' check (source_device in ('pc', 'mobile')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ghost_passports_nickname_self_only check (is_self or nickname is null),
  constraint ghost_passports_owner_name_uniq unique (owner_email, real_name)
);

-- 계정당 '나(본인)'는 1명
create unique index if not exists ghost_passports_one_self_per_owner
  on public.ghost_passports (lower(owner_email)) where is_self;

drop trigger if exists trg_ghost_passports_touch on public.ghost_passports;
create trigger trg_ghost_passports_touch
  before update on public.ghost_passports
  for each row execute function public.ghosti_touch_updated_at();

alter table public.ghost_passports enable row level security;

drop policy if exists ghost_passports_own on public.ghost_passports;
create policy ghost_passports_own on public.ghost_passports
  for all using (lower(owner_email) = public.ghosti_current_email())
  with check (lower(owner_email) = public.ghosti_current_email());

-- ============================================================================
-- 👻 귀신비서 미등록 질문 포집 (unmatched_questions) — 주 1회 비서 정기 감사로 대본집 편입
-- ============================================================================
create table if not exists public.unmatched_questions (
  id bigserial primary key,
  owner_email text,
  question text not null check (char_length(question) <= 300),
  reason text not null default 'no_playbook_match' check (reason in ('no_playbook_match', 'feature_request')),
  created_at timestamptz not null default now()
);

create index if not exists idx_unmatched_questions_owner_created
  on public.unmatched_questions (owner_email, created_at desc);

alter table public.unmatched_questions enable row level security;

drop policy if exists unmatched_questions_insert_own on public.unmatched_questions;
create policy unmatched_questions_insert_own on public.unmatched_questions
  for insert with check (owner_email is null or lower(owner_email) = public.ghosti_current_email());

-- ============================================================================
-- 📸 사진 공유방 『방식 A — 14일(2주) 초대 골든타임 마중물 버퍼(TTL) + 합류 멤버 기기 로컬 영구 금고 + 재초대 1초 재장전』 정식 스키마
--    (2026-11-20 멀린님 최종 확정 · 강령 제18조 정규 컬럼 준수 · 영구 클라우드 비대화 0원 방어)
-- ----------------------------------------------------------------------------
-- 확정 원칙:
-- 1. [초대 골든타임 14일(2주) 마중물 버퍼]: 방장이 PC를 끄거나 폰 화면이 잠겨 있어도 카톡 초대 링크(?invite=...&token=...) 클릭 즉시
--    0.3~0.8초 내에 해당 방(room_id)의 공유 사진 13KB WebP 썸네일·검색 인덱스·댓글/하트(읽기)·친근한 촬영일/지역명이 100% 열람됨.
--    단, 본 서버 테이블(ghosti_room_shared_photos)은 초대 마중물로서 14일(2주) 동안만 유지되며 14일 경과분은 서버 브릿지·RPC에서 자동 소거됨.
-- 2. [합류 멤버 로컬 영구 금고 & 재초대 1초 자동 재장전(Re-Seed)]: 정식 합류한 멤버는 본인 기기 IndexedDB('${email}::${roomId}')에
--    영구 캐싱하여 서버 14일 소거 이후에도 0.05초 만에 전체 사진을 열람·검색하며, 몇 달 뒤 다시 [💌 초대 링크 복사]를 누르면
--    로컬 금고의 13KB WebP 썸네일이 본 테이블로 1초 만에 자동 재장전(신규 14일 TTL 부여)됨. (비로그인 게스트는 로컬 흔적 0 Byte)
-- 3. 고화질 원본(5~20MB)은 본 테이블에 저장하지 않고 기기 간 P2P 직결([🔄 원본 동기화])로만 전송함.
-- 4. 계정별·방별 100% 격리 및 프라이버시 보호: 무가입 프리뷰(ghosti_get_guest_preview_room RPC)에서는 정밀 GPS 좌표(gps_lat, gps_lng)와 업로더 이메일을 원천 제외함.
-- ============================================================================

create table if not exists public.ghosti_room_shared_photos (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.ghosti_lounge_rooms(room_id) on delete cascade,
  uploader_user_id uuid references public.users(id) on delete set null,
  uploader_email text not null,
  uploader_nickname text not null,
  dhash_64 text,
  -- 13KB 초경량 WebP 썸네일 Data URL (14일 초대 마중물 버퍼 전용 · 5MB 고화질 원본 저장 금지)
  thumb_webp_url text not null,
  caption_ko text not null default '',
  keywords_ko text[] not null default '{}',
  face_person_names text[] not null default '{}',
  -- 무가입 프리뷰 공개용 친근한 촬영일·대표 지역명 (예: '2024년 8월', '강릉 경포대')
  shot_date_display text,
  shot_place_display text,
  -- 정식 합류 멤버 전용 정밀 좌표 (무가입 프리뷰 RPC에서는 절대 반환하지 않음)
  gps_lat double precision,
  gps_lng double precision,
  width_px integer not null default 0,
  height_px integer not null default 0,
  original_byte_size bigint not null default 0,
  has_original_exif boolean not null default false,
  is_hidden_by_master boolean not null default false,
  seed_expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ghosti_room_shared_photos
  add column if not exists seed_expires_at timestamptz not null default (now() + interval '14 days');

create index if not exists idx_ghosti_room_shared_photos_room_created
  on public.ghosti_room_shared_photos (room_id, created_at desc)
  where is_hidden_by_master = false;

create index if not exists idx_ghosti_room_shared_photos_created_ttl
  on public.ghosti_room_shared_photos (created_at asc);

create index if not exists idx_ghosti_room_shared_photos_room_dhash
  on public.ghosti_room_shared_photos (room_id, dhash_64)
  where dhash_64 is not null;

drop trigger if exists trg_ghosti_room_shared_photos_touch on public.ghosti_room_shared_photos;
create trigger trg_ghosti_room_shared_photos_touch
  before update on public.ghosti_room_shared_photos
  for each row execute function public.ghosti_touch_updated_at();

alter table public.ghosti_room_shared_photos enable row level security;

drop policy if exists ghosti_room_shared_photos_member_select on public.ghosti_room_shared_photos;
create policy ghosti_room_shared_photos_member_select on public.ghosti_room_shared_photos
  for select using (
    is_hidden_by_master = false
    and public.ghosti_is_room_member(room_id)
  );

drop policy if exists ghosti_room_shared_photos_member_insert on public.ghosti_room_shared_photos;
create policy ghosti_room_shared_photos_member_insert on public.ghosti_room_shared_photos
  for insert with check (
    public.ghosti_is_room_member(room_id)
    and lower(uploader_email) = public.ghosti_current_email()
  );

drop policy if exists ghosti_room_shared_photos_owner_or_admin_update on public.ghosti_room_shared_photos;
create policy ghosti_room_shared_photos_owner_or_admin_update on public.ghosti_room_shared_photos
  for update using (
    public.ghosti_is_room_admin(room_id)
    or (
      lower(uploader_email) = public.ghosti_current_email()
      and created_at >= (now() - interval '24 hours')
    )
  );

drop policy if exists ghosti_room_shared_photos_owner_24h_delete on public.ghosti_room_shared_photos;
create policy ghosti_room_shared_photos_owner_24h_delete on public.ghosti_room_shared_photos
  for delete using (
    (
      lower(uploader_email) = public.ghosti_current_email()
      and created_at >= (now() - interval '24 hours')
    )
    or (
      public.ghosti_is_room_member(room_id)
      and created_at < (now() - interval '14 days')
    )
  );

create table if not exists public.ghosti_room_photo_comments (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.ghosti_lounge_rooms(room_id) on delete cascade,
  photo_id uuid not null references public.ghosti_room_shared_photos(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  author_email text not null,
  author_nickname text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_ghosti_room_photo_comments_room_photo
  on public.ghosti_room_photo_comments (room_id, photo_id, created_at asc);

alter table public.ghosti_room_photo_comments enable row level security;

drop policy if exists ghosti_room_photo_comments_member_select on public.ghosti_room_photo_comments;
create policy ghosti_room_photo_comments_member_select on public.ghosti_room_photo_comments
  for select using (public.ghosti_is_room_member(room_id));

drop policy if exists ghosti_room_photo_comments_member_insert on public.ghosti_room_photo_comments;
create policy ghosti_room_photo_comments_member_insert on public.ghosti_room_photo_comments
  for insert with check (
    public.ghosti_is_room_member(room_id)
    and lower(author_email) = public.ghosti_current_email()
  );

drop policy if exists ghosti_room_photo_comments_author_or_admin_delete on public.ghosti_room_photo_comments;
create policy ghosti_room_photo_comments_author_or_admin_delete on public.ghosti_room_photo_comments
  for delete using (
    lower(author_email) = public.ghosti_current_email()
    or public.ghosti_is_room_admin(room_id)
  );

create table if not exists public.ghosti_room_photo_reactions (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.ghosti_lounge_rooms(room_id) on delete cascade,
  photo_id uuid not null references public.ghosti_room_shared_photos(id) on delete cascade,
  reactor_email text not null,
  reactor_nickname text not null,
  reaction_type text not null default 'heart' check (reaction_type in ('heart')),
  created_at timestamptz not null default now(),
  unique (photo_id, reactor_email, reaction_type)
);

create index if not exists idx_ghosti_room_photo_reactions_room_photo
  on public.ghosti_room_photo_reactions (room_id, photo_id);

alter table public.ghosti_room_photo_reactions enable row level security;

drop policy if exists ghosti_room_photo_reactions_member_select on public.ghosti_room_photo_reactions;
create policy ghosti_room_photo_reactions_member_select on public.ghosti_room_photo_reactions
  for select using (public.ghosti_is_room_member(room_id));

drop policy if exists ghosti_room_photo_reactions_member_insert on public.ghosti_room_photo_reactions;
create policy ghosti_room_photo_reactions_member_insert on public.ghosti_room_photo_reactions
  for insert with check (
    public.ghosti_is_room_member(room_id)
    and lower(reactor_email) = public.ghosti_current_email()
  );

drop policy if exists ghosti_room_photo_reactions_own_delete on public.ghosti_room_photo_reactions;
create policy ghosti_room_photo_reactions_own_delete on public.ghosti_room_photo_reactions
  for delete using (lower(reactor_email) = public.ghosti_current_email());

-- [필수] 2026-10-30 이후 Supabase 신규 테이블 Data API 접근 권한 부여
grant select, insert, update, delete on table public.ghosti_lounge_rooms to authenticated, service_role;
grant select, insert, update, delete on table public.ghosti_lounge_members to authenticated, service_role;
grant select, insert, update, delete on table public.ghosti_room_invites to authenticated, service_role;
grant select, insert, update, delete on table public.ghosti_room_shared_photos to authenticated, service_role;
grant select, insert, update, delete on table public.ghosti_room_photo_comments to authenticated, service_role;
grant select, insert, update, delete on table public.ghosti_room_photo_reactions to authenticated, service_role;

-- [14일(2주) 경과 마중물 썸네일 자동 청소 RPC]
create or replace function public.ghosti_purge_expired_photo_seed_buffer(
  p_room_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purged integer := 0;
begin
  if p_room_ids is null or coalesce(array_length(p_room_ids, 1), 0) = 0 then
    delete from public.ghosti_room_shared_photos
     where created_at < (now() - interval '14 days');
  else
    delete from public.ghosti_room_shared_photos
     where room_id = any(p_room_ids)
       and created_at < (now() - interval '14 days');
  end if;
  get diagnostics v_purged = row_count;
  return jsonb_build_object(
    'ok', true,
    'ttlDays', 14,
    'purgedCount', v_purged
  );
end;
$$;

grant execute on function public.ghosti_purge_expired_photo_seed_buffer(text[]) to anon, authenticated, service_role;

-- [AI 에이전트 DB 추적 실증 전용 무-PII 집계 RPC (이메일·썸네일·방제목 일절 미반환)]
create or replace function public.ghosti_get_photo_seed_ttl_telemetry()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_active integer := 0;
  v_expired integer := 0;
  v_rooms integer := 0;
  v_oldest timestamptz;
  v_newest timestamptz;
begin
  select
    count(*)::int,
    count(*) filter (where created_at >= (now() - interval '14 days'))::int,
    count(*) filter (where created_at < (now() - interval '14 days'))::int,
    count(distinct room_id)::int,
    min(created_at),
    max(created_at)
    into v_total, v_active, v_expired, v_rooms, v_oldest, v_newest
    from public.ghosti_room_shared_photos;

  return jsonb_build_object(
    'ok', true,
    'ttlDays', 14,
    'checkedAtUtc', now(),
    'cutoffUtc', (now() - interval '14 days'),
    'distinctRoomCount', v_rooms,
    'totalRows', v_total,
    'activeWithin14dRows', v_active,
    'expiredOver14dRows', v_expired,
    'oldestCreatedAt', v_oldest,
    'newestCreatedAt', v_newest
  );
end;
$$;

grant execute on function public.ghosti_get_photo_seed_ttl_telemetry() to anon, authenticated, service_role;

-- [방장 전용: 계정별 고유 공유방 + 14일 초대 토큰 원자적 생성·조회 RPC]
create or replace function public.ghosti_ensure_room_and_invite(
  p_lounge_type text,
  p_sub_type text,
  p_room_title text,
  p_master_nickname text default '방장'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.ghosti_current_email();
  v_room_id text;
  v_token text;
begin
  if v_email = '' then
    raise exception 'GHOSTI_AUTH_REQUIRED';
  end if;

  select r.room_id into v_room_id
    from public.ghosti_lounge_rooms r
   where lower(r.master_email) = v_email
     and r.lounge_type = p_lounge_type
     and coalesce(r.sub_type, '') = coalesce(p_sub_type, '')
   order by r.created_at asc
   limit 1;

  if v_room_id is null then
    v_room_id := 'room_' || substr(md5(v_email || ':' || p_lounge_type || ':' || coalesce(p_sub_type, '')), 1, 16);
    insert into public.ghosti_lounge_rooms (
      room_id, lounge_type, sub_type, room_title, master_user_id, master_email
    ) values (
      v_room_id, p_lounge_type, p_sub_type, coalesce(nullif(p_room_title, ''), '사진 공유방'),
      coalesce(auth.uid()::text, v_email), v_email
    )
    on conflict (room_id) do nothing;

    insert into public.ghosti_lounge_members (room_id, member_email, role, room_persona_nickname)
    values (v_room_id, v_email, 'master', coalesce(nullif(p_master_nickname, ''), '방장'))
    on conflict (room_id, member_email) do nothing;
  end if;

  select i.token into v_token
    from public.ghosti_room_invites i
   where i.room_id = v_room_id
     and i.revoked_at is null
     and i.expires_at > now()
     and i.used_count < i.max_uses
   order by i.created_at desc
   limit 1;

  if v_token is null then
    v_token := md5(gen_random_uuid()::text || ':' || clock_timestamp()::text || ':' || v_room_id)
               || substr(md5(random()::text), 1, 4);
    insert into public.ghosti_room_invites (
      token, room_id, created_by_email, default_role, max_uses, expires_at
    ) values (
      v_token, v_room_id, v_email, 'member', 500, now() + interval '14 days'
    );
  else
    -- 재초대 시 초대장 유효기간도 오늘부터 14일(2주)로 자동 갱신
    update public.ghosti_room_invites
       set expires_at = greatest(expires_at, now() + interval '14 days')
     where token = v_token;
  end if;

  return jsonb_build_object(
    'ok', true,
    'roomId', v_room_id,
    'inviteToken', v_token
  );
end;
$$;

revoke all on function public.ghosti_ensure_room_and_invite(text, text, text, text) from public, anon;
grant execute on function public.ghosti_ensure_room_and_invite(text, text, text, text) to authenticated, service_role;

-- [무가입 1초 프리뷰 전용 SECURITY DEFINER 읽기 RPC — 14일(2주) 이내 마중물만 노출 및 만료분 자동 소거]
-- 유효한 초대 토큰(p_invite_token) 보유자(anon 포함)에게만 해당 방(room_id)의 14일 이내 13KB 썸네일·검색 인덱스·인물 문패·댓글/하트(읽기)·친근한 촬영일시를 반환.
-- 정밀 GPS 좌표(gps_lat, gps_lng), 업로더 이메일, 타 방 사진은 원천 차단됨.
create or replace function public.ghosti_get_guest_preview_room(p_invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id text;
  v_host_nick text;
  v_room record;
  v_photos jsonb;
begin
  select i.room_id into v_room_id
    from public.ghosti_room_invites i
   where i.token = trim(coalesce(p_invite_token, ''))
     and i.revoked_at is null
     and i.expires_at > now()
   limit 1;

  if v_room_id is null then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_OR_EXPIRED_INVITE');
  end if;

  -- 14일(2주) 경과 마중물 행 자동 청소
  delete from public.ghosti_room_shared_photos
   where room_id = v_room_id
     and created_at < (now() - interval '14 days');

  select r.room_id, r.lounge_type, r.sub_type, r.room_title
    into v_room
    from public.ghosti_lounge_rooms r
   where r.room_id = v_room_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ROOM_NOT_FOUND');
  end if;

  select m.room_persona_nickname into v_host_nick
    from public.ghosti_lounge_members m
   where m.room_id = v_room_id and m.role = 'master'
   limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'roomId', p.room_id,
        'uploaderNickname', p.uploader_nickname,
        'thumbWebpUrl', p.thumb_webp_url,
        'captionKo', p.caption_ko,
        'keywordsKo', p.keywords_ko,
        'facePersonNames', p.face_person_names,
        'shotDateDisplay', p.shot_date_display,
        'shotPlaceDisplay', p.shot_place_display,
        'widthPx', p.width_px,
        'heightPx', p.height_px,
        'createdAt', p.created_at,
        'heartCount', (
          select count(*)::int
            from public.ghosti_room_photo_reactions rx
           where rx.photo_id = p.id
        ),
        'comments', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'authorNickname', c.author_nickname,
              'body', c.body,
              'createdAt', c.created_at
            ) order by c.created_at asc
          )
            from public.ghosti_room_photo_comments c
           where c.photo_id = p.id
        ), '[]'::jsonb)
      ) order by p.created_at desc
    ),
    '[]'::jsonb
  )
    into v_photos
    from public.ghosti_room_shared_photos p
   where p.room_id = v_room_id
     and p.is_hidden_by_master = false
     and p.created_at >= (now() - interval '14 days');

  return jsonb_build_object(
    'ok', true,
    'room', jsonb_build_object(
      'roomId', v_room.room_id,
      'loungeType', v_room.lounge_type,
      'subType', v_room.sub_type,
      'roomTitle', v_room.room_title,
      'hostNickname', coalesce(v_host_nick, '방장')
    ),
    'photos', v_photos
  );
end;
$$;

grant execute on function public.ghosti_get_guest_preview_room(text) to anon, authenticated, service_role;

-- ============================================================================
-- 💼 [업무 공유 S: 드라이브 & 📱 내 기기 통합 — 정식 SQL 테이블 + 비공개 금고 브릿지 정합화]
-- ----------------------------------------------------------------------------
-- 1) 레거시 zeye_* RLS 잔재가 남아 있는 운영 환경에서도 에러(42P01)가 나지 않도록 구 정책 안전 제거:
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and (qual::text ilike '%zeye_%' or with_check::text ilike '%zeye_%')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- 2) 업무 공유(S: 드라이브) 실시간·비동기 하이브리드 아키텍처:
--    - 방 개설·팀원 편입(work_accept_invite)·초대 토큰 검증: ghosti_lounge_rooms / ghosti_lounge_members / ghosti_room_invites 정식 SQL 컬럼 직결
--    - 실시간 파일·오피스 열람 잠금(~$)·삭제 Tombstone 동기화: Realtime 인가 정책(9번)과 일치하는 표준 채널(ghosti:room:<roomId>) 사용
--    - 방장 PC 퇴근/절전 시 24시간 미리보기 및 512KB 초과 ~ 50MB 대용량 오피스·현장사진 서명 전송:
--      비공개 금고(ghosti-work-vault) + 서버 검증 브릿지(hub-supabase-bridge.mjs / workAndDeviceBridgeOps.mjs) 경유
-- 3) 내 기기 통합(PC + 폰 + PC+) 6대 실배선 아키텍처:
--    - 기기 등록·하트비트·6자리 보안 바인딩: ghosti_devices / ghosti_pairing_codes 정식 SQL 컬럼 직결
--    - 실시간 양방향 제어(E2EE 클립보드 · 무선 모니터 캐스트 · 0.2초 공간이동): 표준 채널(ghosti:pair:<emailHash>) 사용
--    - 30일 무제한 체험(D-30) 영속 원장 · AES-256-GCM 24시간 지연 우체통 · 13KB 섀도우/원본 미러 서명 전송:
--      비공개 금고(ghosti-device-vault) + 서버 검증 브릿지(hub-supabase-bridge.mjs) 경유
-- ============================================================================
