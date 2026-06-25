import React, { useState } from 'react';

var API = window.api || { calculateCost: function() { return Promise.resolve({ cost: 0, breakdown: {} }); } };
const RATES = { bw: 0.05, color: 0.25, a3: 0.10 };

export default function CostCalculator() {
  const [form, setForm] = useState({ pages: 1, color: false, paper: 'A4', copies: 1 });
  const [result, setResult] = useState(null);

  const calc = async () => {
    const r = await API.calculateCost({
      pageCount: parseInt(form.pages) || 1,
      isColor: form.color,
      paperSize: form.paper,
      copies: parseInt(form.copies) || 1,
    });
    setResult(r);
  };

  return (
    <div className="card">
      <h2>Job Cost Calculator</h2>
      <div className="form-grid">
        <label>Pages <input type="number" min="1" value={form.pages} onChange={e => setForm(f => ({ ...f, pages: e.target.value }))} /></label>
        <label>Copies <input type="number" min="1" value={form.copies} onChange={e => setForm(f => ({ ...f, copies: e.target.value }))} /></label>
        <label>Paper Size <select value={form.paper} onChange={e => setForm(f => ({ ...f, paper: e.target.value }))}>
          <option value="A4">A4</option><option value="A3">A3 (+$0.10/page)</option>
        </select></label>
        <label>Color <select value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value === 'true' }))}>
          <option value="false">Black & White ($0.05/page)</option><option value="true">Color ($0.25/page)</option>
        </select></label>
        <button className="btn" onClick={calc}>Calculate Cost</button>
      </div>
      {result && (
        <div className="cost-result">${result.cost}</div>
      )}
      {result && (
        <table><thead><tr><th>Pages</th><th>Color</th><th>Paper</th><th>Copies</th><th>Unit Price</th></tr></thead>
          <tbody><tr>
            <td>{result.breakdown.pageCount}</td>
            <td>{result.breakdown.isColor ? 'Color' : 'B/W'}</td>
            <td>{result.breakdown.paperSize}</td>
            <td>{result.breakdown.copies}</td>
            <td>${result.breakdown.unitPrice}</td>
          </tr></tbody></table>
      )}
    </div>
  );
}
