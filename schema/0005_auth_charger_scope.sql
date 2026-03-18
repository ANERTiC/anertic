-- Add charger-scoped authorization: NULL = global, set = scoped to specific charger
alter table ev_authorization_tags
    add column if not exists charger_id varchar(20) references ev_chargers (id);

-- drop old unique constraint on id_tag alone, replace with (charger_id, id_tag)
alter table ev_authorization_tags
    drop constraint if exists ev_authorization_tags_id_tag_key;

alter table ev_authorization_tags
    add constraint ev_authorization_tags_charger_id_tag_key unique (charger_id, id_tag);

create index if not exists idx_ev_authorization_tags_charger
    on ev_authorization_tags (charger_id) where charger_id is not null;
