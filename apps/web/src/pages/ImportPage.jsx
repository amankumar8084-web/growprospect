import { useState } from 'react';
import { useAuth } from '@clerk/react';

export default function ImportPage() {
  const { getToken } = useAuth();
  const [step, setStep] = useState(1);
  const [source, setSource] = useState('');
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [validationResult, setValidationResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const sources = [
    'Google Maps', 'LinkedIn', 'LinkedIn Jobs', 'Website', 'CSV / Excel', 'Manual',
    'Instagram', 'Facebook', 'Local Directories', 'IndiaMART', 'Clutch', 'Upwork', 'Fiverr', 'Wellfound'
  ];

  const handleSourceSelect = (src) => {
    setSource(src);
    setStep(2);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsProcessing(true);
    
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source', source);

      const res = await fetch(`${API_URL}/api/imports/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        setPreviewData(data.data);
        const initialMapping = data.data.suggestedMapping || {};
        data.data.headers.forEach(h => {
          if (initialMapping[h] === undefined) initialMapping[h] = '';
        });
        setMapping(initialMapping);
        setStep(3);
      } else {
        alert(data.message || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingChange = (header, systemField) => {
    setMapping(prev => ({ ...prev, [header]: systemField }));
  };

  const handleValidate = async () => {
    setIsProcessing(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));

      const res = await fetch(`${API_URL}/api/imports/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        setValidationResult(data.data);
        setStep(4);
      } else {
        alert(data.message || 'Validation failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error validating data');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    setIsProcessing(true);
    try {
      const token = await getToken();
      const payload = {
        source,
        filename: file.name,
        validRecords: validationResult.validRecords
      };

      const res = await fetch(`${API_URL}/api/imports/commit`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setValidationResult(prev => ({
          ...prev,
          commitResult: data.data
        }));
        setStep(5);
      } else {
        alert(data.message || 'Commit failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error committing data');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <h2>Import Leads</h2>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
        <span style={{ fontWeight: step === 1 ? 'bold' : 'normal', color: step === 1 ? '#000' : '#888' }}>1. Source</span>
        <span style={{ fontWeight: step === 2 ? 'bold' : 'normal', color: step === 2 ? '#000' : '#888' }}>2. Upload</span>
        <span style={{ fontWeight: step === 3 ? 'bold' : 'normal', color: step === 3 ? '#000' : '#888' }}>3. Mapping</span>
        <span style={{ fontWeight: step === 4 ? 'bold' : 'normal', color: step === 4 ? '#000' : '#888' }}>4. Validation</span>
        <span style={{ fontWeight: step === 5 ? 'bold' : 'normal', color: step === 5 ? '#000' : '#888' }}>5. Summary</span>
      </div>

      {step === 1 && (
        <div>
          <h3>Select a Source</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            {sources.map(src => (
              <button 
                key={src} 
                onClick={() => handleSourceSelect(src)}
                style={{ padding: '20px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '8px', background: '#f9f9f9', fontSize: '16px' }}
              >
                {src}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>Upload Data for {source}</h3>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} style={{ marginBottom: '20px', display: 'block' }} />
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(1)} style={{ padding: '10px 20px', cursor: 'pointer' }}>Back</button>
            <button 
              onClick={handleUpload} 
              disabled={!file || isProcessing}
              style={{ padding: '10px 20px', cursor: file ? 'pointer' : 'not-allowed', background: file ? '#0070f3' : '#ccc', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              {isProcessing ? 'Processing...' : 'Upload & Preview'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && previewData && (
        <div>
          <h3>Map Columns</h3>
          <p>File: {previewData.filename}</p>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>File Header</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>System Field</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Sample Data</th>
              </tr>
            </thead>
            <tbody>
              {previewData.headers.map((header, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{header}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <select 
                      value={mapping[header] || ''} 
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      style={{ width: '100%', padding: '5px' }}
                    >
                      <option value="">-- Ignore --</option>
                      <option value="name">Name</option>
                      <option value="company_name">Company Name</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="website">Website</option>
                      <option value="linkedin_url">LinkedIn URL</option>
                      <option value="address">Address</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', color: '#666', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {previewData.preview.length > 0 ? previewData.preview[0][header] : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={() => setStep(2)} style={{ padding: '10px 20px', cursor: 'pointer' }}>Back</button>
            <button 
              onClick={handleValidate}
              disabled={isProcessing}
              style={{ padding: '10px 20px', cursor: 'pointer', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              {isProcessing ? 'Validating...' : 'Validate Import'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && validationResult && (
        <div>
          <h3>Validation Summary</h3>
          <div style={{ display: 'flex', gap: '20px', margin: '20px 0' }}>
            <div style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px', flex: 1 }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{validationResult.summary.total}</div>
              <div>Total Rows</div>
            </div>
            <div style={{ padding: '15px', background: '#e6ffe6', borderRadius: '8px', flex: 1, color: 'green' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{validationResult.summary.valid}</div>
              <div>Valid Rows</div>
            </div>
            <div style={{ padding: '15px', background: '#ffe6e6', borderRadius: '8px', flex: 1, color: 'red' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{validationResult.summary.invalid}</div>
              <div>Invalid Rows</div>
            </div>
          </div>

          {validationResult.invalidRows.length > 0 && (
            <div>
              <h4>Errors (Showing up to 100)</h4>
              <ul style={{ color: 'red', fontSize: '14px', maxHeight: '300px', overflowY: 'auto', background: '#fff0f0', padding: '15px', borderRadius: '8px' }}>
                {validationResult.invalidRows.map((err, idx) => (
                  <li key={idx}>Row {err.row}: {err.errors}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={() => setStep(3)} style={{ padding: '10px 20px', cursor: 'pointer' }}>Back to Mapping</button>
            <button 
              onClick={handleCommit}
              disabled={validationResult.summary.valid === 0 || isProcessing}
              style={{ padding: '10px 20px', cursor: validationResult.summary.valid > 0 ? 'pointer' : 'not-allowed', background: validationResult.summary.valid > 0 ? '#28a745' : '#ccc', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              {isProcessing ? 'Committing...' : 'Commit Valid Rows'}
            </button>
          </div>
        </div>
      )}

      {step === 5 && validationResult && validationResult.commitResult && (
        <div>
          <h3>Import Complete!</h3>
          <p>Your data has been successfully processed and imported.</p>
          
          <div style={{ display: 'flex', gap: '20px', margin: '20px 0' }}>
            <div style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px', flex: 1 }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{validationResult.summary.total}</div>
              <div>Total Processed</div>
            </div>
            <div style={{ padding: '15px', background: '#e6ffe6', borderRadius: '8px', flex: 1, color: 'green' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{validationResult.commitResult.inserted}</div>
              <div>New Leads Inserted</div>
            </div>
            <div style={{ padding: '15px', background: '#fff3cd', borderRadius: '8px', flex: 1, color: '#856404' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{validationResult.commitResult.duplicates}</div>
              <div>Duplicates Ignored</div>
            </div>
          </div>

          <button 
            onClick={() => {
              setStep(1);
              setFile(null);
              setPreviewData(null);
              setValidationResult(null);
            }} 
            style={{ padding: '10px 20px', cursor: 'pointer', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
