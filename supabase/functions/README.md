# Edge Function Deployment

Two cron functions ship with the app. Deploy them from the repo root.

## Prereqs

```bash
npm i -g supabase
supabase login                      # browser auth
supabase link --project-ref <ref>   # from Supabase dashboard → Settings → API
```

## Secrets (send-reminders only)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically —
do NOT set them. Only VAPID is needed:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="$NEXT_PUBLIC_VAPID_PUBLIC_KEY" \
  VAPID_PRIVATE_KEY="$VAPID_PRIVATE_KEY" \
  VAPID_SUBJECT="mailto:you@example.com"
```

(Values from `.env.local`. `VAPID_SUBJECT` is the email in the push payload.)

## Deploy

```bash
supabase functions deploy send-reminders --no-verify-jwt
supabase functions deploy recurring-generator --no-verify-jwt
```

The `schedule` keys in `supabase/config.toml` register the crons on deploy:
- `send-reminders`: `*/10 * * * *` (every 10 min)
- `recurring-generator`: `0 1 * * *` (daily 01:00 UTC)

## Verify

- Send-reminders: open the function in the Supabase dashboard → Invocations.
  With a task scheduled ~10 min out and a browser push subscription active
  (`Settings` → reminders enabled), a notification should arrive.
- Recurring-generator: complete a task marked "Repeats: Daily/Weekly/Monthly",
  run the function manually from the dashboard, and confirm a fresh open task
  (child of the completed one) appears with an advanced due date.

## Note on calendar sync

The two-way Google Calendar pull (`/api/calendar/sync`) is currently manual
("Sync now" on Settings → Calendar). To automate it without a scheduler,
point a cron at the route — or a scheduled Edge Function that calls it with a
service-role auth header.
