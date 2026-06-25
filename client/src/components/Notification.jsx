import React from 'react';

export default function Notification({ message, type, onClose }) {
  var icon = type === 'success' ? '\u2714 ' : type === 'error' ? '\u2718 ' : '\u2139 ';
  var bg = type === 'success' ? '#2e7d32' : type === 'error' ? '#c62828' : '#1a73e8';
  return (
    <div className="notification" style={{ background: bg }} onClick={onClose}>
      <span style={{ fontWeight: 'bold' }}>{icon}</span>
      {message}
      <span style={{ marginLeft: '1rem', cursor: 'pointer', opacity: 0.7 }}>x</span>
    </div>
  );
}
