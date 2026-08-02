import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { exchangeCode } from "@/lib/google/calendar"
import { encryptToken } from "@/lib/google/crypto"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin

  if (error) {
    return NextResponse.redirect(`${origin}/settings/calendar?status=denied`)
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get("google_oauth_state")?.value
  if (!state || state !== expectedState) {
    return NextResponse.redirect(`${origin}/settings/calendar?status=error`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  try {
    if (!code) throw new Error("Missing code")
    const tokens = await exchangeCode(code)
    if (!tokens.refresh_token) {
      throw new Error("No refresh token returned — re-consent needed")
    }

    const admin = getAdminClient()
    await admin.from("calendar_integrations").upsert({
      user_id: user.id,
      provider: "google",
      refresh_token_encrypted: encryptToken(tokens.refresh_token),
      access_token: tokens.access_token,
      token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      calendar_id: "primary",
      last_synced_at: new Date().toISOString(),
    })

    cookieStore.delete("google_oauth_state")
    return NextResponse.redirect(`${origin}/settings/calendar?status=connected`)
  } catch (err) {
    console.error("Google callback failed:", err)
    return NextResponse.redirect(`${origin}/settings/calendar?status=error`)
  }
}
