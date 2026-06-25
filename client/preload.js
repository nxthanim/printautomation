const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  detectFiery: () => ipcRenderer.invoke('detect-fiery'),
  printPdf: (data) => ipcRenderer.invoke('print-pdf', data),
  downloadFile: (data) => ipcRenderer.invoke('download-file', data),
  calculateCost: (data) => ipcRenderer.invoke('calculate-cost', data),
  sendEmail: (data) => ipcRenderer.invoke('send-email', data),
  showNotification: (data) => ipcRenderer.invoke('show-notification', data),
  generateReceiptPdf: (data) => ipcRenderer.invoke('generate-receipt-pdf', data),
  openFile: (data) => ipcRenderer.invoke('open-file', data),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  printRawToIp: (data) => ipcRenderer.invoke('print-raw-to-ip', data),
});
