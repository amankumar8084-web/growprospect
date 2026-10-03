const { pool } = require('../db');

// GET /api/leads
const getLeads = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, source, status, pipeline_stage, assigned_to } = req.query;
    const orgId = req.auth?.orgId || req.headers['x-org-id'] || 'org_default';
    const offset = (page - 1) * limit;

    const conditions = [`(org_id = $1 OR org_id = 'org_default')`];
    const values = [orgId];
    let pIndex = 2;

    if (search) {
      conditions.push(`(name ILIKE $${pIndex} OR company_name ILIKE $${pIndex} OR email ILIKE $${pIndex})`);
      values.push(`%${search}%`);
      pIndex++;
    }
    if (source) {
      conditions.push(`source = $${pIndex++}`);
      values.push(source);
    }
    if (status) {
      conditions.push(`lead_status = $${pIndex++}`);
      values.push(status);
    }
    if (pipeline_stage) {
      conditions.push(`pipeline_stage = $${pIndex++}`);
      values.push(pipeline_stage);
    }
    if (assigned_to) {
      conditions.push(`assigned_to = $${pIndex++}`);
      values.push(assigned_to);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    
    // Get total count
    const countQuery = `SELECT COUNT(*) FROM leads ${whereClause}`;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].count, 10);

    // Get paginated data
    const dataQuery = `
      SELECT id, org_id, name, company_name, category, city, country, phone, email, website, source, lead_status,
             pipeline_stage, deal_value, assigned_to, assigned_to_name, last_activity_at, created_at
      FROM leads
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${pIndex++} OFFSET $${pIndex}
    `;
    const dataValues = [...values, limit, offset];
    
    const { rows } = await pool.query(dataQuery, dataValues);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leads' });
  }
};

// GET /api/leads/:id
const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.auth?.orgId || req.headers['x-org-id'] || 'org_default';
    const { rows } = await pool.query(
      'SELECT * FROM leads WHERE id = $1 AND (org_id = $2 OR org_id = \'org_default\')',
      [id, orgId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching lead details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lead details' });
  }
};

// PATCH /api/leads/:id
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.auth?.orgId || req.headers['x-org-id'] || 'org_default';
    const {
      lead_status, notes, name, company_name, email, phone, website,
      pipeline_stage, deal_value, assigned_to, assigned_to_name
    } = req.body;
    
    const updates = [];
    const values = [];
    let pIndex = 1;

    if (lead_status !== undefined) { updates.push(`lead_status = $${pIndex++}`); values.push(lead_status); }
    if (notes !== undefined) { updates.push(`notes = $${pIndex++}`); values.push(notes); }
    if (name !== undefined) { updates.push(`name = $${pIndex++}`); values.push(name); }
    if (company_name !== undefined) { updates.push(`company_name = $${pIndex++}`); values.push(company_name); }
    if (email !== undefined) { updates.push(`email = $${pIndex++}`); values.push(email); }
    if (phone !== undefined) { updates.push(`phone = $${pIndex++}`); values.push(phone); }
    if (website !== undefined) { updates.push(`website = $${pIndex++}`); values.push(website); }
    if (pipeline_stage !== undefined) { updates.push(`pipeline_stage = $${pIndex++}`); values.push(pipeline_stage); }
    if (deal_value !== undefined) { updates.push(`deal_value = $${pIndex++}`); values.push(Number(deal_value)); }
    if (assigned_to !== undefined) { updates.push(`assigned_to = $${pIndex++}`); values.push(assigned_to); }
    if (assigned_to_name !== undefined) { updates.push(`assigned_to_name = $${pIndex++}`); values.push(assigned_to_name); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    updates.push(`last_activity_at = CURRENT_TIMESTAMP`);
    values.push(id);
    values.push(orgId);

    const query = `
      UPDATE leads
      SET ${updates.join(', ')}
      WHERE id = $${pIndex++} AND (org_id = $${pIndex} OR org_id = 'org_default')
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
};

// DELETE /api/leads/:id
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.auth?.orgId || req.headers['x-org-id'] || 'org_default';
    const { rowCount } = await pool.query(
      'DELETE FROM leads WHERE id = $1 AND (org_id = $2 OR org_id = \'org_default\')',
      [id, orgId]
    );
    
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ success: false, message: 'Failed to delete lead' });
  }
};

// GET /api/leads/export
const exportLeads = async (req, res) => {
  try {
    const { search, source, status, pipeline_stage, format = 'csv' } = req.query;
    const orgId = req.auth?.orgId || req.headers['x-org-id'] || 'org_default';

    const conditions = [`(org_id = $1 OR org_id = 'org_default')`];
    const values = [orgId];
    let pIndex = 2;

    if (search) {
      conditions.push(`(name ILIKE $${pIndex} OR company_name ILIKE $${pIndex} OR email ILIKE $${pIndex})`);
      values.push(`%${search}%`);
      pIndex++;
    }
    if (source) {
      conditions.push(`source = $${pIndex++}`);
      values.push(source);
    }
    if (status) {
      conditions.push(`lead_status = $${pIndex++}`);
      values.push(status);
    }
    if (pipeline_stage) {
      conditions.push(`pipeline_stage = $${pIndex++}`);
      values.push(pipeline_stage);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    
    const query = `
      SELECT name, company_name, email, phone, website, linkedin_url, category, address, city, state, country, source,
             lead_status, pipeline_stage, deal_value, assigned_to_name, notes, created_at
      FROM leads
      ${whereClause}
      ORDER BY created_at DESC
    `;
    
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No leads found to export' });
    }

    const xlsx = require('xlsx');
    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Leads');

    let buffer;
    if (format === 'xlsx') {
      buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename="leads_export.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else {
      buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'csv' });
      res.setHeader('Content-Disposition', 'attachment; filename="leads_export.csv"');
      res.setHeader('Content-Type', 'text/csv');
    }

    res.send(buffer);
  } catch (error) {
    console.error('Error exporting leads:', error);
    res.status(500).json({ success: false, message: 'Failed to export leads' });
  }
};

module.exports = {
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  exportLeads
};
