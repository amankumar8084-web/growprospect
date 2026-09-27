// Export utilities for CSV, Excel (XLSX compatible XML/CSV), and JSON

export const exportLeadsToCsv = (leads, filename = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`) => {
  if (!leads || leads.length === 0) {
    alert('No leads available to export.');
    return;
  }

  const headers = [
    'Lead ID',
    'Company / Business Name',
    'Opportunity Type',
    'Category',
    'Location',
    'Website',
    'Phone',
    'Email',
    'Verification Status',
    'Source',
    'Source URL',
    'Scraped At',
    'Scraper Run ID'
  ];

  const escapeField = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = leads.map((l) => [
    escapeField(l.id),
    escapeField(l.name),
    escapeField(l.opportunityType),
    escapeField(l.category),
    escapeField(l.location),
    escapeField(l.website || 'N/A'),
    escapeField(l.phone || 'N/A'),
    escapeField(l.email || 'N/A'),
    escapeField(l.emailVerificationStatus || 'unverified'),
    escapeField(l.source),
    escapeField(l.sourceUrl || ''),
    escapeField(l.scrapedAt),
    escapeField(l.scraperRunId || '')
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
        th { background-color: #111111; color: #FFFFFF; font-weight: bold; border: 1px solid #CCCCCC; padding: 8px; }
        td { border: 1px solid #E0E0E0; padding: 6px; font-family: sans-serif; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th>Company / Business Name</th>
            <th>Opportunity Type</th>
            <th>Category</th>
            <th>Location</th>
            <th>Website</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Verification Status</th>
            <th>Source</th>
            <th>Scraped Date</th>
            <th>Run ID</th>
          </tr>
        </thead>
        <tbody>
  `;

  leads.forEach((l) => {
    html += `
      <tr>
        <td>${escapeHtml(l.name)}</td>
        <td>${escapeHtml(l.opportunityType)}</td>
        <td>${escapeHtml(l.category)}</td>
        <td>${escapeHtml(l.location)}</td>
        <td>${escapeHtml(l.website || '-')}</td>
        <td>${escapeHtml(l.phone || '-')}</td>
        <td>${escapeHtml(l.email || '-')}</td>
        <td>${escapeHtml(l.emailVerificationStatus || '-')}</td>
        <td>${escapeHtml(l.source)}</td>
        <td>${escapeHtml(l.scrapedAt ? new Date(l.scrapedAt).toLocaleDateString() : '-')}</td>
        <td>${escapeHtml(l.scraperRunId || '-')}</td>
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
