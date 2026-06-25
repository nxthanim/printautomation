import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import CostCalculator from './components/CostCalculator';
import PrintPreview from './components/PrintPreview';
import Settings from './components/Settings';
import ReceiptForm from './components/ReceiptForm';
import Notification from './components/Notification';
import ThemeToggle from './components/ThemeToggle';
import SetupWizard from './components/SetupWizard';

const pages = ['Dashboard', 'Cost Calculator', 'Print Preview', 'Settings', 'Receipt'];

export default function App() {
  var [setupComplete, setSetupComplete] = useState(localStorage.getItem('setupComplete') === 'true');
  const [page, setPage] = useState('Dashboard');
  const [dark, setDark] = useState(false);
  const [notif, setNotif] = useState(null);

  if (!setupComplete) {
    return <SetupWizard onComplete={function() { setSetupComplete(true); }} />;
  }

  useEffect(() => {
    document.body.className = dark ? 'dark' : 'light';
  }, [dark]);

  const notify = (message, type = 'info') => {
    setNotif({ message, type });
    var delay = type === 'success' ? 8000 : 4000;
    setTimeout(function() { setNotif(null); }, delay);
  };

  const renderPage = () => {
    switch (page) {
      case 'Dashboard': return <Dashboard notify={notify} />;
      case 'Cost Calculator': return <CostCalculator />;
      case 'Print Preview': return <PrintPreview />;
      case 'Settings': return <Settings notify={notify} />;
      case 'Receipt': return <ReceiptForm notify={notify} />;
      default: return <Dashboard notify={notify} />;
    }
  };

  return (
    <div className={`app ${dark ? 'dark' : ''}`}>
      <header className="app-header">
        <h1>Print Automation</h1>
        <nav className="nav-links">
          {pages.map(p => (
            <button key={p} className={`nav-btn ${page === p ? 'active' : ''}`}
              onClick={() => setPage(p)}>{p}</button>
          ))}
        </nav>
        <ThemeToggle dark={dark} setDark={setDark} />
      </header>
      <main className="app-main">{renderPage()}</main>
      {notif && <Notification message={notif.message} type={notif.type} onClose={() => setNotif(null)} />}
    </div>
  );
}
