---
Title: 허브 DB 스키마
Version: v1.3
Last Updated: 2026-10-20
---

# 🗄️ Merlin Family Hub DB Schema

| table_name                 | column_name           | data_type                | is_nullable |
| -------------------------- | --------------------- | ------------------------ | ----------- |
| family_aggro_video_pricing | video_id              | text                     | NO          |
| family_aggro_video_pricing | raw_token_cost        | numeric                  | NO          |
| family_aggro_video_pricing | margin_multiplier     | integer                  | NO          |
| family_aggro_video_pricing | fixed_coin_price      | bigint                   | NO          |
| family_aggro_video_pricing | created_at            | timestamp with time zone | YES         |
| family_app_scopes          | id                    | uuid                     | NO          |
| family_app_scopes          | app_id                | uuid                     | YES         |
| family_app_scopes          | scope                 | text                     | NO          |
| family_app_scopes          | description           | text                     | YES         |
| family_app_scopes          | created_at            | timestamp with time zone | YES         |
| family_apps                | id                    | uuid                     | NO          |
| family_apps                | client_id             | text                     | NO          |
| family_apps                | client_secret         | text                     | NO          |
| family_apps                | app_name              | text                     | NO          |
| family_apps                | status                | text                     | YES         |
| family_apps                | created_at            | timestamp with time zone | YES         |
| family_apps                | is_paid               | boolean                  | NO          |
| family_coin_packages       | id                    | uuid                     | NO          |
| family_coin_packages       | name                  | text                     | NO          |
| family_coin_packages       | price                 | bigint                   | NO          |
| family_coin_packages       | coin_amount           | bigint                   | NO          |
| family_coin_packages       | is_active             | boolean                  | YES         |
| family_coin_packages       | created_at            | timestamp with time zone | YES         |
| family_model_rates         | model_name            | text                     | NO          |
| family_model_rates         | tokens_per_coin       | numeric                  | NO          |
| family_model_rates         | description           | text                     | YES         |
| family_model_rates         | created_at            | timestamp with time zone | YES         |
| family_notifications       | id                    | uuid                     | NO          |
| family_notifications       | user_id               | uuid                     | YES         |
| family_notifications       | app_id                | text                     | NO          |
| family_notifications       | title                 | text                     | NO          |
| family_notifications       | content               | text                     | NO          |
| family_notifications       | is_read               | boolean                  | YES         |
| family_notifications       | created_at            | timestamp with time zone | YES         |
| family_notifications       | link                  | text                     | YES         |
| family_otp                 | id                    | uuid                     | NO          |
| family_otp                 | email                 | text                     | NO          |
| family_otp                 | otp_code              | text                     | NO          |
| family_otp                 | expires_at            | timestamp with time zone | NO          |
| family_otp                 | is_used               | boolean                  | YES         |
| family_otp                 | created_at            | timestamp with time zone | YES         |
| family_payments            | id                    | uuid                     | NO          |
| family_payments            | user_id               | uuid                     | YES         |
| family_payments            | order_id              | text                     | NO          |
| family_payments            | amount                | bigint                   | NO          |
| family_payments            | coin_amount           | bigint                   | NO          |
| family_payments            | status                | text                     | YES         |
| family_payments            | pg_tid                | text                     | YES         |
| family_payments            | pg_result_code        | text                     | YES         |
| family_payments            | pg_result_msg         | text                     | YES         |
| family_payments            | app_id                | text                     | YES         |
| family_payments            | created_at            | timestamp with time zone | YES         |
| family_payments            | updated_at            | timestamp with time zone | YES         |
| family_transfer_codes      | id                    | uuid                     | NO          |
| family_transfer_codes      | user_id               | uuid                     | NO          |
| family_transfer_codes      | transfer_code         | text                     | NO          |
| family_transfer_codes      | expires_at            | timestamp with time zone | NO          |
| family_transfer_codes      | is_used               | boolean                  | YES         |
| family_transfer_codes      | created_at            | timestamp with time zone | YES         |
| family_user_registrations  | id                    | uuid                     | NO          |
| family_user_registrations  | user_id               | uuid                     | YES         |
| family_user_registrations  | app_id                | text                     | NO          |
| family_user_registrations  | last_registered_at    | timestamp with time zone | YES         |
| family_users               | id                    | uuid                     | NO          |
| family_users               | email                 | text                     | NO          |
| family_users               | nickname              | text                     | YES         |
| family_users               | admin_memo            | text                     | YES         |
| family_users               | created_at            | timestamp with time zone | YES         |
| family_users               | region                | text                     | YES         |
| family_users               | first_app_id          | text                     | YES         |
| family_users               | avatar_url            | text                     | YES         |
| family_users               | updated_at            | timestamp with time zone | YES         |
| family_users               | referral_code         | text                     | YES         |
| family_users               | invited_by_id         | uuid                     | YES         |
| family_users               | registered_apps       | ARRAY                    | YES         |
| family_users               | notification_settings | jsonb                    | YES         |
| family_users               | app_join_dates        | jsonb                    | YES         |
| family_users               | deleted_at            | timestamp with time zone | YES         |
| family_wallet_balances     | user_id               | uuid                     | NO          |
| family_wallet_balances     | balance               | bigint                   | NO          |
| family_wallet_balances     | updated_at            | timestamp with time zone | YES         |
| family_wallet_logs         | id                    | uuid                     | NO          |
| family_wallet_logs         | user_id               | uuid                     | NO          |
| family_wallet_logs         | app_id                | uuid                     | NO          |
| family_wallet_logs         | amount                | bigint                   | NO          |
| family_wallet_logs         | type                  | text                     | NO          |
| family_wallet_logs         | request_id            | text                     | NO          |
| family_wallet_logs         | display_text          | text                     | YES         |
| family_wallet_logs         | created_at            | timestamp with time zone | YES         |
| family_wallet_transactions | id                    | uuid                     | NO          |
| family_wallet_transactions | user_id               | uuid                     | YES         |
| family_wallet_transactions | app_id                | text                     | NO          |
| family_wallet_transactions | amount                | bigint                   | NO          |
| family_wallet_transactions | request_id            | text                     | NO          |
| family_wallet_transactions | transaction_type      | text                     | NO          |
| family_wallet_transactions | display_text          | text                     | YES         |
| family_wallet_transactions | created_at            | timestamp with time zone | YES         |
| family_wallet_transactions | usage_metadata        | jsonb                    | YES         |

