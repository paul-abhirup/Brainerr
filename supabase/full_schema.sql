-- Brainer full schema — migrations 0001-0004, ordered.
-- Paste into Supabase Dashboard -> SQL Editor -> Run.
--
-- This file is re-runnable: the cleanup block below drops everything Brainer
-- owns first, so it's safe even if a previous run got partway (e.g. the old
-- goal_forecast view error).

-- ============================================================
-- 0. Cleanup (idempotent)
-- ============================================================
drop view if exists goal_forecast cascade;
drop view if exists daily_task_stats cascade;
drop view if exists goal_progress cascade;

drop function if exists is_owner(uuid) cascade;
drop function if exists set_updated_at() cascade;
drop function if exists touch_task() cascade;
drop function if exists compute_habit_streak(uuid) cascade;
drop function if exists refresh_habit_streak() cascade;
drop function if exists award_points(uuid, text, int) cascade;
drop function if exists on_task_done() cascade;
drop function if exists on_goal_done() cascade;
drop function if exists on_first_task_of_day() cascade;
drop function if exists ensure_user_settings() cascade;
drop function if exists on_habit_streak_milestone() cascade;
drop function if exists update_estimate_calibration() cascade;
drop function if exists update_productivity_pattern() cascade;

drop table if exists
  calendar_busy,
  reminder_log,
  push_subscriptions,
  goal_templates,
  estimate_calibration,
  productivity_patterns,
  scheduling_feedback,
  user_settings,
  calendar_integrations,
  achievements,
  user_state,
  daily_focus,
  focus_sessions,
  notes,
  habit_logs,
  habits,
  task_dependencies,
  tasks,
  projects,
  goals
  cascade;


-- ============================================================
-- 0001_core_schema.sql

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

-- ============================================================
-- 0002_calendar_settings.sql

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

-- ============================================================
-- 0003_rls_views.sql

-- 0003_rls_views.sql
-- Row Level Security on every table + precomputed views + streak/points logic.

-- ============================================================
-- RLS
-- ============================================================
create or replace function is_owner(user_id uuid)
returns boolean as $$
  select auth.uid() = user_id
$$ language sql stable;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'goals','projects','tasks','task_dependencies','habits','habit_logs',
    'notes','focus_sessions','daily_focus','user_state','achievements',
    'push_subscriptions','reminder_log','calendar_integrations','user_settings',
    'scheduling_feedback','productivity_patterns','estimate_calibration','goal_templates'
  ]
  loop
    execute format('alter table %I enable row level security;', tbl);
    execute format(
      'create policy "Owners manage their %I" on %I for all using (is_owner(user_id)) with check (is_owner(user_id));',
      tbl, tbl
    );
  end loop;
end $$;

-- ============================================================
-- Views
-- ============================================================

-- Goal progress: % of linked tasks done, per goal (all descendants via projects).
create or replace view goal_progress as
with goal_projects as (
  select g.id as goal_id, p.id as project_id
  from goals g
  left join projects p on p.goal_id = g.id
),
goal_tasks as (
  select gp.goal_id, t.id as task_id, t.status
  from goal_projects gp
  left join tasks t on t.project_id = gp.project_id
)
select
  gt.goal_id,
  g.user_id,
  g.title,
  count(gt.task_id) as total_tasks,
  count(gt.task_id) filter (where gt.status = 'done') as done_tasks,
  case when count(gt.task_id) = 0 then 0
       else round(100.0 * count(gt.task_id) filter (where gt.status = 'done') / count(gt.task_id), 1)
  end as progress_pct
from goal_tasks gt
join goals g on g.id = gt.goal_id
group by gt.goal_id, g.user_id, g.title;

-- Daily task stats: planned vs completed per day, for the weekly bar chart + heatmap.
create or replace view daily_task_stats as
select
  user_id,
  (created_at at time zone 'UTC')::date as day,
  count(*) filter (where status = 'done') as completed,
  count(*) filter (where status not in ('done','archived')) as open
from tasks
group by user_id, (created_at at time zone 'UTC')::date;

-- Goal velocity & completion forecast (naive projection from trailing 4-week pace).
create or replace view goal_forecast as
with weekly_pace as (
  select
    g.id as goal_id,
    g.user_id,
    g.title,
    g.target_date,
    count(t.id) filter (
      where t.status = 'done' and t.completed_at > now() - interval '4 weeks'
    )::numeric / 4 as done_per_week
  from goals g
  left join projects p on p.goal_id = g.id
  left join tasks t on t.project_id = p.id
  group by g.id, g.user_id, g.title, g.target_date
),
remaining as (
  select
    g.id as goal_id,
    count(t.id) filter (where t.status != 'done') as remaining_tasks
  from goals g
  left join projects p on p.goal_id = g.id
  left join tasks t on t.project_id = p.id
  group by g.id
)
select
  w.goal_id, w.user_id, w.title, w.target_date, w.done_per_week,
  r.remaining_tasks,
  case when w.done_per_week > 0 then
    now() + (r.remaining_tasks / w.done_per_week) * interval '7 days'
  else null end as projected_completion
from weekly_pace w
join remaining r on r.goal_id = w.goal_id;

-- ============================================================
-- Habit streaks (consecutive days, allowing weekly "freezes")
-- ============================================================
create or replace function compute_habit_streak(p_habit_id uuid)
returns int as $$
declare
  v_streak int := 0;
  v_freeze_used int := 0;
  v_day date := current_date;
  v_row record;
