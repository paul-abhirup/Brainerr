import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Check if Supabase environment variables are configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const isAuthRoute = request.nextUrl.pathname.startsWith("/login")
    const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/")
    
    if (!isAuthRoute && !isAuthCallback) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login")
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/")

  if (!user && !isAuthRoute && !isAuthCallback) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/inbox"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
