import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setMetrics(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading dashboard...</div>;
  if (!metrics) return <div style={{ padding: '40px', textAlign: 'center' }}>Failed to load dashboard</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Top Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#666', fontSize: '14px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Leads</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#111' }}>{metrics.totalLeads}</div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#666', fontSize: '14px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Websites Audited</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#0070f3' }}>
            {metrics.websiteStatus.audited} <span style={{ fontSize: '16px', color: '#888', fontWeight: 'normal' }}>/ {metrics.websiteStatus.withWebsite}</span>
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
        {/* Leads by Source */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Leads by Source</h3>
          {metrics.leadsBySource.length === 0 ? (
            <p style={{ color: '#888' }}>No data available.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {metrics.leadsBySource.map((s, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{ fontWeight: '500' }}>{s.source}</span>
                  <span style={{ background: '#f0f0f0', padding: '2px 8px', borderRadius: '10px', fontSize: '14px' }}>{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lead Status */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Pipeline Status</h3>
          {metrics.leadStatus.length === 0 ? (
            <p style={{ color: '#888' }}>No data available.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {metrics.leadStatus.map((s, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{s.status}</span>
                  <span style={{ background: s.status === 'qualified' ? '#d4edda' : '#f0f0f0', color: s.status === 'qualified' ? '#155724' : '#333', padding: '2px 8px', borderRadius: '10px', fontSize: '14px' }}>{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent Imports */}
      <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Recent Imports</h3>
          <Link to="/import" style={{ fontSize: '14px', color: '#0070f3', textDecoration: 'none' }}>+ New Import</Link>
        </div>
        
        {metrics.recentImports.length === 0 ? (
          <p style={{ color: '#888' }}>No recent imports found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#fcfcfc' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: '#666' }}>Source</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#666' }}>File</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#666' }}>Total Rows</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#666' }}>Imported</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#666' }}>Duplicates</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#666' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentImports.map(batch => (
                <tr key={batch.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '12px', fontWeight: '500' }}>{batch.source}</td>
                  <td style={{ padding: '12px', color: '#888' }}>{batch.filename}</td>
                  <td style={{ padding: '12px' }}>{batch.total_rows}</td>
                  <td style={{ padding: '12px', color: 'green' }}>{batch.valid_rows}</td>
                  <td style={{ padding: '12px', color: '#856404' }}>{batch.duplicate_rows}</td>
                  <td style={{ padding: '12px', color: '#888' }}>{new Date(batch.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
