@echo off
cd /d "C:\Users\Binary11\AppData\Local\Temp\opencode\print-automation\server"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 > server.log 2>&1
