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
-- Auto-own rows: client inserts never send user_id; derive it from the
-- session (auth.uid()). Admin/service-role inserts that pass user_id are
-- left untouched.
-- ============================================================
create or replace function set_user_id()
returns trigger as $$
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql;

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
    execute format(
      'create trigger %I before insert on %I for each row execute function set_user_id();',
      tbl || '_set_user', tbl
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
