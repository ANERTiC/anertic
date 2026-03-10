-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sites (homes, buildings, facilities)
CREATE TABLE sites (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    address    TEXT NOT NULL DEFAULT '',
    timezone   TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    metadata   JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Devices (AC, fridge, EV charger, inverter, solar panel, etc.)
CREATE TABLE devices (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id    UUID NOT NULL REFERENCES sites(id),
    name       TEXT NOT NULL,
    type       TEXT NOT NULL, -- 'appliance', 'inverter', 'solar_panel', 'ev_charger'
    brand      TEXT NOT NULL DEFAULT '',
    model      TEXT NOT NULL DEFAULT '',
    metadata   JSONB NOT NULL DEFAULT '{}',
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_site_id ON devices(site_id);
CREATE INDEX idx_devices_type ON devices(type);

-- Meters (smart meters attached to devices, third-party)
CREATE TABLE meters (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id     UUID NOT NULL REFERENCES devices(id),
    serial_number TEXT NOT NULL UNIQUE,
    protocol      TEXT NOT NULL DEFAULT 'mqtt', -- 'mqtt', 'http', 'modbus'
    vendor        TEXT NOT NULL DEFAULT '',
    config        JSONB NOT NULL DEFAULT '{}', -- connection details, topics, etc.
    is_online     BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meters_device_id ON meters(device_id);

-- EV Chargers (OCPP-specific)
CREATE TABLE ev_chargers (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id         UUID NOT NULL REFERENCES devices(id) UNIQUE,
    charge_point_id   TEXT NOT NULL UNIQUE, -- OCPP identity
    ocpp_version      TEXT NOT NULL DEFAULT '1.6', -- '1.6' or '2.0.1'
    status            TEXT NOT NULL DEFAULT 'unavailable', -- OCPP status
    connector_count   INT NOT NULL DEFAULT 1,
    max_power_kw      DECIMAL(10,2) NOT NULL DEFAULT 0,
    current_session   JSONB, -- active charging session
    last_heartbeat_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Readings (time-series, hypertable)
CREATE TABLE readings (
    time       TIMESTAMPTZ NOT NULL,
    meter_id   UUID NOT NULL,
    power_w    DECIMAL(12,3),    -- instantaneous power (watts)
    energy_kwh DECIMAL(12,6),    -- cumulative energy (kWh)
    voltage_v  DECIMAL(8,2),
    current_a  DECIMAL(8,3),
    frequency  DECIMAL(6,2),
    pf         DECIMAL(4,3),     -- power factor
    metadata   JSONB NOT NULL DEFAULT '{}'
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('readings', 'time');

CREATE INDEX idx_readings_meter_id_time ON readings(meter_id, time DESC);

-- Continuous aggregate: hourly rollup
CREATE MATERIALIZED VIEW readings_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    meter_id,
    AVG(power_w) AS avg_power_w,
    MAX(power_w) AS max_power_w,
    MIN(power_w) AS min_power_w,
    MAX(energy_kwh) - MIN(energy_kwh) AS energy_kwh,
    AVG(voltage_v) AS avg_voltage_v,
    AVG(current_a) AS avg_current_a,
    COUNT(*) AS sample_count
FROM readings
GROUP BY bucket, meter_id
WITH NO DATA;

-- Continuous aggregate: daily rollup
CREATE MATERIALIZED VIEW readings_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    meter_id,
    AVG(power_w) AS avg_power_w,
    MAX(power_w) AS max_power_w,
    MIN(power_w) AS min_power_w,
    MAX(energy_kwh) - MIN(energy_kwh) AS energy_kwh,
    AVG(voltage_v) AS avg_voltage_v,
    AVG(current_a) AS avg_current_a,
    COUNT(*) AS sample_count
FROM readings
GROUP BY bucket, meter_id
WITH NO DATA;

-- Refresh policies
SELECT add_continuous_aggregate_policy('readings_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('readings_daily',
    start_offset => INTERVAL '3 days',
    end_offset   => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');

-- Retention: raw data 90 days, aggregates forever
SELECT add_retention_policy('readings', INTERVAL '90 days');

-- Compression after 7 days
ALTER TABLE readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'meter_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('readings', INTERVAL '7 days');

-- EV Charging Sessions
CREATE TABLE charging_sessions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ev_charger_id     UUID NOT NULL REFERENCES ev_chargers(id),
    connector_id      INT NOT NULL DEFAULT 1,
    transaction_id    INT, -- OCPP transaction ID
    id_tag            TEXT NOT NULL DEFAULT '',
    start_time        TIMESTAMPTZ NOT NULL,
    end_time          TIMESTAMPTZ,
    energy_kwh        DECIMAL(12,6) NOT NULL DEFAULT 0,
    max_power_kw      DECIMAL(10,2) NOT NULL DEFAULT 0,
    stop_reason       TEXT,
    metadata          JSONB NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_charging_sessions_charger ON charging_sessions(ev_charger_id, start_time DESC);

-- Insights (AI-generated summaries pushed to users)
CREATE TABLE insights (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id    UUID NOT NULL REFERENCES sites(id),
    type       TEXT NOT NULL, -- 'daily_summary', 'anomaly', 'recommendation', 'cost_alert'
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    data       JSONB NOT NULL DEFAULT '{}',
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insights_site_id ON insights(site_id, created_at DESC);
CREATE INDEX idx_insights_type ON insights(type);
