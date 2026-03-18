-- ============================================================
-- OCPP 1.6 Complete Schema
-- Covers all 6 profiles: Core, Firmware Management,
-- Local Authorization, Reservation, Smart Charging, Remote Trigger
-- ============================================================

-- ev_chargers: central charge point registry
-- BootNotification populates vendor/model/serial/firmware fields
create table if not exists ev_chargers
(
    id                       varchar(20) primary key not null,
    site_id                  varchar(20) references sites (id),
    charge_point_id          text                    not null unique, -- OCPP identity
    ocpp_version             text                    not null default '1.6', -- '1.6' or '2.0.1'
    status                   text                    not null default 'Unavailable',
    registration_status      text                    not null default 'Pending', -- Accepted, Pending, Rejected
    connector_count          integer                 not null default 1,
    max_power_kw             numeric(10, 2)          not null default 0,
    -- BootNotification fields
    vendor                   text                    not null default '',
    model                    text                    not null default '',
    serial_number            text                    not null default '',
    charge_box_serial_number text                    not null default '',
    firmware_version         text                    not null default '',
    iccid                    text                    not null default '',
    imsi                     text                    not null default '',
    meter_type               text                    not null default '',
    meter_serial_number      text                    not null default '',
    -- heartbeat interval (seconds) returned to charger
    heartbeat_interval       integer                 not null default 60,
    -- firmware management
    firmware_status          text                    not null default 'Idle', -- Idle, Downloading, Downloaded, DownloadFailed, Installing, Installed, InstallationFailed
    diagnostics_status       text                    not null default 'Idle', -- Idle, Uploading, Uploaded, UploadFailed
    -- local auth list management (GetLocalListVersion / SendLocalList)
    local_list_version                integer  not null default 0,
    -- command status tracking (0=pending, 1=ok, 2=error)
    get_local_list_version_status     smallint not null default 0,
    send_local_list_status            smallint not null default 0,
    unlock_connector_status           smallint not null default 0,
    change_availability_status        smallint not null default 0,
    clear_cache_status                smallint not null default 0,
    change_configuration_status       smallint not null default 0,
    update_firmware_status            smallint not null default 0,
    get_diagnostics_status            smallint not null default 0,
    set_charging_profile_status       smallint not null default 0,
    clear_charging_profile_status     smallint not null default 0,
    get_composite_schedule_status     smallint not null default 0,
    --
    current_session          jsonb,
    last_heartbeat_at        timestamptz,
    created_at               timestamptz             not null default now(),
    updated_at               timestamptz             not null default now()
);

-- ============================================================
-- Core Profile: Authorization
-- ============================================================

-- authorization_tags: id tags for Authorize, StartTransaction, StopTransaction
-- supports local list (SendLocalList) and backend authorization
create table if not exists ev_authorization_tags
(
    id              varchar(20) primary key not null,
    charger_id      varchar(20) references ev_chargers (id), -- NULL = global (any charger), set = scoped to this charger
    id_tag          text                    not null, -- RFID tag / token
    parent_id_tag   text, -- group/parent tag
    status          text                    not null default 'Accepted', -- Accepted, Blocked, Expired, Invalid
    expiry_date     timestamptz,
    -- local list management (SendLocalList)
    list_version    integer                 not null default 0,
    created_at      timestamptz             not null default now(),
    updated_at      timestamptz             not null default now(),

    unique (charger_id, id_tag)
);

create unique index if not exists idx_ev_authorization_tags_global_id_tag on ev_authorization_tags (id_tag) where charger_id is null;
create unique index if not exists idx_ev_authorization_tags_charger_id_tag on ev_authorization_tags (charger_id, id_tag) where charger_id is not null;
create index if not exists idx_ev_authorization_tags_id_tag on ev_authorization_tags (id_tag);
create index if not exists idx_ev_authorization_tags_charger on ev_authorization_tags (charger_id) where charger_id is not null;
create index if not exists idx_ev_authorization_tags_parent on ev_authorization_tags (parent_id_tag) where parent_id_tag is not null;

-- ============================================================
-- Core Profile: Connectors
-- ============================================================

