const { pool } = require('../db');

// GET /api/leads
const getLeads = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, source, status } = req.query;
    const offset = (page - 1) * limit;

    const conditions = [];
    const values = [];
    let pIndex = 1;

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) FROM leads ${whereClause}`;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].count, 10);

    // Get paginated data
    const dataQuery = `
      SELECT id, name, company_name, category, city, country, phone, email, website, source, lead_status, created_at
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
    const { rows } = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
    
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
    const { lead_status, notes, name, company_name, email, phone, website } = req.body;
    
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

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE leads SET ${updates.join(', ')} WHERE id = $${pIndex} RETURNING *`;
    
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
    const { rowCount } = await pool.query('DELETE FROM leads WHERE id = $1', [id]);
    
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
    const { search, source, status, format = 'csv' } = req.query;

    const conditions = [];
    const values = [];
    let pIndex = 1;

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const query = `
      SELECT name, company_name, email, phone, website, linkedin_url, category, address, city, state, country, source, lead_status, notes, created_at
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
