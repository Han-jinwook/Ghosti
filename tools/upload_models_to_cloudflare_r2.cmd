@echo off
chcp 65001 > NUL
cd /d "%~dp0.."
echo ======================================================================
echo ☁️ 멀린 AI 모델 마스터 사본 (8비트 q8 + 4비트 q4) Cloudflare R2 업로드 도구
echo ======================================================================
echo.
echo [1/2] Cloudflare 계정 인증 상태를 확인합니다 (미인증 시 브라우저 로그인 창이 열립니다)...
call npx.cmd wrangler whoami > NUL 2>&1
if errorlevel 1 (
    call npx.cmd wrangler login
)
echo.
echo [2/2] D:\Merlin_AI_Models\embeddinggemma-2 마스터 사본을 Cloudflare R2 버킷에 업로드합니다...
python tools\sync_embedding_gemma_models.py --upload-r2
echo.
pause
