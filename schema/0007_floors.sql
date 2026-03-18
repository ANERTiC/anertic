create table if not exists floors (
    site_id    varchar(20) not null references sites (id),
    level      int         not null,
    name       text        not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (site_id, level)
);

-- Add level column to rooms
alter table rooms
    add column if not exists level int not null default 0;

create index if not exists idx_rooms_level on rooms (site_id, level);
