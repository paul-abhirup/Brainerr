"use client"

import { useReminders } from "@/hooks/use-reminders"
import { registerServiceWorker, subscribePush } from "@/lib/reminders/sw"
import { useEffect } from "react"

// Mounted once in the (app) layout. Enables browser reminder polling whenever
// notification permission is granted, and registers the service worker so Web
// Push subscriptions are possible.
export function ReminderProvider() {
  useReminders()

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    registerServiceWorker().then((registration) => {
      if (!registration || !("pushManager" in registration)) return
      if (!("Notification" in window) || Notification.permission !== "granted") return
      subscribePush(registration).catch(() => {})
    })
  }, [])

  return null
}
