# ADHD Productivity App — Architecture & Build Plan
### Stack: Next.js (App Router) + Supabase

---

## 1. Scope Recap

One app, four pillars, one data layer:
- **Work tasks** (deadlines, priority, projects)
- **Habits** (daily/weekly recurring checks)
- **Notes** (freeform capture, linkable to tasks/goals)
- **Goals** (long-term → weekly → daily), synced with **Google Calendar**

Design principle driving every decision below: **low friction to capture, low friction to reschedule, high visibility of progress.**

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14+ (App Router), React Server Components where possible | SSR for fast initial load, API routes for backend glue |
| Styling | Tailwind CSS + shadcn/ui | Fast, accessible, easy to keep "clean and uncluttered" |
| Backend/DB | Supabase (Postgres + Auth + Storage + Edge Functions + Realtime) | One managed backend, RLS for per-user data isolation |
| State/data fetching | TanStack Query (React Query) + Supabase JS client | Caching, optimistic updates for snappy drag-and-drop |
| Calendar sync | Google Calendar API v3 via OAuth2, server-side (Next.js API routes / Supabase Edge Function) | Two-way sync needs a secure token store — never in the browser |
| Charts | Recharts | Dashboard, heatmap, weekly bar charts |
| Notifications | Web Push (via a service worker) + Supabase Edge Function cron for scheduled reminders | Push works offline-tolerant, no email dependency for MVP |
| Testing | Jest (unit) + Playwright (E2E) | Matches your original roadmap |
| Hosting | Vercel (frontend) + Supabase Cloud (backend) | Zero-ops for MVP |

---

## 3. High-Level Architecture

```
┌─────────────────────────────┐
│         Next.js App          │
│  (App Router, RSC + Client)  │
│                               │
│  /app                         │
│   /inbox      /planner        │
│   /goals      /habits         │
│   /notes      /focus          │
│   /dashboard  /settings       │
└──────────────┬────────────────┘
               │  supabase-js (client + server)
               ▼
┌─────────────────────────────────────────┐
│              Supabase                    │
│  ┌───────────┐  ┌────────────────────┐   │
│  │  Postgres │  │  Auth (email/OAuth)│   │
│  │  + RLS    │  │                     │   │
│  └───────────┘  └────────────────────┘   │
│  ┌───────────┐  ┌────────────────────┐   │
│  │ Realtime  │  │  Edge Functions     │   │
│  │(subscribe)│  │  - calendar-sync    │   │
│  │           │  │  - send-reminders   │   │
│  │           │  │  - recurring-gen    │   │
│  └───────────┘  └────────────────────┘   │
└──────────────┬───────────────────────────┘
               │
               ▼
     Google Calendar API (OAuth2, per-user token)
```

Key architectural decision: **all Google token handling and calendar writes happen server-side** (Edge Function or Next.js Route Handler with the service role key), never client-side. Store refresh tokens encrypted in a `calendar_integrations` table.

---

## 4. Database Schema (Postgres via Supabase)

All tables have `user_id uuid references auth.users` and RLS policies restricting rows to `auth.uid() = user_id`.

