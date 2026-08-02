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
