-- Database Extensions for Chrome Extension Support
-- This migration adds support for tracking UI extraction metadata

-- Add source field tracking if not already present
-- The EntitySnapshot model already has a 'source' field that differentiates:
-- - 'github_api': Data from GitHub REST API
-- - 'browser_extension': Data scraped from GitHub UI via Chrome extension

-- Add extraction quality metadata tracking
-- ALTER TABLE "EntitySnapshot" ADD COLUMN IF NOT EXISTS "extractionMetadata" JSONB;

-- Index for efficient querying of extension-sourced data
-- CREATE INDEX IF NOT EXISTS "idx_entity_snapshot_browser_source" 
-- ON "EntitySnapshot"("source") 
-- WHERE "source" = 'browser_extension';

-- The current schema supports extension data via:
-- 1. EntitySnapshot.source = 'browser_extension'
-- 2. EntitySnapshot.payload = Full JSON data extracted from DOM
-- 3. EntitySnapshot.payloadHash = Deduplication hash
-- 4. CollectionRun.source = 'browser_extension' (for tracking run source)

-- Verify schema is ready by running:
-- SELECT * FROM "EntitySnapshot" WHERE source = 'browser_extension' LIMIT 5;
