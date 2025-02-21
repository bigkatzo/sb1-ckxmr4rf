-- Create user_profiles table
create table if not exists public.user_profiles (
    id uuid references auth.users on delete cascade primary key,
    email text,
    role text default 'user',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.user_profiles enable row level security;

-- Create policies
create policy "Users can view their own profile"
    on public.user_profiles for select
    using ( auth.uid() = id );

create policy "Users can update their own profile"
    on public.user_profiles for update
    using ( auth.uid() = id );

-- Allow insert for authenticated users
create policy "Users can insert their own profile"
    on public.user_profiles for insert
    with check ( auth.uid() = id );

-- Create function to handle user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.user_profiles (id, email, role)
    values (new.id, new.email, 'user');
    return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new user creation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user(); 