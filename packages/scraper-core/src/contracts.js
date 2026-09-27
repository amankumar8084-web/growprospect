/**
 * Core contracts for Multi-Scraper Lead Discovery Dashboard
 * Conforms to PRD Section 6 & ARCHITECTURE Section 2
 */

export const OPPORTUNITY_TYPES = {
  NO_WEBSITE: 'No Website',
  OUTDATED_WEBSITE: 'Outdated Website UI',
  TECH_HIRING: 'Tech Hiring',
  FREELANCE_REQ: 'Freelancer Requirement'
};

export const RUN_STATUSES = {
  DRAFT: 'draft',
  QUEUED: 'queued',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  COMPLETED_WITH_ERRORS: 'completed_with_errors',
  FAILED: 'failed',
  STOPPED: 'stopped'
};

export const EMAIL_VERIFICATION_STATUSES = {
  VERIFIED: 'verified',
  UNVERIFIED: 'unverified',
  PENDING: 'pending',
  INVALID: 'invalid',
  NOT_APPLICABLE: 'not_applicable'
};

/**
 * Validates whether an object strictly conforms to the Normalized Lead contract.
 * @param {Object} lead 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateNormalizedLead(lead) {
  const errors = [];
  if (!lead.id) errors.push('Missing required field: id');
  if (!lead.name || typeof lead.name !== 'string') errors.push('Missing or invalid field: name');
  if (!lead.opportunityType) errors.push('Missing required field: opportunityType');
  if (!lead.category) errors.push('Missing required field: category');
  if (!lead.location) errors.push('Missing required field: location');
  if (!lead.source) errors.push('Missing required field: source');
  if (!lead.scrapedAt) errors.push('Missing required field: scrapedAt');

  return {
    valid: errors.length === 0,
    errors
  };
}
