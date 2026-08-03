"use client"

import { useMemo, useState } from "react"
import { addDays, format, startOfWeek, subDays } from "date-fns"
import { useRouter } from "next/navigation"
import { useTasks, type TaskRow } from "@/hooks/use-tasks"
import { useGoals, useProjects } from "@/hooks/use-data"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { toast } from "sonner"
import { CalendarClock, Flag, AlarmClock, AlertTriangle, CheckCircle2, GitBranch, Target, Sparkles, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const RESCHEDULE_THRESHOLD = 3
const STALE_DAYS = 14

export default function ReviewPage() {
  const router = useRouter()
  const supabase = createClient()
  const { data: tasks } = useTasks()
  const { data: goals } = useGoals()
  const { data: projects } = useProjects()

  const [big3, setBig3] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)

  const now = useMemo(() => new Date(), [])
  const lastWeekStart = useMemo(() => startOfWeek(subDays(now, 7), { weekStartsOn: 1 }), [now])
  const lastWeekEnd = addDays(lastWeekStart, 7)
  const nextWeekStart = useMemo(() => addDays(startOfWeek(now, { weekStartsOn: 1 }), 7), [now])
  const nextWeekEnd = addDays(nextWeekStart, 7)

  const activeGoals = useMemo(() => (goals ?? []).filter((g) => g.status === "active"), [goals])

  const goalProjectIds = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const p of projects ?? []) {
      if (!p.goal_id) continue
      if (!map.has(p.goal_id)) map.set(p.goal_id, new Set())
      map.get(p.goal_id)!.add(p.id)
    }
    return map
  }, [projects])

  const openTasks = useMemo(() => (tasks ?? []).filter((t) => t.status !== "done"), [tasks])

  const goalsSlipping = useMemo(() => {
    return activeGoals
      .map((goal) => {
        const goalTasks = openTasks.filter(
          (t) => goalProjectIds.get(goal.id)?.has(t.project_id ?? "") || !t.project_id,
        )
        const scheduledNext = goalTasks.filter(
          (t) => t.scheduled_start && new Date(t.scheduled_start) >= nextWeekStart && new Date(t.scheduled_start) < nextWeekEnd,
        )
        const hasWork = goalTasks.length > 0
        return { goal, openCount: goalTasks.length, scheduledCount: scheduledNext.length, hasWork }
      })
      .filter((g) => g.hasWork && g.scheduledCount === 0)
  }, [activeGoals, openTasks, goalProjectIds, nextWeekStart, nextWeekEnd])

  const rescheduled = useMemo(
    () =>
      openTasks
        .filter((t) => t.reschedule_count >= RESCHEDULE_THRESHOLD)
        .sort((a, b) => b.reschedule_count - a.reschedule_count)
        .slice(0, 10),
    [openTasks],
  )

  const staleBacklog = useMemo(
    () =>
      openTasks
        .filter((t) => {
          const touched = new Date(t.last_touched_at)
          return now.getTime() - touched.getTime() > STALE_DAYS * 864e5
        })
        .sort((a, b) => new Date(a.last_touched_at).getTime() - new Date(b.last_touched_at).getTime())
        .slice(0, 10),
    [openTasks, now],
  )

  const lastWeekStats = useMemo(() => {
    const completed = (tasks ?? []).filter((t) => t.completed_at && new Date(t.completed_at) >= lastWeekStart && new Date(t.completed_at) < lastWeekEnd)
    const due = (tasks ?? []).filter((t) => t.due_date && new Date(t.due_date) >= lastWeekStart && new Date(t.due_date) < lastWeekEnd)
    const doneOfDue = due.filter((t) => t.status === "done" && t.completed_at)
    const rate = due.length ? Math.round((doneOfDue.length / due.length) * 100) : null
    return { completed: completed.length, due: due.length, rate }
  }, [tasks, lastWeekStart, lastWeekEnd])

  const candidatesByGoal = useMemo(() => {
    const map = new Map<string, TaskRow[]>()
    for (const goal of activeGoals) {
      const goalTasks = openTasks.filter(
        (t) => goalProjectIds.get(goal.id)?.has(t.project_id ?? "") || !t.project_id,
      )
      const sorted = [...goalTasks].sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity
        return (b.priority === "high" ? 1 : 0) - (a.priority === "high" ? 1 : 0) || da - db
      })
      map.set(goal.id, sorted.slice(0, 3))
    }
    return map
  }, [activeGoals, openTasks, goalProjectIds])

  async function touchTask(id: string) {
    const { error } = await supabase.from("tasks").update({ last_touched_at: new Date().toISOString() }).eq("id", id)
    if (error) toast.error(error.message)
    else toast.success("Kept — no longer stale")
  }

  async function snoozeTask(id: string) {
    const { error } = await supabase.from("tasks").update({ status: "snoozed" }).eq("id", id)
    if (error) toast.error(error.message)
    else toast.success("Snoozed indefinitely")
  }

  async function scheduleBig3() {
    const picks = Object.entries(big3).filter(([, ids]) => ids.length > 0)
    if (!picks.length) {
      toast.info("Pick at least one task to schedule")
      return
    }
    setSaving(true)
    try {
      for (const [, ids] of picks) {
        const slots = [9, 10, 11] // Mon/Tue/Wed 9am
        for (let i = 0; i < ids.length; i++) {
          const start = new Date(nextWeekStart)
          start.setDate(start.getDate() + i)
          start.setHours(slots[i] ?? 9, 0, 0, 0)
          const end = new Date(start.getTime() + 60 * 60000)
          const { error } = await supabase
            .from("tasks")
            .update({ scheduled_start: start.toISOString(), scheduled_end: end.toISOString(), is_pinned: true })
            .eq("id", ids[i])
          if (error) throw error
        }
      }
      toast.success("Big 3 scheduled for next week — review the planner")
      setBig3({})
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const [aiReview, setAiReview] = useState<{ headline: string; summary: string; recommendations: string[] } | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)

  async function handleGenerateAiReview() {
    setLoadingAi(true)
    try {
      const res = await fetch("/api/ai/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completedCount: lastWeekStats.completed,
          habitRate: lastWeekStats.rate || 50,
          focusMinutes: 120,
          rescheduleCount: rescheduled.length,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiReview(data)
      toast.success("✨ AI Executive Brief generated!")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingAi(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Weekly review"
          description="A 2-minute pass to catch drift. Nothing to fill in — just look."
        />
        <Button
          onClick={handleGenerateAiReview}
          disabled={loadingAi}
          className="font-bold gap-1.5 shrink-0 cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          {loadingAi ? "Analyzing…" : "AI Weekly Brief"}
        </Button>
      </div>

      {/* AI Review Summary Card */}
      {aiReview && (
        <Card className="border-2 border-primary/40 bg-primary/5 p-6 shadow-md space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">{aiReview.headline}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{aiReview.summary}</p>
          <div className="pt-2 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-primary block">
              Coach Recommendations for Next Week:
            </span>
            <ul className="space-y-1 text-xs text-foreground">
              {aiReview.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Card className="flex-col sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-secondary p-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Last week: <span className="tabular-nums">{lastWeekStats.completed} completed</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {lastWeekStats.rate === null
                ? "Nothing was due last week."
                : `${lastWeekStats.rate}% of due tasks finished (${lastWeekStats.due} due).`}
            </p>
          </div>
        </div>
      </Card>

      {goalsSlipping.length > 0 && (
        <Section
          icon={<CalendarClock className="h-4 w-4" />}
          title="Goals going nowhere"
          tone="text-warning"
          body="These have open work but nothing scheduled for next week — the most common way long-term goals die."
        >
          <ul className="space-y-1.5">
            {goalsSlipping.map(({ goal, openCount }) => (
              <li key={goal.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{goal.title}</p>
                  <p className="text-xs text-muted-foreground">{openCount} open task{openCount !== 1 ? "s" : ""}, none scheduled</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push("/planner")}>
                  Plan week
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        icon={<GitBranch className="h-4 w-4" />}
        title="Repeatedly rescheduled"
        tone="text-warning"
        body="Rescheduled 3+ times — usually needs breaking into a smaller first step, or snoozing it for later."
      >
        {rescheduled.length === 0 ? (
          <p className="text-sm text-disabled">Nothing here — nice.</p>
        ) : (
          <ul className="space-y-1.5">
            {rescheduled.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">Rescheduled {t.reschedule_count}×</p>
                </div>
                <div className="flex flex-col sm:flex-row shrink-0 gap-1.5 sm:gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/inbox?new=1&title=${encodeURIComponent("Break down: " + t.title)}`)}>
                    Break down
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => snoozeTask(t.id)}>
                    Snooze
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={<AlarmClock className="h-4 w-4" />}
        title="Stale backlog"
        tone="text-muted-foreground"
        body={`Sitting untouched for ${STALE_DAYS}+ days. Keep it, snooze it, or let it go.`}
      >
        {staleBacklog.length === 0 ? (
          <p className="text-sm text-disabled">No stale tasks.</p>
        ) : (
          <ul className="space-y-1.5">
            {staleBacklog.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">Last touched {format(new Date(t.last_touched_at), "MMM d")}</p>
                </div>
                <div className="flex flex-col sm:flex-row shrink-0 gap-1.5 sm:gap-2">
                  <Button variant="outline" size="sm" onClick={() => touchTask(t.id)}>
                    Still relevant
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => snoozeTask(t.id)}>
                    Snooze
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={<Target className="h-4 w-4" />}
        title="Next week's Big 3"
        tone="text-primary"
        body="Pick up to 3 per active goal — they'll be pinned to next Mon/Tue/Wed mornings."
      >
        <div className="space-y-3">
          {activeGoals.length === 0 && <p className="text-sm text-disabled">Create a goal first — it gives this review something to work toward.</p>}
          {activeGoals.map((goal) => {
            const candidates = candidatesByGoal.get(goal.id) ?? []
            if (!candidates.length) return null
            const checked = big3[goal.id] ?? []
            return (
              <div key={goal.id} className="rounded-lg bg-secondary p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{goal.title}</p>
                <div className="space-y-1">
                  {candidates.map((t) => {
                    const isChecked = checked.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        onClick={() =>
                          setBig3((prev) => {
                            const cur = prev[goal.id] ?? []
                            const next = isChecked
                              ? cur.filter((id) => id !== t.id)
                              : cur.length < 3
                                ? [...cur, t.id]
                                : cur
                            return { ...prev, [goal.id]: next }
                          })
                        }
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 outline-none",
                          isChecked ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30",
                        )}
                        aria-pressed={isChecked}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            isChecked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary",
                          )}
                        >
                          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                        </span>
                        <span className={cn("min-w-0 flex-1 truncate", isChecked && "text-primary")}>{t.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {t.priority === "high" && <Flag className="mr-1 inline h-3 w-3" />}
                          {t.estimated_minutes ? `${t.estimated_minutes}m` : ""}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={scheduleBig3} disabled={saving} className="w-full sm:w-auto">
            <AlertTriangle className="mr-2 h-4 w-4" />
            {saving ? "Scheduling…" : "Schedule Big 3 for next week"}
          </Button>
        </div>
      </Section>
    </div>
  )
}

function Section({
  icon,
  title,
  body,
  tone,
  children,
}: {
  icon: React.ReactNode
  title: string
  body: string
  tone: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-md bg-secondary", tone)}>{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{body}</p>
      {children}
    </section>
  )
}
