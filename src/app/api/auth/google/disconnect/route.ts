import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { decryptToken } from "@/lib/google/crypto"
import { revokeToken } from "@/lib/google/calendar"

export async function POST() {
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
    .select("refresh_token_encrypted")
    .eq("user_id", user.id)
    .single()

  if (integration?.refresh_token_encrypted) {
    try {
      await revokeToken(decryptToken(integration.refresh_token_encrypted))
    } catch {
      // token may already be revoked — continue
    }
  }

  await admin.from("calendar_integrations").delete().eq("user_id", user.id)
  return NextResponse.json({ ok: true })
}
