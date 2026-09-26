import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { useParams, Link, useNavigate } from 'react-router-dom';

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [audit, setAudit] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const fetchLeadAndAudit = async () => {
      try {
        const token = await getToken();
        // Fetch Lead
        const resLead = await fetch(`${API_URL}/api/leads/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dataLead = await resLead.json();
        
        if (dataLead.success) {
          setLead(dataLead.data);
          setFormData(dataLead.data);
        } else {
          alert('Lead not found');
          navigate('/leads');
          return;
        }

        // Fetch Audit
        const resAudit = await fetch(`${API_URL}/api/analysis/${id}/audit`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dataAudit = await resAudit.json();
        if (dataAudit.success && dataAudit.data) {
          setAudit(dataAudit.data);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeadAndAudit();
  }, [id]);

  const handleUpdate = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setLead(data.data);
        setIsEditing(false);
      } else {
        alert('Failed to update lead');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating lead');
    }
  };

  const handleAnalyze = async () => {
    if (!lead.website) {
      alert("Lead has no website to analyze");
      return;
    }
    setAnalyzing(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/analysis/${id}/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAudit(data.data);
        // If analysis found an email and lead didn't have one, update UI state
        if (!lead.email && data.data.found_emails && data.data.found_emails.length > 0) {
          setLead(prev => ({ ...prev, email: data.data.found_emails[0] }));
        }
      } else {
        alert(data.message || 'Analysis failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error running analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (!lead) return null;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <Link to="/leads" style={{ textDecoration: 'none', color: '#0070f3', marginBottom: '20px', display: 'inline-block' }}>&larr; Back to Leads</Link>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '20px' }}>
        <h2>Lead Details</h2>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} style={{ padding: '8px 16px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px' }}>Edit Lead</button>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setIsEditing(false)} style={{ padding: '8px 16px', cursor: 'pointer', background: 'none', border: 'none' }}>Cancel</button>
            <button onClick={handleUpdate} style={{ padding: '8px 16px', cursor: 'pointer', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}>Save Changes</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', color: '#666', marginBottom: '5px' }}>Name</label>
          {isEditing ? (
            <input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          ) : (
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{lead.name || '-'}</div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', color: '#666', marginBottom: '5px' }}>Company</label>
          {isEditing ? (
            <input value={formData.company_name || ''} onChange={e => setFormData({...formData, company_name: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          ) : (
            <div style={{ fontSize: '16px' }}>{lead.company_name || '-'}</div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', color: '#666', marginBottom: '5px' }}>Email</label>
          {isEditing ? (
            <input value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          ) : (
            <div style={{ fontSize: '16px' }}>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : '-'}</div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', color: '#666', marginBottom: '5px' }}>Phone</label>
          {isEditing ? (
            <input value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          ) : (
            <div style={{ fontSize: '16px' }}>{lead.phone || '-'}</div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', color: '#666', marginBottom: '5px' }}>Website</label>
          {isEditing ? (
            <input value={formData.website || ''} onChange={e => setFormData({...formData, website: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          ) : (
            <div style={{ fontSize: '16px' }}>{lead.website ? <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank">{lead.website}</a> : '-'}</div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', color: '#666', marginBottom: '5px' }}>Status</label>
          {isEditing ? (
            <select value={formData.lead_status || 'new'} onChange={e => setFormData({...formData, lead_status: e.target.value})} style={{ width: '100%', padding: '8px' }}>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="archived">Archived</option>
            </select>
          ) : (
            <div style={{ fontSize: '16px', textTransform: 'capitalize' }}>{lead.lead_status}</div>
          )}
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', color: '#666', marginBottom: '5px' }}>Notes</label>
          {isEditing ? (
            <textarea rows="4" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          ) : (
            <div style={{ fontSize: '16px', whiteSpace: 'pre-wrap', background: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>{lead.notes || 'No notes added.'}</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Website Analysis</h3>
          <button 
            onClick={handleAnalyze} 
            disabled={!lead.website || analyzing}
            style={{ padding: '8px 16px', cursor: lead.website && !analyzing ? 'pointer' : 'not-allowed', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>

        {!lead.website && <p style={{ color: '#888' }}>Add a website to run an analysis.</p>}
        
        {audit && (
          <div style={{ background: '#f0f8ff', padding: '20px', borderRadius: '8px', border: '1px solid #cce5ff' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
              <div><strong>Status:</strong> {audit.status_code === 200 ? '✅ 200 OK' : `⚠️ ${audit.status_code}`}</div>
              <div><strong>Contact Page:</strong> {audit.has_contact_page ? '✅ Found' : '❌ Not Found'}</div>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <strong>Found Emails:</strong> 
              {audit.found_emails && audit.found_emails.length > 0 ? (
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  {audit.found_emails.map((em, i) => <li key={i}>{em}</li>)}
                </ul>
              ) : (
                <span style={{ color: '#888', marginLeft: '10px' }}>None detected</span>
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <strong>Technologies Detected:</strong> 
              {audit.technologies && audit.technologies.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '5px' }}>
                  {audit.technologies.map((t, i) => <span key={i} style={{ background: '#e2e3e5', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{t}</span>)}
                </div>
              ) : (
                <span style={{ color: '#888', marginLeft: '10px' }}>None detected</span>
              )}
            </div>

            <div>
              <strong>Target Keywords:</strong> 
              {audit.keywords && audit.keywords.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '5px' }}>
                  {audit.keywords.map((k, i) => <span key={i} style={{ background: '#d4edda', color: '#155724', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{k}</span>)}
                </div>
              ) : (
                <span style={{ color: '#888', marginLeft: '10px' }}>None detected</span>
              )}
            </div>
            
            <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
              Last audited: {new Date(audit.audited_at).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
