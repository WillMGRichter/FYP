-- Add live progress tracking to collection runs
-- These columns back the incremental sync / progress UI:
--   phase          - human-readable stage, e.g. 'FETCHING_COMMITS (page 3)'
--   progressItems  - cumulative count of NEW items persisted during the run

ALTER TABLE "CollectionRun" ADD COLUMN "phase" TEXT;
ALTER TABLE "CollectionRun" ADD COLUMN "progressItems" INTEGER NOT NULL DEFAULT 0;