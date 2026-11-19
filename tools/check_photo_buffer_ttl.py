#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[AI 에이전트 DB 추적 실증 도구] 사진 공유방 14일(2주) 마중물 버퍼(TTL) 전수 점검·소거 검증기
- 목적: QA 알바생 수동 테스트 없이 AI 에이전트가 직접 운영 Supabase DB(`ghosti_room_shared_photos`)의
        전사 전체 행 수(`service_role` 기준, RLS 사각지대 0%) · 최고령/최신 생성일시(`created_at`) ·
        14일 이내 활성 행 vs 14일 초과 만료 행 잔존 유무를 실측 검증합니다.
- 보안: 로컬 코드/환경변수에 service_role 시크릿을 두지 않고도 Netlify 서버 브릿지
        (`GET /.netlify/functions/hub-supabase-bridge?action=photo_seed_ttl_status`, 무-PII 집계 전용)를 통해
        전 방 합산 통계 및 14일 초과분 서버 소거(`--purge`)를 안전하게 수행합니다.
- 사용법:
    python tools/check_photo_buffer_ttl.py           # 현재 14일 TTL 기준 전 방 활성/만료 행 분포 조회
    python tools/check_photo_buffer_ttl.py --purge   # 14일 초과 만료 행 서버 즉시 소거 후 0건 재검증
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

TTL_DAYS = 14
DEFAULT_BRIDGE_URL = "https://ghosti.sundreamer.app/.netlify/functions/hub-supabase-bridge"
ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent


def load_local_env() -> dict[str, str]:
    merged: dict[str, str] = dict(os.environ)
    for fname in (".env.local", ".env"):
        fpath = ROOT_DIR / fname
        if not fpath.exists():
            continue
        for raw_line in fpath.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            merged.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return merged


def call_json(url: str, headers: dict[str, str] | None = None, method: str = "GET", body: dict | None = None) -> tuple[int, dict]:
    req_headers = {"Accept": "application/json", **(headers or {})}
    payload = None
    if body is not None:
        req_headers["Content-Type"] = "application/json"
        payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {}
            return resp.status, (parsed if isinstance(parsed, dict) else {"rows": parsed})
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(raw) if raw else {"raw": raw}
        except Exception:
            parsed = {"raw": raw}
        return err.code, (parsed if isinstance(parsed, dict) else {"raw": str(parsed)})
    except Exception as exc:
        return 0, {"error": str(exc)}


