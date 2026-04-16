-- FlowPilot Analytics-Optimized PostgreSQL Schema
-- Purpose: production-ready storage model for workflow intelligence and diagnostics.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('employee', 'manager', 'admin')),
  department TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  department TEXT NOT NULL,
  requester_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(14,2) NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS request_events (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_role TEXT,
  actor_name TEXT,
  comment TEXT,
  event_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash TEXT
);

CREATE TABLE IF NOT EXISTS intelligence_daily_rollups (
  rollup_date DATE NOT NULL,
  department TEXT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  pending_requests INTEGER NOT NULL DEFAULT 0,
  approved_requests INTEGER NOT NULL DEFAULT 0,
  rejected_requests INTEGER NOT NULL DEFAULT 0,
  avg_cycle_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  p90_cycle_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  workflow_health_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  fairness_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (rollup_date, department)
);

CREATE TABLE IF NOT EXISTS request_risk_scores (
  request_id UUID PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
  risk_score NUMERIC(6,2) NOT NULL,
  amount_component NUMERIC(6,2) NOT NULL,
  history_component NUMERIC(6,2) NOT NULL,
  variance_component NUMERIC(6,2) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_requests_status_department_created
  ON requests (status, department, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_requester_created
  ON requests (requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_events_request_stage_ts
  ON request_events (request_id, stage, event_ts);

CREATE INDEX IF NOT EXISTS idx_request_events_actor_ts
  ON request_events (actor_id, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_rollups_department_date
  ON intelligence_daily_rollups (department, rollup_date DESC);

CREATE INDEX IF NOT EXISTS idx_risk_level_score
  ON request_risk_scores (risk_level, risk_score DESC);
