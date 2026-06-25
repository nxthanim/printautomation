import React, { useState } from 'react';

var API = window.api || {};

export default function Settings({ notify }) {
  var [serverUrl, setServerUrl] = useState(localStorage.getItem('serverUrl') || 'http://localhost:8000');
  var [token, setToken] = useState(localStorage.getItem('token') || '');
  var [sumatraPath, setSumatraPath] = useState(localStorage.getItem('sumatraPath') || '');
  var [email, setEmail] = useState(localStorage.getItem('emailTo') || '');
  var [emailEnabled, setEmailEnabled] = useState(localStorage.getItem('emailEnabled') === 'true');
  var [paperSize, setPaperSize] = useState(localStorage.getItem('paperSize') || 'A4');
  var [pollRate, setPollRate] = useState(localStorage.getItem('pollRate') || '1000');
  var [retryCount, setRetryCount] = useState(localStorage.getItem('retryCount') || '3');

  var save = function() {
    localStorage.setItem('serverUrl', serverUrl);
    localStorage.setItem('token', token);
    localStorage.setItem('sumatraPath', sumatraPath);
    localStorage.setItem('emailTo', email);
    localStorage.setItem('emailEnabled', emailEnabled ? 'true' : 'false');
    localStorage.setItem('paperSize', paperSize);
    localStorage.setItem('pollRate', pollRate);
    localStorage.setItem('retryCount', retryCount);
    notify('Settings saved - restart app for poll rate change', 'success');
  };

  return (
    <div className="card" style={{ maxWidth: 600 }}>
      <h2>Settings</h2>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
        <label>Server URL <input value={serverUrl} onChange={function(e) { setServerUrl(e.target.value); }} placeholder="http://localhost:8000" /></label>
        <label>API Token <input value={token} onChange={function(e) { setToken(e.target.value); }} type="password" /></label>
        <label>SumatraPDF Path <input value={sumatraPath} onChange={function(e) { setSumatraPath(e.target.value); }} placeholder="tools/SumatraPDF.exe" /></label>
        <label>Default Paper Size
          <select value={paperSize} onChange={function(e) { setPaperSize(e.target.value); }}>
            <option value="">Printer Default</option>
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="Letter">Letter</option>
            <option value="Legal">Legal</option>
            <option value="A5">A5</option>
          </select>
        </label>
        <label>Poll Rate (ms) <input value={pollRate} onChange={function(e) { setPollRate(e.target.value); }} type="number" min="200" placeholder="1000" /></label>
        <label>Auto-Retry Count <input value={retryCount} onChange={function(e) { setRetryCount(e.target.value); }} type="number" min="0" max="10" placeholder="3" /></label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={emailEnabled} onChange={function(e) { setEmailEnabled(e.target.checked); }} style={{ width: 'auto' }} />
          Enable Email Notifications
        </label>
        {emailEnabled ? (
          <label>Notification Email <input value={email} onChange={function(e) { setEmail(e.target.value); }} type="email" placeholder="admin@example.com" /></label>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={save}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
