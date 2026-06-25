const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const os = require('os');
const url = require('url');
const { execSync, exec, spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');

var mainWindow;

// Prevent multiple instances — kills GPU cache conflicts
var gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

app.on('second-instance', function() {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});

// Use a dedicated userData folder to avoid "Unable to move cache" errors
app.setPath('userData', path.join(app.getPath('appData'), 'PrintAutomationClient'));

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  // Actually close the window (no hide) — simplifies cleanup
  mainWindow.on('close', function() { mainWindow = null; });
}

app.whenReady().then(function() {
  createWindow();
});

app.on('window-all-closed', function() { app.quit(); });

var psCache = {};
function runPowerShell(script) {
  return new Promise(function(resolve) {
    try {
      var key = script.slice(0, 64).replace(/[^a-zA-Z0-9]/g, '_');
      if (!psCache[key]) {
        var tmp = app.getPath('temp');
        psCache[key] = path.join(tmp, 'ps_' + key + '.ps1');
        // UTF8 BOM so PowerShell recognises the encoding
        fs.writeFileSync(psCache[key], '\ufeff' + script, 'utf8');
      }
      exec('powershell -NoProfile -ExecutionPolicy Bypass -File "' + psCache[key] + '"',
        { timeout: 30000, windowsHide: true },
        function(err, stdout) { resolve(stdout ? stdout.trim() : ''); }
      );
    } catch { resolve(''); }
  });
}

ipcMain.handle('get-printers', async () => {
  var out = await runPowerShell(
    'Get-Printer | Where-Object { $_.Name -notlike "*Microsoft*" -and $_.Name -notlike "*OneNote*" -and $_.Name -notlike "*XPS*" } | Select-Object Name, PrinterStatus, Location | ConvertTo-Json'
  );
  try { return JSON.parse(out); } catch { return []; }
});

ipcMain.handle('detect-fiery', async () => {
  var out = await runPowerShell(
    'Get-Printer | Where-Object { $_.DriverName -like "*Fiery*" -or $_.Name -like "*Fiery*" -or $_.Name -like "*EFI*" } | Select-Object Name, DriverName, PortName | ConvertTo-Json'
  );
  try { return JSON.parse(out); } catch { return []; }
});

function printViaSumatra(exe, pdfPath, printerName, paperSize) {
  return new Promise(function(resolve) {
    var args = ['-print-to', printerName, '-silent', '-exit-on-print'];
    if (paperSize) args.push('-print-settings', 'paper=' + paperSize);
    args.push(pdfPath);
    var proc = spawn(exe, args);
    proc.on('close', function(code) { resolve(code === 0 ? { success: true } : { success: false, error: 'SumatraPDF exited with code ' + code }); });
    proc.on('error', function(err) { resolve({ success: false, error: err.message }); });
  });
}

function printViaElectron(pdfPath, printerName, paperSize) {
  return new Promise(function(resolve) {
    var win = null;
    try {
      win = new BrowserWindow({ show: false, width: 800, height: 600 });
      var printed = false;
      function doPrint() {
        if (printed) return;
        printed = true;
        var opts = { silent: true, deviceName: printerName, printBackground: true };
        if (paperSize) opts.pageSize = paperSize;
        win.webContents.print(opts).then(function() {
          try { win.close(); } catch {}
          resolve({ success: true });
        }).catch(function(err) {
          try { win.close(); } catch {}
          resolve({ success: false, error: err.message });
        });
      }
      win.webContents.on('did-finish-load', function() { setTimeout(doPrint, 2000); });
      win.webContents.on('did-fail-load', function(event, code, desc) {
        if (!printed) { printed = true; try { win.close(); } catch {} resolve({ success: false, error: 'Load failed: ' + desc }); }
      });
      win.webContents.on('dom-ready', function() { setTimeout(doPrint, 2000); });
      var fileUrl = url.pathToFileURL(pdfPath).href;
      win.loadURL(fileUrl);
      setTimeout(function() {
        if (!printed) {
          try { win.close(); } catch {}
          resolve({ success: false, error: 'PDF print timed out. Use a Fiery IP or install SumatraPDF.' });
        }
      }, 30000);
    } catch (err) {
      if (win) try { win.close(); } catch {}
      resolve({ success: false, error: err.message });
    }
  });
}

