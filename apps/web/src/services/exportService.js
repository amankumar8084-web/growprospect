// Export utilities for CSV, Excel (XLSX compatible XML/CSV), and JSON respecting CRM fields

export const exportLeadsToCsv = (leads, filename = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`) => {
  if (!leads || leads.length === 0) {
    alert('No leads available to export.');
    return;
  }

  const headers = [
    'Lead ID',
    'Company / Business Name',
    'Status / Stage',
    'Owner / Assignee',
    'Deal Value ($)',
    'Next Follow-up',
    'City',
    'State',
    'Country',
    'Location',
    'Opportunity Type',
    'Category',
    'Website',
    'Phone',
    'Email',
    'Verification Status',
    'Tags',
    'Source',
    'Notes',
    'Created At'
  ];

  const escapeField = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = leads.map((l) => [
    escapeField(l.id),
    escapeField(l.company_name || l.name || 'Unknown Company'),
    escapeField(l.pipeline_stage || l.status || 'New'),
    escapeField(l.assigned_to_name || l.owner_id || 'Unassigned'),
    escapeField(l.deal_value || 0),
    escapeField(l.next_followup || ''),
    escapeField(l.city || ''),
    escapeField(l.state || ''),
    escapeField(l.country || ''),
    escapeField(l.location || ''),
    escapeField(l.opportunityType || ''),
    escapeField(l.category || ''),
    escapeField(l.website || ''),
    escapeField(l.phone || ''),
    escapeField(l.email || ''),
    escapeField(l.emailVerificationStatus || 'unverified'),
    escapeField(Array.isArray(l.tags) ? l.tags.join('; ') : ''),
    escapeField(l.source || l.scraperName || 'Manual'),
    escapeField(l.notes || ''),
    escapeField(l.created_at || l.scrapedAt || '')
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
};

export const exportLeadsToExcel = (leads, filename = `leads_export_${new Date().toISOString().slice(0, 10)}.xls`) => {
  if (!leads || leads.length === 0) {
    alert('No leads available to export.');
    return;
  }

  // Generate an HTML table format that MS Excel opens natively with correct encoding and cell styling
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        th { background-color: #111111; color: #FFFFFF; font-weight: bold; border: 1px solid #CCCCCC; padding: 8px; font-family: sans-serif; }
        td { border: 1px solid #E0E0E0; padding: 6px; font-family: sans-serif; font-size: 13px; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th>Company Name</th>
            <th>Stage</th>
            <th>Owner</th>
            <th>Deal Value</th>
            <th>Next Follow-up</th>
            <th>City</th>
            <th>Country</th>
            <th>Website</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Tags</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
  `;

  leads.forEach((l) => {
    html += `
      <tr>
        <td>${escapeHtml(l.company_name || l.name)}</td>
        <td>${escapeHtml(l.pipeline_stage || l.status || 'New')}</td>
        <td>${escapeHtml(l.assigned_to_name || l.owner_id || 'Unassigned')}</td>
        <td>${escapeHtml(l.deal_value ? `$${l.deal_value}` : '$0')}</td>
        <td>${escapeHtml(l.next_followup || '-')}</td>
        <td>${escapeHtml(l.city || '-')}</td>
        <td>${escapeHtml(l.country || '-')}</td>
        <td>${escapeHtml(l.website || '-')}</td>
        <td>${escapeHtml(l.phone || '-')}</td>
        <td>${escapeHtml(l.email || '-')}</td>
        <td>${escapeHtml(Array.isArray(l.tags) ? l.tags.join(', ') : '-')}</td>
        <td>${escapeHtml(l.source || l.scraperName || 'Manual')}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  triggerDownload(blob, filename);
};

export const exportLeadsToJson = (leads, filename = `leads_export_${new Date().toISOString().slice(0, 10)}.json`) => {
  if (!leads || leads.length === 0) {
    alert('No leads available to export.');
    return;
  }
  const jsonContent = JSON.stringify(leads, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, filename);
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};
