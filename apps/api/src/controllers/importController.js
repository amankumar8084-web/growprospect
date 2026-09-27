import { pool } from '../db/index.js';

// In-memory import sessions store
const importSessions = new Map();

// Helper to parse CSV text into headers & rows
export function parseCsv(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentField.trim());
      if (row.length > 0 && row.some(f => f.length > 0)) {
        lines.push(row);
      }
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || row.length > 0) {
    row.push(currentField.trim());
    if (row.some(f => f.length > 0)) lines.push(row);
  }

  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map(h => h.replace(/^["']|["']$/g, '').trim());
  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (lines[r][idx] || '').replace(/^["']|["']$/g, '').trim();
    });
    rows.push(obj);
  }
  return { headers, rows };
}

// Auto-map file column headers to GrowProspect system fields
export function autoMapHeaders(source, headers) {
  const rules = [
    { field: 'company_name', patterns: ['company', 'company_name', 'companyname', 'business', 'business_name', 'businessname', 'title', 'organization', 'agency'] },
    { field: 'name', patterns: ['name', 'contact', 'contact_name', 'fullname', 'full_name', 'person', 'owner'] },
    { field: 'job_title', patterns: ['title', 'job_title', 'jobtitle', 'headline', 'position', 'role'] },
    { field: 'category', patterns: ['category', 'categories', 'industry', 'type', 'business_type', 'tag', 'tags'] },
    { field: 'email', patterns: ['email', 'email_address', 'e-mail', 'mail', 'primary_email'] },
    { field: 'phone', patterns: ['phone', 'phone_number', 'phonenumber', 'tel', 'telephone', 'mobile', 'contact_number'] },
    { field: 'website', patterns: ['website', 'url', 'site', 'web', 'domain', 'link'] },
    { field: 'address', patterns: ['address', 'formatted_address', 'street', 'location_address', 'full_address'] },
    { field: 'city', patterns: ['city', 'town', 'municipality', 'locality'] },
    { field: 'state', patterns: ['state', 'province', 'region'] },
    { field: 'country', patterns: ['country', 'nation'] },
    { field: 'maps_url', patterns: ['maps_url', 'google_maps_url', 'place_url', 'gmaps', 'map_url'] },
    { field: 'linkedin_url', patterns: ['linkedin', 'linkedin_url', 'profile_url'] }
  ];

  const mapping = {};
  headers.forEach(h => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    let matched = '';
    for (const rule of rules) {
      if (rule.patterns.some(p => p.replace(/[^a-z0-9]/g, '') === clean || clean.includes(p.replace(/[^a-z0-9]/g, '')))) {
        matched = rule.field;
        break;
      }
    }
    mapping[h] = matched;
  });
  return mapping;
}

// 1. Upload & Preview
export async function handleImportUpload(payload, source = 'Google Maps') {
  let headers = [];
  let rows = [];
  let filename = payload.filename || 'import.csv';

  if (payload.csvText) {
    const parsed = parseCsv(payload.csvText);
    headers = parsed.headers;
    rows = parsed.rows;
  } else if (payload.rows && payload.headers) {
    headers = payload.headers;
    rows = payload.rows;
  } else if (payload.buffer) {
    const text = Buffer.isBuffer(payload.buffer) ? payload.buffer.toString('utf8') : String(payload.buffer);
    const parsed = parseCsv(text);
    headers = parsed.headers;
    rows = parsed.rows;
  }

  if (headers.length === 0 && rows.length === 0) {
    throw new Error('Unable to extract records from uploaded file. Please ensure it is a valid CSV.');
  }

  const importSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const suggestedMapping = autoMapHeaders(source, headers);

  importSessions.set(importSessionId, {
    importSessionId,
    filename,
    source,
    headers,
    rows,
    autoMapping: suggestedMapping,
    createdAt: Date.now()
  });

  return {
    success: true,
    importSessionId,
    filename,
    totalRows: rows.length,
    headers,
    preview: rows.slice(0, 5),
    autoMapping: suggestedMapping
  };
}

