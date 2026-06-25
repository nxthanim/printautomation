import React, { useState, useEffect } from 'react';

var API = window.api || { getPrinters: function() { return Promise.resolve([]); }, generateReceiptPdf: function() { return Promise.resolve({ success: false, error: 'API not available' }); } };

export default function ReceiptForm({ notify }) {
  const [companyName, setCompanyName] = useState('');
  const [tinNo, setTinNo] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [regNo, setRegNo] = useState('');
  const [busy, setBusy] = useState(false);
  var [receiptNo, setReceiptNo] = useState(null);
  var [printers, setPrinters] = useState([]);
  var [selectedPrinter, setSelectedPrinter] = useState('');

  useEffect(function() {
    API.getPrinters().then(function(p) {
      setPrinters(Array.isArray(p) ? p : []);
      if (p.length > 0) setSelectedPrinter(p[0].Name);
    });
  }, []);

  var handlePrint = async function() {
    if (!companyName || !tinNo || !phoneNo || !regNo) {
      notify('Please fill all fields', 'error');
      return;
    }
    if (!selectedPrinter) { notify('No printer selected', 'error'); return; }
    setBusy(true);
    try {
      var result = await API.generateReceiptPdf({ companyName, tinNo, phoneNo, regNo, printerName: selectedPrinter });
      if (!result.success) { notify('Error: ' + result.error, 'error'); setBusy(false); return; }
      notify('Receipt ' + result.receiptNo + ' sent to ' + selectedPrinter, 'success');
      setReceiptNo(result.receiptNo);
    } catch (err) { notify('Error: ' + err.message, 'error'); }
    setBusy(false);
  };

  var handleClear = function() {
    setCompanyName('');
    setTinNo('');
    setPhoneNo('');
    setRegNo('');
    setReceiptNo(null);
  };

  return (
    <div className="receipt-form-container">
      <h2>Print Receipt</h2>
      <p className="subtitle">Fill in the details and print directly to a local printer</p>
      <div className="receipt-form">
        <div className="form-group">
          <label>Company Name</label>
          <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
            placeholder="Enter company name" />
        </div>
        <div className="form-group">
          <label>TIN No</label>
          <input type="text" value={tinNo} onChange={e => setTinNo(e.target.value)}
            placeholder="Enter TIN number" />
        </div>
        <div className="form-group">
          <label>Phone No</label>
          <input type="text" value={phoneNo} onChange={e => setPhoneNo(e.target.value)}
            placeholder="Enter phone number" />
        </div>
        <div className="form-group">
          <label>Reg No</label>
          <input type="text" value={regNo} onChange={e => setRegNo(e.target.value)}
            placeholder="Enter registration number" />
        </div>
        <div className="form-group">
          <label>Printer</label>
          <select value={selectedPrinter} onChange={e => setSelectedPrinter(e.target.value)}>
            {printers.map(p => (
              <option key={p.Name} value={p.Name}>{p.Name}</option>
            ))}
          </select>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handlePrint} disabled={busy}>
            {busy ? 'Printing...' : 'Print Receipt'}
          </button>
          {receiptNo && <button className="btn btn-secondary" onClick={handleClear}>New Receipt</button>}
        </div>
      </div>
      {receiptNo && <div className="receipt-preview">
        <h3>Receipt Sent</h3>
        <table className="receipt-table">
          <thead>
            <tr><th colSpan="2">OFFICIAL RECEIPT</th></tr>
          </thead>
          <tbody>
            <tr><td className="label">Receipt No</td><td>{receiptNo}</td></tr>
            <tr><td className="label">Company Name</td><td>{companyName}</td></tr>
            <tr><td className="label">TIN No</td><td>{tinNo}</td></tr>
            <tr><td className="label">Phone No</td><td>{phoneNo}</td></tr>
            <tr><td className="label">Reg No</td><td>{regNo}</td></tr>
            <tr><td className="label">Printed To</td><td>{selectedPrinter}</td></tr>
          </tbody>
        </table>
      </div>}
    </div>
  );
}