```sql
-- Goals: long-term, mid-term, weekly — self-referencing for hierarchy
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  parent_goal_id uuid references goals(id), -- null = top-level long-term goal
  title text not null,
  description text,
  horizon text check (horizon in ('long_term','monthly','weekly')) not null,
  target_date date,
  status text check (status in ('active','done','archived')) default 'active',
  created_at timestamptz default now()
);

-- Projects: optional grouping layer under a goal (e.g. "GATE CS Prep")
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  goal_id uuid references goals(id),
  name text not null,
  color text,
  created_at timestamptz default now()
);

-- Tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  project_id uuid references projects(id),
  parent_task_id uuid references tasks(id), -- sub-tasks
  title text not null,
  description text,
  due_date timestamptz,
  scheduled_start timestamptz,   -- when placed on the planner/calendar
  scheduled_end timestamptz,
  priority text check (priority in ('low','medium','high')) default 'medium',
  effort text check (effort in ('low','medium','high')),  -- energy-based suggestion feature
  status text check (status in ('todo','in_progress','done','snoozed')) default 'todo',
  reschedule_count int default 0,   -- friction tracking
  recurring_rule text,              -- RRULE string, null if one-off
  google_event_id text,             -- link to synced calendar event
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Habits (separate from tasks: they reset daily/weekly rather than being "done" once)
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  frequency text check (frequency in ('daily','weekly','custom')) default 'daily',
  target_days_per_week int default 7,
  active boolean default true,
  created_at timestamptz default now()
);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id),
  user_id uuid not null references auth.users(id),
  date date not null,
  completed boolean default false,
  unique(habit_id, date)
);

-- Notes: freeform, optionally linked to a task/goal/project
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text,
  body text,
  tags text[],                 -- simple tag array; upgrade to join table if needed later
  linked_task_id uuid references tasks(id),
  linked_goal_id uuid references goals(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Gamification
create table achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  type text not null,          -- e.g. 'streak_7', 'first_task', 'goal_complete'
  points int default 0,
  earned_at timestamptz default now()
);

-- Calendar integration token store (encrypted at rest via Supabase Vault or pgcrypto)
create table calendar_integrations (
  user_id uuid primary key references auth.users(id),
  provider text default 'google',
  refresh_token text not null,   -- encrypt this column
  access_token text,
  token_expiry timestamptz,
  calendar_id text,               -- which Google calendar to write to
  last_synced_at timestamptz
);
```

