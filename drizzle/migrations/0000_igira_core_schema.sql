-- Roles enum
create type public.app_role as enum ('admin', 'learner');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles select" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "admins read profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins read roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- New user trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'learner') on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Books
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text,
  content text not null default '',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.books to authenticated;
grant insert, update, delete on public.books to authenticated;
grant all on public.books to service_role;
alter table public.books enable row level security;
create policy "all read books" on public.books for select to authenticated using (true);
create policy "admins manage books" on public.books for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Questions
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  question_text text not null,
  options jsonb not null,
  correct_index int not null check (correct_index between 0 and 3),
  explanation text,
  difficulty text not null default 'medium',
  topic text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "all read questions" on public.questions for select to authenticated using (true);
create policy "admins manage questions" on public.questions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Attempts
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'exam',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total int not null default 20,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  percentage numeric not null default 0,
  passed boolean not null default false,
  completed boolean not null default false
);
grant select, insert, update on public.exam_attempts to authenticated;
grant all on public.exam_attempts to service_role;
alter table public.exam_attempts enable row level security;
create policy "own attempts" on public.exam_attempts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins read attempts" on public.exam_attempts for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- Attempt questions / answers
create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  order_index int not null default 0,
  selected_index int,
  is_correct boolean,
  answered_at timestamptz
);
grant select, insert, update on public.attempt_answers to authenticated;
grant all on public.attempt_answers to service_role;
alter table public.attempt_answers enable row level security;
create policy "own attempt answers" on public.attempt_answers for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Learner history per question
create table public.learner_question_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  times_seen int not null default 1,
  times_correct int not null default 0,
  last_correct boolean,
  last_seen_at timestamptz not null default now(),
  unique (user_id, question_id)
);
grant select, insert, update on public.learner_question_history to authenticated;
grant all on public.learner_question_history to service_role;
alter table public.learner_question_history enable row level security;
create policy "own history" on public.learner_question_history for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on public.attempt_answers (attempt_id);
create index on public.exam_attempts (user_id, started_at desc);
create index on public.questions (book_id);