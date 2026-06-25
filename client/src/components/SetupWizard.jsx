import React, { useState, useEffect } from 'react';

var API = window.api || { getPrinters: function() { return Promise.resolve([]); }, detectFiery: function() { return Promise.resolve([]); } };

function generateToken() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var result = '';
  for (var i = 0; i < 24; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export default function SetupWizard({ onComplete }) {
  var [step, setStep] = useState(0);
  var [serverUrl, setServerUrl] = useState('http://localhost:8000');
  var [apiToken, setApiToken] = useState(generateToken());
  var [status, setStatus] = useState('');
  var [error, setError] = useState('');
  var [loading, setLoading] = useState(false);
  var [printers, setPrinters] = useState([]);

  useEffect(function() {
    API.getPrinters().then(function(p) {
      setPrinters(Array.isArray(p) ? p : []);
    });
  }, []);

  var testConnection = async function() {
    setLoading(true);
    setError('');
    try {
      var res = await fetch(serverUrl + '/api/health');
      if (res.ok) {
        setStatus('Server reachable!');
        return true;
      }
      setError('Server returned status ' + res.status);
      return false;
    } catch (e) {
      setError('Cannot reach server at ' + serverUrl);
      return false;
    } finally {
      setLoading(false);
    }
  };

  var register = async function() {
    setLoading(true);
    setError('');
    try {
      var names = printers.map(function(x) { return x.Name || x.name; }).filter(Boolean);
      var res = await fetch(serverUrl + '/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: 'ElectronClient', api_token: apiToken, printers: names }),
      });
      if (res.ok) {
        var data = await res.json();
        setStatus('Registered! Client ID: ' + data.client_id.slice(0, 8) + '...');
        localStorage.setItem('serverUrl', serverUrl);
        localStorage.setItem('token', apiToken);
        localStorage.setItem('clientId', data.client_id);
        localStorage.setItem('setupComplete', 'true');
        return true;
      }
      var errData = await res.text();
      setError('Registration failed: ' + errData);
      return false;
    } catch (e) {
      setError('Registration error: ' + e.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  var nextStep = async function() {
    if (step === 0) {
      var ok = await testConnection();
      if (ok) setStep(1);
    } else if (step === 1) {
      var ok = await register();
      if (ok) setStep(2);
    }
  };

  var steps = [
    { title: 'Server Connection', icon: '🔌' },
    { title: 'Registration', icon: '🔑' },
    { title: 'Complete', icon: '✅' },
  ];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '2.5rem', width: 500, maxWidth: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🖨️</div>
          <h1 style={{ fontSize: '1.5rem', color: '#1a73e8', margin: 0 }}>Print Automation</h1>
          <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem' }}>First-time setup wizard</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', justifyContent: 'center' }}>
          {steps.map(function(s, i) {
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.8rem', borderRadius: 20,
                background: i === step ? '#1a73e8' : (i < step ? '#e8f5e9' : '#f0f0f0'),
                color: i === step ? '#fff' : (i < step ? '#2e7d32' : '#999'),
                fontSize: '0.8rem', fontWeight: 600
              }}>
                <span>{s.icon}</span>
                <span>{s.title}</span>
              </div>
            );
          })}
        </div>

        {step === 0 ? (
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#333' }}>Connect to Server</h2>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
              Enter the URL of your Print Automation server. If running locally, use <strong>http://localhost:8000</strong>
            </p>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#333' }}>
              Server URL
              <input value={serverUrl} onChange={function(e) { setServerUrl(e.target.value); setError(''); }}
                placeholder="http://localhost:8000"
                style={{ marginTop: '0.3rem', padding: '0.6rem', fontSize: '0.9rem', border: '2px solid #e0e0e0', borderRadius: 8, width: '100%' }} />
            </label>
          </div>
        ) : step === 1 ? (
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#333' }}>Register This Client</h2>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
              An API token will be used to authenticate this client with the server.
            </p>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#333' }}>
              API Token
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                <input value={apiToken} onChange={function(e) { setApiToken(e.target.value); }}
                  style={{ flex: 1, padding: '0.6rem', fontSize: '0.9rem', border: '2px solid #e0e0e0', borderRadius: 8, fontFamily: 'monospace' }} />
                <button onClick={function() { setApiToken(generateToken()); }}
                  style={{ padding: '0.5rem 1rem', background: '#f0f0f0', border: '2px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', fontSize: '1.1rem' }}
                  title="Generate new token">🔄</button>
              </div>
            </label>
            <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
              {printers.length} printer(s) detected on this machine
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.1rem', color: '#2e7d32', marginBottom: '0.5rem' }}>Setup Complete!</h2>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
              Your client is connected to the server and ready to use.
            </p>
            <div style={{
              background: '#e8f5e9', borderRadius: 8, padding: '0.75rem', fontSize: '0.8rem', color: '#2e7d32', textAlign: 'left'
            }}>
              <div><strong>Server:</strong> {serverUrl}</div>
              <div><strong>Token:</strong> {apiToken.slice(0, 12)}...</div>
              <div><strong>Printers:</strong> {printers.length} detected</div>
            </div>
          </div>
        )}

        {status ? (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#e8f5e9', borderRadius: 6, fontSize: '0.8rem', color: '#2e7d32' }}>
            {status}
          </div>
        ) : null}
        {error ? (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#ffebee', borderRadius: 6, fontSize: '0.8rem', color: '#c62828' }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          {step < 2 ? (
            <button onClick={nextStep} disabled={loading}
              style={{
                background: loading ? '#ccc' : '#1a73e8', color: '#fff', border: 'none',
                padding: '0.6rem 1.5rem', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem', fontWeight: 600
              }}>
              {loading ? 'Please wait...' : (step === 0 ? 'Test Connection' : 'Register')}
            </button>
          ) : (
            <button onClick={onComplete}
              style={{
                background: '#2e7d32', color: '#fff', border: 'none',
                padding: '0.6rem 1.5rem', borderRadius: 8, cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 600
              }}>
              Start Using Print Automation
            </button>
          )}
          {step > 0 && step < 2 ? (
            <button onClick={function() { setStep(step - 1); setError(''); setStatus(''); }}
              style={{ background: 'transparent', color: '#666', border: '1px solid #ddd', padding: '0.6rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
              Back
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