---

## 📌 주요 테이블 운영 및 2026-10-01 코인경제 정책 반영 명세

1. **`family_aggro_video_pricing`**:
   - `fixed_coin_price`: 어그로필터 신규 분석 시 **50C 단일가** 캐싱 (`raw_token_cost` 및 미터기 로직 폐지).
   - ⭐ **채널 소유자 재분석 의뢰 (`REANALYSIS_OWNER`)**: **1,000C 고정**.
2. **`family_apps`**:
   - `client_id`: `NOSTRA`, `NOSTRACOURT` (노스트라 예언법정, `is_paid = TRUE`) 추가.
   - `AggroFilter` (`is_paid = TRUE`), `Vaulter` (`is_paid = TRUE`), `SunDreamer` (`is_paid = FALSE`), `WhatEat` (`is_paid = FALSE`).
3. **`family_coin_packages`**:
   - 노스트라 및 기간제 패스 수용을 위해 1,000원(1,000C), 5,000원(5,200C), 10,000원(11,000C), 30,000원(34,000C), 50,000원(57,500C), 100,000원(120,000C) 라인업 확장.
4. **`family_wallet_transactions`**:
   - `usage_metadata`: 50C 결제 유저에게 `{ ad_free_granted: true, ad_free_date: 'YYYY-MM-DD' }`를 기록하여 당일 전체 광고 제거 혜택 보장.

---

## 🔐 Supabase Data API 신규 테이블 GRANT 필수 수칙 (2026-10-30 시행)

- Supabase 정책 변경으로 **2026-10-30 이후 `public` 스키마에 새로 만드는 테이블**은 Data API(`supabase-js`, PostgREST, GraphQL) 접근 권한이 자동 부여되지 않는다. 미부여 시 `permission denied` 오류 발생.
- **기존 테이블은 영향 없음** (현재 허브 `family_*` 및 루미노트/썬드리머 전 테이블 정상 유지).
- 신규 테이블 생성 시 **같은 마이그레이션 SQL 안에 아래 GRANT를 반드시 포함**한다 (새 프로젝트, 프리뷰 브랜치, 로컬 `supabase db reset` 동일 적용):

```sql
grant select on public.새테이블명 to anon;
grant select, insert, update, delete on public.새테이블명 to authenticated;
grant select, insert, update, delete on public.새테이블명 to service_role;
```

- 테이블 성격상 `anon` 읽기가 불필요하면 `anon` GRANT는 생략하고 RLS 정책과 함께 검토한다.