var pdfViewerCache = null;
function findAnyPdfViewer() {
  if (pdfViewerCache) return pdfViewerCache;
  var candidates = [
    { exe: 'C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe', args: ['/t'] },
    { exe: 'C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe', args: ['/t'] },
    { exe: 'C:\\Program Files\\Adobe\\Acrobat 2020\\Acrobat\\Acrobat.exe', args: ['/t'] },
    { exe: 'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe', args: ['/t'] },
    { exe: 'C:\\Program Files\\Foxit Software\\Foxit Reader\\FoxitReader.exe', args: ['/t'] },
    { exe: 'C:\\Program Files (x86)\\Foxit Software\\Foxit Reader\\FoxitReader.exe', args: ['/t'] },
    { exe: 'C:\\Program Files\\Tracker Software\\PDF Viewer\\PDFXEdit.exe', args: ['/print'] },
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i].exe)) { pdfViewerCache = candidates[i]; return candidates[i]; }
  }
  return null;
}

function printViaViewer(viewer, pdfPath, printerName) {
  return new Promise(function(resolve) {
    var args = viewer.args.concat([pdfPath, printerName]);
    var proc = spawn(viewer.exe, args);
    proc.on('close', function(code) { resolve(code === 0 ? { success: true } : { success: false, error: 'PDF viewer exited with code ' + code }); });
    proc.on('error', function(err) { resolve({ success: false, error: err.message }); });
  });
}

ipcMain.handle('print-pdf', async (e, { pdfPath, printerName, paperSize, sumatraPath }) => {
  var sumatra = (sumatraPath && fs.existsSync(sumatraPath)) ? sumatraPath : findSumatra();
  if (sumatra) return await printViaSumatra(sumatra, pdfPath, printerName, paperSize);
  var viewer = findAnyPdfViewer();
  if (viewer) return await printViaViewer(viewer, pdfPath, printerName);
  return await printViaElectron(pdfPath, printerName, paperSize);
});

ipcMain.handle('download-file', async (e, { url, destPath, token, serverUrl }) => {
  return new Promise((resolve) => {
    const fullUrl = serverUrl.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '');
    const proto = fullUrl.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    proto.get(fullUrl, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      if (res.statusCode !== 200) { resolve({ success: false, error: `HTTP ${res.statusCode}` }); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve({ success: true }); });
    }).on('error', (e) => resolve({ success: false, error: e.message }));
  });
});

ipcMain.handle('calculate-cost', async (e, { pageCount, isColor, paperSize, copies }) => {
  const rates = { bw: 0.05, color: 0.25, a3surcharge: 0.10 };
  let cost = (isColor ? pageCount * rates.color : pageCount * rates.bw) * copies;
  if (paperSize === 'A3') cost += pageCount * copies * rates.a3surcharge;
  return { cost: Math.round(cost * 100) / 100, breakdown: { pageCount, isColor, paperSize, copies, unitPrice: isColor ? rates.color : rates.bw } };
});

