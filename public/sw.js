// Brainer service worker — Web Push notifications.
// Registered from src/lib/reminders/sw.ts when the user opts into app-closed
// reminders. Client-side polling (src/hooks/use-reminders.ts) covers the
// app-open case without needing this file.

self.addEventListener("push", (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Brainer", body: event.data.text() }
  }

  const { title = "Brainer", body = "", taskId, scheduledStart } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: `brainer-${taskId ?? ""}`,
      data: { taskId, scheduledStart },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      requireInteraction: true,
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = event.notification.data?.taskId ? "/now" : "/now"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url.includes(target)) {
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
