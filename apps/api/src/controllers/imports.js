const { parse } = require('csv-parse/sync');
const xlsx = require('xlsx');

// POST /api/imports/preview
const previewImport = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { originalname, buffer, mimetype } = req.file;
    let headers = [];
    let previewData = [];

    if (originalname.endsWith('.csv') || mimetype === 'text/csv') {
      const records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        to_line: 6 // preview first 5 rows
      });
      if (records.length > 0) {
        headers = Object.keys(records[0]);
        previewData = records;
      }
    } else if (originalname.endsWith('.xlsx') || originalname.endsWith('.xls')) {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const records = xlsx.utils.sheet_to_json(worksheet, { header: 1 }); // Array of arrays

      if (records.length > 0) {
        headers = records[0];
        // Preview next 5 rows mapped to headers
        const dataRows = records.slice(1, 6);
        previewData = dataRows.map(row => {
          const obj = {};
          headers.forEach((h, i) => {
            obj[h] = row[i];
          });
          return obj;
        });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file type' });
    }

    const { autoMapHeaders } = require('../importers/adapters');
    const suggestedMapping = autoMapHeaders(req.body.source || '', headers);

    res.json({
      success: true,
      data: {
        filename: originalname,
        headers,
        preview: previewData,
        suggestedMapping
      }
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ success: false, message: 'Failed to preview file' });
  }
};

// POST /api/imports/validate
const validateImport = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    let mapping;
    try {
      mapping = JSON.parse(req.body.mapping); // { "File Header": "system_field" }
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid mapping data' });
    }

    const { originalname, buffer, mimetype } = req.file;
    let records = [];

    if (originalname.endsWith('.csv') || mimetype === 'text/csv') {
      records = parse(buffer, { columns: true, skip_empty_lines: true });
    } else if (originalname.endsWith('.xlsx') || originalname.endsWith('.xls')) {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      records = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file' });
    }

    // Map records to system fields
    const mappedRecords = records.map(row => {
      const mapped = {};
      for (const [fileHeader, sysField] of Object.entries(mapping)) {
        if (sysField) mapped[sysField] = row[fileHeader];
      }
      return mapped;
    });

    const { leadImportSchema } = require('../validators/leadSchema');
    let validCount = 0;
    let invalidCount = 0;
    let invalidRows = [];
    let validRecords = [];

    mappedRecords.forEach((record, index) => {
      const result = leadImportSchema.safeParse(record);
      if (result.success) {
        validCount++;
        validRecords.push(result.data);
      } else {
        invalidCount++;
        invalidRows.push({
          row: index + 1, // original data row number (excluding header depending on parser)
          record,
          errors: result.error.errors.map(e => e.message).join(', ')
        });
      }
    });

    res.json({
      success: true,
      data: {
        summary: { total: mappedRecords.length, valid: validCount, invalid: invalidCount, duplicate: 0 },
        invalidRows: invalidRows.slice(0, 100) // cap at 100 for response size
      }
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, message: 'Failed to validate file' });
  }
};

// POST /api/imports/commit
const commitImport = async (req, res) => {
  try {
    const { validRecords, source, filename } = req.body;
    if (!Array.isArray(validRecords) || !source) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const { pool } = require('../db');
    const client = await pool.connect();
    
    let duplicateCount = 0;
    let insertedCount = 0;

    try {
      await client.query('BEGIN');

      // Create import batch
      const batchRes = await client.query(
        'INSERT INTO import_batches (source, filename, total_rows) VALUES ($1, $2, $3) RETURNING id',
        [source, filename || 'unknown', validRecords.length]
      );
      const batchId = batchRes.rows[0].id;

      for (const record of validRecords) {
        // Deduplication Check
        // Phase 7 criteria: source_record_id OR website OR phone OR email OR (name AND (city OR state OR country))
        const conditions = [];
        const values = [];
        let pIndex = 1;

        if (record.source_record_id) { conditions.push(`source_record_id = $${pIndex++}`); values.push(record.source_record_id); }
        if (record.website) { conditions.push(`website = $${pIndex++}`); values.push(record.website); }
        if (record.phone) { conditions.push(`phone = $${pIndex++}`); values.push(record.phone); }
        if (record.email) { conditions.push(`email = $${pIndex++}`); values.push(record.email); }
        if (record.name && (record.city || record.state || record.country)) {
          conditions.push(`(name = $${pIndex++} AND (city = $${pIndex} OR state = $${pIndex} OR country = $${pIndex}))`);
          values.push(record.name, record.city || record.state || record.country);
          pIndex++;
        }

        let isDuplicate = false;
        if (conditions.length > 0) {
          const dupCheck = await client.query(`SELECT id FROM leads WHERE ${conditions.join(' OR ')} LIMIT 1`, values);
          if (dupCheck.rows.length > 0) {
            isDuplicate = true;
          }
        }

        if (isDuplicate) {
          duplicateCount++;
        } else {
          // Insert new lead
          await client.query(
            `INSERT INTO leads (
              source, source_record_id, name, company_name, email, phone, website, linkedin_url, address, import_batch_id,
              lead_type, job_title, maps_url, country, state, city, website_status, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
              source,
              record.source_record_id || null,
              record.name || null,
              record.company_name || null,
              record.email || null,
              record.phone || null,
              record.website || null,
              record.linkedin_url || null,
              record.address || null,
              batchId,
              record.lead_type || null,
              record.job_title || null,
              record.maps_url || null,
              record.country || null,
              record.state || null,
              record.city || null,
              record.website_status || null,
              record.notes || null
            ]
          );
          insertedCount++;
        }
      }

      // Update import batch stats
      await client.query(
        'UPDATE import_batches SET valid_rows = $1, duplicate_rows = $2 WHERE id = $3',
        [insertedCount, duplicateCount, batchId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          inserted: insertedCount,
          duplicates: duplicateCount,
          batchId
        }
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Commit error:', error);
    res.status(500).json({ success: false, message: 'Failed to commit import' });
  }
};

// GET /api/imports
const getImports = (req, res) => {
  res.json({ success: true, data: [] });
};

// GET /api/imports/:id
const getImportById = (req, res) => {
  res.json({ success: true, data: {} });
};

module.exports = {
  previewImport,
  validateImport,
  commitImport,
  getImports,
  getImportById
};
