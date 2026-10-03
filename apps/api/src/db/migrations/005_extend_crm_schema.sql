-- Migration: 005_extend_crm_schema.sql
-- Step 2: Extended Data Model for GrowProspect Team CRM
-- Multi-tenant enforcement: All new tables & columns indexed on org_id

-- 1. Create Enums for Lead Status & Activity Types
DO $$ BEGIN
    CREATE TYPE lead_status_enum AS ENUM ('new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE activity_type_enum AS ENUM ('note', 'call', 'email', 'whatsapp', 'status_change', 'assignment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Extend leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status lead_status_enum DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted TIMESTAMP WITH TIME ZONE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_value NUMERIC(12, 2);

-- Backfill status from pipeline_stage if present
UPDATE leads 
SET status = LOWER(pipeline_stage)::lead_status_enum 
WHERE pipeline_stage IS NOT NULL 
  AND (status IS NULL OR status = 'new')
  AND LOWER(pipeline_stage) IN ('new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost');

-- Backfill owner_id from assigned_to if present
UPDATE leads 
SET owner_id = assigned_to, 
    assigned_at = COALESCE(assigned_at, CURRENT_TIMESTAMP)
WHERE owner_id IS NULL AND assigned_to IS NOT NULL;

-- Migrate old opportunityType into tags array
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'opportunityType') THEN
    UPDATE leads 
    SET tags = array_append(COALESCE(tags, '{}'::text[]), "opportunityType") 
    WHERE "opportunityType" IS NOT NULL 
      AND NOT ("opportunityType" = ANY(COALESCE(tags, '{}'::text[])));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'opportunity_type') THEN
    UPDATE leads 
    SET tags = array_append(COALESCE(tags, '{}'::text[]), opportunity_type) 
    WHERE opportunity_type IS NOT NULL 
      AND NOT (opportunity_type = ANY(COALESCE(tags, '{}'::text[])));
  END IF;
END $$;

-- 3. New table: activities
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('note', 'call', 'email', 'whatsapp', 'status_change', 'assignment')),
    body TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. New table: tasks
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    lead_id TEXT,
    assignee_id TEXT NOT NULL,
    title TEXT NOT NULL,
    due_date DATE,
    done BOOLEAN DEFAULT FALSE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Multi-Tenant Indexes
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_org_owner ON leads(org_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_leads_org_location ON leads(org_id, country, state, city);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(org_id, next_followup);
CREATE INDEX IF NOT EXISTS idx_activities_org_lead ON activities(org_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_created ON activities(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_org_assignee ON tasks(org_id, assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_due ON tasks(org_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_org_lead ON tasks(org_id, lead_id);
