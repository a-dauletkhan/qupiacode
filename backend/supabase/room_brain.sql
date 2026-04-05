create extension if not exists pgcrypto;

create table if not exists public.room_sessions (
    id uuid primary key default gen_random_uuid(),
    room_id text not null unique,
    status text not null check (status in ('active', 'ended')),
    started_at timestamptz not null default timezone('utc', now()),
    ended_at timestamptz,
    last_activity_at timestamptz not null default timezone('utc', now()),
    metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.room_events (
    id uuid primary key default gen_random_uuid(),
    room_id text not null,
    event_type text not null,
    source text not null,
    actor_type text not null check (actor_type in ('user', 'ai', 'system')),
    actor_id text,
    occurred_at timestamptz not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists room_events_room_id_idx on public.room_events (room_id);
create index if not exists room_events_occurred_at_idx on public.room_events (occurred_at desc);
create index if not exists room_events_type_idx on public.room_events (event_type);

create table if not exists public.transcript_utterances (
    id uuid primary key default gen_random_uuid(),
    utterance_id text not null unique,
    room_id text not null,
    segment_id text not null,
    participant_identity text,
    speaker_id text,
    speaker_name text not null,
    text text not null,
    start_time_ms bigint,
    end_time_ms bigint,
    recording_offset_ms bigint,
    occurred_at timestamptz not null,
    source text not null default 'livekit',
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists transcript_utterances_room_id_idx
    on public.transcript_utterances (room_id, occurred_at desc);

create table if not exists public.ai_actions (
    action_id text primary key,
    room_id text not null,
    command_id text,
    requested_by text,
    type text not null,
    node_ids jsonb not null default '[]'::jsonb,
    edge_ids jsonb not null default '[]'::jsonb,
    status text not null check (status in ('pending', 'approved', 'rejected')),
    summary text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_actions_room_id_idx on public.ai_actions (room_id, created_at desc);

create table if not exists public.ai_action_feedback (
    id uuid primary key default gen_random_uuid(),
    room_id text not null,
    action_id text not null references public.ai_actions(action_id) on delete cascade,
    user_id text not null,
    status text not null check (status in ('approved', 'rejected')),
    reason text,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_action_feedback_room_id_idx
    on public.ai_action_feedback (room_id, created_at desc);

create table if not exists public.room_recordings (
    recording_id text primary key,
    room_id text not null,
    room_name text not null,
    egress_id text,
    status text not null,
    storage_provider text not null default 's3',
    storage_bucket text,
    object_path text,
    playback_url text,
    started_at timestamptz,
    ended_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists room_recordings_room_id_idx
    on public.room_recordings (room_id, started_at desc);
