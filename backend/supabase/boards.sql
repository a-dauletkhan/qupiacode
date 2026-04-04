create extension if not exists pgcrypto;

create table if not exists public.boards (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    owner_id uuid not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.board_members (
    board_id uuid not null references public.boards(id) on delete cascade,
    user_id uuid not null,
    role text not null check (role in ('owner', 'editor', 'viewer')),
    created_at timestamptz not null default timezone('utc', now()),
    primary key (board_id, user_id)
);

create index if not exists board_members_user_id_idx on public.board_members (user_id);
create index if not exists boards_owner_id_idx on public.boards (owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists boards_set_updated_at on public.boards;

create trigger boards_set_updated_at
before update on public.boards
for each row
execute function public.set_updated_at();

alter table public.boards enable row level security;
alter table public.board_members enable row level security;
