-- PostgreSQL init script — runs automatically on first container start
-- Enables the pg_trgm extension for ILIKE search optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;
