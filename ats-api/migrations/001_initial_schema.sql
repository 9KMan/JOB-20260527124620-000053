-- ATS Platform Initial Schema
-- PostgreSQL migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    name VARCHAR(255),
    location VARCHAR(255),
    current_title VARCHAR(255),
    years_experience INT,
    skills TEXT[],
    source VARCHAR(50),
    portal_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_candidates_source ON candidates(source);
CREATE INDEX idx_candidates_skills ON candidates USING GIN(skills);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    department VARCHAR(255),
    location VARCHAR(255),
    employment_type VARCHAR(50),
    portal_source VARCHAR(50),
    portal_job_id VARCHAR(255),
    salary_range VARCHAR(100),
    description TEXT,
    requirements TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jobs_portal_source ON jobs(portal_source);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_portal_job_id ON jobs(portal_source, portal_job_id);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id),
    job_id UUID REFERENCES jobs(id),
    stage VARCHAR(50) DEFAULT 'new',
    applied_at TIMESTAMP DEFAULT NOW(),
    last_stage_change TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    UNIQUE(candidate_id, job_id)
);

CREATE INDEX idx_applications_candidate ON applications(candidate_id);
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_stage ON applications(stage);

-- Portal configs table
CREATE TABLE IF NOT EXISTS portal_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_name VARCHAR(50) UNIQUE NOT NULL,
    api_key_encrypted TEXT,
    oauth_token TEXT,
    oauth_secret_encrypted TEXT,
    webhook_secret VARCHAR(255),
    last_sync_at TIMESTAMP,
    sync_interval_minutes INT DEFAULT 15,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sync logs table
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_name VARCHAR(50),
    sync_type VARCHAR(50),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    records_synced INT,
    errors TEXT,
    status VARCHAR(20)
);

CREATE INDEX idx_sync_logs_portal ON sync_logs(portal_name);
CREATE INDEX idx_sync_logs_started ON sync_logs(started_at DESC);
