-- Rollback Migration: 005_extend_crm_schema_rollback.sql
-- Step 2: Rollback Extended Data Model for GrowProspect Team CRM

-- 1. Drop tasks and activities tables
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS activities;

-- 2. Drop new indexes
DROP INDEX IF EXISTS idx_tasks_org_lead;
DROP INDEX IF EXISTS idx_tasks_org_due;
DROP INDEX IF EXISTS idx_tasks_org_assignee;
DROP INDEX IF EXISTS idx_activities_org_created;
DROP INDEX IF EXISTS idx_activities_org_lead;
DROP INDEX IF EXISTS idx_leads_next_followup;
DROP INDEX IF EXISTS idx_leads_org_location;
DROP INDEX IF EXISTS idx_leads_tags;
DROP INDEX IF EXISTS idx_leads_org_owner;
DROP INDEX IF EXISTS idx_leads_org_status;

-- 3. Drop columns added to leads table
ALTER TABLE leads DROP COLUMN IF EXISTS last_contacted;
ALTER TABLE leads DROP COLUMN IF EXISTS next_followup;
ALTER TABLE leads DROP COLUMN IF EXISTS notes;
ALTER TABLE leads DROP COLUMN IF EXISTS tags;
ALTER TABLE leads DROP COLUMN IF EXISTS country;
ALTER TABLE leads DROP COLUMN IF EXISTS state;
ALTER TABLE leads DROP COLUMN IF EXISTS city;
ALTER TABLE leads DROP COLUMN IF EXISTS created_by;
ALTER TABLE leads DROP COLUMN IF EXISTS assigned_at;
ALTER TABLE leads DROP COLUMN IF EXISTS owner_id;
ALTER TABLE leads DROP COLUMN IF EXISTS status_changed_at;
ALTER TABLE leads DROP COLUMN IF EXISTS lost_reason;
ALTER TABLE leads DROP COLUMN IF EXISTS status;

-- 4. Drop Enum Types
DROP TYPE IF EXISTS activity_type_enum;
DROP TYPE IF EXISTS lead_status_enum;
