const { pool } = require('../db');

const getDashboardMetrics = async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      // 1. Total Leads
      const totalRes = await client.query('SELECT COUNT(*) FROM leads');
      const totalLeads = parseInt(totalRes.rows[0].count, 10);

      // 2. Leads by Source
      const sourceRes = await client.query(`
        SELECT source, COUNT(*) as count 
        FROM leads 
        GROUP BY source 
        ORDER BY count DESC
      `);
      
      // 3. Lead Status distribution
      const statusRes = await client.query(`
        SELECT lead_status, COUNT(*) as count 
        FROM leads 
        GROUP BY lead_status
      `);

      // 4. Website Analysis Status (Audited vs Unaudited)
      const auditRes = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM leads WHERE website IS NOT NULL) as total_with_website,
          (SELECT COUNT(DISTINCT lead_id) FROM website_audits) as total_audited
      `);
      const totalWithWebsite = parseInt(auditRes.rows[0].total_with_website, 10);
      const totalAudited = parseInt(auditRes.rows[0].total_audited, 10);

      // 5. Recent Imports
      const importsRes = await client.query(`
        SELECT id, source, filename, total_rows, valid_rows, duplicate_rows, created_at 
        FROM import_batches 
        ORDER BY created_at DESC 
        LIMIT 5
      `);

      res.json({
        success: true,
        data: {
          totalLeads,
          leadsBySource: sourceRes.rows.map(row => ({ source: row.source, count: parseInt(row.count, 10) })),
          leadStatus: statusRes.rows.map(row => ({ status: row.lead_status, count: parseInt(row.count, 10) })),
          websiteStatus: {
            withWebsite: totalWithWebsite,
            audited: totalAudited
          },
          recentImports: importsRes.rows
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard metrics' });
  }
};

module.exports = {
  getDashboardMetrics
};
