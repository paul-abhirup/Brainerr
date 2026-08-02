"use client"

import { useMemo, useState } from "react"
import { format, startOfWeek, addDays } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useHabits, useHabitLogs, type HabitRow } from "@/hooks/use-data"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, Flame, Check, Snowflake } from "lucide-react"
import { cn } from "@/lib/utils"

export default function HabitsPage() {
  const { data: habits, isLoading } = useHabits()
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const { data: logs } = useHabitLogs(
    format(weekStart, "yyyy-MM-dd"),
    format(addDays(weekStart, 7), "yyyy-MM-dd"),
  )
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Habits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Small, repeatable wins. Missed days don&apos;t break your streak — one free pass a week.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New habit
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : !habits?.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-subtle py-16 text-center">
          <p className="text-sm text-text-secondary">No habits yet</p>
          <p className="text-xs text-text-disabled">Start with something tiny — “drink water”, “10 push-ups”.</p>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            Create your first habit
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <HabitRow key={habit.id} habit={habit} weekStart={weekStart} logs={logs ?? []} />
          ))}
        </div>
      )}

      <HabitDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

function HabitRow({
  habit,
  weekStart,
  logs,
}: {
  habit: HabitRow
  weekStart: Date
  logs: { id: string; habit_id: string; date: string; completed: boolean }[]
}) {
  const supabase = createClient()
  const qc = useQueryClient()
  const todayStr = format(new Date(), "yyyy-MM-dd")

  const weekLogs = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const day = format(addDays(weekStart, i), "yyyy-MM-dd")
      return logs.find((l) => l.habit_id === habit.id && l.date === day)
    })
  }, [habit.id, weekStart, logs])

  const doneThisWeek = weekLogs.filter((l) => l?.completed).length
  const todayLog = weekLogs[6]
  const checkedToday = todayLog?.completed ?? false
  const freezeUsedThisWeek = weekLogs.filter((l) => l && !l.completed).length >= 1

  async function toggle(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd")
    const existing = weekLogs.find((l) => l && format(new Date(l.date + "T00:00:00"), "yyyy-MM-dd") === dateStr)
    try {
      const { error } = await supabase.from("habit_logs").upsert(
        {
          id: existing?.id,
          habit_id: habit.id,
          date: dateStr,
          completed: !(existing?.completed ?? false),
        },
        { onConflict: "habit_id,date" },
      )
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ["habit_logs"] })
      await qc.invalidateQueries({ queryKey: ["habits"] })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-1 p-4">
      <button
        onClick={() => toggle(new Date())}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all",
          checkedToday
            ? "border-accent-success bg-accent-success text-surface-base"
            : "border-border-subtle bg-surface-2 text-text-disabled hover:border-accent-success/60",
        )}
        aria-label={`Toggle ${habit.title} for today`}
      >
        <Check className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("truncate text-sm font-medium", checkedToday && "text-text-secondary")}>
            {habit.title}
          </p>
          {habit.current_streak > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-accent-success/15 px-2 py-0.5 text-xs font-medium text-accent-success">
              <Flame className="h-3 w-3" />
              {habit.current_streak}
            </span>
          )}
          {freezeUsedThisWeek && (
            <span className="flex items-center gap-0.5 rounded-full bg-accent-primary/10 px-2 py-0.5 text-xs text-accent-primary" title="Freeze used this week — a missed day won't break the streak">
              <Snowflake className="h-3 w-3" />
              freeze
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          {doneThisWeek} of {habit.target_days_per_week} this week
        </p>
        <div className="mt-2 flex gap-1.5">
          {weekLogs.map((log, i) => {
            const isToday = i === 6
            return (
              <button
                key={i}
                onClick={() => toggle(addDays(weekStart, i))}
                className={cn(
                  "h-5 w-5 rounded-full border transition-colors",
                  log?.completed
                    ? "border-accent-success bg-accent-success"
                    : "border-border-subtle bg-surface-2 hover:border-accent-success/50",
                  isToday && "ring-2 ring-accent-primary/40",
                )}
                aria-label={format(addDays(weekStart, i), "EEE")}
                title={format(addDays(weekStart, i), "EEE d")}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function HabitDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [title, setTitle] = useState("")
  const [target, setTarget] = useState("7")
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from("habits").insert({
        title: title.trim(),
        target_days_per_week: Number(target),
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ["habits"] })
      setTitle("")
      onOpenChange(false)
      toast.success("Habit created")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New habit</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="h-title">Habit</Label>
            <Input id="h-title" autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Drink a glass of water" />
          </div>
          <div className="space-y-1.5">
            <Label>Target days per week</Label>
            <Select value={target} onValueChange={(v) => setTarget(v ?? "7")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} day{n > 1 ? "s" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