**RLS pattern (repeat per table):**
```sql
alter table tasks enable row level security;
create policy "Users manage their own tasks"
  on tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**Indexes worth adding early:** `tasks(user_id, scheduled_start)`, `tasks(user_id, due_date)`, `habit_logs(user_id, date)` — these back your planner and dashboard queries.

---

## 5. Core Feature Workflows

### 5.1 Capture (Inbox / Brain Dump)
1. Global "quick add" (keyboard shortcut, e.g. `Cmd+K`) opens a single-line input available from any screen.
2. Natural-language parsing (use a small library like `chrono-node`) extracts a date/time if present ("finish slides tomorrow 5pm") and pre-fills `due_date`.
3. Task is inserted with `project_id = null` (unsorted) — it lands in the Inbox view.
4. User can triage later: assign project, priority, effort, or convert to a note if it's not actionable.

### 5.2 Planning (Weekly + Daily)
1. Planner view queries tasks where `due_date` this week OR `scheduled_start` this week, plus all active habits.
2. Drag-and-drop (use `@dnd-kit/core`) lets the user place unscheduled tasks into time blocks on a day grid.
3. On drop, `scheduled_start`/`scheduled_end` are written, and an Edge Function pushes/updates the corresponding Google Calendar event (create if `google_event_id` is null, else patch).
4. Calendar → App direction: a periodic Edge Function (cron, every 5–15 min) polls Google Calendar's `events.list` with `updatedMin`, and blocks out busy time so the planner won't suggest scheduling over meetings. (Use Calendar push notifications/webhooks instead of polling once you're past MVP — lower latency, less API quota.)

### 5.3 Goal Hierarchy Rollup
1. Goals table is self-referencing (`parent_goal_id`), so a long-term goal has monthly children, which have weekly children.
2. Dashboard/Goals view renders a tree: long-term goal → % of linked tasks completed → drill into weekly goal → its tasks.
3. Progress % is computed as `count(tasks where status='done' and project.goal_id = X) / count(all tasks under X)` — a simple SQL view (`goal_progress`) can precompute this.

### 5.4 Notes Linking
1. Any note can optionally set `linked_task_id` or `linked_goal_id`.
2. On a task detail page, show a "Notes" tab querying `notes where linked_task_id = :taskId`.
3. Quick-link UX: while writing a note, typing `@` opens a searchable picker of tasks/goals (simple `ilike` search on title) to link inline.

### 5.5 Focus Mode (Pomodoro)
1. Client-side timer component (no backend needed for the countdown itself).
2. On session start, optionally set `tasks.status = 'in_progress'`.
3. On session complete, log a `focus_sessions` table entry (task_id, duration, completed_at) — feeds the dashboard's "hours focused" chart and can trigger an achievement.

### 5.6 Habits
1. Daily view queries all `active` habits and left-joins `habit_logs` for today's date.
2. Checking a habit off is an upsert into `habit_logs` (unique constraint on `habit_id, date` makes this idempotent).
3. Streak calculation: a SQL function or a scheduled Edge Function computes consecutive completed days; store the running streak on the habit row to avoid recomputing on every read.

### 5.7 Gamification
1. Point-earning events (task completed, streak milestone, goal completed) are handled in a single Postgres trigger or Edge Function so logic lives in one place, not scattered across the frontend.
2. Simple rule set to start: task done = +5, habit streak of 7 = +20 + badge, goal completed = +50 + badge.
3. Display current points/level on the dashboard header — small and persistent, not a full separate screen (keeps it low-pressure per your "gentle rewards" principle).

### 5.8 Dashboard / Progress Visualization
1. Weekly bar chart: planned vs completed tasks — precompute via a `daily_task_stats` view or materialized view refreshed nightly.
2. Calendar heatmap: reuse `habit_logs` + `tasks` completion dates, rendered with a lightweight heatmap component (e.g. `react-calendar-heatmap`).
3. "Missed tasks, gently surfaced" panel: query tasks where `due_date < now() and status != 'done'`, sorted by `reschedule_count desc` — the ones rescheduled most are flagged as "maybe this needs breaking down" rather than just "overdue."

---

## 6. Google Calendar Integration — Technical Detail

1. **OAuth2 flow**: Use Google's OAuth consent screen scoped to `https://www.googleapis.com/auth/calendar.events`. Implement via a Next.js Route Handler (`/api/auth/google/callback`) — do NOT use a client-only OAuth flow, since you need the refresh token server-side.
2. Store `refresh_token` in `calendar_integrations`, encrypted (Supabase Vault, or `pgcrypto` with a key held in Edge Function secrets — never in client-exposed env vars).
3. **Sync direction App → Calendar**: on task schedule/update/delete, call an Edge Function that uses the stored refresh token to get a fresh access token, then calls `events.insert` / `events.patch` / `events.delete`.
4. **Sync direction Calendar → App**: for MVP, poll `events.list` with `updatedMin` on a cron (every 10 min via `pg_cron` + Edge Function invocation). For V2, register a Calendar webhook (`events.watch`) for near-real-time updates.
5. Conflict handling: if a user edits the same event in both places between syncs, last-write-wins is fine for MVP — don't over-engineer merge logic early.

---

## 7. Frontend Structure (Next.js App Router)

```
/app
  /(auth)/login
  /(app)
    /inbox/page.tsx
    /planner/page.tsx          -- weekly/daily drag-drop view
    /goals/page.tsx
    /goals/[id]/page.tsx
    /habits/page.tsx
    /notes/page.tsx
    /notes/[id]/page.tsx
    /focus/page.tsx
    /dashboard/page.tsx
    /settings/calendar/page.tsx  -- connect/disconnect Google
  /api
    /auth/google/callback/route.ts
    /webhooks/calendar/route.ts   -- (V2) push notification receiver
/lib
  /supabase/client.ts   -- browser client
  /supabase/server.ts   -- server client (RSC, route handlers)
  /google/calendar.ts   -- token refresh + Calendar API wrapper
  /nlp/parseQuickAdd.ts -- chrono-node wrapper
/components
  /task-card, /habit-row, /goal-tree, /focus-timer, /planner-grid, ...
/supabase
  /migrations/*.sql
  /functions
    /calendar-sync
    /send-reminders
    /recurring-generator
```

Fetch pattern: use Server Components for initial data load (fast, no loading spinner for the first paint), then TanStack Query on the client for mutations and realtime-driven cache invalidation (subscribe to Supabase Realtime on `tasks`/`habit_logs` so multi-device use stays in sync).

---

## 8. Recurring Tasks & Reminders (Edge Functions)

