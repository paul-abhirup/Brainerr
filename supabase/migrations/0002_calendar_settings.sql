-- 0002_calendar_settings.sql
-- Calendar integration token store, user settings, scheduler feedback, productivity patterns.

-- ============================================================
-- Calendar integration (encrypted tokens)
-- ============================================================
create table calendar_integrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'google',
  refresh_token_encrypted text,
  access_token text,
  token_expiry timestamptz,
  calendar_id text,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger calendar_integrations_updated_at before update on calendar_integrations
  for each row execute function set_updated_at();

-- ============================================================
-- User settings (auto-scheduler, working hours, etc.)
-- ============================================================
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  working_hours jsonb not null default '{
    "mon":["09:00","18:00"],
    "tue":["09:00","18:00"],
    "wed":["09:00","18:00"],
    "thu":["09:00","18:00"],
    "fri":["09:00","18:00"],
    "sat":null,
    "sun":null
  }'::jsonb,
  buffer_minutes int not null default 10,
  max_daily_task_minutes int not null default 240,
  scheduling_horizon_days int not null default 7,
  weekly_review_at text,
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_updated_at before update on user_settings
  for each row execute function set_updated_at();

-- ============================================================
-- Scheduling feedback: learn from manual overrides
-- ============================================================
create table scheduling_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  suggested_start timestamptz not null,
  user_chosen_start timestamptz not null,
  created_at timestamptz not null default now()
);

create index scheduling_feedback_user_idx on scheduling_feedback(user_id, created_at desc);

-- ============================================================
-- Productivity patterns: derived completion-rate by hour (V2)
-- ============================================================
create table productivity_patterns (
  user_id uuid not null references auth.users(id) on delete cascade,
  hour_of_day int not null check (hour_of_day between 0 and 23),
  completion_rate numeric,
  primary key (user_id, hour_of_day)
);

-- ============================================================
-- Estimate calibration: per-project average multiplier
-- ============================================================
create table estimate_calibration (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  multiplier numeric not null default 1.0,
  sample_count int not null default 0,
  primary key (user_id, project_id)
);

-- ============================================================
-- Goal templates (reusable completed-goal skeletons)
-- ============================================================
create table goal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal_title text not null,
  goal_description text,
  horizon text not null check (horizon in ('long_term','monthly','weekly')),
  data jsonb not null default '{}'::jsonb, -- { projects: [...], tasks: [...] }
  created_at timestamptz not null default now()
);
