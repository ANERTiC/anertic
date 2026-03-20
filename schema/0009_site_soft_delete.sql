alter table sites
    add column if not exists deleted_at timestamptz;
