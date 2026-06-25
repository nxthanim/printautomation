import React, { useState, useEffect, useCallback } from 'react';
import FieryConfig from './FieryConfig';

var API = window.api || { getPrinters: function() { return Promise.resolve([]); }, detectFiery: function() { return Promise.resolve([]); }, getTempDir: function() { return Promise.resolve(''); }, saveFile: function() { return Promise.resolve(null); }, downloadFile: function() { return Promise.resolve({ success: false }); }, printPdf: function() { return Promise.resolve({ success: false, error: 'API not available' }); }, printRawToIp: function() { return Promise.resolve({ success: false, error: 'API not available' }); }, sendToPrinter: function() { return Promise.resolve({ success: false, error: 'API not available' }); }, getStatus: function() { return Promise.resolve({ status: 'unknown' }); }, registerToken: function() { return Promise.reject('API not available'); }, testConnection: function() { return Promise.reject('API not available'); }, calculateCost: function() { return Promise.resolve({ cost: 0, breakdown: {} }); }, generateReceiptPdf: function() { return Promise.resolve({ success: false, error: 'API not available' }); } };

export default function Dashboard({ notify }) {
  const [printers, setPrinters] = useState([]);
  const [fieryPrinters, setFieryPrinters] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState([]);
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('serverUrl') || 'https://print-automation.local');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [clientId, setClientId] = useState(localStorage.getItem('clientId') || '');
  const [form, setForm] = useState({ customerName: '', customerTin: '', customerReg: '', customerPhone: '', paperSize: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [fieryIp, setFieryIp] = useState(localStorage.getItem('fieryIp') || '');
  const [fieryPort, setFieryPort] = useState(localStorage.getItem('fieryPort') || '9100');
  const [fieryList, setFieryList] = useState(JSON.parse(localStorage.getItem('fieryList') || '[]'));
  var defaultPaper = localStorage.getItem('paperSize') || 'A4';
  var [fieryTarget, setFieryTarget] = useState(null);

  const fetchPrinters = useCallback(async () => {
    const p = await API.getPrinters();
    setPrinters(Array.isArray(p) ? p : []);
    const f = await API.detectFiery();
    setFieryPrinters(Array.isArray(f) ? f : []);
  }, []);

  const fetchJobs = useCallback(async () => {
    if (!clientId || !token || !serverUrl) return;
    try {
      const res = await fetch(serverUrl + '/api/jobs/pending?client_id=' + clientId, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) setJobs(await res.json());
    } catch {}
  }, [clientId, token, serverUrl]);

  useEffect(function() {
    fetchPrinters();
    fetchJobs();
    var i1 = setInterval(fetchPrinters, 30000);
    var i2 = setInterval(fetchJobs, 15000);
    return function() { clearInterval(i1); clearInterval(i2); };
  }, [fetchPrinters, fetchJobs]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    if (!clientId) return;
    setStatus('Connected - ' + jobs.length + ' pending jobs');
  }, [clientId, jobs]);

  const register = async () => {
    try {
      const p = await API.getPrinters();
      const names = (Array.isArray(p) ? p : []).map(function(x) { return x.Name || x.name; }).filter(Boolean);
      const res = await fetch(serverUrl + '/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: 'ElectronClient', api_token: token, printers: names }),
      });
      if (res.ok) {
        const data = await res.json();
        setClientId(data.client_id);
        localStorage.setItem('clientId', data.client_id);
        setStatus('Registered successfully');
        notify('Registered with server', 'success');
      } else notify('Registration failed', 'error');
    } catch (e) { notify('Server unreachable', 'error'); }
  };

  const submitOrder = async (e) => {
    e.preventDefault();
    if (!selectedFile) { notify('Select a PDF file', 'error'); return; }
    var fd = new FormData();
    fd.append('customer_name', form.customerName);
    fd.append('customer_tin', form.customerTin);
    fd.append('customer_registration', form.customerReg);
    fd.append('customer_phone', form.customerPhone);
    fd.append('pdf', selectedFile);
    try {
      var res = await fetch(serverUrl + '/api/orders', { method: 'POST', body: fd });
      if (res.ok) {
        notify('Order submitted', 'success');
        setForm({ customerName: '', customerTin: '', customerReg: '', customerPhone: '' });
        setSelectedFile(null);
        setTimeout(fetchJobs, 1000);
      } else notify('Order failed', 'error');
    } catch { notify('Server error', 'error'); }
  };

  const printPending = async () => {
    var tmpDir = await API.getTempDir();
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      setStatus('Printing job ' + job.job_id.slice(0, 8) + '...');
      var pdfPath = tmpDir + '/print_' + job.job_id + '.pdf';
      var dl = await API.downloadFile({ url: job.pdf_url, destPath: pdfPath, token: token, serverUrl: serverUrl });
      if (!dl.success) { notify('Download failed: ' + job.job_id, 'error'); continue; }
      var pr = await API.printPdf({ pdfPath: pdfPath, printerName: job.printer_name, paperSize: defaultPaper });
      if (pr.success) {
        await fetch(serverUrl + '/api/jobs/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ job_id: job.job_id, status: 'completed', message: 'Printed via Electron' }),
        });
        notify('Job ' + job.job_id.slice(0, 8) + ' completed', 'success');
        setHistory(function(h) { return [{ jobId: job.job_id, orderId: job.order_id, printer: job.printer_name, status: 'Completed', time: new Date().toLocaleTimeString() }].concat(h); });
      } else notify('Print failed: ' + job.job_id, 'error');
    }
    setStatus('Ready');
    fetchJobs();
  };

  const pickAndPrint = async function(printerName) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var fileName = file.name;
      var tmpDir = await API.getTempDir();
      var pdfPath = tmpDir + '/print_' + Date.now() + '.pdf';
      var buffer = await file.arrayBuffer();
      notify('Sending ' + fileName + ' to ' + printerName + '...', 'info');
      await API.saveFile({ destPath: pdfPath, buffer: buffer });
      var result = await API.printPdf({ pdfPath: pdfPath, printerName: printerName, paperSize: defaultPaper });
      if (result.success) notify(fileName + ' printed on ' + printerName, 'success');
      else notify(fileName + ' failed: ' + result.error, 'error');
    };
    input.click();
  };

  var sendToFiery = async function(file, ip, port, opts) {
    var fileName = file.name;
    var tmpDir = await API.getTempDir();
    var pdfPath = tmpDir + '/fiery_' + Date.now() + '.pdf';
    var buffer = await file.arrayBuffer();
    var cfg = opts.copies + 'x ' + opts.paper + ' ' + (opts.color === 'true' ? 'Color' : 'B/W') + ' ' + opts.orientation + ' ' + (opts.duplex === 'on' ? 'Duplex' : 'Single');
    notify('Sending ' + fileName + ' (' + cfg + ') to ' + ip + ':' + port + '...', 'info');
    await API.saveFile({ destPath: pdfPath, buffer: buffer });
    var result = await API.printRawToIp({
      filePath: pdfPath, ip: ip, port: port,
      paper: opts.paper, copies: opts.copies, color: opts.color,
      orientation: opts.orientation, duplex: opts.duplex
    });
    if (result.success) notify(fileName + ' done (' + (result.message || cfg) + ')', 'success');
    else notify(fileName + ' failed: ' + result.error, 'error');
  };

  const pickAndPrintIp = async function(ip, port) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async function(e) {
      var file = e.target.files[0];
      if (!file) return;
      setFieryTarget({ file: file, ip: ip, port: port });
    };
    input.click();
  };

  const addFieryIp = function() {
    if (!fieryIp) return;
    var entry = { ip: fieryIp, port: fieryPort || '9100', id: Date.now() };
    var updated = fieryList.concat([entry]);
    setFieryList(updated);
    localStorage.setItem('fieryList', JSON.stringify(updated));
    setFieryIp('');
    notify('Added Fiery ' + fieryIp + ':' + (fieryPort || '9100'), 'success');
  };

  const removeFieryIp = function(id) {
    var updated = fieryList.filter(function(f) { return f.id !== id; });
    setFieryList(updated);
    localStorage.setItem('fieryList', JSON.stringify(updated));
  };

  var statusMap = { 2: 'idle', 3: 'busy', 4: 'offline' };
  var labelMap = { 2: 'Idle', 3: 'Printing', 4: 'Offline' };
  var hasFiery = fieryPrinters.length > 0;

  return (
    <div>
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{status}</span>
        <input value={serverUrl} onChange={function(e) { setServerUrl(e.target.value); localStorage.setItem('serverUrl', e.target.value); }}
          placeholder="Server URL" style={{ width: 260 }} />
        <input value={token} onChange={function(e) { setToken(e.target.value); localStorage.setItem('token', e.target.value); }}
          placeholder="API Token" type="password" style={{ width: 200 }} />
        <button className="btn" onClick={register}>Register</button>
        <button className="btn btn-success" onClick={printPending} disabled={jobs.length === 0}>Print All ({jobs.length})</button>
      </div>

      <div className="card">
        <h2>New Order</h2>
        <form onSubmit={submitOrder} className="form-grid">
          <label>Customer Name <input value={form.customerName} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { customerName: e.target.value }); }); }} required /></label>
          <label>TIN <input value={form.customerTin} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { customerTin: e.target.value }); }); }} /></label>
          <label>Registration <input value={form.customerReg} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { customerReg: e.target.value }); }); }} /></label>
          <label>Phone <input value={form.customerPhone} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { customerPhone: e.target.value }); }); }} /></label>
          <label>Paper Size
            <select value={defaultPaper} onChange={function(e) { localStorage.setItem('paperSize', e.target.value); }}>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
            </select>
          </label>
          <label>PDF <input type="file" accept=".pdf" onChange={function(e) { setSelectedFile(e.target.files[0]); }} required /></label>
          <button className="btn" type="submit">Submit Order</button>
        </form>
      </div>

      <div className="card">
        <h2>Printers {hasFiery ? <span className="fiery-badge">Fiery Detected</span> : null}</h2>
        <div className="grid">
          {printers.map(function(p, i) {
            var name = p.Name || p.name || p.PrinterName || 'Unknown';
            var st = statusMap[p.PrinterStatus] || 'idle';
            var lb = labelMap[p.PrinterStatus] || 'Idle';
            return (
              <div key={i} className="printer-card">
                <h3>{name}</h3>
                <span className={'status-badge status-' + st}>{lb}</span>
                <button className="btn" style={{ marginTop: '0.5rem', width: '100%' }} onClick={function() { pickAndPrint(name); }}>Print to this</button>
              </div>
            );
          })}
        </div>
        {hasFiery ? (
          <div>
            <h3 style={{ marginTop: '1rem', color: '#ff6f00' }}>Detected Fiery Printers</h3>
            <div className="grid">
              {fieryPrinters.map(function(p, i) {
                return (
                  <div key={i} className="printer-card" style={{ borderColor: '#ff6f00' }}>
                    <h3>{p.Name} <span className="fiery-badge">Fiery</span></h3>
                    <small>{p.DriverName} - {p.PortName}</small>
                    <button className="btn" style={{ marginTop: '0.5rem', width: '100%', background: '#ff6f00' }} onClick={function() { pickAndPrint(p.Name); }}>Send to Fiery</button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <h3 style={{ marginTop: '1rem' }}>Fiery by IP Address</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: 2, minWidth: 180 }}>IP Address
            <input value={fieryIp} onChange={function(e) { setFieryIp(e.target.value); }} placeholder="192.168.1.100" />
          </label>
          <label style={{ flex: 1, minWidth: 80 }}>Port
            <input value={fieryPort} onChange={function(e) { setFieryPort(e.target.value); }} placeholder="9100" />
          </label>
          <button className="btn" onClick={addFieryIp} style={{ height: 36 }}>+ Add Fiery</button>
        </div>
        {fieryList.length > 0 ? (
          <div className="grid" style={{ marginTop: '0.75rem' }}>
            {fieryList.map(function(f) {
              return (
                <div key={f.id} className="printer-card" style={{ borderColor: '#ff6f00' }}>
                  <h3>{f.ip}:{f.port} <span className="fiery-badge">IP</span></h3>
                  <button className="btn" style={{ width: '100%', background: '#ff6f00', marginTop: '0.5rem' }}
                    onClick={function() { pickAndPrintIp(f.ip, f.port); }}>Send File</button>
                  <button className="btn btn-danger" style={{ width: '100%', marginTop: '0.25rem' }}
                    onClick={function() { removeFieryIp(f.id); }}>Remove</button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2>Pending Jobs ({jobs.length})</h2>
        <table><thead><tr><th>Job ID</th><th>Order ID</th><th>Printer</th><th>Status</th></tr></thead>
          <tbody>{jobs.map(function(j, i) {
            return (
              <tr key={i}><td>{j.job_id ? j.job_id.slice(0, 8) : ''}</td><td>{j.order_id ? j.order_id.slice(0, 8) : ''}</td><td>{j.printer_name}</td><td>Pending</td></tr>
            );
          })}</tbody></table>
      </div>

      <div className="card">
        <h2>Job History</h2>
        <table><thead><tr><th>Job ID</th><th>Order</th><th>Printer</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>{history.map(function(h, i) {
            return (
              <tr key={i}><td>{h.jobId ? h.jobId.slice(0, 8) : ''}</td><td>{h.orderId ? h.orderId.slice(0, 8) : ''}</td><td>{h.printer}</td><td>{h.status}</td><td>{h.time}</td></tr>
            );
          })}</tbody></table>
      </div>
      {fieryTarget ? (
        <FieryConfig
          ip={fieryTarget.ip}
          port={fieryTarget.port}
          defaultPaper={defaultPaper}
          onConfirm={function(opts) {
            sendToFiery(fieryTarget.file, fieryTarget.ip, fieryTarget.port, opts);
            setFieryTarget(null);
          }}
          onCancel={function() { setFieryTarget(null); }}
        />
      ) : null}
    </div>
  );
}
