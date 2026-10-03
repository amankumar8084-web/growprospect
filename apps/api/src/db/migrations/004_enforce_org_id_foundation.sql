-- Migration 004: Enforce Multi-Tenant Foundation (org_id on every table)
-- 1. Add org_id column if not exists on every table
-- 2. Backfill existing rows with default organization 'org_default'
-- 3. Set NOT NULL constraint on org_id
-- 4. Create performance indexes for org_id and composite query filters

-- Table: leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS org_id TEXT DEFAULT 'org_default';
UPDATE leads SET org_id = 'org_default' WHERE org_id IS NULL;
ALTER TABLE leads ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_stage ON leads(org_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_org_assigned ON leads(org_id, assigned_to);

-- Table: import_batches
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS org_id TEXT DEFAULT 'org_default';
UPDATE import_batches SET org_id = 'org_default' WHERE org_id IS NULL;
ALTER TABLE import_batches ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_batches_org_id ON import_batches(org_id);

-- Table: website_audits
ALTER TABLE website_audits ADD COLUMN IF NOT EXISTS org_id TEXT DEFAULT 'org_default';
UPDATE website_audits SET org_id = 'org_default' WHERE org_id IS NULL;
ALTER TABLE website_audits ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_website_audits_org_id ON website_audits(org_id);

-- Table: users (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id TEXT DEFAULT 'org_default';
        UPDATE users SET org_id = 'org_default' WHERE org_id IS NULL;
        ALTER TABLE users ALTER COLUMN org_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
    END IF;
END $$;

-- Table: crm_activities
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id TEXT NOT NULL DEFAULT 'org_default',
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT,
    type VARCHAR(50) NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
UPDATE crm_activities SET org_id = 'org_default' WHERE org_id IS NULL;
ALTER TABLE crm_activities ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_org_id ON crm_activities(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_org_lead ON crm_activities(org_id, lead_id);

-- Table: crm_team_members
CREATE TABLE IF NOT EXISTS crm_team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id TEXT NOT NULL DEFAULT 'org_default',
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'rep',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_crm_team_org_user UNIQUE (org_id, user_id)
);
UPDATE crm_team_members SET org_id = 'org_default' WHERE org_id IS NULL;
ALTER TABLE crm_team_members ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_team_members_org_id ON crm_team_members(org_id);

-- Table: scraper_runs (if used in DB)
CREATE TABLE IF NOT EXISTS scraper_runs (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL DEFAULT 'org_default',
    scraper_id TEXT NOT NULL,
    scraper_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    leads_found INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    params JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);
UPDATE scraper_runs SET org_id = 'org_default' WHERE org_id IS NULL;
ALTER TABLE scraper_runs ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scraper_runs_org_id ON scraper_runs(org_id);
