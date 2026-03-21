-- Soft-delete marker for sites (also present on `create table sites` in 0001.sql).
-- Kept for databases migrated before `deleted_at` was added to 0001.
alter table sites
    add column if not exists deleted_at timestamptz;