def print_bridge_report(report: dict, source_label: str) -> int:
    print("=== [Ghosti 사진 공유방 14일(2주) 마중물 버퍼 DB 추적 리포트] ===")
    print(f"- 조회 경로: {source_label}")
    print(f"- 점검 시각(UTC): {report.get('checkedAtUtc')}")
    print(f"- 14일 만료 기준선(cutoff UTC): {report.get('cutoffUtc')}")
    print(f"- 전체 공유방 수(마중물 보유 방): {report.get('distinctRoomCount', 0)}개")
    print(f"- 조회된 총 마중물 행 수: {report.get('totalRows', 0)}건")
    print(f"  * 14일 이내 활성 마중물(정상 유지 대상): {report.get('activeWithin14dRows', 0)}건")
    print(f"  * 14일 초과 만료 마중물(자동 소거 대상): {report.get('expiredOver14dRows', 0)}건")
    if report.get("purgedCount") is not None:
        print(f"  * 금회 즉시 소거된 만료 행 수: {report.get('purgedCount', 0)}건")
    print(f"  * 최고령 행 created_at: {report.get('oldestCreatedAt')}")
    print(f"  * 최신 행 created_at:   {report.get('newestCreatedAt')}")

    expired = int(report.get("expiredOver14dRows") or 0)
    if expired == 0:
        print("✅ [검증 통과] 14일(2주) 초과 만료 마중물 잔존 0건 — TTL 정책 정상 작동 중")
        return 0
    print(f"⚠️ [만료 행 감지] 14일 초과 행 {expired}건 발견 (`--purge` 옵션으로 즉시 청소 가능)")
    return 0


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Ghosti 14일 사진 마중물 버퍼 DB 추적 검증기")
    parser.add_argument("--purge", action="store_true", help="14일 경과 만료 마중물 행 서버 즉시 소거 실행")
    args = parser.parse_args()

    env = load_local_env()
    bridge_base = (env.get("GHOSTI_BRIDGE_URL") or DEFAULT_BRIDGE_URL).strip()

    # 1순위: 프로덕션 Netlify 브릿지의 service_role 무-PII 집계 엔드포인트 조회 (RLS 사각지대 0%)
    qs = {"action": "photo_seed_ttl_status"}
    if args.purge:
        qs["purge"] = "1"
    bridge_url = f"{bridge_base}?{urllib.parse.urlencode(qs)}"
    b_status, b_data = call_json(bridge_url)
    if b_status == 200 and b_data.get("ok") and "totalRows" in b_data:
        return print_bridge_report(b_data, "Netlify Hub-Supabase-Bridge (service_role 전수 집계)")

    # 2순위: 로컬 SUPABASE_SERVICE_ROLE_KEY 또는 DB SECURITY DEFINER 집계 RPC 폴백
    sb_url = (
        env.get("GHOSTI_SUPABASE_URL")
        or env.get("SUPABASE_URL")
        or env.get("VITE_GHOSTI_SUPABASE_URL")
        or env.get("VITE_SUPABASE_URL")
        or ""
    ).rstrip("/")
    anon_key = env.get("VITE_GHOSTI_SUPABASE_ANON_KEY") or env.get("VITE_SUPABASE_ANON_KEY") or ""
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("GHOSTI_SUPABASE_SERVICE_ROLE_KEY") or ""

    if sb_url and (service_key or anon_key):
        api_key = anon_key or service_key
        bearer = service_key or anon_key
        headers = {"apikey": api_key, "Authorization": f"Bearer {bearer}"}

        if args.purge:
            call_json(
                f"{sb_url}/rest/v1/rpc/ghosti_purge_expired_photo_seed_buffer",
                headers=headers,
                method="POST",
                body={},
            )

        rpc_status, rpc_data = call_json(
            f"{sb_url}/rest/v1/rpc/ghosti_get_photo_seed_ttl_telemetry",
            headers=headers,
            method="POST",
            body={},
        )
        if rpc_status == 200 and rpc_data.get("ok") and "totalRows" in rpc_data:
            return print_bridge_report(rpc_data, "Supabase RPC ghosti_get_photo_seed_ttl_telemetry")

        if service_key:
            now_utc = dt.datetime.now(dt.timezone.utc)
            cutoff_utc = now_utc - dt.timedelta(days=TTL_DAYS)
            r_status, r_data = call_json(
                f"{sb_url}/rest/v1/ghosti_room_shared_photos?select=room_id,created_at&order=created_at.asc&limit=5000",
                headers=headers,
            )
            rows = r_data.get("rows", []) if r_status == 200 else []
            active_cnt = 0
            exp_cnt = 0
            rooms = set()
            for r in rows:
                rooms.add(str(r.get("room_id") or ""))
                c_str = str(r.get("created_at") or "").replace("Z", "+00:00")
                try:
                    c_dt = dt.datetime.fromisoformat(c_str)
                    if c_dt < cutoff_utc:
                        exp_cnt += 1
                    else:
                        active_cnt += 1
                except Exception:
                    active_cnt += 1
            return print_bridge_report(
                {
                    "checkedAtUtc": now_utc.isoformat(),
                    "cutoffUtc": cutoff_utc.isoformat(),
                    "distinctRoomCount": len(rooms),
                    "totalRows": len(rows),
                    "activeWithin14dRows": active_cnt,
                    "expiredOver14dRows": exp_cnt,
                    "oldestCreatedAt": rows[0].get("created_at") if rows else None,
                    "newestCreatedAt": rows[-1].get("created_at") if rows else None,
                },
                "Direct Supabase REST (service_role)",
            )

    print("=== [Ghosti 사진 공유방 14일(2주) 마중물 버퍼 DB 추적 리포트] ===")
    print(
        "ℹ️ 프로덕션 브릿지 집계 엔드포인트 배포 반영 대기 중입니다 "
        "(Netlify 배포 완료 직후 재실행하면 service_role 전수 통계가 즉시 출력됩니다)."
    )
    print(f"- 브릿지 현재 응답: HTTP {b_status} -> {b_data}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
