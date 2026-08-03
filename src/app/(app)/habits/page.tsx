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
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { toast } from "sonner"
import { Plus, Flame, Check, Snowflake, Sparkles } from "lucide-react"
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Habits & Routines"
        description="Small, repeatable wins. Missed days don&apos;t break your streak — one free freeze pass per week."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New habit
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse border border-border-subtle/50" />
          ))}
        </div>
      ) : !habits?.length ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8 text-accent-warm/70" />}
          title="No habits registered yet"
          description="Start with a tiny low-friction win: “drink a glass of water”, “stretch for 2 minutes”."
          action={
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              Create your first habit
            </Button>
          }
        />
      ) : (
        <div className="space-y-3.5">
          {habits.map((habit) => (
            <HabitCard key={habit.id} habit={habit} weekStart={weekStart} logs={logs ?? []} />
          ))}
        </div>
      )}

      <HabitDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

function HabitCard({
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
  const [animatingId, setAnimatingId] = useState<string | null>(null)

  const weekLogs = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const day = format(addDays(weekStart, i), "yyyy-MM-dd")
      return logs.find((l) => l.habit_id === habit.id && l.date === day)
    })
  }, [habit.id, weekStart, logs])

  const doneThisWeek = weekLogs.filter((l) => l?.completed).length
  const todayIndex = (new Date().getDay() + 6) % 7
  const todayLog = weekLogs[todayIndex]
  const checkedToday = todayLog?.completed ?? false
  const freezeUsedThisWeek = weekLogs.filter((l) => l && !l.completed).length >= 1

  async function toggle(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd")
    const existing = weekLogs.find((l) => l && format(new Date(l.date + "T00:00:00"), "yyyy-MM-dd") === dateStr)
    setAnimatingId(dateStr)
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
    } finally {
      setTimeout(() => setAnimatingId(null), 400)
    }
  }

  return (
    <div className="glass-card glass-card-hover flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl p-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          onClick={() => toggle(new Date())}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 shadow-sm focus-visible:ring-2 focus-visible:ring-ring/60 outline-none",
            checkedToday
              ? "border-accent-success bg-accent-success text-surface-base shadow-[0_0_12px_rgba(111,207,151,0.4)]"
              : "border-border-subtle bg-surface-2/80 text-text-disabled hover:border-accent-success/60 hover:text-accent-success",
            animatingId === format(new Date(), "yyyy-MM-dd") && "animate-pop",
          )}
          aria-label={`Toggle ${habit.title} for today`}
        >
          <Check className="h-6 w-6 stroke-[2.5]" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <p className={cn("truncate text-base font-semibold text-text-primary", checkedToday && "text-text-secondary opacity-80")}>
              {habit.title}
            </p>
            {habit.current_streak > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-accent-success/15 border border-accent-success/20 px-2.5 py-0.5 text-xs font-semibold text-accent-success">
                <Flame className="h-3.5 w-3.5 fill-current" />
                {habit.current_streak} streak
              </span>
            )}
            {freezeUsedThisWeek && (
              <span className="flex items-center gap-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 px-2 py-0.5 text-xs text-accent-primary font-medium" title="Streak freeze active for missed day">
                <Snowflake className="h-3.5 w-3.5" />
                Freeze active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-text-secondary font-medium">
            {doneThisWeek} of {habit.target_days_per_week} days completed this week
          </p>
        </div>
      </div>

      {/* Touch-Friendly 7-Day Dot Grid */}
      <div className="flex items-center justify-between sm:justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle/40">
        {weekLogs.map((log, i) => {
          const dayDate = addDays(weekStart, i)
          const isToday = i === todayIndex
          const dayName = format(dayDate, "EEE")
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-text-disabled uppercase">{dayName}</span>
              <button
                onClick={() => toggle(dayDate)}
                className={cn(
                  "h-8 w-8 rounded-xl border transition-all active:scale-95 flex items-center justify-center text-xs font-semibold focus-visible:ring-2 focus-visible:ring-ring/60 outline-none",
                  log?.completed
                    ? "border-accent-success bg-accent-success text-surface-base shadow-[0_0_8px_rgba(111,207,151,0.3)]"
                    : "border-border-subtle bg-surface-2/60 text-text-disabled hover:border-accent-success/50",
                  isToday && !log?.completed && "ring-2 ring-accent-primary/50 border-accent-primary",
                )}
                aria-label={format(dayDate, "EEEE, MMM d")}
                title={format(dayDate, "EEEE, MMM d")}
              >
                {log?.completed && <Check className="h-4 w-4 stroke-[2.5]" />}
              </button>
            </div>
          )
        })}
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
      toast.success("Habit created!")
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
          <DialogTitle>New Habit</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="h-title">Habit Name</Label>
            <Input id="h-title" autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Drink 2L water, 10 min reading" />
          </div>
          <div className="space-y-1.5">
            <Label>Weekly Goal Target</Label>
            <Select value={target} onValueChange={(v) => setTarget(v ?? "7")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} day{n > 1 ? "s" : ""} / week</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>Create Habit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

