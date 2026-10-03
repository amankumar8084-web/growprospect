/**
 * CRM Constants & Stage Definitions
 * Fixed Pipeline Stages: New, Contacted, Replied, Meeting, Proposal, Won, Lost
 * Multi-tenant Roles: admin, manager, rep
 */

export const PIPELINE_STAGES = [
  'New',
  'Contacted',
  'Replied',
  'Meeting',
  'Proposal',
  'Won',
  'Lost'
];

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'replied',
  'meeting',
  'proposal',
  'won',
  'lost'
];

export const ACTIVITY_TYPES = [
  'note',
  'call',
  'email',
  'whatsapp',
  'status_change',
  'assignment'
];

export const CRM_ROLES = ['admin', 'manager', 'rep'];

export function isValidStage(stage) {
  if (typeof stage !== 'string') return false;
  return PIPELINE_STAGES.includes(stage) || LEAD_STATUSES.includes(stage.toLowerCase().trim());
}

export function isValidLeadStatus(status) {
  return typeof status === 'string' && LEAD_STATUSES.includes(status.toLowerCase().trim());
}

export function isValidActivityType(type) {
  return typeof type === 'string' && ACTIVITY_TYPES.includes(type.toLowerCase().trim());
}

export function isValidRole(role) {
  return typeof role === 'string' && CRM_ROLES.includes(role);
}

/**
 * Normalizes Clerk Organization role format (e.g. 'org:admin' -> 'admin')
 * @param {string} roleStr
 * @returns {'admin'|'manager'|'rep'}
 */
export function normalizeRole(roleStr) {
  if (!roleStr) return 'rep';
  const clean = String(roleStr).toLowerCase().replace(/^org:/, '').trim();
  if (clean === 'admin' || clean === 'owner') return 'admin';
  if (clean === 'manager' || clean === 'lead') return 'manager';
  return 'rep';
}

/**
 * Permission checker: Can user transition lead stage?
 * Reps can transition leads assigned to them or unassigned leads.
 * Managers and Admins can transition any lead in their organization.
 */
export function canTransitionLead(userRole, assignedToUserId, currentUserId) {
  const role = normalizeRole(userRole);
  if (role === 'admin' || role === 'manager') return true;
  if (!assignedToUserId) return true; // Unassigned leads can be claimed/advanced by reps
  return assignedToUserId === currentUserId;
}

/**
 * Permission checker: Can user reassign leads or manage team?
 * Admins and managers can reassign any lead and manage team members.
 */
export function canAssignLead(userRole) {
  const role = normalizeRole(userRole);
  return role === 'admin' || role === 'manager';
}
