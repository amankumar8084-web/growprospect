import { useState, useEffect } from 'react';
import { sessionManager } from '../services/sessionManager';
import { Link } from 'react-router-dom';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/leads?page=${page}&limit=10&search=${search}`);
      const data = await res.json();
      if (data.success) {
        setLeads(data.data);
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, search]);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/leads/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchLeads();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/leads/export?format=${format}&search=${search}`);
      
      if (!res.ok) {
        alert('Export failed');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_export.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Error exporting leads');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Lead Management</h2>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Search name, company, email..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ padding: '10px', width: '250px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <div style={{ display: 'flex', gap: '5px' }}>
            <button 
              onClick={() => handleExport('csv')} 
              disabled={exporting || leads.length === 0}
              style={{ padding: '8px 12px', cursor: (exporting || leads.length === 0) ? 'not-allowed' : 'pointer', background: '#e2e3e5', border: 'none', borderRadius: '4px' }}
            >
              CSV
            </button>
            <button 
              onClick={() => handleExport('xlsx')} 
              disabled={exporting || leads.length === 0}
              style={{ padding: '8px 12px', cursor: (exporting || leads.length === 0) ? 'not-allowed' : 'pointer', background: '#217346', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              XLSX
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading leads...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Company</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Email / Phone</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Location</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Source</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No leads found</td>
                </tr>
              ) : (
                leads.map(lead => (
                  <tr key={lead.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{lead.name || '-'}</td>
                    <td style={{ padding: '12px' }}>{lead.company_name || '-'}</td>
                    <td style={{ padding: '12px' }}>
                      <div>{lead.email || ''}</div>
                      <div style={{ color: '#666', fontSize: '12px' }}>{lead.phone || ''}</div>
                    </td>
                    <td style={{ padding: '12px' }}>{[lead.city, lead.country].filter(Boolean).join(', ') || '-'}</td>
                    <td style={{ padding: '12px' }}>{lead.source}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '4px 8px', background: lead.lead_status === 'new' ? '#e6f7ff' : '#f5f5f5', borderRadius: '12px', fontSize: '12px' }}>
                        {lead.lead_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', display: 'flex', gap: '10px' }}>
                      <Link to={`/leads/${lead.id}`} style={{ color: '#0070f3', textDecoration: 'none' }}>View</Link>
                      <button onClick={() => handleDelete(lead.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <button 
          disabled={page === 1} 
          onClick={() => setPage(p => p - 1)}
          style={{ padding: '8px 16px', border: '1px solid #ccc', background: page === 1 ? '#f5f5f5' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', borderRadius: '4px' }}
        >
          Previous
        </button>
        <span>Page {page} of {totalPages || 1}</span>
        <button 
          disabled={page >= totalPages} 
          onClick={() => setPage(p => p + 1)}
          style={{ padding: '8px 16px', border: '1px solid #ccc', background: page >= totalPages ? '#f5f5f5' : 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', borderRadius: '4px' }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
