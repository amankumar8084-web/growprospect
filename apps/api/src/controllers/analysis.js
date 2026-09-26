const { pool } = require('../db');
const axios = require('axios');
const cheerio = require('cheerio');

// Target technologies to look for in scripts/meta tags
const TECH_SIGNATURES = {
  'WordPress': /wp-content|wp-includes/i,
  'React': /react/i,
  'Next.js': /_next/i,
  'Shopify': /cdn\.shopify\.com/i,
  'Google Analytics': /google-analytics\.com\/analytics\.js|googletagmanager\.com\/gtag\/js/i,
  'Stripe': /js\.stripe\.com/i,
  'Tailwind': /tailwind/i,
  'Webflow': /webflow/i
};

// Target keywords (basic set for testing)
const TARGET_KEYWORDS = ['software', 'SaaS', 'ecommerce', 'agency', 'consulting', 'platform', 'solutions', 'b2b'];

const analyzeLeadWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get lead
    const leadRes = await pool.query('SELECT website FROM leads WHERE id = $1', [id]);
    if (leadRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    let url = leadRes.rows[0].website;
    if (!url) {
      return res.status(400).json({ success: false, message: 'Lead has no website' });
    }

    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    let statusCode = null;
    let hasContactPage = false;
    let foundEmails = [];
    let technologies = [];
    let keywords = [];
    let html = '';

    try {
      const response = await axios.get(url, { timeout: 10000 });
      statusCode = response.status;
      html = response.data;
    } catch (err) {
      statusCode = err.response ? err.response.status : 0;
      return res.status(200).json({
        success: true,
        data: { statusCode, hasContactPage: false, foundEmails: [], technologies: [], keywords: [] },
        message: 'Could not reach website'
      });
    }

    const $ = cheerio.load(html);

    // 1. Contact Page Check
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && (href.toLowerCase().includes('contact') || href.toLowerCase().includes('about'))) {
        hasContactPage = true;
      }
    });

    // 2. Email Search
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const bodyText = $('body').text();
    const emails = bodyText.match(emailRegex) || [];
    // Deduplicate and filter out common false positives (e.g. image extensions)
    foundEmails = [...new Set(emails)].filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.webp'));

    // 3. Technology Check
    const htmlString = html.toLowerCase();
    for (const [tech, regex] of Object.entries(TECH_SIGNATURES)) {
      if (regex.test(htmlString)) {
        technologies.push(tech);
      }
    }

    // 4. Keyword Analysis
    const content = $('title').text() + ' ' + $('meta[name="description"]').attr('content') + ' ' + $('h1').text() + ' ' + $('h2').text();
    const contentLower = content.toLowerCase();
    keywords = TARGET_KEYWORDS.filter(kw => contentLower.includes(kw.toLowerCase()));

    // Save to database
    const insertRes = await pool.query(
      `INSERT INTO website_audits (lead_id, status_code, has_contact_page, found_emails, technologies, keywords)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, statusCode, hasContactPage, foundEmails, technologies, keywords]
    );

    // Optionally update lead with email if not present
    if (foundEmails.length > 0) {
      await pool.query('UPDATE leads SET email = COALESCE(email, $1) WHERE id = $2', [foundEmails[0], id]);
    }

    res.json({
      success: true,
      data: insertRes.rows[0]
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ success: false, message: 'Failed to analyze website' });
  }
};

const getLeadAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const auditRes = await pool.query('SELECT * FROM website_audits WHERE lead_id = $1 ORDER BY audited_at DESC LIMIT 1', [id]);
    
    if (auditRes.rows.length === 0) {
      return res.status(200).json({ success: true, data: null });
    }
    
    res.json({ success: true, data: auditRes.rows[0] });
  } catch (error) {
    console.error('Error fetching audit:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit' });
  }
};

module.exports = {
  analyzeLeadWebsite,
  getLeadAudit
};
