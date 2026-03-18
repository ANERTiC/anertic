-- Energy Score: sub-score columns, confidence, and site-level config fields
-- Phase 1: composite score only (energy_score)
-- Phase 2: sub-scores + confidence

alter table site_energy_daily
    add column if not exists energy_score         smallint not null default 0,
    add column if not exists score_ss             smallint not null default 0,
    add column if not exists score_solar_util     smallint not null default 0,
    add column if not exists score_peak_avoidance smallint not null default 0,
    add column if not exists score_device_health  smallint not null default 0,
    add column if not exists score_savings        smallint not null default 0,
    add column if not exists score_confidence     smallint not null default 0;

-- Covering index for score trend queries (7-day window, ORDER BY date DESC)
create index if not exists idx_site_energy_daily_score_lookup
    on site_energy_daily (site_id, date desc)
    include (energy_score, score_confidence);

-- Contracted demand kVA for demand-charge PAS enhancement (Phase 3)
alter table sites
    add column if not exists contracted_demand_kva numeric not null default 0;

-- Per-site grid emission factor (kg CO2e/kWh).
-- Default: Thailand DEDE 2024 grid factor = 0.4774.
-- Override per site when customer has a green tariff or known local mix.
alter table sites
    add column if not exists grid_emission_factor numeric not null default 0.4774;