- **recurring-generator**: nightly cron. For each task/habit with a `recurring_rule` (RRULE), materializes the next occurrence(s) into concrete rows so the planner only ever queries simple date-bound rows, not RRULE logic at read time.
- **send-reminders**: cron every 5–10 min, queries tasks with `scheduled_start` in the next N minutes and no reminder sent yet, pushes a Web Push notification.

---

## 9. Build Phasing

**Phase 1 — MVP (4–6 weeks solo)**
- Auth, Inbox capture, Tasks CRUD, basic Planner (no drag-drop yet, just list-by-day), Habits + daily check-off, one-way Calendar push (App → Google), basic dashboard chart.

**Phase 2 — Core UX**
- Drag-and-drop planner, Notes + linking, Goal hierarchy + rollup, recurring tasks, gamification, two-way Calendar sync (polling), Web Push reminders.

**Phase 3 — Polish & Scale**
- Calendar webhooks (replace polling), offline caching (service worker + local cache of today's tasks), energy-based task suggestions, friction tracking surfaced in UI, mobile app (React Native reusing the same Supabase backend).

---

## 10. Testing & Ops Notes

- Unit test the RRULE expansion and streak-calculation logic first — these are the two places subtle bugs will silently corrupt data over time.
- Playwright E2E for the three critical flows: quick-add → task appears in inbox; drag task to planner → Calendar event created; check off habit → streak increments.
- Nightly Supabase backup (built-in on paid tiers) — call this out explicitly since task/goal data is exactly the kind of thing a user will be upset to lose.

---

## 11. Additional Features for Executive Function & Mood-Driven Work

Most ADHD apps stop at "reminders + gamification." The features below target the actual executive-function bottlenecks — task initiation, working memory, time perception, and emotional regulation around work — which matter more for someone whose output is mood-dependent than another streak counter does.

### 11.1 Mood/Energy Check-in
- A 5-second check-in at day start (or on-demand): "How's your energy/mood right now?" — 3–4 simple states, not a mood diary.
- This isn't stored as sensitive health data — treat it as a transient UI preference (e.g. stored client-side or as a same-day ephemeral value), not a logged historical record. It only drives *what's shown next*, nothing more.
- Based on the answer, the "Now" view (below) re-ranks: low energy → surfaces low-effort/low-dread tasks first; high energy → surfaces the task with the biggest impact or the one that's been avoided longest.

### 11.2 "Now" View — Single Next Action
- A dedicated screen showing exactly **one** task at a time, not a list. This directly targets the ADHD failure mode where a long list itself is the thing causing paralysis.
- A "Skip / not right now" action instantly swaps in the next-best task without guilt copy — reframes avoidance as normal rather than failure.
- Optional "just the first 2 minutes" mode: shows only the very first physical action of a task (e.g. "open the document" rather than "write the report") to lower the activation barrier — directly implements the "tolerable ten" idea from your original research, made even smaller.

### 11.3 Resume / "Where Was I"
- On app open, surface the last task/note that was active, with a one-line summary — rebuilds context instantly after an interruption instead of forcing the user to reconstruct it from a full task list.
- Track `last_active_task_id` and `last_active_note_id` per user; this is cheap to add to the existing schema (a single row in a `user_state` table).

### 11.4 Forgiving Streaks
- Instead of a streak resetting to zero on a missed day, allow 1 "streak freeze" per week (used automatically, not something the user has to remember to activate) — protects motivation from a single bad day, which is exactly when someone with ADHD is most likely to abandon the habit entirely.
- Frame missed days factually ("2 of 7 this week") rather than punitively ("streak broken").

### 11.5 Dread/Friction Tagging
- Let users optionally tag a task with a "dread level" separate from priority/effort — a task can be low-effort but high-avoidance (e.g. a phone call). Surface high-dread + overdue tasks with a specific "break this down" prompt rather than just re-listing it, since repetition without a different intervention is what causes chronic avoidance.
- Combine with the existing `reschedule_count`: dread-tagged tasks rescheduled repeatedly are the strongest candidate for an automatic "let's split this into 2 smaller tasks" nudge.

### 11.6 Randomized/Assisted Task Picker
- A "pick for me" button on the Inbox/Planner that picks one task at random (optionally weighted by due date/priority) — removes decision paralysis when the user has capacity to work but can't choose what to work on.

### 11.7 Ambient Focus Support
- Optional ambient sound presets (lo-fi, white noise, binaural) bundled into Focus Mode — small addition, meaningfully increases session starts for people who use sound to enter a work state.
- Visual, not just numeric, time display in Focus Mode (a shrinking bar/ring) — addresses time blindness more effectively than a plain countdown number.

### 11.8 End-of-Day Wind-Down
- A short, optional end-of-day summary: what got done, what got moved, tomorrow's first task pre-selected — closes the day with a concrete stopping point instead of an open-ended list that follows the user into the evening.

---

## 12. UI Design System — Dark Mode

Dark-mode-first is the right call for a focus-and-mood-sensitive app: reduces visual harshness during long sessions and evening use, and lets you use light/accent sparingly as a signal rather than a default.

### 12.1 Foundational principle (current industry standard)
Avoid true black (`#000000`) as the base surface — it causes halation (glow/smearing) on OLED screens and reads as harsher than intended. The standard used by Material Design 3, and adopted across most modern dark-mode products, is a **dark neutral gray base with elevated surfaces getting progressively lighter**, not shadowed — elevation is communicated through lightness, not drop-shadows, since shadows barely read on dark backgrounds.

### 12.2 Token System

| Token | Value | Use |
|---|---|---|
| `surface-base` | `#121212` | App background |
| `surface-1` | `#1C1C1E` | Cards, list rows |
| `surface-2` | `#242426` | Modals, popovers (one level "up") |
| `surface-3` | `#2C2C2E` | Active/selected surface |
| `border-subtle` | `#3A3A3C` | Hairline dividers, card borders |
| `text-primary` | `#F2F2F2` | Primary text — not pure white, reduces glare |
| `text-secondary` | `#A0A0A5` | Secondary/meta text |
| `text-disabled` | `#5C5C5E` | Placeholder, disabled state |
| `accent-primary` | `#7C9EFF` (soft indigo-blue) | Primary actions, links, focus rings |
| `accent-warm` | `#E8A34D` (muted amber) | "Attention/due soon" — deliberately amber, not red, to avoid triggering anxiety around overdue tasks |
| `accent-success` | `#6FCF97` (muted sage green) | Completed states, streaks |
| `accent-danger` | `#E5766D` (soft coral, not saturated red) | Reserved for true destructive actions only (delete), never for "overdue" |

Deliberately avoid saturated red for anything related to lateness or missed tasks — for a user whose relationship with tasks is already mood-sensitive, a red badge on every overdue item reads as a string of small failures. Amber/warm tones carry "needs attention" without the alarm connotation.

### 12.3 Typography
- **UI/body face**: Inter or similar geometric-humanist sans (variable font) — high legibility at small sizes, neutral personality that won't fight with the content.
- **Numeric/data face**: tabular figures (Inter has this built in) for dashboard stats and timers so numbers don't jitter in width as they change.
- Base body size 15–16px, generous line-height (1.5) — long lists of tasks need breathing room to not feel like a wall of text, which is its own executive-function tax.

### 12.4 Layout Principles
- **One primary action visible per screen** — the "Now" view is the extreme version of this, but even the Planner should have one obvious primary CTA (e.g. "Add task"), not several competing buttons.
- Generous whitespace over dense information — resist the urge to show every metadata field (priority, effort, project, due date) on every task row; show 1–2 at rest, reveal the rest on tap/hover.
- Rounded corners (8–12px radius) on cards — softer geometry reads as lower-pressure than sharp edges, consistent with the "gentle, not punitive" tone the app is going for throughout.
- Respect `prefers-reduced-motion` — keep transitions functional (150–200ms ease) rather than decorative; ADHD users are often sensitive to unnecessary motion competing for attention.
- Visible focus rings (`accent-primary` outline) on every interactive element for keyboard navigation — accessibility floor, not optional.

### 12.5 Component Notes
- **Task cards**: surface-1 background, border-subtle 1px border, priority shown as a small left-edge color bar (not a full-card tint) — keeps color-coding visible without making the whole list visually loud.
- **Habit checkboxes**: large tap targets (44px minimum), immediate fill animation on check — small satisfying feedback loop matters more here than almost anywhere else in the app.
- **Focus Mode**: near-fullscreen, minimal chrome, surface-base background with only the timer ring and current task title visible — this is the one screen where you actively remove everything else.
- **Empty states**: never a bare "No tasks" — pair with a single clear action ("Add your first task" / "Nothing due today — enjoy it"), following the interface-voice-not-guilt tone throughout.

---

## 13. Features Aimed Specifically at Getting Work Done & Hitting Goals

Everything above helps with capture and emotional friction. This section is about the mechanics of actually converting a goal into finished work — the features that matter most here, roughly in priority order to build:

### 13.1 Daily "Big 3" (Most Important Tasks)
- Each morning (or the night before), prompt the user to pick 1–3 tasks as the day's real target — everything else on the planner is secondary.
- Schema: a small `daily_focus` table (`user_id`, `date`, `task_ids uuid[]`) — deliberately separate from `tasks` so "today's focus" is a view, not a task property.
- The Now view (section 11.2) draws from this list first before falling back to the general planner queue.
- This single feature does more for "goals actually get hit" than any dashboard — it forces daily prioritization instead of working reactively off whatever's on top of a long list.

### 13.2 Auto-Scheduling (Reclaim.ai / Motion-style)
- The single highest-leverage feature for this app. Instead of the user manually placing every task on the calendar, an algorithm proposes placement automatically, turning "I have 40 open tasks and don't know when I'll do them" into a concrete calendar the user can just follow. Full algorithm spec in **Section 14**.

### 13.3 Task Dependencies
- Add `blocked_by_task_id` (or a small `task_dependencies` join table if a task can depend on more than one other) so sequential work — like syllabus topics that build on each other — can't be scheduled or suggested out of order.
- The planner and auto-scheduler both skip a task while its dependency is incomplete, which prevents the very ADHD-unfriendly experience of staring at a task you technically can't start yet.

### 13.4 Estimate vs. Actual — a Calibration Loop
- Add `estimated_minutes` and `actual_minutes` to `tasks` (the latter populated from Focus Mode session logs, section 5.5/11.7).
- After a task is completed, if actual time diverged significantly from the estimate, show a one-line reflection: "This took 2x your estimate — want similar tasks to get more buffer automatically?"
- Store a per-project or per-tag average multiplier and apply it as a default suggestion for future estimates — this is a simple heuristic, not ML, and it directly targets ADHD time-blindness with real personal data instead of generic advice.

### 13.5 Weekly Review Ritual (structured, not just a prompt)
- A guided, single-screen flow the user runs once a week: shows (a) goals with no tasks scheduled for the coming week — a goal silently going nowhere is the most common way long-term goals die, (b) tasks rescheduled 3+ times (candidates to break down or drop), (c) last week's completion rate, (d) a prompt to pick next week's Big 3 per active goal.
- Keep it to under 2 minutes end-to-end — a heavy review ritual won't survive contact with an ADHD user's actual week; the point is to catch drift, not audit performance.

### 13.6 Goal Velocity & Completion Forecasting
- For any goal, compute completed-tasks-per-week over the trailing 3–4 weeks and project a naive completion date from remaining tasks at that pace (`goal_forecast` view or Edge Function).
- Surface it plainly on the goal page: "At your current pace, this finishes around [date]" — makes slipping goals visible *before* the deadline is imminent, rather than only at the point of crisis, which is the pattern this app is trying to break.

### 13.7 Protected Focus Time (Calendar Auto-Block)
- When a Focus Mode session starts, immediately create a "busy" Google Calendar event for its duration (via the same sync path as section 6) — protects the block from being double-booked by someone else's meeting invite, which is a real failure mode for work-context task apps that only show tasks, not actually defend the time.

### 13.8 Eisenhower (Urgent/Important) View
- An alternate view of the same task data, plotted on urgency (due date proximity) × importance (priority) — useful on days the user has capacity to think strategically rather than just execute the Big 3. This is a filter/view on existing columns, not new schema.

### 13.9 Stale Backlog Detection
- Separate from reschedule-count friction tracking: flag tasks that have simply sat untouched (no status change, no reschedule) for 14+ days. These are quietly dead weight in the inbox and should surface in the weekly review as "still relevant? snooze indefinitely, or drop it."

### 13.10 Project/Goal Templates
- Let a completed goal be saved as a reusable template (its projects + task skeleton, dates stripped) — useful for genuinely recurring goal types (e.g., "exam prep cycle," "quarterly work review") so starting the next cycle doesn't mean rebuilding structure from scratch, which is exactly the kind of setup friction that causes a goal to never get started.

**If you're prioritizing for the MVP-to-V2 jump:** build 13.1 (Big 3), 13.5 (weekly review), and 13.4 (estimate calibration) first — they're cheap schema-wise and directly change daily behavior. Save 13.2 (auto-scheduling) for after the manual planner is solid, since it's the most complex piece and depends on calendar sync already being reliable.

---

## 14. Auto-Scheduling Algorithm — Detailed Spec

At this scale (one user's personal task list, not a multi-tenant optimization problem), a **greedy, priority-ordered first-fit algorithm** is the right tool — not a constraint solver or ILP. It's fast, predictable, and — critically for an ADHD-focused app — its output is easy to explain to the user ("scheduled here because it's due soonest and high priority"), which matters more than squeezing out a theoretically optimal packing.

### 14.1 Additional Schema Needed

```sql
alter table tasks add column estimated_minutes int;
alter table tasks add column is_pinned boolean default false;   -- true once manually dragged; algorithm never touches pinned tasks
alter table tasks add column at_risk boolean default false;     -- true if it couldn't be placed before its due date

create table user_settings (
  user_id uuid primary key references auth.users(id),
  working_hours jsonb default '{"mon":["09:00","18:00"],"tue":["09:00","18:00"],"wed":["09:00","18:00"],"thu":["09:00","18:00"],"fri":["09:00","18:00"],"sat":null,"sun":null}',
  buffer_minutes int default 10,          -- gap enforced between scheduled blocks
  max_daily_task_minutes int default 240, -- cap on total auto-scheduled minutes/day
  scheduling_horizon_days int default 7
);

-- Learn from manual overrides, used to tune future placement defaults
create table scheduling_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  task_id uuid not null references tasks(id),
  suggested_start timestamptz not null,
  user_chosen_start timestamptz not null,
  created_at timestamptz default now()
);

-- Derived productivity-by-hour, used for effort-aware placement (optional, V2+)
create table productivity_patterns (
  user_id uuid not null references auth.users(id),
  hour_of_day int not null,          -- 0-23
  completion_rate numeric,           -- fraction of focus sessions completed vs abandoned, started in this hour
  primary key (user_id, hour_of_day)
);
```

### 14.2 Inputs Per Run
1. All `tasks` where `status = 'todo'` and `is_pinned = false` (pinned/manually-placed tasks are treated as fixed busy blocks, not rescheduled).
2. `user_settings` — working hours, buffer, daily cap, horizon length.
3. Busy blocks for the horizon: synced Google Calendar events (section 6) **plus** already-pinned tasks.
4. `productivity_patterns`, if present, for effort-aware placement (optional refinement, not required for V1).

### 14.3 Step-by-Step Algorithm

**Step 1 — Build free/busy map.**
For each day in the horizon, start with the day's working-hours window, then subtract every busy interval (calendar events + pinned tasks + buffer padding around each). The result is an ordered list of free intervals per day, e.g. `[{day: '2026-08-04', slots: [[09:00,10:30],[13:00,15:00]]}, ...]`.

**Step 2 — Order the task queue.**
Sort eligible tasks by a composite key, evaluated in this order (each level only breaks ties in the level above):
1. Dependency readiness — a task with an incomplete `blocked_by_task_id` is excluded from this pass entirely; it becomes eligible once its blocker gets a `scheduled_end` assigned (process dependency chains in topological order).
2. Has a `due_date` before the horizon end → these go first, sorted by due date ascending.
3. `priority` (high → medium → low) as the tiebreaker within the same due date.
4. Tasks with no `due_date` go last, in creation-date order (oldest first, so nothing is buried forever).

**Step 3 — Place each task (first-fit, with an optional effort-aware pass).**
```
for task in ordered_queue:
    earliest_start = max(now, task.blocker?.scheduled_end + buffer, working_hours_start)
    
    if task.effort == 'high' and productivity_patterns exist:
        # try peak-productivity windows first, before falling back to plain first-fit
        candidate = find_first_fit(free_map, earliest_start, task.estimated_minutes,
                                    prefer_hours = top_productivity_hours, before = task.due_date)
    else:
        candidate = find_first_fit(free_map, earliest_start, task.estimated_minutes,
                                    before = task.due_date)
    
    if candidate is None:
        task.at_risk = true          # couldn't fit before its due date — never silently push past deadline
        continue
    
    if daily_scheduled_minutes[candidate.day] + task.estimated_minutes > max_daily_task_minutes:
        candidate = find_first_fit(free_map, next_day_start, task.estimated_minutes, before = task.due_date)
        if candidate is None:
            task.at_risk = true
            continue
    
    task.scheduled_start = candidate.start
    task.scheduled_end   = candidate.start + task.estimated_minutes
    free_map.subtract(candidate.start, task.estimated_minutes + buffer_minutes)
    daily_scheduled_minutes[candidate.day] += task.estimated_minutes
```

**Step 4 — Write & sync.**
Batch-write all `scheduled_start`/`scheduled_end`/`at_risk` updates in one transaction, then call the Calendar-push path (section 6) for each newly scheduled task to create/update its Google Calendar event.

**Step 5 — Return a summary, not a silent mutation.**
The function returns `{ scheduled: [...], at_risk: [...] }`. The frontend shows this as a short review ("11 tasks scheduled this week, 2 couldn't fit before their due date — want to adjust?") before the user navigates away — auto-placement should always be visible and reversible, never a black box.

### 14.4 When It Runs
- **Incremental** (default): triggered via a Supabase Database Webhook on `tasks` insert — a single new task gets slotted into the existing free/busy map without touching anything already scheduled. This keeps the schedule stable day-to-day, which matters for trust in the feature.
- **Full re-optimize** (manual, on-demand): a "Re-optimize my week" button the user presses explicitly, which reruns the algorithm across all non-pinned tasks in the horizon and shows a diff ("6 tasks will move") before committing. Never run a full reshuffle silently overnight — waking up to a rearranged day is disorienting for anyone, more so for someone who already struggles with a sense of control over their schedule.

### 14.5 Learning From Overrides
Every time a user drags an auto-placed (non-pinned) task to a new time, log it to `scheduling_feedback` and flip `is_pinned = true` on that task. A weekly Edge Function scans this table for patterns — e.g., consistently moving high-effort tasks out of early morning — and nudges the user's `working_hours`/effort-window defaults accordingly. Keep this a simple aggregation (most common override direction), not a machine-learning model — the goal is better defaults over time, not a black-box recommender the user can't reason about.

### 14.6 Edge Cases
- **Nothing fits before the due date at all:** flag `at_risk` and surface it clearly rather than scheduling late without telling the user — the user needs to either extend the deadline, drop the task, or free up time elsewhere.
- **Missing `estimated_minutes`:** either prompt at capture time, or default from the historical average duration of completed tasks in the same project (fall back to a flat 30 minutes if no history exists yet).
- **Stale calendar data:** if the last calendar sync is older than ~30 minutes, trigger a fresh pull before running the algorithm — scheduling against stale busy/free data risks double-booking a real meeting.
- **Dependency chain longer than the horizon:** warn explicitly ("this chain needs more than 7 days to fit") rather than truncating silently.
