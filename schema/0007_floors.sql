create table if not exists floors (
    id         varchar(20) primary key not null,
    site_id    varchar(20) not null references sites (id),
    name       text        not null,
    level      int         not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create unique index if not exists uq_floors_site_level_active
    on floors (site_id, level)
    where deleted_at is null;

create index if not exists idx_floors_site_id on floors (site_id);

-- Add floor assignment to rooms (cross-table dependency requires alter)
alter table rooms
    add column if not exists floor_id varchar(20) references floors (id);

create index if not exists idx_rooms_floor_id on rooms (floor_id);
