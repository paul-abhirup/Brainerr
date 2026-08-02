import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"
import {
  createEvent,
  patchEvent,
  deleteEvent,
  taskToEvent,
} from "@/lib/google/calendar"

/**
 * POST /api/calendar/push-scheduled
 * Syncs scheduled tasks to Google Calendar (App → Calendar direction).
 * Body: { taskIds?: string[] } — omitted = all currently scheduled tasks.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = getAdminClient()
  const { data: integration } = await admin
    .from("calendar_integrations")
    .select("user_id")
    .eq("user_id", user.id)
    .single()
  if (!integration) {
    return NextResponse.json({ ok: false, reason: "not_connected" }, { status: 200 })
  }

  let body: { taskIds?: string[] } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const query = admin.from("tasks").select("*").eq("user_id", user.id)
  if (body.taskIds?.length) {
    query.in("id", body.taskIds)
  }
  const { data: tasks } = await query

  const results: Record<string, string> = {}
  for (const task of tasks ?? []) {
    try {
      if (task.scheduled_start && task.scheduled_end) {
        const evt = taskToEvent({
          id: task.id,
          title: task.title,
          description: task.description,
          scheduled_start: task.scheduled_start,
          scheduled_end: task.scheduled_end,
        })
        if (task.google_event_id) {
          await patchEvent(user.id, task.google_event_id, evt)
        } else {
          const eventId = await createEvent(user.id, evt)
          await admin.from("tasks").update({ google_event_id: eventId }).eq("id", task.id)
          results[task.id] = eventId
        }
      } else if (task.google_event_id) {
        await deleteEvent(user.id, task.google_event_id)
        await admin.from("tasks").update({ google_event_id: null }).eq("id", task.id)
      }
      results[task.id] = "ok"
    } catch (err) {
      results[task.id] = `error: ${(err as Error).message}`
    }
  }

  await admin.from("calendar_integrations").update({
    last_synced_at: new Date().toISOString(),
  }).eq("user_id", user.id)

  return NextResponse.json({ ok: true, results })
}
