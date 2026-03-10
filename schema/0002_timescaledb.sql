select create_hypertable('readings', 'time', if_not_exists => true);

create materialized view if not exists readings_hourly
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

create materialized view if not exists readings_daily
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
    start_offset      => interval '3 hours',
    end_offset        => interval '1 hour',
    schedule_interval => interval '1 hour',
    if_not_exists     => true);

select add_continuous_aggregate_policy('readings_daily',
    start_offset      => interval '3 days',
    end_offset        => interval '1 day',
    schedule_interval => interval '1 day',
    if_not_exists     => true);

select add_retention_policy('readings', interval '90 days', if_not_exists => true);

alter table readings set (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'meter_id',
    timescaledb.compress_orderby = 'time desc'
);

select add_compression_policy('readings', interval '7 days', if_not_exists => true);