-- ev_connectors: per-connector status for StatusNotification
-- connectorId 0 = charge point itself, 1+ = individual connectors
-- Status values follow OCPP 1.6 ChargePointStatus enum
create table if not exists ev_connectors
(
    id               varchar(20) primary key not null,
    charger_id    varchar(20)             not null references ev_chargers (id),
    connector_id     integer                 not null, -- OCPP connectorId (1-based)
    status           text                    not null default 'Available', -- Available, Preparing, Charging, SuspendedEVSE, SuspendedEV, Finishing, Reserved, Unavailable, Faulted
    error_code       text                    not null default 'NoError',
    connector_type   text                    not null default '', -- Type1, Type2, CCS, CHAdeMO, etc.
    max_power_kw     numeric(10, 2)          not null default 0,
    info             text                    not null default '',
    vendor_id        text                    not null default '',
    vendor_error_code text                   not null default '',
    last_status_at   timestamptz,
    created_at       timestamptz             not null default now(),
    updated_at       timestamptz             not null default now(),

    unique (charger_id, connector_id)
);

create index if not exists idx_ev_connectors_charger_id on ev_connectors (charger_id);
create index if not exists idx_ev_connectors_status on ev_connectors (status);

-- ============================================================
-- Core Profile: Transactions
-- ============================================================

-- transaction_id sequence for OCPP StartTransaction responses
create sequence if not exists ev_transaction_id_seq start 1;

-- ev_charging_sessions: tracks StartTransaction → StopTransaction lifecycle
create table if not exists ev_charging_sessions
(
    id              varchar(20) primary key not null,
    charger_id   varchar(20) references ev_chargers (id),
    connector_id    integer                 not null default 1,
    transaction_id  integer                 not null default nextval('ev_transaction_id_seq'),
    id_tag          text                    not null default '',
    reservation_id  integer,                -- from StartTransaction.reservationId
    start_time      timestamptz             not null,
    end_time        timestamptz,
    meter_start     integer                 not null default 0, -- Wh at start
    meter_stop      integer,                -- Wh at stop
    energy_kwh      numeric(12, 6)          not null default 0,
    max_power_kw    numeric(10, 2)          not null default 0,
    stop_reason     text,                   -- EmergencyStop, EVDisconnected, HardReset, Local, Other, PowerLoss, Reboot, Remote, SoftReset, UnlockCommand, DeAuthorized
    metadata        jsonb                   not null default '{}',
    created_at      timestamptz             not null default now()
);

create unique index if not exists idx_ev_charging_sessions_transaction_id on ev_charging_sessions (transaction_id);
create index if not exists idx_ev_charging_sessions_charger on ev_charging_sessions (charger_id, start_time desc);
create index if not exists idx_ev_charging_sessions_id_tag on ev_charging_sessions (id_tag) where id_tag != '';

-- ============================================================
-- Core Profile: MeterValues
-- ============================================================

-- ev_meter_values: raw sampled values from MeterValues and StopTransaction.transactionData
-- uses hypertable-friendly structure (time-series)
create table if not exists ev_meter_values
(
    time            timestamptz             not null,
    charger_id   varchar(20)             not null,
    connector_id    integer                 not null default 1,
    transaction_id  integer,
    measurand       text                    not null default 'Energy.Active.Import.Register',
    phase           text                    not null default '',           -- L1, L2, L3, L1-N, L2-N, L3-N, L1-L2, L2-L3, L3-L1, or empty for total
    value           numeric(16, 6)          not null,
    unit            text                    not null default 'Wh',        -- Wh, kWh, varh, kvarh, W, kW, VA, kVA, var, kvar, A, V, Celsius, Fahrenheit, K, Percent
    context         text                    not null default 'Sample.Periodic', -- Interruption.Begin, Interruption.End, Sample.Clock, Sample.Periodic, Transaction.Begin, Transaction.End, Trigger, Other
    location        text                    not null default 'Outlet',    -- Body, Cable, EV, Inlet, Outlet
    format          text                    not null default 'Raw'        -- Raw, SignedData
);

create index if not exists idx_ev_meter_values_charger_time on ev_meter_values (charger_id, time desc);
create index if not exists idx_ev_meter_values_transaction on ev_meter_values (transaction_id, time desc) where transaction_id is not null;

-- ============================================================
-- Core Profile: Configuration
-- ============================================================

-- ev_configurations: per-charger configuration key/value pairs
-- GetConfiguration / ChangeConfiguration / ChangeAvailability
create table if not exists ev_configurations
(
    id              varchar(20) primary key not null,
    charger_id   varchar(20)             not null references ev_chargers (id),
    key             text                    not null,
    value           text,
    readonly        boolean                 not null default false,
    created_at      timestamptz             not null default now(),
    updated_at      timestamptz             not null default now(),

    unique (charger_id, key)
);

