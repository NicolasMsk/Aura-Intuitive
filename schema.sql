-- ═══════════════════════════════════════════════════════
-- AURA INTUITIVE — Supabase Schema
-- Run this SQL in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Consultations table
CREATE TABLE consultations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_session_id TEXT UNIQUE NOT NULL,
    service           TEXT NOT NULL,
    amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
    status            TEXT NOT NULL DEFAULT 'paid'
                      CHECK (status IN ('paid', 'submitted', 'answered')),
    customer_email    TEXT,
    name              TEXT,
    email             TEXT,
    birthdate         DATE,
    person_concerned  TEXT,
    message           TEXT,
    response          TEXT,
    submitted_at      TIMESTAMPTZ,
    answered_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by stripe session
CREATE INDEX idx_consultations_stripe_session
    ON consultations (stripe_session_id);

-- Index for admin dashboard queries
CREATE INDEX idx_consultations_status
    ON consultations (status);

-- Row Level Security (optional but recommended)
-- The server uses the SERVICE_KEY so RLS is bypassed,
-- but we enable it to protect against direct client access.
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- No public access policies — only the service key can read/write.
-- If you ever need a public policy, add it here.
