import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { authUrl } from "@/lib/google/calendar"
import { cookies } from "next/headers"
import crypto from "crypto"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"))
  }

  const state = crypto.randomBytes(24).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  })

  try {
    return NextResponse.redirect(authUrl(state))
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
