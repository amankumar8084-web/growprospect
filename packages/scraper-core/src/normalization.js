import { OPPORTUNITY_TYPES, EMAIL_VERIFICATION_STATUSES } from './contracts.js';

/**
 * Normalizes any raw scraper record into the standard common lead model.
 * @param {Object} raw 
 * @param {Object} context 
 * @returns {Object}
 */
export function normalizeLead(raw, context = {}) {
  const now = new Date().toISOString();
  const id = raw.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Determine opportunity type
  let opportunityType = raw.opportunityType;
  if (!opportunityType) {
    if (!raw.website) {
      opportunityType = OPPORTUNITY_TYPES.NO_WEBSITE;
    } else if (context.scraperId === 'outdated-website-biz') {
      opportunityType = OPPORTUNITY_TYPES.OUTDATED_WEBSITE;
    } else if (context.scraperId === 'tech-hiring') {
      opportunityType = OPPORTUNITY_TYPES.TECH_HIRING;
    } else if (context.scraperId === 'freelance-req') {
      opportunityType = OPPORTUNITY_TYPES.FREELANCE_REQ;
    } else {
      opportunityType = 'General Opportunity';
    }
  }

  // Normalize verification status
  let verificationStatus = raw.emailVerificationStatus;
  if (!verificationStatus) {
    if (!raw.email) {
      verificationStatus = EMAIL_VERIFICATION_STATUSES.NOT_APPLICABLE;
    } else {
      verificationStatus = EMAIL_VERIFICATION_STATUSES.PENDING;
    }
  }

  return {
    id,
    name: (raw.name || raw.businessName || raw.title || 'Untitled Business').trim(),
    opportunityType,
    category: (raw.category || raw.industry || 'General Services').trim(),
    location: (raw.location || raw.address || 'Remote / Unknown').trim(),
    website: raw.website || null,
    phone: raw.phone || null,
    email: raw.email || null,
    emailVerificationStatus: verificationStatus,
    source: raw.source || context.sourceEngine || 'Direct Scraper',
    sourceUrl: raw.sourceUrl || raw.url || null,
    scrapedAt: raw.scrapedAt || now,
    scraperRunId: raw.scraperRunId || context.runId || null,
    signals: raw.signals || {}
  };
}
