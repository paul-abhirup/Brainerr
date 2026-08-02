-- 0001_core_schema.sql
-- Core tables: goals, projects, tasks, habits, notes, focus_sessions, user_state, achievements.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- Goals: long-term / monthly / weekly, self-referencing hierarchy
-- ============================================================
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_goal_id uuid references goals(id) on delete cascade,
  title text not null,
  description text,
  horizon text not null check (horizon in ('long_term','monthly','weekly')),
  target_date date,
  status text not null default 'active' check (status in ('active','done','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Projects: optional grouping layer under a goal
-- ============================================================
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Tasks
-- ============================================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  effort text check (effort in ('low','medium','high')),
  dread_level int check (dread_level between 1 and 5),
  status text not null default 'todo' check (status in ('todo','in_progress','done','snoozed')),
  reschedule_count int not null default 0,
  recurring_rule text,
  google_event_id text,
  estimated_minutes int,
  actual_minutes int,
  is_pinned boolean not null default false,
  at_risk boolean not null default false,
  blocked_by_task_id uuid references tasks(id) on delete set null,
  completed_at timestamptz,
  last_touched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_scheduled_start_idx on tasks(user_id, scheduled_start);
create index tasks_user_due_date_idx on tasks(user_id, due_date);
create index tasks_user_status_idx on tasks(user_id, status);
create index tasks_user_created_idx on tasks(user_id, created_at);

-- ============================================================
-- Task dependencies (many-to-many)
-- ============================================================
create table task_dependencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  unique (task_id, depends_on_task_id)
);

-- ============================================================
-- Habits + habit_logs
-- ============================================================
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  frequency text not null default 'daily' check (frequency in ('daily','weekly','custom')),
  target_days_per_week int not null default 7,
  active boolean not null default true,
  current_streak int not null default 0,
  best_streak int not null default 0,
  streak_frozen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  completed boolean not null default false,
  unique (habit_id, date)
);

create index habit_logs_user_date_idx on habit_logs(user_id, date);

-- ============================================================
-- Notes: freeform, optionally linked to a task/goal/project
-- ============================================================
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text,
  tags text[] not null default '{}',
  linked_task_id uuid references tasks(id) on delete set null,
  linked_goal_id uuid references goals(id) on delete set null,
  linked_project_id uuid references projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_idx on notes(user_id, updated_at desc);
create index notes_linked_task_idx on notes(linked_task_id);

-- ============================================================
-- Focus sessions (feeds actual_minutes + dashboard hours)
-- ============================================================
create table focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  duration_minutes int not null,
  completed boolean not null default true,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index focus_sessions_user_start_idx on focus_sessions(user_id, started_at desc);

-- ============================================================
-- Daily focus: the "Big 3"
-- ============================================================
create table daily_focus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  task_ids uuid[] not null default '{}',
  unique (user_id, date)
);

-- ============================================================
-- User state: resume / "where was I"
-- ============================================================
create table user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_active_task_id uuid references tasks(id) on delete set null,
  last_active_note_id uuid references notes(id) on delete set null,
  mood_energy text check (mood_energy in ('low','medium','high')),
  last_mood_checkin timestamptz,
  last_opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Gamification
-- ============================================================
create table achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  points int not null default 0,
  earned_at timestamptz not null default now(),
  unique (user_id, type)
);

create index achievements_user_idx on achievements(user_id);

-- ============================================================
-- Notification subscriptions (Web Push)
-- ============================================================
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- ============================================================
-- Reminder delivery log (dedupe)
-- ============================================================
create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  scheduled_for timestamptz not null,
  sent_at timestamptz not null default now(),
  unique (task_id, scheduled_for)
);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger goals_updated_at before update on goals
  for each row execute function set_updated_at();
create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger habits_updated_at before update on habits
  for each row execute function set_updated_at();
create trigger notes_updated_at before update on notes
  for each row execute function set_updated_at();
create trigger user_state_updated_at before update on user_state
  for each row execute function set_updated_at();

-- Keep last_touched_at in sync on task activity
create or replace function touch_task()
returns trigger as $$
begin
  new.last_touched_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_touch before update on tasks
  for each row execute function touch_task();
