-- ============================================================================
-- ⚡ 제트아이 (Z-Eye) — Zero-Cloud 초경량 Supabase DB 스키마 (v2.0 · 2026-10-26)
-- ============================================================================
-- [핵심 아키텍처 & 평생권 수익성 방어 원칙]
-- 1. 원본 사진·동영상·문서 파일 및 수만 장의 768차원 벡터 인덱스는 중앙 DB에 절대 저장하지 않음!
--    (마스터 PC 로컬 디스크 및 멤버 단말 OPFS/IndexedDB에서만 P2P로 직접 동기화 ➔ DB 스토리지 비용 0원)
-- 2. WebRTC 시그널링(SDP/ICE)은 테이블 INSERT 없이 Supabase Realtime Broadcast(메모리 패스스루)만 사용.
--    (채널 토픽 규칙: `zeye:room:<room_id>` / `zeye:pair:<owner_email>` — 하단 9번 Realtime 인가 정책 참조)
-- 3. 계정·로그인·코인 지갑은 Z-Eye가 따로 만들지 않고 멀린허브OS(os.sundreamer.app) SSO 단일 원장을 따름.
--    ➔ 본 스키마의 모든 RLS는 허브 SSO 세션 JWT의 이메일 클레임(`auth.jwt() ->> 'email'`) 하나로 판별하며,
--      코인 잔액·결제 테이블은 본 스키마에 절대 두지 않음 (중복 원장 금지).
-- 4. 본 스키마에는 오직 아래 초경량 메타데이터만 저장하여 평생권 회원 1만 명 유입 시에도 유지비 0원 달성:
--    ① zeye_face_passports       : 이메일 귀속 만국공통 Z-Eye 여권 안면 시드 (1인당 5슬롯 × 768d ≈ 15KB)
--    ② zeye_devices              : 내 기기 등록부 (PC 마스터 1 + 모바일 1 무료) & PC 아웃바운드 터널 주소
--    ③ zeye_pairing_codes        : PC ↔ 폰 1회용 연결 코드(QR/6자리, 10분 만료)
--    ④ zeye_lounge_rooms         : 3대 메뉴(내 기기 / 사진 공유 / 업무 공유) 라운지 방 메타데이터
--    ⑤ zeye_lounge_members       : 방별 멤버 권한 & 방별 독립 호칭(room_persona_nickname)
--    ⑥ zeye_room_invites         : 방 초대 링크 토큰 (만료·사용 횟수 제한)
--    ⑦ zeye_room_shared_folders  : 방에 공유된 PC 폴더 '포인터'만 기록 (파일 자체·썸네일·벡터 저장 0바이트)
--    ⑧ zeye_setup_playbooks      : 설정 몬스터 표준 정답 경로 캐시(토큰 0원화) & Multi-LLM 최단 지름길 OTA
--    ⑨ zeye_setup_audit_logs     : 설정 몬스터 정산 결과 기록 · 초행길 2회 헤맴 100% 쿨 환불 · 실패 블랙박스 로그
--       (실제 코인 차감/환불 집행은 멀린허브OS 지갑 API가 수행하고, 여기에는 결과 사본만 남김)
-- 5. [v2.0 변경] 구버전 'student(스쿨)' 라운지 유형 폐기 ➔ 1차 출시 3대 메뉴 체계로 정렬
--    - personal(내 기기) / family·club(사진 공유: 우리집·본가·처가 / 동호회 / 동창회) / work(업무 공유 S:)
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ----------------------------------------------------------------------------
-- 0. 공통 헬퍼: 허브 SSO JWT 이메일 & updated_at 자동 갱신
-- ----------------------------------------------------------------------------
create or replace function public.zeye_current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.zeye_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. 만국공통 Z-Eye 여권 (Face Passport) — 1인당 약 15KB 고정
-- ----------------------------------------------------------------------------
create table if not exists public.zeye_face_passports (
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

create index if not exists idx_zeye_face_passports_email
  on public.zeye_face_passports (email);

-- ----------------------------------------------------------------------------
-- 2. 내 기기 등록부 — PC 마스터(원본 보관·AI 인덱싱) + 모바일(13KB 섀도우 캐시 뷰어)
--    - 무료 기준: PC 1대 + 모바일 1대 (초과 대수 제한은 앱/허브 요금제에서 판정)
--    - bridge_url: 폰이 외부 LTE/5G에서 PC에 닿기 위한 마스터 PC 아웃바운드 HTTPS 터널 주소
-- ----------------------------------------------------------------------------
create table if not exists public.zeye_devices (
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

create index if not exists idx_zeye_devices_owner
  on public.zeye_devices (owner_email, device_kind);

drop trigger if exists trg_zeye_devices_touch on public.zeye_devices;
create trigger trg_zeye_devices_touch
  before update on public.zeye_devices
  for each row execute function public.zeye_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 3. PC ↔ 폰 1회용 연결 코드 (PC 화면 QR / 6자리 숫자, 10분 만료, 1회 사용)
-- ----------------------------------------------------------------------------
create table if not exists public.zeye_pairing_codes (
  code text primary key check (code ~ '^[0-9]{6}$'),
  owner_email text not null,
  pc_device_id uuid not null references public.zeye_devices(device_id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  consumed_by_device_id uuid references public.zeye_devices(device_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_zeye_pairing_codes_owner
  on public.zeye_pairing_codes (owner_email, expires_at desc);

-- ----------------------------------------------------------------------------
-- 4. 라운지 방 메타데이터 — 1차 출시 3대 메뉴 체계
--    lounge_type : personal(내 기기) / family·club(사진 공유) / work(업무 공유 S:)
--    sub_type    : family ➔ 우리집 / 본가(친가) / 처가(친정)
--                  club   ➔ 동호회 / 동창회 (동창회는 '우리반 타임캡슐' 메뉴를 UI에서 제공)
-- ----------------------------------------------------------------------------
create table if not exists public.zeye_lounge_rooms (
  room_id text primary key,
  lounge_type text not null check (lounge_type in ('personal', 'family', 'club', 'work')),
  sub_type text,
  room_title text not null,
  master_user_id text not null,
  master_email text not null,
  pricing_plan text not null default 'free_trial',
  -- 원본을 보관하는 마스터 PC (P2P 1순위 WebRTC 실패 시 이 기기의 bridge_url로 2순위 자동 폴백)
  master_pc_device_id uuid references public.zeye_devices(device_id) on delete set null,
  -- [호환 유지] v1 필드: 마스터 PC 아웃바운드 터널 주소 직접 기록 (master_pc_device_id 미사용 시)
  master_outbound_tunnel_url text,
  master_pc_online boolean not null default true,
  gpu_cloud_helper_until timestamptz,
  custom_watermark_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zeye_lounge_rooms_sub_type_chk check (
    (lounge_type = 'family' and sub_type in ('우리집', '본가(친가)', '처가(친정)'))
    or (lounge_type = 'club' and sub_type in ('동호회', '동창회'))
    or (lounge_type in ('personal', 'work') and sub_type is null)
  )
);

create index if not exists idx_zeye_lounge_rooms_master
  on public.zeye_lounge_rooms (master_email);

drop trigger if exists trg_zeye_lounge_rooms_touch on public.zeye_lounge_rooms;
create trigger trg_zeye_lounge_rooms_touch
  before update on public.zeye_lounge_rooms
  for each row execute function public.zeye_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. 라운지 멤버 권한 & 방별 독립 별명(Persona) 매핑
-- ----------------------------------------------------------------------------
create table if not exists public.zeye_lounge_members (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.zeye_lounge_rooms(room_id) on delete cascade,
  member_email text not null,
  passport_id uuid references public.zeye_face_passports(passport_id) on delete set null,
  role text not null default 'member' check (role in ('master', 'admin', 'member')),
  -- 해당 방에서 불릴 독립 호칭 (예: 처가방에서는 '👑 둘째사위', 동창회방에서는 '지우짱')
  room_persona_nickname text not null,
  joined_at timestamptz not null default now(),
  unique (room_id, member_email)
);

create index if not exists idx_zeye_lounge_members_room
  on public.zeye_lounge_members (room_id);
create index if not exists idx_zeye_lounge_members_email
  on public.zeye_lounge_members (member_email);

-- ----------------------------------------------------------------------------
-- 6. 방 초대 링크 토큰 (카톡/문자로 전달, 만료·최대 사용 횟수 제한)
-- ----------------------------------------------------------------------------
create table if not exists public.zeye_room_invites (
  -- URL에 그대로 붙일 수 있도록 hex 36자 (base64의 +,/ 문자로 링크가 깨지는 문제 방지)
  token text primary key default encode(gen_random_bytes(18), 'hex'),
  room_id text not null references public.zeye_lounge_rooms(room_id) on delete cascade,
  created_by_email text not null,
  default_role text not null default 'member' check (default_role in ('admin', 'member')),
  max_uses integer not null default 10 check (max_uses between 1 and 500),
  used_count integer not null default 0,
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_zeye_room_invites_room
  on public.zeye_room_invites (room_id);

-- ----------------------------------------------------------------------------
-- 7. 방에 공유된 PC 폴더 '포인터' (원본·썸네일·벡터 저장 0바이트)
--    - 폰은 이 포인터로 마스터 PC의 bridge_url에 접속해 13KB 썸네일·벡터만 받아감
-- ----------------------------------------------------------------------------
create table if not exists public.zeye_room_shared_folders (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.zeye_lounge_rooms(room_id) on delete cascade,
  pc_device_id uuid not null references public.zeye_devices(device_id) on delete cascade,
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

drop trigger if exists trg_zeye_room_shared_folders_touch on public.zeye_room_shared_folders;
create trigger trg_zeye_room_shared_folders_touch
  before update on public.zeye_room_shared_folders
  for each row execute function public.zeye_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 8. 설정 몬스터 Playbook DB (표준 경로 0원 캐시 & Multi-LLM 최단 직행 지름길 OTA)
-- ----------------------------------------------------------------------------
create table if not exists public.zeye_setup_playbooks (
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
create table if not exists public.zeye_setup_audit_logs (
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

create index if not exists idx_zeye_setup_audit_user
  on public.zeye_setup_audit_logs (user_email, created_at desc);

-- ============================================================================
-- 10. 권한 판별 헬퍼 (SECURITY DEFINER — RLS 재귀 방지)
-- ============================================================================
create or replace function public.zeye_is_room_member(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.zeye_lounge_members m
    where m.room_id = p_room_id
      and lower(m.member_email) = public.zeye_current_email()
  );
$$;

create or replace function public.zeye_is_room_admin(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.zeye_lounge_members m
    where m.room_id = p_room_id
      and lower(m.member_email) = public.zeye_current_email()
      and m.role in ('master', 'admin')
  ) or exists (
    select 1 from public.zeye_lounge_rooms r
    where r.room_id = p_room_id
      and lower(r.master_email) = public.zeye_current_email()
  );
$$;

-- ============================================================================
-- 11. 원자적 RPC (클라이언트가 직접 테이블을 조작하지 않고 검증된 함수로만 처리)
-- ============================================================================

-- 11-1. 방 생성: 방 + 마스터 멤버 행을 한 번에 생성
create or replace function public.zeye_create_room(
  p_room_id text,
  p_lounge_type text,
  p_sub_type text,
  p_room_title text,
  p_master_nickname text,
  p_master_pc_device_id uuid default null
)
returns public.zeye_lounge_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.zeye_current_email();
  v_room public.zeye_lounge_rooms;
begin
  if v_email = '' then
    raise exception 'ZEYE_AUTH_REQUIRED';
  end if;
  if p_master_pc_device_id is not null and not exists (
    select 1 from public.zeye_devices d
    where d.device_id = p_master_pc_device_id
      and lower(d.owner_email) = v_email
      and d.device_kind = 'pc_master'
      and d.revoked_at is null
  ) then
    raise exception 'ZEYE_PC_NOT_OWNED';
  end if;

  insert into public.zeye_lounge_rooms (
    room_id, lounge_type, sub_type, room_title, master_user_id, master_email, master_pc_device_id
  ) values (
    p_room_id, p_lounge_type, p_sub_type, p_room_title,
    coalesce(auth.uid()::text, v_email), v_email, p_master_pc_device_id
  )
  returning * into v_room;

  insert into public.zeye_lounge_members (room_id, member_email, role, room_persona_nickname)
  values (p_room_id, v_email, 'master', coalesce(nullif(p_master_nickname, ''), '방장'));

  return v_room;
end;
$$;

-- 11-2. PC ↔ 폰 연결: 6자리 코드 1회 소비 + 모바일 기기 등록
create or replace function public.zeye_consume_pairing_code(
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
  v_email text := public.zeye_current_email();
  v_pc_id uuid;
  v_mobile_id uuid;
begin
  if v_email = '' then
    raise exception 'ZEYE_AUTH_REQUIRED';
  end if;

  update public.zeye_pairing_codes c
     set consumed_at = now()
   where c.code = p_code
     and lower(c.owner_email) = v_email
     and c.consumed_at is null
     and c.expires_at > now()
  returning c.pc_device_id into v_pc_id;

  if v_pc_id is null then
    raise exception 'ZEYE_PAIRING_CODE_INVALID_OR_EXPIRED';
  end if;

  insert into public.zeye_devices (owner_email, device_kind, display_name, platform)
  values (v_email, 'mobile', coalesce(nullif(p_mobile_display_name, ''), '내 휴대폰'), p_mobile_platform)
  returning device_id into v_mobile_id;

  update public.zeye_pairing_codes set consumed_by_device_id = v_mobile_id where code = p_code;

  return query
    select d.device_id, d.display_name, d.bridge_url, v_mobile_id
      from public.zeye_devices d
     where d.device_id = v_pc_id;
end;
$$;

-- 11-3. 초대 링크 수락: 토큰 검증 + 사용 횟수 증가 + 멤버 등록 (이미 멤버면 그대로 반환)
create or replace function public.zeye_accept_room_invite(
  p_token text,
  p_nickname text
)
returns public.zeye_lounge_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.zeye_current_email();
  v_invite public.zeye_room_invites;
  v_member public.zeye_lounge_members;
begin
  if v_email = '' then
    raise exception 'ZEYE_AUTH_REQUIRED';
  end if;

  select * into v_invite
    from public.zeye_room_invites i
   where i.token = p_token
   for update;

  if v_invite.token is null
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or v_invite.used_count >= v_invite.max_uses then
    raise exception 'ZEYE_INVITE_INVALID_OR_EXPIRED';
  end if;

  select * into v_member
    from public.zeye_lounge_members m
   where m.room_id = v_invite.room_id and lower(m.member_email) = v_email;

  if v_member.id is not null then
    return v_member;
  end if;

  insert into public.zeye_lounge_members (room_id, member_email, role, room_persona_nickname)
  values (v_invite.room_id, v_email, v_invite.default_role, coalesce(nullif(p_nickname, ''), '새 멤버'))
  returning * into v_member;

  update public.zeye_room_invites set used_count = used_count + 1 where token = p_token;

  return v_member;
end;
$$;

-- ============================================================================
-- 12. RLS (Row Level Security) — 허브 SSO 이메일 기준 최소 권한
-- ============================================================================
alter table public.zeye_face_passports      enable row level security;
alter table public.zeye_devices             enable row level security;
alter table public.zeye_pairing_codes       enable row level security;
alter table public.zeye_lounge_rooms        enable row level security;
alter table public.zeye_lounge_members      enable row level security;
alter table public.zeye_room_invites        enable row level security;
alter table public.zeye_room_shared_folders enable row level security;
alter table public.zeye_setup_playbooks     enable row level security;
alter table public.zeye_setup_audit_logs    enable row level security;

-- 12-1. 여권: 본인 것만 읽기/쓰기 (같은 방 멤버의 시드 조회는 추후 RPC로 별도 제공)
drop policy if exists zeye_passports_own on public.zeye_face_passports;
create policy zeye_passports_own on public.zeye_face_passports
  for all using (lower(email) = public.zeye_current_email())
  with check (lower(email) = public.zeye_current_email());

-- 12-2. 기기: 본인 기기만 / 같은 방 멤버는 그 방 마스터 PC의 bridge_url 읽기 허용
drop policy if exists zeye_devices_own on public.zeye_devices;
create policy zeye_devices_own on public.zeye_devices
  for all using (lower(owner_email) = public.zeye_current_email())
  with check (lower(owner_email) = public.zeye_current_email());

drop policy if exists zeye_devices_room_master_pc_read on public.zeye_devices;
create policy zeye_devices_room_master_pc_read on public.zeye_devices
  for select using (
    exists (
      select 1 from public.zeye_lounge_rooms r
      where r.master_pc_device_id = zeye_devices.device_id
        and public.zeye_is_room_member(r.room_id)
    )
  );

-- 12-3. 연결 코드: 본인 PC가 발급·조회만 (소비는 RPC 11-2로만)
drop policy if exists zeye_pairing_codes_own_select on public.zeye_pairing_codes;
create policy zeye_pairing_codes_own_select on public.zeye_pairing_codes
  for select using (lower(owner_email) = public.zeye_current_email());

drop policy if exists zeye_pairing_codes_own_insert on public.zeye_pairing_codes;
create policy zeye_pairing_codes_own_insert on public.zeye_pairing_codes
  for insert with check (
    lower(owner_email) = public.zeye_current_email()
    and exists (
      select 1 from public.zeye_devices d
      where d.device_id = pc_device_id
        and lower(d.owner_email) = public.zeye_current_email()
        and d.device_kind = 'pc_master'
    )
  );

-- 12-4. 방: 멤버만 읽기 / 방장·관리자만 수정 / 생성은 RPC 11-1로만
drop policy if exists zeye_rooms_member_read on public.zeye_lounge_rooms;
create policy zeye_rooms_member_read on public.zeye_lounge_rooms
  for select using (public.zeye_is_room_member(room_id) or lower(master_email) = public.zeye_current_email());

drop policy if exists zeye_rooms_admin_update on public.zeye_lounge_rooms;
create policy zeye_rooms_admin_update on public.zeye_lounge_rooms
  for update using (public.zeye_is_room_admin(room_id))
  with check (public.zeye_is_room_admin(room_id));

drop policy if exists zeye_rooms_master_delete on public.zeye_lounge_rooms;
create policy zeye_rooms_master_delete on public.zeye_lounge_rooms
  for delete using (lower(master_email) = public.zeye_current_email());

-- 12-5. 멤버: 같은 방 멤버끼리 명단 읽기 / 본인 호칭 수정 / 방장·관리자는 내보내기 / 본인은 나가기
drop policy if exists zeye_members_room_read on public.zeye_lounge_members;
create policy zeye_members_room_read on public.zeye_lounge_members
  for select using (public.zeye_is_room_member(room_id));

drop policy if exists zeye_members_self_update on public.zeye_lounge_members;
create policy zeye_members_self_update on public.zeye_lounge_members
  for update using (lower(member_email) = public.zeye_current_email() or public.zeye_is_room_admin(room_id))
  with check (lower(member_email) = public.zeye_current_email() or public.zeye_is_room_admin(room_id));

drop policy if exists zeye_members_leave_or_kick on public.zeye_lounge_members;
create policy zeye_members_leave_or_kick on public.zeye_lounge_members
  for delete using (
    (lower(member_email) = public.zeye_current_email() and role <> 'master')
    or (public.zeye_is_room_admin(room_id) and role <> 'master')
  );

-- 12-6. 초대: 방장·관리자만 발급·조회·회수 (수락은 RPC 11-3으로만)
drop policy if exists zeye_invites_admin_all on public.zeye_room_invites;
create policy zeye_invites_admin_all on public.zeye_room_invites
  for all using (public.zeye_is_room_admin(room_id))
  with check (public.zeye_is_room_admin(room_id) and lower(created_by_email) = public.zeye_current_email());

-- 12-7. 공유 폴더 포인터: 멤버 읽기 / PC 소유자이자 방 멤버만 등록·수정·삭제
drop policy if exists zeye_shared_folders_member_read on public.zeye_room_shared_folders;
create policy zeye_shared_folders_member_read on public.zeye_room_shared_folders
  for select using (public.zeye_is_room_member(room_id));

drop policy if exists zeye_shared_folders_owner_write on public.zeye_room_shared_folders;
create policy zeye_shared_folders_owner_write on public.zeye_room_shared_folders
  for all using (
    public.zeye_is_room_member(room_id)
    and exists (
      select 1 from public.zeye_devices d
      where d.device_id = pc_device_id and lower(d.owner_email) = public.zeye_current_email()
    )
  )
  with check (
    public.zeye_is_room_member(room_id)
    and lower(shared_by_email) = public.zeye_current_email()
    and exists (
      select 1 from public.zeye_devices d
      where d.device_id = pc_device_id and lower(d.owner_email) = public.zeye_current_email()
    )
  );

-- 12-8. 설정 몬스터 Playbook: 로그인 사용자 읽기 전용 (쓰기는 service_role 서버 전용)
drop policy if exists zeye_playbooks_read on public.zeye_setup_playbooks;
create policy zeye_playbooks_read on public.zeye_setup_playbooks
  for select using (public.zeye_current_email() <> '');

-- 12-9. 감사 로그: 본인 기록만 읽기 (쓰기는 service_role 서버 전용)
drop policy if exists zeye_audit_own_read on public.zeye_setup_audit_logs;
create policy zeye_audit_own_read on public.zeye_setup_audit_logs
  for select using (lower(user_email) = public.zeye_current_email());

-- RPC 실행 권한: 로그인 사용자만
revoke all on function public.zeye_create_room(text, text, text, text, text, uuid) from public, anon;
revoke all on function public.zeye_consume_pairing_code(text, text, text) from public, anon;
revoke all on function public.zeye_accept_room_invite(text, text) from public, anon;
grant execute on function public.zeye_create_room(text, text, text, text, text, uuid) to authenticated;
grant execute on function public.zeye_consume_pairing_code(text, text, text) to authenticated;
grant execute on function public.zeye_accept_room_invite(text, text) to authenticated;

-- ============================================================================
-- 13. Realtime Broadcast 인가 (Private Channel) — 시그널링 DB Write 0 Byte
--     - 토픽 `zeye:room:<room_id>` : 해당 방 멤버만 송수신 (WebRTC SDP/ICE 패스스루)
--     - 토픽 `zeye:pair:<email>`   : 본인 기기끼리만 송수신 (PC ↔ 폰 연결 핸드셰이크)
--     ※ realtime.messages 는 Broadcast 인가 판정에만 쓰이며 메시지 본문은 DB에 저장되지 않음
-- ============================================================================
drop policy if exists zeye_realtime_receive on realtime.messages;
create policy zeye_realtime_receive on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      (realtime.topic() like 'zeye:room:%'
        and public.zeye_is_room_member(substring(realtime.topic() from 11)))
      or realtime.topic() = 'zeye:pair:' || public.zeye_current_email()
    )
  );

drop policy if exists zeye_realtime_send on realtime.messages;
create policy zeye_realtime_send on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and (
      (realtime.topic() like 'zeye:room:%'
        and public.zeye_is_room_member(substring(realtime.topic() from 11)))
      or realtime.topic() = 'zeye:pair:' || public.zeye_current_email()
    )
  );
