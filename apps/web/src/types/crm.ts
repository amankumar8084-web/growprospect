/**
 * GrowProspect Team CRM Type Definitions
 * Frontend Client Types (Step 2)
 */

export type UserRole = 'admin' | 'manager' | 'rep';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'meeting'
  | 'proposal'
  | 'won'
  | 'lost';

export type ActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'whatsapp'
  | 'status_change'
  | 'assignment';

export interface Lead {
  id: string;
  org_id: string;
  name: string;
  company_name: string;
  status: LeadStatus;
  pipeline_stage?: string;
  lost_reason?: string | null;
  status_changed_at?: string;
  owner_id?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  assigned_at?: string | null;
  created_by?: string | null;
  city?: string;
  state?: string;
  country?: string;
  location?: string;
  tags: string[];
  notes?: string | null;
  next_followup?: string | null;
  last_contacted?: string | null;
  last_activity_at?: string | null;
  deal_value?: number | null;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  opportunityType?: string;
  website_status?: string;
  emailVerificationStatus?: string;
  source?: string;
  scrapedAt?: string;
  scraperId?: string;
  scraperName?: string;
  signals?: Record<string, any>;
}

export interface Activity {
  id: string;
  org_id: string;
  lead_id: string;
  user_id: string;
  user_name?: string;
  type: ActivityType;
  body: string;
  created_at: string;
}

export interface Task {
  id: string;
  org_id: string;
  lead_id?: string | null;
  assignee_id: string;
  title: string;
  due_date?: string | null;
  done: boolean;
  created_by: string;
  created_at: string;
}

export interface BulkLeadActionRequest {
  action: 'status' | 'assign' | 'tag' | 'delete';
  lead_ids: string[];
  status?: LeadStatus;
  lost_reason?: string;
  owner_id?: string;
  assigned_to_name?: string;
  tags?: string[];
  tag_mode?: 'add' | 'remove' | 'set';
}

export interface LocationSummary {
  city: string;
  state?: string;
  country: string;
  lead_count: number;
  pipeline_value: number;
}
