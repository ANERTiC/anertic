create table if not exists users
(
    id            varchar(20) primary key not null,
    email         text                    not null unique,
    name          text                    not null default '',
    picture       text                    not null default '',
    provider      text                    not null default 'google',
    provider_id   text                    not null default '',
    created_at    timestamptz             not null default now(),
    updated_at    timestamptz             not null default now()
);

create table if not exists user_auth_tokens
(
    user_id    varchar(20) not null references users (id),
    token      text        not null unique,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_user_auth_tokens_user_id on user_auth_tokens (user_id);

create table if not exists user_auth_refresh_tokens
(
    user_id    varchar(20) not null references users (id),
    token      text        not null unique,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_user_auth_refresh_tokens_user_id on user_auth_refresh_tokens (user_id);

create table if not exists sites
(
    id         varchar(20) primary key not null,
    name       text                    not null,
    address    text                    not null default '',
    timezone   text                    not null default 'Asia/Bangkok',
    metadata   jsonb                   not null default '{}',
    created_at timestamptz             not null default now(),
    updated_at timestamptz             not null default now()
);

create table if not exists devices
(
    id         varchar(20) primary key not null,
    site_id    varchar(20) references sites (id),
    name       text                    not null,
    type       text                    not null, -- 'appliance', 'inverter', 'solar_panel', 'ev_charger'
    brand      text                    not null default '',
    model      text                    not null default '',
    metadata   jsonb                   not null default '{}',
    is_active  boolean                 not null default true,
    created_at timestamptz             not null default now(),
    updated_at timestamptz             not null default now()
);

create index if not exists idx_devices_site_id on devices (site_id);
create index if not exists idx_devices_type on devices (type);

create table if not exists meters
(
    id            varchar(20) primary key not null,
    device_id     varchar(20) references devices (id),
    serial_number text                    not null unique,
    protocol      text                    not null default 'mqtt', -- 'mqtt', 'http', 'modbus'
    vendor        text                    not null default '',
    config        jsonb                   not null default '{}',
    is_online     boolean                 not null default false,
    last_seen_at  timestamptz,
    created_at    timestamptz             not null default now(),
    updated_at    timestamptz             not null default now()
);

create index if not exists idx_meters_device_id on meters (device_id);

create table if not exists readings
(
    time       timestamptz    not null,
    meter_id   varchar(20)    not null,
    power_w    numeric(12, 3),
    energy_kwh numeric(12, 6),
    voltage_v  numeric(8, 2),
    current_a  numeric(8, 3),
    frequency  numeric(6, 2),
    pf         numeric(4, 3),
    metadata   jsonb          not null default '{}'
);

create index if not exists idx_readings_meter_id_time on readings (meter_id, time desc);

create table if not exists insights
(
    id         varchar(20) primary key not null,
    site_id    varchar(20) references sites (id),
    type       text                    not null, -- 'daily_summary', 'anomaly', 'recommendation', 'cost_alert'
    title      text                    not null,
    body       text                    not null,
    data       jsonb                   not null default '{}',
    is_read    boolean                 not null default false,
    created_at timestamptz             not null default now()
);

create index if not exists idx_insights_site_id on insights (site_id, created_at desc);
create index if not exists idx_insights_type on insights (type);
