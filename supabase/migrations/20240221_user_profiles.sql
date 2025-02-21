-- Create a secure schema for users
create schema if not exists auth;

-- Create a table for user profiles
create table if not exists auth.user_profiles (
    id uuid references auth.users on delete cascade primary key,
    email text,
    role text default 'merchant',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Enable RLS
alter table auth.user_profiles enable row level security;

-- Create policies
create policy "Users can view own profile"
    on auth.user_profiles for select
    using ( auth.uid() = id );

create policy "Users can update own profile"
    on auth.user_profiles for update
    using ( auth.uid() = id );

-- Create a function to handle user creation
create or replace function auth.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into auth.user_profiles (id, email, role)
    values (new.id, new.email, 'merchant');
    return new;
end;
$$;

-- Create a trigger to automatically create user profiles
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure auth.handle_new_user(); 