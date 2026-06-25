import React, { useState } from 'react';

export default function FieryConfig({ ip, port, defaultPaper, onConfirm, onCancel }) {
  var [paper, setPaper] = useState(defaultPaper || 'A4');
  var [copies, setCopies] = useState('1');
  var [color, setColor] = useState('false');
  var [orientation, setOrientation] = useState('portrait');
  var [duplex, setDuplex] = useState('off');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 99999
    }}>
      <div className="card" style={{ width: 420, maxWidth: '90vw', padding: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Send to Fiery {ip}:{port}</h2>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label>Paper Size
            <select value={paper} onChange={function(e) { setPaper(e.target.value); }}>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
              <option value="A5">A5</option>
            </select>
          </label>
          <label>Copies
            <input type="number" min="1" max="999" value={copies}
              onChange={function(e) { setCopies(e.target.value); }} />
          </label>
          <label>Color Mode
            <select value={color} onChange={function(e) { setColor(e.target.value); }}>
              <option value="false">Black & White</option>
              <option value="true">Full Color</option>
            </select>
          </label>
          <label>Orientation
            <select value={orientation} onChange={function(e) { setOrientation(e.target.value); }}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label>Duplex
            <select value={duplex} onChange={function(e) { setDuplex(e.target.value); }}>
              <option value="off">Single Sided</option>
              <option value="on">Double Sided</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn btn-danger" onClick={onCancel}>Cancel</button>
          <button className="btn btn-success" onClick={function() {
            onConfirm({ paper: paper, copies: copies, color: color, orientation: orientation, duplex: duplex });
          }}>Send to Fiery</button>
        </div>
      </div>
    </div>
  );
}
