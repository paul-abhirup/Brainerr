import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"

// Stores a Web Push subscription so the send-reminders cron can reach the
// device even when the app is closed.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }
  if (!body.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })

  const admin = getAdminClient()
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: body.endpoint,
      keys: { p256dh: body.keys?.p256dh ?? "", auth: body.keys?.auth ?? "" },
    },
    { onConflict: "endpoint" },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { endpoint?: string }
  if (!body.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })

  const admin = getAdminClient()
  await admin.from("push_subscriptions").delete().eq("endpoint", body.endpoint)
  return NextResponse.json({ ok: true })
}
