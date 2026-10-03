/**
 * Team CRM Pipeline Constants & Stages
 * Fixed Stages: New, Contacted, Replied, Meeting, Proposal, Won, Lost
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

export const STAGE_CONFIG = {
  New: {
    label: 'New',
    description: 'Freshly discovered / imported leads',
    color: '#111111',
    badgeClass: 'bg-[#111111] text-white border-transparent',
    dotColor: '#111111'
  },
  Contacted: {
    label: 'Contacted',
    description: 'Initial outreach / email / cold call sent',
    color: '#4B5563',
    badgeClass: 'bg-gray-100 text-gray-800 border-[#E7E7E7]',
    dotColor: '#6B7280'
  },
  Replied: {
    label: 'Replied',
    description: 'Prospect answered and engaged',
    color: '#0284C7',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    dotColor: '#0284C7'
  },
  Meeting: {
    label: 'Meeting',
    description: 'Discovery or demo meeting scheduled',
    color: '#EA4B0B',
    badgeClass: 'bg-[#FFF5F0] text-[#EA4B0B] border-[#FFE2D5] font-semibold',
    dotColor: '#EA4B0B'
  },
  Proposal: {
    label: 'Proposal',
    description: 'Pricing, audit, or scope sent for review',
    color: '#EA4B0B',
    badgeClass: 'bg-[#EA4B0B] text-white border-transparent font-semibold',
    dotColor: '#EA4B0B'
  },
  Won: {
    label: 'Won',
    description: 'Contract signed / deal closed successfully',
    color: '#10B981',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
    dotColor: '#10B981'
  },
  Lost: {
    label: 'Lost',
    description: 'Deal disqualified or lost to competitor',
    color: '#6B7280',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-200 line-through decoration-gray-400',
    dotColor: '#9CA3AF'
  }
};

export const CRM_ROLES = ['admin', 'manager', 'rep'];

export function normalizeRole(roleStr) {
  if (!roleStr) return 'rep';
  const clean = String(roleStr).toLowerCase().replace(/^org:/, '').trim();
  if (clean === 'admin' || clean === 'owner') return 'admin';
  if (clean === 'manager' || clean === 'lead') return 'manager';
  return 'rep';
}

export function isValidStage(stage) {
  return typeof stage === 'string' && PIPELINE_STAGES.includes(stage);
}

export function isValidRole(role) {
  return typeof role === 'string' && CRM_ROLES.includes(role);
}

export function canTransitionLead(userRole, assignedToUserId, currentUserId) {
  const role = normalizeRole(userRole);
  if (role === 'admin' || role === 'manager') return true;
  if (!assignedToUserId) return true;
  return assignedToUserId === currentUserId;
}

export function canAssignLead(userRole) {
  const role = normalizeRole(userRole);
  return role === 'admin' || role === 'manager';
}
