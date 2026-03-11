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

-- connectors: per-connector status for OCPP 1.6 StatusNotification
-- connectorId 0 = charge point itself, 1+ = individual connectors
-- Status values follow OCPP 1.6 ChargePointStatus enum
create table if not exists ev_connectors
(
    id             varchar(20) primary key not null,
    ev_charger_id  varchar(20)             not null references ev_chargers (id),
    connector_id   integer                 not null, -- OCPP connectorId (1-based)
    status         text                    not null default 'Available', -- Available, Preparing, Charging, SuspendedEVSE, SuspendedEV, Finishing, Reserved, Unavailable, Faulted
    error_code     text                    not null default 'NoError',
    connector_type text                    not null default '', -- Type1, Type2, CCS, CHAdeMO, etc.
    max_power_kw   numeric(10, 2)          not null default 0,
    info           text                    not null default '',
    last_status_at timestamptz,
    created_at     timestamptz             not null default now(),
    updated_at     timestamptz             not null default now(),

    unique (ev_charger_id, connector_id)
);

create index if not exists idx_ev_connectors_ev_charger_id on ev_connectors (ev_charger_id);
create index if not exists idx_ev_connectors_status on ev_connectors (status);
