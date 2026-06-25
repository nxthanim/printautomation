import React, { useState, useRef } from 'react';

var API = window.api || { getPrinters: function() { return Promise.resolve([]); }, getTempDir: function() { return Promise.resolve(''); }, saveFile: function() { return Promise.resolve(null); }, printPdf: function() { return Promise.resolve({ success: false, error: 'API not available' }); } };

export default function PrintPreview() {
  var [file, setFile] = useState(null);
  var [previewUrl, setPreviewUrl] = useState(null);
  var iframeRef = useRef();
  var [selectedPrinter, setSelectedPrinter] = useState('');
  var [printers, setPrinters] = useState([]);

  var handleFile = async function(e) {
    var f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    var p = await API.getPrinters();
    setPrinters(Array.isArray(p) ? p : []);
    if (p.length > 0) setSelectedPrinter(p[0].Name || p[0].name);
  };

  var handlePrint = async function() {
    if (!file || !selectedPrinter) return;
    var tmpDir = await API.getTempDir();
    var pdfPath = tmpDir + '/preview_' + Date.now() + '.pdf';
    var buffer = await file.arrayBuffer();
    await API.saveFile({ destPath: pdfPath, buffer: buffer });
    var result = await API.printPdf({ pdfPath: pdfPath, printerName: selectedPrinter });
    if (result.success) alert('Print job sent successfully');
    else alert('Print failed: ' + (result.error || 'Unknown error'));
  };

  return (
    <div className="card">
      <h2>Print Preview</h2>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label>Select PDF <input type="file" accept=".pdf" onChange={handleFile} /></label>
        <label>Printer
          <select value={selectedPrinter} onChange={function(e) { setSelectedPrinter(e.target.value); }} style={{ width: 250 }}>
            {printers.map(function(p, i) { return <option key={i} value={p.Name || p.name}>{p.Name || p.name}</option>; })}
          </select>
        </label>
        <button className="btn btn-success" onClick={handlePrint} disabled={!file}>Send to Printer</button>
      </div>
      {previewUrl ? (
        <iframe ref={iframeRef} src={previewUrl} style={{ width: '100%', height: '70vh', border: '1px solid var(--border)', borderRadius: 6 }} title="Preview" />
      ) : null}
    </div>
  );
}