// 2. Validate
export async function handleImportValidate({ importSessionId, mapping = {} }) {
  const session = importSessions.get(importSessionId);
  if (!session) {
    throw new Error('Import session expired or invalid. Please re-upload your file.');
  }

  session.mapping = mapping;
  const rows = session.rows;
  const mappedRecords = [];
  const invalidRows = [];

  rows.forEach((row, idx) => {
    const record = {
      source: session.source,
      importedAt: new Date().toISOString()
    };

    for (const [fileHeader, sysField] of Object.entries(mapping)) {
      if (sysField && row[fileHeader] !== undefined) {
        record[sysField] = row[fileHeader];
      }
    }

    const companyName = record.company_name || record.name;
    if (!companyName || String(companyName).trim() === '') {
      invalidRows.push({
        row: idx + 1,
        errors: 'Missing required company name or contact name'
      });
    } else {
      mappedRecords.push(record);
    }
  });

  session.validatedRecords = mappedRecords;

  return {
    success: true,
    summary: {
      total: rows.length,
      valid: mappedRecords.length,
      invalid: invalidRows.length
    },
    invalidRows
  };
}

// 3. Commit
export async function handleImportCommit({ importSessionId }, leadsStore = []) {
  const session = importSessions.get(importSessionId);
  if (!session) {
    throw new Error('Import session expired. Please re-upload your file.');
  }

  const records = session.validatedRecords || [];
  if (records.length === 0) {
    throw new Error('No valid records to commit.');
  }

  let insertedCount = 0;
  let duplicateCount = 0;
  const savedLeads = [];

  const existingSignatures = new Set(
    leadsStore.map(l => `${(l.name || l.company_name || '').toLowerCase().trim()}|${(l.location || l.city || '').toLowerCase().trim()}`)
  );

  // DB client check
  let client = null;
  try {
    client = await pool.connect();
  } catch (err) {
    console.warn('[Import Commit] PostgreSQL client unavailable, saving to active store:', err.message);
  }

  for (const rec of records) {
    const name = rec.company_name || rec.name || 'Unnamed Prospect';
    const city = rec.city || '';
    const state = rec.state || '';
    const country = rec.country || 'US';
    const location = rec.address || (city ? `${city}${state ? ', ' + state : ''}` : country);
    const sig = `${name.toLowerCase().trim()}|${location.toLowerCase().trim()}`;

    if (existingSignatures.has(sig)) {
      duplicateCount++;
      continue;
    }

    existingSignatures.add(sig);

    const leadObject = {
      id: `lead-import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      company_name: name,
      category: rec.category || rec.industry || 'Commercial Services',
      location,
      city,
      state,
      country,
      website: rec.website || null,
      phone: rec.phone || null,
      email: rec.email || null,
      emailVerificationStatus: rec.email ? 'verified' : 'not_applicable',
      source: session.source || 'File Import',
      scraperId: 'no-website-biz',
      scraperName: `${session.source || 'File'} Import`,
      website_status: rec.website ? 'Website Exists' : 'No Website',
      opportunityType: rec.website ? 'Website Audit' : 'No Website',
      scrapedAt: new Date().toISOString(),
      lead_status: 'new'
    };

    leadsStore.unshift(leadObject);
    savedLeads.push(leadObject);
    insertedCount++;

    // Insert into PostgreSQL leads table if DB is connected
    if (client) {
      try {
        await client.query(`
          INSERT INTO leads (
            name, company_name, category, email, phone, website, address, city, state, country, source, website_status, lead_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          leadObject.name,
          leadObject.company_name,
          leadObject.category,
          leadObject.email,
          leadObject.phone,
          leadObject.website,
          leadObject.location,
          leadObject.city,
          leadObject.state,
          leadObject.country,
          leadObject.source,
          leadObject.website_status,
          leadObject.lead_status
        ]);
      } catch (dbErr) {
        console.warn('[DB Lead Insert Error]:', dbErr.message);
      }
    }
  }

  if (client) {
    client.release();
  }

  // Clear session after successful commit
  importSessions.delete(importSessionId);

  return {
    success: true,
    inserted: insertedCount,
    duplicates: duplicateCount,
    leads: savedLeads
  };
}