ipcMain.handle('send-email', async (e, { to, subject, text }) => {
  try {
    const { execSync } = require('child_process');
    const script = `
      $smtp = New-Object Net.Mail.SmtpClient('localhost', 25);
      $smtp.Send('print-automation@local', '${to.replace(/'/g, "''")}', '${subject.replace(/'/g, "''")}', '${text.replace(/'/g, "''")}');
    `;
    execSync(`powershell -NoProfile -Command "${script}"`, { timeout: 10000 });
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('show-notification', async (e, { title, body }) => {
  new Notification({ title, body }).show();
});

ipcMain.handle('get-temp-dir', async () => require('os').tmpdir());

ipcMain.handle('save-file', async (e, { destPath, buffer }) => {
  try { fs.writeFileSync(destPath, Buffer.from(buffer)); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('print-raw-to-ip', async (e, { filePath, ip, port, paper, copies, color, orientation, duplex }) => {
  try {
    const net = require('net');
    var pdfData = fs.readFileSync(filePath);
    var ESC = '\u001b';
    var pjlPaper = paper || 'A4';
    var pjlCopies = copies || '1';
    var pjlOrient = (orientation === 'landscape') ? 'LANDSCAPE' : 'PORTRAIT';

    var pjlHeader = ESC + '%-12345X@PJL JOB NAME="PrintAutomation"\r\n';
    pjlHeader += '@PJL SET COPIES=' + pjlCopies + '\r\n';
    pjlHeader += '@PJL SET PAPER=' + pjlPaper + '\r\n';
    pjlHeader += '@PJL SET ORIENTATION=' + pjlOrient + '\r\n';
    if (duplex === 'on') pjlHeader += '@PJL SET DUPLEX=ON\r\n';
    pjlHeader += '@PJL ENTER LANGUAGE=PDF\r\n';

    var pjlFooter = '\r\n' + ESC + '%-12345X@PJL EOJ\r\n' + ESC + '%-12345X\r\n';

    var pjlPayload = Buffer.concat([
      Buffer.from(pjlHeader, 'ascii'),
      pdfData,
      Buffer.from(pjlFooter, 'ascii'),
    ]);

    var rawPayload = pdfData;

    function probePort(targetIp, targetPort, timeoutMs) {
      return new Promise(function(resolve) {
        var s = new net.Socket();
        var timer = setTimeout(function() { s.destroy(); resolve(false); }, timeoutMs);
        s.connect(targetPort, targetIp, function() {
          clearTimeout(timer);
          s.destroy();
          resolve(true);
        });
        s.on('error', function() { clearTimeout(timer); s.destroy(); resolve(false); });
      });
    }

    function sendPayload(payload, usePjl) {
      return new Promise(function(resolve) {
        var socket = new net.Socket();
        var totalSent = 0;
        var connTimer = setTimeout(function() {
          socket.destroy();
          resolve({ success: false, error: 'Connection timed out' });
        }, 30000);

        socket.connect(usedPort, ip, function() {
          clearTimeout(connTimer);
          var sendNext = function() {
            if (totalSent >= payload.length) {
              socket.end();
              return;
            }
            var chunkSize = 32768;
            var chunk = payload.slice(totalSent, totalSent + chunkSize);
            totalSent += chunk.length;
            var drained = socket.write(chunk);
            if (!drained) {
              socket.once('drain', sendNext);
            } else {
              setImmediate(sendNext);
            }
          };
          sendNext();
        });

        socket.on('end', function() {
          setTimeout(function() {
            socket.destroy();
            if (usePjl) resolve({ success: true, message: pjlCopies + 'x ' + pjlPaper + ' ' + (color === 'true' ? 'Color' : 'B/W') });
            else resolve({ success: true, message: 'Sent to ' + ip });
          }, 2000);
        });

        socket.on('error', function(err) {
          clearTimeout(connTimer);
          socket.destroy();
          resolve({ success: false, error: err.message, code: err.code });
        });
      });
    }

    var usedPort = parseInt(port);
    if (!usedPort) {
      var printPorts = [9100, 515, 631, 2501, 2000];
      for (var pi = 0; pi < printPorts.length; pi++) {
        var open = await probePort(ip, printPorts[pi], 3000);
        if (open) { usedPort = printPorts[pi]; break; }
      }
      if (!usedPort) return { success: false, error: 'No open print port found on ' + ip + ' (tried 9100, 515, 631, 2501, 2000)' };
    }

    var result = await sendPayload(pjlPayload, true);
    if (!result.success && (result.code === 'ECONNRESET' || (result.error && result.error.indexOf('reset') !== -1))) {
      result = await sendPayload(rawPayload, false);
    }
    return result;
  } catch (err) { return { success: false, error: err.message }; }
});

function findSumatra() {
  var localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  var progFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
  var progFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const candidates = [
    path.join(process.resourcesPath || __dirname, 'tools', 'SumatraPDF.exe'),
    path.join(__dirname, 'tools', 'SumatraPDF.exe'),
    'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
    path.join(progFilesX86, 'SumatraPDF', 'SumatraPDF.exe'),
    path.join(progFiles, 'SumatraPDF', 'SumatraPDF.exe'),
    path.join(localAppData, 'SumatraPDF', 'SumatraPDF.exe'),
    path.join(__dirname, '..', 'SumatraPDF.exe'),
  ];
  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  return null;
}

// ── Receipt Direct Print (no Sumatra needed) ──────────────────────
ipcMain.handle('generate-receipt-pdf', async (e, { companyName, tinNo, phoneNo, regNo, printerName }) => {
  try {
    var now = new Date();
    var dateStr = now.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    var recNo = 'RCP-' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');

    var esc = function(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
      '@page { margin: 10mm; }' +
      'body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; color: #222; }' +
      '.header { text-align: center; border-bottom: 2px solid #1a73e8; padding-bottom: 8px; margin-bottom: 12px; }' +
      '.header h1 { font-size: 20pt; color: #1a73e8; margin: 0; }' +
      '.header p { font-size: 9pt; color: #666; margin: 2px 0; }' +
      'table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }' +
      'td { padding: 4px 8px; border: 1px solid #ccc; font-size: 11pt; }' +
      'td.l { font-weight: bold; background: #f0f4ff; width: 120px; }' +
      '.items th { background: #1a73e8; color: #fff; padding: 5px 8px; font-size: 10pt; text-align: center; }' +
      '.items td { padding: 4px 8px; border: 1px solid #ccc; font-size: 11pt; }' +
      '.c { text-align: center; } .r { text-align: right; }' +
      '.ft { text-align: right; font-weight: bold; font-size: 13pt; border-top: 2px solid #333; padding-top: 5px; }' +
      '.ft s { color: #1a73e8; }' +
      '</style></head><body>' +
      '<div class="header"><h1>OFFICIAL RECEIPT</h1><p>No: ' + recNo + ' &nbsp;|&nbsp; Date: ' + dateStr + '</p></div>' +
      '<table><tr><td class="l">Company Name</td><td colspan="3">' + esc(companyName) + '</td></tr>' +
      '<tr><td class="l">TIN No</td><td>' + esc(tinNo) + '</td><td class="l">Phone No</td><td>' + esc(phoneNo) + '</td></tr>' +
      '<tr><td class="l">Reg No</td><td colspan="3">' + esc(regNo) + '</td></tr></table>' +
      '<table class="items"><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>' +
      '<tr><td class="c">1</td><td>Printing Services</td><td class="c">1</td><td class="r">0.00</td><td class="r">0.00</td></tr>' +
      '<tr><td class="c">2</td><td></td><td class="c"></td><td class="r"></td><td class="r"></td></tr>' +
      '<tr><td class="c">3</td><td></td><td class="c"></td><td class="r"></td><td class="r"></td></tr>' +
      '<tr><td class="c">4</td><td></td><td class="c"></td><td class="r"></td><td class="r"></td></tr>' +
      '<tr><td class="c">5</td><td></td><td class="c"></td><td class="r"></td><td class="r"></td></tr></table>' +
      '<div class="ft">Total Amount: <s>0.00</s></div>' +
      '</body></html>';

    var printResult = await new Promise(function(resolve, reject) {
      var win = new BrowserWindow({ show: false, width: 800, height: 600 });
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      var printed = false;
      function doPrint() {
        if (printed) return;
        printed = true;
        win.webContents.print({ silent: true, printBackground: true, printerName: printerName }).then(function() {
          win.close();
          resolve({ success: true });
        }).catch(function(err) {
          win.close();
          reject(err);
        });
      }
      win.webContents.on('did-finish-load', function() { setTimeout(doPrint, 200); });
      win.webContents.on('dom-ready', function() { setTimeout(doPrint, 200); });
      // fallback: print after 1s even if events don't fire
      setTimeout(doPrint, 1000);
    });

    return { success: true, receiptNo: recNo, printed: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('open-file', async (e, { filePath }) => {
  try {
    var err = await shell.openPath(filePath);
    if (err) return { success: false, error: err };
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

require('./src/utils/storage.js').initDatabase();
