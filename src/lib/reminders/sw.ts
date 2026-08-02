"use client"

// Service worker registration + Web Push subscription helpers.
// Push (app-closed reminders) is optional; browser Notification polling in
// use-reminders covers the app-open case.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null
  if (!process.env.NODE_ENV || process.env.NODE_ENV === "production") {
    // fine in both dev and prod; Turbopack serves /public at root
  }
  try {
    return await navigator.serviceWorker.register("/sw.js")
  } catch {
    return null
  }
}

export async function subscribePush(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) return null

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const urlBase64ToUint8Array = (base64: string) => {
      const padding = "=".repeat((4 - (base64.length % 4)) % 4)
      const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
      const arr = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
      return arr
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const res = await fetch("/api/reminders/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  })
  if (!res.ok) return null
  return subscription
}
