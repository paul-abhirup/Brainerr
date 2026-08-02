import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createEvent } from "@/lib/google/calendar"

// Focus Mode auto-block (§13.7): when a session starts, drop a busy event on
// Google Calendar so the block is defended against other people's invites.
// No brainerTaskId is set, so the sync path treats it as real busy time.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    start?: string
    end?: string
  }
  if (!body.start || !body.end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 })
  }

  try {
    const eventId = await createEvent(user.id, {
      summary: `Focus${body.title ? `: ${body.title}` : " session"}`,
      description: "Protected focus time (Brainer)",
      start: { dateTime: body.start, timeZone: "UTC" },
      end: { dateTime: body.end, timeZone: "UTC" },
      extendedProperties: { private: { type: "focus" } },
    })
    return NextResponse.json({ ok: true, eventId })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
