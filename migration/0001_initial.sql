create extension if not exists timescaledb;

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

create table if not exists ev_chargers
(
    id                varchar(20) primary key not null,
    device_id         varchar(20) references devices (id) unique,
    charge_point_id   text                    not null unique, -- OCPP identity
    ocpp_version      text                    not null default '1.6', -- '1.6' or '2.0.1'
    status            text                    not null default 'unavailable',
    connector_count   integer                 not null default 1,
    max_power_kw      numeric(10, 2)          not null default 0,
    current_session   jsonb,
    last_heartbeat_at timestamptz,
    created_at        timestamptz             not null default now(),
    updated_at        timestamptz             not null default now()
);

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

select create_hypertable('readings', 'time');

create index if not exists idx_readings_meter_id_time on readings (meter_id, time desc);

create materialized view readings_hourly
with (timescaledb.continuous) as
select
    time_bucket('1 hour', time) as bucket,
    meter_id,
    avg(power_w)                          as avg_power_w,
    max(power_w)                          as max_power_w,
    min(power_w)                          as min_power_w,
    max(energy_kwh) - min(energy_kwh)     as energy_kwh,
    avg(voltage_v)                        as avg_voltage_v,
    avg(current_a)                        as avg_current_a,
    count(*)                              as sample_count
from readings
group by bucket, meter_id
with no data;

create materialized view readings_daily
with (timescaledb.continuous) as
select
    time_bucket('1 day', time) as bucket,
    meter_id,
    avg(power_w)                          as avg_power_w,
    max(power_w)                          as max_power_w,
    min(power_w)                          as min_power_w,
    max(energy_kwh) - min(energy_kwh)     as energy_kwh,
    avg(voltage_v)                        as avg_voltage_v,
    avg(current_a)                        as avg_current_a,
    count(*)                              as sample_count
from readings
group by bucket, meter_id
with no data;

select add_continuous_aggregate_policy('readings_hourly',
    start_offset    => interval '3 hours',
    end_offset      => interval '1 hour',
    schedule_interval => interval '1 hour');

select add_continuous_aggregate_policy('readings_daily',
    start_offset    => interval '3 days',
    end_offset      => interval '1 day',
    schedule_interval => interval '1 day');

select add_retention_policy('readings', interval '90 days');

alter table readings set (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'meter_id',
    timescaledb.compress_orderby = 'time desc'
);

select add_compression_policy('readings', interval '7 days');

create table if not exists charging_sessions
(
    id             varchar(20) primary key not null,
    ev_charger_id  varchar(20) references ev_chargers (id),
    connector_id   integer                 not null default 1,
    transaction_id integer,
    id_tag         text                    not null default '',
    start_time     timestamptz             not null,
    end_time       timestamptz,
    energy_kwh     numeric(12, 6)          not null default 0,
    max_power_kw   numeric(10, 2)          not null default 0,
    stop_reason    text,
    metadata       jsonb                   not null default '{}',
    created_at     timestamptz             not null default now()
);

create index if not exists idx_charging_sessions_charger on charging_sessions (ev_charger_id, start_time desc);

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
