# Print Automation Client (Electron + React)

## Prerequisites
- Node.js 18+ (https://nodejs.org)
- SumatraPDF.exe in `tools/` directory (for PDF printing)

## Install dependencies

```powershell
cd client
npm install
```

## Run for development

```powershell
npm run webpack
npm start
```

## Package into installer exe

```powershell
npm run build
```

The installer will be at `dist/Print Automation Client Setup x.x.x.exe`.

## Features
- **Dashboard** — live printer status, pending jobs, job history
- **Fiery detection** — auto-detects EFI Fiery print controllers
- **Print Preview** — view PDF before printing
- **Cost Calculator** — estimate print costs (B/W vs color, A4 vs A3)
- **Email notifications** — configure notification email in Settings
- **Auto-retry** — failed jobs retry up to 3 times
- **Dark mode** — toggle in header
- **Offline cache** — SQLite-based job status caching

## Quick Start
1. Start the server (`uvicorn main:app` on your Ubuntu machine)
2. Launch this app
3. Enter server URL and API token in the top bar
4. Click Register
5. Submit orders or print directly
