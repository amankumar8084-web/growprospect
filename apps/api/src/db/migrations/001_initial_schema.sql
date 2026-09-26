CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(50) NOT NULL,
    filename VARCHAR(255),
    total_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,
    invalid_rows INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_type VARCHAR(50),
    source VARCHAR(50) NOT NULL,
    source_record_id VARCHAR(255),
    name VARCHAR(255),
    company_name VARCHAR(255),
    job_title VARCHAR(150),
    category VARCHAR(150),
    industry VARCHAR(150),
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    linkedin_url VARCHAR(255),
    company_linkedin_url VARCHAR(255),
    maps_url TEXT,
    address TEXT,
    country VARCHAR(100),
    state VARCHAR(100),
    city VARCHAR(100),
    postal_code VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    notes TEXT,
    website_status VARCHAR(50),
    lead_status VARCHAR(50) DEFAULT 'new',
    import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS website_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    http_status INTEGER,
    has_https BOOLEAN,
    broken_links INTEGER DEFAULT 0,
    broken_assets INTEGER DEFAULT 0,
    mobile_friendly BOOLEAN,
    audited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Leads table
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_lead_status ON leads(lead_status);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_import_batch_id ON leads(import_batch_id);
