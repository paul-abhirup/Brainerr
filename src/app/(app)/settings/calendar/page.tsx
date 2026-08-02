"use client"

import { useCallback, useEffect, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { toast } from "sonner"
import { Calendar, CalendarOff, Link2, Loader2, RefreshCw, CheckCircle2, XCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

type Status = "connected" | "denied" | "error" | null

export default function CalendarSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<Status>(() => {
    const s = searchParams.get("status")
    return s === "connected" || s === "denied" || s === "error" ? s : null
  })
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => {
      setStatus(null)
      const url = new URL(window.location.href)
      url.searchParams.delete("status")
      router.replace(url.pathname, { scroll: false })
    }, 4000)
    return () => clearTimeout(t)
  }, [status, router])

  const { data: integration, isLoading, refetch } = useQuery({
    queryKey: ["calendar_integration"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_integrations")
        .select("provider, calendar_id, last_synced_at, updated_at")
        .eq("provider", "google")
        .single()
      if (error && error.code !== "PGRST116") throw error
      return data
    },
  })

  const connect = () => {
    window.location.href = "/api/auth/google/start"
  }

  const disconnect = useCallback(async () => {
    setWorking(true)
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST" })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? "Disconnect failed")
      toast.success("Google Calendar disconnected")
      await refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setWorking(false)
    }
  }, [refetch])

  const lastSynced = integration?.last_synced_at

  const syncNow = useCallback(async () => {
    setWorking(true)
    try {
      const res = await fetch("/api/calendar/sync")
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? "Sync failed")
      toast.success(
        json.busyUpserted > 0 || json.busyRemoved > 0
          ? `Synced — ${json.busyUpserted} busy blocks added, ${json.busyRemoved} removed`
          : "Synced — no changes",
      )
      await refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setWorking(false)
    }
  }, [refetch])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Calendar"
        description="Your scheduled tasks mirror to Google Calendar as private events; external events are pulled back in as busy time the scheduler works around."
      />

      <StatusBanner status={status} onClose={() => setStatus(null)} />

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : integration ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent-success/10 p-2 text-accent-success">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Google Calendar connected</p>
                  <p className="text-xs text-text-secondary">
                    {integration.calendar_id} · {integration.provider}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-success/10 px-2.5 py-1 text-xs font-medium text-accent-success">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-success" /> Active
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3">
              <div className="text-xs text-text-secondary">
                Last synced:{" "}
                {lastSynced ? (
                  <span className="text-text-primary" title={format(new Date(lastSynced), "EEE, MMM d, yyyy h:mm a")}>
                    {formatDistanceToNow(new Date(lastSynced), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-text-disabled">never</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={syncNow} disabled={working}>
                  {working ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                  Sync now
                </Button>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh status
                </Button>
                <Button variant="ghost" size="sm" className="text-accent-danger" onClick={disconnect} disabled={working}>
                  {working ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CalendarOff className="mr-1.5 h-3.5 w-3.5" />}
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="rounded-full bg-surface-2 p-4 text-text-secondary">
              <Calendar className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold">Not connected</p>
              <p className="mt-1 max-w-sm text-xs text-text-secondary">
                Link your Google Calendar so planned tasks show up as events and your other meetings block out focus
                time.
              </p>
            </div>
            <Button onClick={connect}>
              <Link2 className="mr-2 h-4 w-4" /> Connect Google Calendar
            </Button>
          </div>
        )}
      </Card>

      <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-1 p-4 text-xs text-text-secondary">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" />
        <div className="space-y-1">
          <p>
            <span className="font-medium text-text-primary">App → Calendar:</span> scheduling a task creates a private
            event in your calendar. Unschedule or delete removes it.
          </p>
          <p>
            <span className="font-medium text-text-primary">Calendar → App:</span> external events become busy blocks
            that the auto-scheduler routes around.
          </p>
        </div>
      </div>
    </div>
  )
}

function StatusBanner({ status, onClose }: { status: Status; onClose: () => void }) {
  if (!status) return null
  const config = {
    connected: { tone: "border-accent-success/40 bg-accent-success/10 text-accent-success", icon: CheckCircle2, text: "Connected! Scheduled tasks will now mirror to Google Calendar." },
    denied: { tone: "border-accent-warm/40 bg-accent-warm/10 text-accent-warm", icon: XCircle, text: "Access was denied. You can try again whenever you're ready." },
    error: { tone: "border-accent-danger/40 bg-accent-danger/10 text-accent-danger", icon: XCircle, text: "Something went wrong during connection. Please try again." },
  }[status]

  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm", config.tone)}>
      <span className="flex items-center gap-2">
        <config.icon className="h-4 w-4 shrink-0" />
        {config.text}
      </span>
      <button onClick={onClose} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss">
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  )
}
