create table if not exists conversations (
    id varchar(20) not null,
    site_id varchar(20) not null references sites (id),
    user_id varchar(20) not null references users (id),
    title text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (id)
);

create index if not exists idx_conversations_site_user
    on conversations (site_id, user_id, created_at desc);

create table if not exists conversation_messages (
    id varchar(20) not null,
    conversation_id varchar(20) not null references conversations (id),
    role text not null,
    content text not null,
    tool_name text,
    tool_call_id text,
    tool_input text,
    created_at timestamptz not null default now(),
    primary key (id)
);

create index if not exists idx_conversation_messages_conversation_id
    on conversation_messages (conversation_id, created_at);
