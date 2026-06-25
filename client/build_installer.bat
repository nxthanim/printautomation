@echo off
cd /d "C:\Users\Binary11\AppData\Local\Temp\opencode\print-automation\client"
if exist dist_electron rmdir /s /q dist_electron
set CSC_IDENTITY_AUTO_DISCOVERY=false
set CSC_LINK=
set CSC_KEY_PASSWORD=
npx electron-builder --win --dir 2>&1
