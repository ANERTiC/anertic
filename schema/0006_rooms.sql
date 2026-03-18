create table if not exists rooms (
    id         varchar(20) primary key not null,
    site_id    varchar(20) not null references sites (id),
    name       text        not null,
    type       text        not null default 'other',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists idx_rooms_site_id on rooms (site_id);

create table if not exists room_devices (
    room_id    varchar(20) not null references rooms (id),
    device_id  varchar(20) not null references devices (id),
    created_at timestamptz not null default now(),
    primary key (room_id, device_id)
);

create index if not exists idx_room_devices_device_id on room_devices (device_id);
