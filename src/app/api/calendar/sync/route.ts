import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { listEventsSince } from "@/lib/google/calendar"

// Calendar → App sync. Pulls external events into calendar_busy so the
// scheduler can route around them, and unschedules tasks whose Brainer
// events were cancelled/deleted from Google directly.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getAdminClient()
  const { data: integration } = await admin
    .from("calendar_integrations")
    .select("last_synced_at")
    .eq("user_id", user.id)
    .single()

  if (!integration) {
    return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 })
  }

  const updatedMin = integration.last_synced_at
    ? new Date(integration.last_synced_at)
    : new Date(Date.now() - 30 * 864e5)

  let events
  try {
    events = await listEventsSince(user.id, updatedMin)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  let busyUpserted = 0
  let busyRemoved = 0
  let tasksUnscheduled = 0

  for (const evt of events) {
    if (evt.cancelled) {
      if (evt.brainerTaskId) {
        const { error } = await admin
          .from("tasks")
          .update({ scheduled_start: null, scheduled_end: null })
          .eq("id", evt.brainerTaskId)
          .eq("user_id", user.id)
        if (!error) tasksUnscheduled++
      } else {
        const { error } = await admin
          .from("calendar_busy")
          .delete()
          .eq("user_id", user.id)
          .eq("event_id", evt.id)
        if (!error) busyRemoved++
      }
      continue
    }

    if (evt.brainerTaskId) continue // Brainer's own events aren't busy time

    if (!evt.start || !evt.end) continue // all-day events have date only; skip

    const { error } = await admin.from("calendar_busy").upsert(
      {
        user_id: user.id,
        event_id: evt.id,
        title: evt.summary || null,
        start: new Date(evt.start).toISOString(),
        end: new Date(evt.end).toISOString(),
        synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_id" },
    )
    if (!error) busyUpserted++
  }

  await admin
    .from("calendar_integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", user.id)

  return NextResponse.json({ ok: true, busyUpserted, busyRemoved, tasksUnscheduled })
}
