-- Create users table (extends Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  credits integer default 100,
  subscription_tier text default 'free',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  topic text not null,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint projects_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade
);

-- Create results table
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  
  -- AI generated content
  script text,
  scenes jsonb,
  capcut_instructions jsonb,
  seo_metadata jsonb,
  thumbnail_suggestions jsonb,
  
  -- Metadata
  processing_status text default 'pending',
  error_message text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint results_project_id_fkey foreign key (project_id) references public.projects(id) on delete cascade,
  constraint results_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade
);

-- Create indexes
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_results_user_id on public.results(user_id);
create index if not exists idx_results_project_id on public.results(project_id);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.results enable row level security;

-- RLS Policies for users table
create policy "Users can view their own data" on public.users
  for select using (auth.uid() = id);

create policy "Users can update their own data" on public.users
  for update using (auth.uid() = id);

-- RLS Policies for projects table
create policy "Users can view their own projects" on public.projects
  for select using (auth.uid() = user_id);

create policy "Users can create their own projects" on public.projects
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own projects" on public.projects
  for update using (auth.uid() = user_id);

create policy "Users can delete their own projects" on public.projects
  for delete using (auth.uid() = user_id);

-- RLS Policies for results table
create policy "Users can view their own results" on public.results
  for select using (auth.uid() = user_id);

create policy "Users can create their own results" on public.results
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own results" on public.results
  for update using (auth.uid() = user_id);

create policy "Users can delete their own results" on public.results
  for delete using (auth.uid() = user_id);
