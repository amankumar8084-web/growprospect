-- GrowProspect Team CRM Schema Migration
-- Multi-tenant enforcement: org_id across all tables
-- Pipeline stages: 'New', 'Contacted', 'Replied', 'Meeting', 'Proposal', 'Won', 'Lost'
-- Roles: 'admin', 'manager', 'rep'

-- 1. Multi-tenant columns for existing tables
ALTER TABLE leads ADD COLUMN IF NOT EXISTS org_id VARCHAR(255) NOT NULL DEFAULT 'org_default';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'New';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_value NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS org_id VARCHAR(255) NOT NULL DEFAULT 'org_default';
ALTER TABLE website_audits ADD COLUMN IF NOT EXISTS org_id VARCHAR(255) NOT NULL DEFAULT 'org_default';

-- 2. CRM Activity Log (Notes, Stage changes, Calls, Emails)
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(255) NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    type VARCHAR(50) NOT NULL, -- 'stage_change', 'note', 'call', 'email', 'meeting'
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CRM Organization Members / Team
CREATE TABLE IF NOT EXISTS crm_team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'rep', -- 'admin', 'manager', 'rep'
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_user UNIQUE (org_id, user_id)
);

-- 4. Multi-Tenant Indexes
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(org_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(org_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_activities_org_lead ON crm_activities(org_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_team_org ON crm_team_members(org_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_org ON import_batches(org_id);
