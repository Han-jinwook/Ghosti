@echo off
cd /d "%~dp0.."
python tools\sync_embedding_gemma_models.py --upload-r2
cmd /k
