"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"

// Browser-side reminder polling. Works while the app is open — no push
// infrastructure needed. Web Push (send-reminders Edge Function) covers the
// app-closed case once VAPID keys + a service worker subscription are in place.
const POLL_MS = 60_000
const LEAD_MINUTES = 10
const DEDUPE_KEY = "brainer-reminder-deduped"

export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window
}

export function notificationPermission() {
  if (!isNotificationSupported()) return "unsupported" as const
  return Notification.permission
}

export function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!isNotificationSupported()) return Promise.resolve(null)
  return Notification.requestPermission()
}

function dedupeKey(taskId: string, scheduledStart: string) {
  return `${DEDUPE_KEY}:${taskId}:${scheduledStart}`
}

function alreadyNotified(taskId: string, scheduledStart: string) {
  try {
    return localStorage.getItem(dedupeKey(taskId, scheduledStart)) === "1"
  } catch {
    return false
  }
}

function markNotified(taskId: string, scheduledStart: string) {
  try {
    localStorage.setItem(dedupeKey(taskId, scheduledStart), "1")
  } catch {
    // ignore
  }
}

export function useReminders() {
  const router = useRouter()
  const supabase = createClient()

  const { data: enabled } = useQuery({
    queryKey: ["reminders-enabled"],
    queryFn: async () => {
      if (!isNotificationSupported()) return false
      return Notification.permission === "granted"
    },
  })

  useEffect(() => {
    if (!enabled) return

    const check = async () => {
      const now = Date.now()
      const from = new Date(now - 30_000).toISOString()
      const to = new Date(now + LEAD_MINUTES * 60_000).toISOString()

      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("id,title,scheduled_start,scheduled_end")
        .not("status", "eq", "done")
        .not("scheduled_start", "is", null)
        .gte("scheduled_start", from)
        .lte("scheduled_start", to)

      if (error || !tasks) return

      for (const t of tasks) {
        if (!t.scheduled_start) continue
        if (alreadyNotified(t.id, t.scheduled_start)) continue
        markNotified(t.id, t.scheduled_start)
        try {
          new Notification(t.title, {
            body: `Starting ${new Date(t.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — ready when you are.`,
            tag: `brainer-${t.id}`,
            requireInteraction: true,
          }).onclick = () => {
            window.focus()
            router.push("/now")
          }
        } catch {
          // notifications disabled mid-session
        }
      }
    }

    check()
    const id = setInterval(check, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, supabase, router])
}
