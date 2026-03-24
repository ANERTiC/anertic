create table if not exists site_devices (
    site_id    varchar(20) not null references sites (id),
    device_id  varchar(20) not null references devices (id),
    created_at timestamptz not null default now(),
    primary key (site_id, device_id)
);

create index if not exists idx_site_devices_device_id on site_devices (device_id);