begin
  -- Walk backwards day by day. A completed day advances the streak; a
  -- single missed day can be covered by one auto "freeze" per rolling 7 days.
  loop
    select hl.completed, hl.date into v_row
    from habit_logs hl
    where hl.habit_id = p_habit_id and hl.date = v_day
    limit 1;

    if not found then
      if v_freeze_used = 0 then
        v_freeze_used := 1;
        v_day := v_day - 1;
        continue;
      end if;
      exit;
    end if;

    if v_row.completed then
      v_streak := v_streak + 1;
    else
      if v_freeze_used = 0 then
        v_freeze_used := 1;
      else
        exit;
      end if;
    end if;

    v_day := v_day - 1;
  end loop;

  return v_streak;
end;
$$ language plpgsql stable;

-- Recompute streak for a habit whenever its log changes.
create or replace function refresh_habit_streak()
returns trigger as $$
declare
  v_streak int;
begin
  select compute_habit_streak(new.habit_id) into v_streak;
  update habits set
    current_streak = v_streak,
    best_streak = greatest(best_streak, v_streak)
  where id = new.habit_id;
  return new;
end;
$$ language plpgsql;

create trigger habit_logs_streak
  after insert or update or delete on habit_logs
  for each row execute function refresh_habit_streak();

-- ============================================================
-- Gamification: single source of truth for points/badges
-- ============================================================
create or replace function award_points(p_user uuid, p_type text, p_points int)
returns void as $$
begin
  insert into achievements (user_id, type, points)
  values (p_user, p_type, p_points)
  on conflict (user_id, type) do nothing;
end;
$$ language plpgsql;

-- Task completed -> +5 points (+5 per sub-task also completed)
create or replace function on_task_done()
returns trigger as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    perform award_points(new.user_id, 'task_complete', 5);
    update tasks set actual_minutes =
      coalesce(actual_minutes, 0) + coalesce((
        select sum(duration_minutes) from focus_sessions
        where task_id = new.id
      ), 0)
    where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tasks_done_points after update of status on tasks
  for each row execute function on_task_done();

-- Goal completed -> +50 + badge
create or replace function on_goal_done()
returns trigger as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    perform award_points(new.user_id, 'goal_complete', 50);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger goals_done_points after update of status on goals
  for each row execute function on_goal_done();

-- First task of the day badge
create or replace function on_first_task_of_day()
returns trigger as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    perform award_points(new.user_id, 'first_task', 2);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tasks_first_of_day after update of status on tasks
  for each row execute function on_first_task_of_day();

-- ============================================================
-- Defaults
-- ============================================================
create or replace function ensure_user_settings()
returns trigger as $$
begin
  insert into public.user_settings (user_id) values (new.id)
  on conflict do nothing;
  insert into public.user_state (user_id) values (new.id)
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function ensure_user_settings();

-- ============================================================
-- 0004_planner_sync.sql

-- 0004_planner_sync.sql
-- Busy-block cache for the scheduler + streak achievements + calibration helpers.

-- ============================================================
-- Cache of non-Brainer Google Calendar events (busy time)
-- ============================================================
create table calendar_busy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  title text,
  start timestamptz not null,
  "end" timestamptz not null,
  synced_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index calendar_busy_user_range_idx on calendar_busy(user_id, start, "end");

alter table calendar_busy enable row level security;
create policy "Owners manage their calendar_busy" on calendar_busy
  for all using (is_owner(user_id)) with check (is_owner(user_id));

-- ============================================================
-- Streak milestone achievement (habit streak reaches 7 → +20)
-- ============================================================
create or replace function on_habit_streak_milestone()
returns trigger as $$
begin
  if new.current_streak >= 7 and old.current_streak < 7 then
    perform award_points(new.user_id, 'streak_7', 20);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger habits_streak_milestone after update of current_streak on habits
  for each row execute function on_habit_streak_milestone();

-- ============================================================
-- Estimate calibration: fold a completed task's actual vs estimate
-- into the per-project multiplier.
-- ============================================================
create or replace function update_estimate_calibration()
returns trigger as $$
declare
  v_mult numeric;
  v_count int;
begin
  if new.status = 'done' and new.actual_minutes is not null and new.estimated_minutes is not null
     and new.estimated_minutes > 0 and old.status is distinct from 'done' then

    select multiplier, sample_count into v_mult, v_count
    from estimate_calibration
    where user_id = new.user_id and project_id = new.project_id;

    if not found then
      v_count := 0;
      v_mult := 1.0;
    end if;

    v_mult := (v_mult * v_count + (new.actual_minutes::numeric / new.estimated_minutes)) / (v_count + 1);

    insert into estimate_calibration (user_id, project_id, multiplier, sample_count)
    values (new.user_id, new.project_id, round(v_mult, 3), v_count + 1)
    on conflict (user_id, project_id)
    do update set multiplier = excluded.multiplier, sample_count = excluded.sample_count;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tasks_calibration after update of status on tasks
  for each row execute function update_estimate_calibration();

-- ============================================================
-- Productive-hour learning: fold a focus session into completion rates.
-- ============================================================
create or replace function update_productivity_pattern()
returns trigger as $$
declare
  v_hour int;
begin
  v_hour := extract(hour from new.started_at);
  insert into productivity_patterns (user_id, hour_of_day, completion_rate)
  values (new.user_id, v_hour, case when new.completed then 1 else 0 end)
  on conflict (user_id, hour_of_day) do update set
    completion_rate = (
      (productivity_patterns.completion_rate * 9) + (case when new.completed then 1 else 0 end)
    ) / 10.0;
  return new;
end;
$$ language plpgsql;

create trigger focus_sessions_pattern after insert on focus_sessions
  for each row execute function update_productivity_pattern();