create index if not exists idx_ev_configurations_charger on ev_configurations (charger_id);

-- ============================================================
-- Reservation Profile
-- ============================================================

-- reservations: ReserveNow / CancelReservation
create table if not exists ev_reservations
(
    id              varchar(20) primary key not null,
    charger_id   varchar(20)             not null references ev_chargers (id),
    connector_id    integer                 not null,
    reservation_id  integer                 not null, -- OCPP reservationId
    id_tag          text                    not null,
    parent_id_tag   text,
    expiry_date     timestamptz             not null,
    status          text                    not null default 'Reserved', -- Reserved, Cancelled, Used, Expired
    created_at      timestamptz             not null default now(),
    updated_at      timestamptz             not null default now(),

    unique (charger_id, reservation_id)
);

create index if not exists idx_ev_reservations_charger on ev_reservations (charger_id, status);
create index if not exists idx_ev_reservations_expiry on ev_reservations (expiry_date) where status = 'Reserved';

-- ============================================================
-- Smart Charging Profile
-- ============================================================

-- ev_charging_profiles: SetChargingProfile / ClearChargingProfile / GetCompositeSchedule
create table if not exists ev_charging_profiles
(
    id                       varchar(20) primary key not null,
    charger_id            varchar(20)             not null references ev_chargers (id),
    connector_id             integer                 not null default 0, -- 0 = whole charger
    charging_profile_id      integer                 not null, -- OCPP chargingProfileId
    stack_level              integer                 not null default 0,
    charging_profile_purpose text                    not null, -- ChargePointMaxProfile, TxDefaultProfile, TxProfile
    charging_profile_kind    text                    not null, -- Absolute, Recurring, Relative
    recurrency_kind          text,                   -- Daily, Weekly (only for Recurring)
    valid_from               timestamptz,
    valid_to                 timestamptz,
    transaction_id           integer,                -- only for TxProfile
    -- schedule stored as jsonb: {duration, startSchedule, chargingRateUnit, chargingSchedulePeriod[], minChargingRate}
    schedule                 jsonb                   not null default '{}',
    created_at               timestamptz             not null default now(),
    updated_at               timestamptz             not null default now(),

    unique (charger_id, charging_profile_id)
);

create index if not exists idx_ev_charging_profiles_charger on ev_charging_profiles (charger_id, connector_id);
create index if not exists idx_ev_charging_profiles_purpose on ev_charging_profiles (charging_profile_purpose);

-- ============================================================
-- Firmware Management Profile
-- ============================================================

-- ev_firmware_updates: tracking firmware update and diagnostics operations
create table if not exists ev_firmware_updates
(
    id              varchar(20) primary key not null,
    charger_id      varchar(20)             not null references ev_chargers (id),
    type            text                    not null, -- 'firmware' or 'diagnostics'
    status          text                    not null default 'Pending',
    -- firmware: location to download from; diagnostics: location to upload to
    location        text                    not null,
    -- firmware fields
    retrieve_date   timestamptz,
    retries         integer                 not null default 0,
    retry_interval  integer                 not null default 0,
    -- diagnostics fields
    start_time      timestamptz,
    stop_time       timestamptz,
    -- diagnostics result (file name returned by charger)
    file_name       text                    not null default '',
    created_at      timestamptz             not null default now(),
    updated_at      timestamptz             not null default now()
);

create index if not exists idx_ev_firmware_updates_charger on ev_firmware_updates (charger_id, created_at desc);
create index if not exists idx_ev_firmware_updates_type on ev_firmware_updates (type, status);

-- ============================================================
-- Message Log (all profiles)
-- ============================================================

-- ev_message_log: audit trail of all OCPP messages
create table if not exists ev_message_log
(
    id              varchar(20) primary key not null,
    charger_id   varchar(20),
    charge_point_id text                    not null,
    message_id      text                    not null, -- OCPP unique message ID
    message_type    integer                 not null, -- 2=Call, 3=CallResult, 4=CallError
    action          text                    not null default '',
    direction       text                    not null, -- 'in' (CP→CS) or 'out' (CS→CP)
    payload         jsonb                   not null default '{}',
    error_code      text,
    error_desc      text,
    created_at      timestamptz             not null default now()
);

create index if not exists idx_ev_message_log_charger on ev_message_log (charger_id, created_at desc);
create index if not exists idx_ev_message_log_action on ev_message_log (action, created_at desc);
create index if not exists idx_ev_message_log_message_id on ev_message_log (charge_point_id, message_id);

