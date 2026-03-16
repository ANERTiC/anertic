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
    id                        varchar(20) primary key not null,
    name                      text                    not null,
    address                   text                    not null default '',
    timezone                  text                    not null default 'Asia/Bangkok',
    currency                  text                    not null default 'THB',
    savings_target_kwh        numeric                 not null default 500,
    grid_import_rate          numeric                 not null default 0,
    grid_export_rate          numeric                 not null default 0,
    peak_start_hour           int                     not null default 17,
    peak_end_hour             int                     not null default 21,
    peak_rate                 numeric                 not null default 0,
    off_peak_rate             numeric                 not null default 0,
    email_alerts              boolean                 not null default true,
    push_alerts               boolean                 not null default false,
    alert_offline             boolean                 not null default true,
    alert_fault               boolean                 not null default true,
    alert_high_consumption    boolean                 not null default false,
    alert_low_solar           boolean                 not null default false,
    offline_threshold_minutes int                     not null default 30,
    consumption_threshold_kwh numeric                 not null default 50,
    api_key                   text                    not null default '',
    api_key_created_at        timestamptz,
    webhook_url               text                    not null default '',
    metadata                  jsonb                   not null default '{}',
    created_at                timestamptz             not null default now(),
    updated_at                timestamptz             not null default now()
);

create table if not exists site_members
(
    site_id    varchar(20) not null references sites (id),
    user_id    varchar(20) not null references users (id),
    role       text        not null default 'viewer',
    created_at timestamptz not null default now(),
    primary key (site_id, user_id)
);

create index if not exists idx_site_members_user_id on site_members (user_id);

create table if not exists site_member_invitations
(
    id         varchar(20) primary key not null,
    site_id    varchar(20) not null references sites (id),
    email      text        not null,
    role       text        not null default 'viewer',
    invited_by varchar(20) not null references users (id),
    status     text        not null default 'pending', -- 'pending', 'accepted', 'expired'
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_site_member_invitations_site_id on site_member_invitations (site_id);
create index if not exists idx_site_member_invitations_email on site_member_invitations (email);

create table if not exists devices
(
    id         varchar(20) primary key not null,
    site_id    varchar(20) references sites (id),
    name       text                    not null,
    type    text not null, -- 'meter', 'inverter', 'solar_panel', 'appliance'
    tag               text not null default '', -- free text describing what the device measures or its location
    brand             text not null default '',
    model             text not null default '',
    metadata   jsonb                   not null default '{}',
    is_active  boolean                 not null default true,
    created_at timestamptz             not null default now(),
    updated_at timestamptz             not null default now(),
    deleted_at timestamptz
);

create index if not exists idx_devices_site_id on devices (site_id);
create index if not exists idx_devices_type on devices (type);

create table if not exists meters
(
    id            varchar(20) primary key not null,
    device_id     varchar(20) references devices (id),
    serial_number text                    not null unique,
    protocol      text                    not null default 'mqtt', -- 'mqtt', 'http'
    vendor        text                    not null default '',
    phase         smallint                not null default 0, -- 0: unassigned, 1: L1, 2: L2, 3: L3
    channel       text                    not null default '', -- 'pv', 'grid', 'battery', 'load', '' (general)
    config        jsonb                   not null default '{}',
    is_online     boolean                 not null default false,
    last_seen_at  timestamptz,
    created_at    timestamptz             not null default now(),
    updated_at    timestamptz             not null default now()
);

create index if not exists idx_meters_device_id on meters (device_id);

create table if not exists meter_readings
(
    time       timestamptz    not null,
    meter_id   varchar(20)    not null,
    power_w              numeric(12, 3),
    energy_kwh           numeric(12, 6),
    voltage_v            numeric(8, 2),
    current_a            numeric(8, 3),
    frequency            numeric(6, 2),
    pf                   numeric(4, 3),
    apparent_power_va    numeric(12, 3),
    reactive_power_var   numeric(12, 3),
    apparent_energy_kvah numeric(12, 6),
    reactive_energy_kvarh numeric(12, 6),
    thd_v                numeric(5, 2),
    thd_i                numeric(5, 2),
    temperature_c        numeric(6, 2),
    metadata             jsonb          not null default '{}'
);

create index if not exists idx_meter_readings_meter_id_time on meter_readings (meter_id, time desc);

create table if not exists insights
(
    id           varchar(20) primary key not null,
    site_id      varchar(20) not null references sites (id),
    type         text        not null, -- 'warning', 'opportunity', 'achievement', 'anomaly'
    category     text        not null, -- 'solar', 'grid', 'battery', 'ev', 'load', 'cost'
    status       text        not null default 'new', -- 'new', 'acknowledged', 'resolved', 'dismissed'
    title        text        not null,
    summary      text        not null,
    detail       text        not null default '',
    impact       text        not null default '',
    impact_value numeric     not null default 0,
    impact_unit  text        not null default '',
    action       text        not null default '',
    confidence   int         not null default 0,
    created_at   timestamptz not null default now()
);

create index if not exists idx_insights_site_created on insights (site_id, created_at desc);
create index if not exists idx_insights_site_type on insights (site_id, type);
create index if not exists idx_insights_site_status on insights (site_id, status);

create table if not exists anomalies
(
    id          varchar(20) primary key not null,
    site_id     varchar(20) not null references sites (id),
    metric      text        not null,
    expected    numeric     not null,
    actual      numeric     not null,
    deviation   numeric     not null,
    severity    text        not null default 'low', -- 'low', 'medium', 'high'
    description text        not null default '',
    created_at  timestamptz not null default now()
);

create index if not exists idx_anomalies_site_created on anomalies (site_id, created_at desc);
create index if not exists idx_anomalies_site_severity on anomalies (site_id, severity);

create table if not exists site_energy_daily
(
    site_id         varchar(20) not null references sites (id),
    date            date        not null,
    solar_kwh       numeric     not null default 0,
    grid_import_kwh numeric     not null default 0,
    grid_export_kwh numeric     not null default 0,
    battery_kwh     numeric     not null default 0,
    consumption_kwh numeric     not null default 0,
    self_use_kwh    numeric     not null default 0,
    optimal_kwh     numeric     not null default 0,
    co2_avoided_kg  numeric     not null default 0,
    primary key (site_id, date)
);
