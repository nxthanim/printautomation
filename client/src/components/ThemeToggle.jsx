import React from 'react';

export default function ThemeToggle({ dark, setDark }) {
  return (
    <button className="btn" onClick={() => setDark(!dark)} style={{ marginLeft: 'auto' }}>
      {dark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
