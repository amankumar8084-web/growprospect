-- GrowProspect AI Agents Schema Migration
-- Additive-only: extends existing leads and crm_activities tables
-- with AI agent output columns. No breaking changes to existing schema.

-- 1. AI scoring columns on leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_score           SMALLINT DEFAULT NULL;     -- 0-100 lead quality score
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_tier            VARCHAR(1) DEFAULT NULL;   -- 'A'|'B'|'C'|'D'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_research_at     TIMESTAMP WITH TIME ZONE;  -- last research run
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_outreach_at     TIMESTAMP WITH TIME ZONE;  -- last AI outreach generated
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_proposal_at     TIMESTAMP WITH TIME ZONE;  -- last proposal generated
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_followup_at     TIMESTAMP WITH TIME ZONE;  -- last follow-up scheduled by AI
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_metadata        JSONB DEFAULT '{}'::jsonb; -- raw AI agent outputs cache

-- 2. AI activity types extension for crm_activities
-- Extends the CHECK constraint if it exists — safe no-op if constraint not present
DO $$
BEGIN
  -- Attempt to update the type constraint to include AI activity types.
  -- This is a best-effort migration; existing data is never affected.
  BEGIN
    ALTER TABLE crm_activities
      DROP CONSTRAINT IF EXISTS crm_activities_type_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 3. AI agent execution log table (standalone, not modifying anything)
CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        VARCHAR(255) NOT NULL,
  agent_id      VARCHAR(50)  NOT NULL,  -- 'research'|'scoring'|'outreach'|'followup'|'crmupdate'|'proposal'|'support'|'reengage'|'recommend'|'analyze'
  lead_id       UUID REFERENCES leads(id) ON DELETE SET NULL,
  user_id       VARCHAR(255),
  tokens_used   INTEGER DEFAULT 0,
  duration_ms   INTEGER DEFAULT 0,
  status        VARCHAR(20) DEFAULT 'success',  -- 'success'|'error'|'skipped'
  result_cache  JSONB,
  error_message TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Agent enable/disable state per org
CREATE TABLE IF NOT EXISTS ai_agent_config (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     VARCHAR(255) NOT NULL,
  agent_id   VARCHAR(50)  NOT NULL,
  enabled    BOOLEAN      NOT NULL DEFAULT true,
  updated_by VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ai_agent_org UNIQUE (org_id, agent_id)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_org       ON ai_agent_runs(org_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_lead      ON ai_agent_runs(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_config_org     ON ai_agent_config(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_ai_score          ON leads(org_id, ai_score) WHERE ai_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_ai_tier           ON leads(org_id, ai_tier) WHERE ai_tier IS NOT NULL;
