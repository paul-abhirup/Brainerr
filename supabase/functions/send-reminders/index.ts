// send-reminders — Supabase Edge Function (Deno).
//
// Scheduled every ~10 min (cron) via supabase config:
//   [functions.send-reminders]
//   schedule = "*/10 * * * *"
//
// Queries tasks starting within the lead window that haven't had a reminder
// logged yet, then pushes a Web Push notification to every subscription the
// user has stored. Requires VAPID keys:
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
// Generate keys locally: `npx web-push generate-vapid-keys`

import webpush from "npm:web-push"
import { createClient } from "npm:@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
)

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? ""
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:owner@brainer.app"
const LEAD_MINUTES = 10

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

Deno.serve(async () => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response("VAPID keys not configured", { status: 500 })
  }

  const now = Date.now()
  const from = new Date(now - 60_000).toISOString()
  const to = new Date(now + LEAD_MINUTES * 60_000).toISOString()

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id,user_id,title,scheduled_start")
    .not("status", "eq", "done")
    .not("scheduled_start", "is", null)
    .gte("scheduled_start", from)
    .lte("scheduled_start", to)

  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  for (const task of tasks ?? []) {
    // Skip tasks already reminded for this scheduled start.
    const { data: logged } = await supabase
      .from("reminder_log")
      .select("id")
      .eq("task_id", task.id)
      .eq("scheduled_for", task.scheduled_start)
      .limit(1)
    if (logged && logged.length > 0) continue

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys")
      .eq("user_id", task.user_id)

    const payload = JSON.stringify({
      title: task.title,
      body: `Starting ${new Date(task.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — ready when you are.`,
      taskId: task.id,
      scheduledStart: task.scheduled_start,
    })

    for (const sub of subs ?? []) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: sub.keys as { p256dh: string; auth: string },
      }
      try {
        await webpush.sendNotification(pushSub, payload)
        sent++
      } catch {
        // 404/410 → subscription dead; drop it
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
      }
    }

    await supabase.from("reminder_log").insert({
      user_id: task.user_id,
      task_id: task.id,
      scheduled_for: task.scheduled_start,
      sent_at: new Date().toISOString(),
    })
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { "Content-Type": "application/json" },
  })
})
