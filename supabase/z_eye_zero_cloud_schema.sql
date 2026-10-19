-- ============================================================================
-- ⚡ 제트아이 (Z-Eye) — Zero-Cloud 초경량 Supabase DB 스키마 (v1.0)
-- ============================================================================
-- [핵심 아키텍처 & 평생권 수익성 방어 원칙]
-- 1. 원본 사진·동영상·문서 파일 및 수만 장의 768차원 벡터 인덱스는 중앙 DB에 절대 저장하지 않음!
--    (마스터 PC 로컬 디스크 및 멤버 단말 OPFS/IndexedDB에서만 P2P로 직접 동기화 ➔ DB 스토리지 비용 0원)
-- 2. WebRTC 시그널링(SDP/ICE)은 테이블 INSERT 없이 Supabase Realtime Broadcast(메모리 패스스루)만 사용.
-- 3. 본 스키마에는 오직 아래 4대 초경량 메타데이터만 저장하여 평생권 회원 1만 명 유입 시에도 유지비 0원 달성:
--    ① zeye_face_passports   : 이메일 귀속 만국공통 Z-Eye 여권 안면 시드 (1인당 5슬롯 × 768d ≈ 15KB)
--    ② zeye_lounge_rooms     : 5대 시크릿 라운지 방 메타데이터 & 아웃바운드 터널 엔드포인트
--    ③ zeye_lounge_members   : 방별 멤버 권한 & 방별 독립 호칭(room_personas JSONB)
--    ④ zeye_setup_playbooks  : 설정 몬스터 표준 정답 경로 캐시(토큰 0원화) & Multi-LLM 최단 지름길 OTA
--    ⑤ zeye_setup_audit_logs : 멀린코인 에스크로 정산 · 초행길 2회 헤맴 100% 쿨 환불 · 실패 블랙박스 로그
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- 1. 만국공통 Z-Eye 여권 (Face Passport) — 1인당 약 15KB 고정
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

-- 2. 5대 시크릿 라운지 방 메타데이터 (개인 / 패밀리 / 클럽 / 스쿨 / 업무)
create table if not exists public.zeye_lounge_rooms (
  room_id text primary key,
  lounge_type text not null check (lounge_type in ('personal', 'family', 'club', 'student', 'work')),
  family_sub_room text check (family_sub_room in ('우리집', '본가(친가)', '처가(친정)')),
  room_title text not null,
  master_user_id text not null,
  master_email text not null,
  pricing_plan text not null default 'free_trial',
  -- P2P 1순위(WebRTC) 실패 시 2순위 자동 폴백용 마스터 PC 아웃바운드 터널 주소
  master_outbound_tunnel_url text,
  master_pc_online boolean not null default true,
  gpu_cloud_helper_until timestamptz,
  custom_watermark_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. 라운지 멤버 권한 & 방별 독립 별명(Persona) 매핑
create table if not exists public.zeye_lounge_members (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.zeye_lounge_rooms(room_id) on delete cascade,
  member_email text not null,
  passport_id uuid references public.zeye_face_passports(passport_id) on delete set null,
  role text not null default 'member' check (role in ('master', 'admin', 'member')),
  -- 해당 방에서 불릴 독립 호칭 (예: 처가방에서는 '👑 둘째사위', 스쿨방에서는 '지우짱')
  room_persona_nickname text not null,
  joined_at timestamptz not null default now(),
  unique (room_id, member_email)
);

create index if not exists idx_zeye_lounge_members_room
  on public.zeye_lounge_members (room_id);

-- 4. 설정 몬스터 Playbook DB (표준 경로 0원 캐시 & Multi-LLM 최단 직행 지름길 OTA)
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

-- 5. 설정 몬스터 에스크로 정산 · 초행길 2회 헤맴 100% 쿨 환불 · 실패 블랙박스 감사 로그
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
