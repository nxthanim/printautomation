const fs = require('fs');
const path = require('path');

let cachePath;

function initDatabase() {
  const userData = process.env.APPDATA || require('os').tmpdir();
  cachePath = path.join(userData, 'PrintAutomationClient', 'cache.json');
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(cachePath)) fs.writeFileSync(cachePath, JSON.stringify({ pending: [], history: [] }));
}

function read() {
  try { return JSON.parse(fs.readFileSync(cachePath, 'utf8')); }
  catch { return { pending: [], history: [] }; }
}

function write(data) {
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
}

function storeJobStatus(jobId, status) {
  const data = read();
  const existing = data.pending.findIndex(j => j.jobId === jobId);
  if (existing >= 0) data.pending[existing].status = status;
  else data.pending.push({ jobId, status, createdAt: new Date().toISOString() });
  write(data);
}

function getPendingJobs() { return read().pending; }

function deletePendingJob(jobId) {
  const data = read();
  data.pending = data.pending.filter(j => j.jobId !== jobId);
  write(data);
}

function addHistory(jobId, orderId, printer, status) {
  const data = read();
  data.history.unshift({ jobId, orderId, printer, status, time: new Date().toISOString() });
  if (data.history.length > 100) data.history = data.history.slice(0, 100);
  write(data);
}

function getHistory() { return read().history; }

module.exports = { initDatabase, storeJobStatus, getPendingJobs, deletePendingJob, addHistory, getHistory };
