"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUserSettings, type UserSettingsRow } from "@/hooks/use-data"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Loader2, Save, Calendar, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
]

type WorkingHours = Record<string, [string, string] | null>

export default function SettingsPage() {
  const { data: settings, isLoading } = useUserSettings()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="These hours and limits drive the auto-scheduler when you hit Re-optimize."
      />

      {isLoading || !settings ? (
        <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <SettingsForm key={settings.user_id} settings={settings} />
      )}
    </div>
  )
}

function SettingsForm({ settings }: { settings: UserSettingsRow }) {
  const supabase = createClient()

  const initialHours: WorkingHours = {}
  const raw = (settings.working_hours ?? {}) as Record<string, string[] | null>
  for (const { key } of DAYS) {
    const range = raw[key]
    initialHours[key] = Array.isArray(range) && range.length === 2 ? [range[0], range[1]] : null
  }

  const [hours, setHours] = useState<WorkingHours>(initialHours)
  const [buffer, setBuffer] = useState(String(settings.buffer_minutes))
  const [maxDaily, setMaxDaily] = useState(String(settings.max_daily_task_minutes))
  const [horizon, setHorizon] = useState(String(settings.scheduling_horizon_days))
  const [saving, setSaving] = useState(false)

  function setDay(key: string, enabled: boolean) {
    setHours((prev) => ({
      ...prev,
      [key]: enabled ? (prev[key] ?? ["09:00", "18:00"]) : null,
    }))
  }

  function setTime(key: string, slot: 0 | 1, value: string) {
    setHours((prev) => {
      const cur = prev[key] ?? ["09:00", "18:00"]
      const next: [string, string] = slot === 0 ? [value, cur[1]] : [cur[0], value]
      return { ...prev, [key]: next }
    })
  }

  async function save() {
    setSaving(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error("Not signed in")
      const { error } = await supabase.from("user_settings").upsert({
        user_id: user.id,
        working_hours: hours,
        buffer_minutes: Number(buffer) || 0,
        max_daily_task_minutes: Number(maxDaily) || 0,
        scheduling_horizon_days: Number(horizon) || 1,
      })
      if (error) throw error
      toast.success("Settings saved")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-sm font-semibold">Working hours</h2>
        <p className="mt-0.5 text-xs text-text-secondary">
          The scheduler only places tasks inside these windows. Toggle a day off for days you don&apos;t plan.
        </p>
        <div className="mt-4 space-y-2.5">
          {DAYS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch checked={!!hours[key]} onCheckedChange={(v) => setDay(key, v)} />
                <span className="w-12 text-sm font-medium">{label}</span>
              </div>
              {hours[key] ? (
                <div className="flex items-center gap-2 text-sm">
                  <TimeInput value={hours[key]![0]} onChange={(v) => setTime(key, 0, v)} ariaLabel={`${label} start`} />
                  <span className="text-text-disabled">–</span>
                  <TimeInput value={hours[key]![1]} onChange={(v) => setTime(key, 1, v)} ariaLabel={`${label} end`} />
                </div>
              ) : (
                <span className="text-xs text-text-disabled">Off</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Scheduling</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Buffer between tasks (min)" value={buffer} onChange={setBuffer} min={0} />
          <Field label="Max planned task time / day (min)" value={maxDaily} onChange={setMaxDaily} min={15} />
          <Field label="Scheduling horizon (days)" value={horizon} onChange={setHorizon} min={1} max={30} />
        </div>
      </Card>

      <Card>
        <Link
          href="/settings/calendar"
          className="flex items-center justify-between rounded-lg px-1 py-1 transition-colors hover:bg-surface-2"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent-primary/10 p-2 text-accent-primary">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Google Calendar</p>
              <p className="text-xs text-text-secondary">Connect, sync, or disconnect your calendar</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-text-secondary" />
        </Link>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save settings
        </Button>
      </div>
    </div>
  )
}

function TimeInput({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) {
  return (
    <input
      type="time"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-sm tabular-nums outline-none",
        "focus-visible:ring-1 focus-visible:ring-ring",
      )}
    />
  )
}

function Field({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min?: number
  max?: number
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
