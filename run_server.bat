@echo off
title Print Automation Server
cd /d "%~dp0server"
echo Installing Python dependencies...
pip install -r requirements.txt
echo Starting Print Automation Server on http://localhost:8000
echo Press Ctrl+C to stop
python -m uvicorn main:app --host 127.0.0.1 --port 8000
pause
