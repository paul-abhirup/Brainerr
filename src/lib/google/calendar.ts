import { getAdminClient } from "@/lib/supabase/admin"
import { decryptToken } from "@/lib/google/crypto"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const API_BASE = "https://www.googleapis.com/calendar/v3"

export interface GoogleAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function googleConfig(): GoogleAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth env vars (GOOGLE_CLIENT_ID/SECRET, REDIRECT_URI) are not configured")
  }
  return { clientId, clientSecret, redirectUri }
}

export function authUrl(state: string): string {
  const cfg = googleConfig()
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

async function exchangeRefreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const cfg = googleConfig()
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

export async function exchangeCode(code: string): Promise<{
  access_token: string
  refresh_token: string | null
  expires_in: number
}> {
  const cfg = googleConfig()
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  })
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    throw new Error(`Code exchange failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

export async function revokeToken(refreshToken: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
    method: "POST",
  }).catch(() => {})
}

interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  transparency?: "transparent" | "opaque"
  extendedProperties?: { private: Record<string, string> }
}

/**
 * Get a live access token for a user's Google integration, refreshing if needed.
 * Only use in server code — never expose tokens to the browser.
 */
export async function getAccessToken(userId: string): Promise<{ accessToken: string; calendarId: string }> {
  const admin = getAdminClient()
  const { data } = await admin
    .from("calendar_integrations")
    .select("*")
    .eq("user_id", userId)
    .single()
  if (!data || !data.refresh_token_encrypted) {
    throw new Error("Google Calendar not connected")
  }
  const refreshToken = decryptToken(data.refresh_token_encrypted)
  const { access_token, expires_in } = await exchangeRefreshToken(refreshToken)
  await admin.from("calendar_integrations").update({
    access_token,
    token_expiry: new Date(Date.now() + expires_in * 1000).toISOString(),
  }).eq("user_id", userId)
  return { accessToken: access_token, calendarId: data.calendar_id ?? "primary" }
}

async function api(userId: string, path: string, init?: RequestInit): Promise<Response> {
  const { accessToken } = await getAccessToken(userId)
  return fetch(`${API_BASE}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })
}

export async function createEvent(userId: string, evt: CalendarEvent): Promise<string> {
  const { calendarId } = await getAccessToken(userId)
  const res = await api(userId, `calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(evt),
  })
  if (!res.ok) throw new Error(`createEvent failed: ${res.status} ${await res.text()}`)
  return (await res.json()).id
}

export async function patchEvent(userId: string, eventId: string, evt: Partial<CalendarEvent>): Promise<void> {
  const { calendarId } = await getAccessToken(userId)
  const res = await api(userId, `calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(evt),
  })
  if (!res.ok) throw new Error(`patchEvent failed: ${res.status} ${await res.text()}`)
}

export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const { calendarId } = await getAccessToken(userId)
  const res = await api(userId, `calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: "DELETE",
  })
  if (!res.ok && res.status !== 404) throw new Error(`deleteEvent failed: ${res.status}`)
}

export interface BusyEvent {
  id: string
  summary: string
  start: string
  end: string
  brainerTaskId?: string
  cancelled?: boolean
}

/** Pull events changed since a timestamp (Calendar → App direction). */
export async function listEventsSince(
  userId: string,
  updatedMin: Date,
): Promise<BusyEvent[]> {
  const { calendarId } = await getAccessToken(userId)
  const params = new URLSearchParams({
    updatedMin: updatedMin.toISOString(),
    singleEvents: "true",
    maxResults: "250",
    orderBy: "startTime",
    timeMin: new Date(Date.now() - 30 * 864e5).toISOString(),
  })
  const res = await api(userId, `calendars/${encodeURIComponent(calendarId)}/events?${params}`)
  if (!res.ok) throw new Error(`events.list failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return (json.items ?? []).map((item: Record<string, unknown>) => ({
    id: String(item.id),
    summary: String(item.summary ?? ""),
    start: (item.start as { dateTime?: string })?.dateTime ?? String(item.start),
    end: (item.end as { dateTime?: string })?.dateTime ?? String(item.end),
    brainerTaskId:
      (item.extendedProperties as { private?: Record<string, string> })?.private?.["brainerTaskId"],
    cancelled: (item.status as string | undefined) === "cancelled",
  }))
}

export function taskToEvent(task: {
  id: string
  title: string
  description?: string | null
  scheduled_start: string
  scheduled_end: string
}): CalendarEvent {
  return {
    summary: task.title,
    description: task.description ?? "Brainer task",
    start: { dateTime: task.scheduled_start, timeZone: "UTC" },
    end: { dateTime: task.scheduled_end, timeZone: "UTC" },
    extendedProperties: { private: { brainerTaskId: task.id } },
  }
}
