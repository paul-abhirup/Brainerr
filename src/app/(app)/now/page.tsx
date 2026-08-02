"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, addDays } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useTasks, type TaskRow } from "@/hooks/use-tasks"
import { useUserState } from "@/hooks/use-data"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { requestNotificationPermission } from "@/hooks/use-reminders"
import { registerServiceWorker, subscribePush } from "@/lib/reminders/sw"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { SkipForward, Check, Timer, SplitSquareHorizontal, Target, Play, Sparkles, Moon, Sunset, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { ParalysisBreakerModal } from "@/components/app/paralysis-breaker-modal"

export default function NowPage() {
  const router = useRouter()
  const supabase = createClient()
  const qc = useQueryClient()
  const { data: tasks } = useTasks()
  const { data: userState } = useUserState()
  const [skipStack, setSkipStack] = useState<TaskRow[]>([])
  const [firstTwo, setFirstTwo] = useState(false)
  const [big3Open, setBig3Open] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [savingBig3, setSavingBig3] = useState(false)
  const [windDownOpen, setWindDownOpen] = useState(false)
  const [windDownSaved, setWindDownSaved] = useState(false)
  const [paralysisBreakerOpen, setParalysisBreakerOpen] = useState(false)

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const dayStart = useMemo(() => new Date().setHours(0, 0, 0, 0), [])

  const doneToday = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.status === "done" && t.completed_at && new Date(t.completed_at).getTime() >= dayStart)
        .slice(0, 6),
    [tasks, dayStart],
  )

  const movedToday = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.status !== "done" && new Date(t.updated_at).getTime() >= dayStart)
        .slice(0, 6),
    [tasks, dayStart],
  )

  const { data: dailyFocus } = useQuery({
    queryKey: ["daily_focus", todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_focus")
        .select("*")
        .eq("date", todayStr)
        .single()
      if (error && error.code !== "PGRST116") throw error
      return data ?? null
    },
  })

  const queue = useMemo(() => {
    if (!tasks) return []
    const open = tasks.filter((t) => t.status !== "done" && !t.parent_task_id)
    const big3 = dailyFocus?.task_ids ?? []
    const big3Tasks = big3.map((id) => open.find((t) => t.id === id)).filter(Boolean) as TaskRow[]
    const rest = open.filter((t) => !big3.includes(t.id))

    const rank = (t: TaskRow) => {
      const urgency = t.due_date ? new Date(t.due_date).getTime() : Infinity
      const priorityScore = t.priority === "high" ? 3 : t.priority === "medium" ? 2 : 1
      const effortScore = userState?.mood_energy === "low"
        ? t.effort === "low" ? 5 : t.effort === "medium" ? 2 : 0
        : userState?.mood_energy === "high"
          ? (t.dread_level ?? 0) * 2
          : 0
      return { urgency, priorityScore, effortScore }
    }

    rest.sort((a, b) => {
      const ra = rank(a)
      const rb = rank(b)
      if (userState?.mood_energy === "high") {
        // big impact = high dread (avoided longest) first
        return (b.dread_level ?? 0) - (a.dread_level ?? 0)
      }
      return rb.priorityScore - ra.priorityScore || ra.urgency - rb.urgency || rb.effortScore - ra.effortScore
    })

    return [...big3Tasks, ...rest]
  }, [tasks, dailyFocus, userState])

  // skipStack is a LIFO of skipped tasks reinserted at the back
  const effectiveQueue = useMemo(() => {
    const base = [...queue]
    for (const skipped of skipStack) {
      base.push(skipped)
    }
    return base
  }, [queue, skipStack])

  const current = effectiveQueue[0]

  function openBig3() {
    setSelected(dailyFocus?.task_ids ?? [])
    setBig3Open(true)
  }

  async function saveBig3() {
    setSavingBig3(true)
    try {
      const userId = (await supabase.auth.getUser()).data.user!.id
      const { error } = await supabase.from("daily_focus").upsert(
        { user_id: userId, date: todayStr, task_ids: selected },
        { onConflict: "user_id,date" },
      )
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ["daily_focus"] })
      toast.success(selected.length ? `Today's Big ${selected.length} set` : "Cleared today's Big 3")
      setBig3Open(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingBig3(false)
    }
  }

  async function setTomorrowsBig1() {
    const tomorrow = addDays(new Date(), 1)
    const taskId = queue[0]?.id ?? current?.id
    if (!taskId) return
    const userId = (await supabase.auth.getUser()).data.user!.id
    const { error } = await supabase.from("daily_focus").upsert(
      { user_id: userId, date: format(tomorrow, "yyyy-MM-dd"), task_ids: [taskId] },
      { onConflict: "user_id,date" },
    )
    if (error) {
      toast.error(error.message)
      return
    }
    setWindDownSaved(true)
    await qc.invalidateQueries({ queryKey: ["daily_focus"] })
    toast.success(`"${queue[0]?.title}" is tomorrow's first task`)
  }

  async function handleSkip() {
    if (!current) return
    setSkipStack((s) => [current, ...s])
    await supabase
      .from("user_state")
      .upsert({ user_id: (await supabase.auth.getUser()).data.user!.id, last_active_task_id: current.id })
    toast.info("Not right now — totally fine.")
  }

  async function handleComplete() {
    if (!current) return
    await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", current.id)
    await qc.invalidateQueries({ queryKey: ["tasks"] })
    toast.success("Done. Nice.")
    maybeSuggestCalibration(current)
  }

  // §13.4 — one-line calibration nudge when a task ran way over its estimate.
  async function maybeSuggestCalibration(task: TaskRow) {
    if (!task.estimated_minutes || !task.actual_minutes) return
    if (task.actual_minutes < task.estimated_minutes * 1.5) return
    const ratio = Math.round((task.actual_minutes / task.estimated_minutes) * 10) / 10
    toast("This took " + ratio + "x your estimate — future estimates for similar tasks will get extra buffer automatically.", {
      duration: 6000,
    })
  }

  async function handleFocus() {
    if (!current) return
    await supabase
      .from("tasks")
      .update({ status: "in_progress" })
      .eq("id", current.id)
    await supabase
      .from("user_state")
      .upsert({ user_id: (await supabase.auth.getUser()).data.user!.id, last_active_task_id: current.id, last_opened_at: new Date().toISOString() })
    router.push("/focus")
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-xl py-24">
        <EmptyState
          icon={<Sparkles className="h-8 w-8 text-accent-primary" />}
          title="Nothing due right now"
          description="Enjoy it. When something shows up, it'll land here one at a time."
          action={
            <Button variant="outline" onClick={() => router.push("/inbox")}>
              Add a task
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center space-y-8 py-10 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs uppercase tracking-widest text-text-disabled">
        <Target className="h-3.5 w-3.5" />
        One thing at a time
        {(dailyFocus?.task_ids.length ?? 0) > 0 && (
          <button
            onClick={openBig3}
            className="rounded-full border border-border-subtle px-2.5 py-0.5 normal-case tracking-normal text-accent-primary transition-colors hover:border-accent-primary/50"
          >
            Big 3 · {dailyFocus!.task_ids.length}
          </button>
        )}
        {(dailyFocus?.task_ids.length ?? 0) === 0 && (
          <button
            onClick={openBig3}
            className="rounded-full border border-border-subtle px-2.5 py-0.5 normal-case tracking-normal text-text-secondary transition-colors hover:border-accent-primary/50 hover:text-accent-primary"
          >
            Set Big 3
          </button>
        )}
        <button
          onClick={() => setParalysisBreakerOpen(true)}
          className="rounded-full border border-accent-warm/40 bg-accent-warm/10 px-3 py-0.5 normal-case tracking-normal text-accent-warm font-semibold transition-all hover:bg-accent-warm/20 hover:scale-105 flex items-center gap-1 cursor-pointer"
        >
          🧊 Smash Paralysis
        </button>
      </div>

      {/* Resume banner for interrupted tasks */}
      {userState?.last_active_task_id && userState.last_active_task_id !== current.id && (
        <ResumeBanner taskId={userState.last_active_task_id} tasks={tasks ?? []} />
      )}

      <Card size="lg" className="w-full gap-0 p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {current.priority === "high" && <Badge className="bg-accent-warm/15 text-accent-warm">High priority</Badge>}
          {current.dread_level && current.dread_level > 2 && (
            <Badge variant="outline" className="border-accent-warm/40 text-accent-warm">Dread {current.dread_level}</Badge>
          )}
          {current.estimated_minutes && (
            <Badge variant="outline" className="tabular-nums">{current.estimated_minutes} min</Badge>
          )}
        </div>

        <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">{current.title}</h1>

        {current.due_date && (
          <p className={cn("mt-3 text-sm", new Date(current.due_date) < new Date() ? "text-accent-warm" : "text-text-secondary")}>
            Due {format(new Date(current.due_date), "EEEE, MMM d")}
            {current.due_date && new Date(current.due_date).getHours() < 18 ? ` at ${format(new Date(current.due_date), "h:mm a")}` : ""}
          </p>
        )}

        {firstTwo && (
          <div className="mt-5 rounded-xl border border-accent-primary/30 bg-accent-primary/5 p-4">
            <p className="text-sm text-text-secondary">Just the first 2 minutes:</p>
            <p className="mt-1 text-base font-medium text-accent-primary">
              Open it and start the first tiny step. That&apos;s the whole task.
            </p>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="lg" onClick={handleFocus}>
          <Play className="mr-2 h-4 w-4" />
          Start focus
        </Button>
        <Button size="lg" variant="outline" onClick={handleSkip}>
          <SkipForward className="mr-2 h-4 w-4" />
          Not right now
        </Button>
        <Button size="lg" variant="ghost" onClick={handleComplete} className="text-accent-success">
          <Check className="mr-2 h-4 w-4" />
          Done
        </Button>
      </div>

      <button
        onClick={() => setFirstTwo((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
          firstTwo
            ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
            : "border-border-subtle text-text-secondary hover:text-text-primary",
        )}
      >
        <SplitSquareHorizontal className="h-3.5 w-3.5" />
        {firstTwo ? "First 2 minutes ON" : "Just the first 2 minutes"}
      </button>

      <div className="flex items-center gap-2 text-xs text-text-disabled">
        <Moon className="h-3.5 w-3.5" />
        {userState?.mood_energy === "low"
          ? "Low energy: low-effort tasks surfaced first."
          : userState?.mood_energy === "high"
            ? "High energy: the biggest, most-avoided task surfaced first."
            : "Set your energy check-in on the dashboard to re-rank this view."}
        {skipStack.length > 0 && <span>· {skipStack.length} skipped</span>}
      </div>

      <button
        onClick={() => setWindDownOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent-primary/50 hover:text-accent-primary"
      >
        <Sunset className="h-3.5 w-3.5" />
        Done for today? Wind down
      </button>

      <ReminderToggle />

      <Dialog open={windDownOpen} onOpenChange={setWindDownOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wind down</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-left">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-accent-success">Done today</p>
              {doneToday.length === 0 ? (
                <p className="text-sm text-text-disabled">Nothing finished yet — that&apos;s okay.</p>
              ) : (
                <ul className="space-y-1">
                  {doneToday.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm text-text-primary">
                      <Check className="h-3.5 w-3.5 shrink-0 text-accent-success" />
                      <span className="truncate">{t.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-accent-warm">Moved, not lost</p>
              {movedToday.length === 0 ? (
                <p className="text-sm text-text-disabled">Nothing got rescheduled today.</p>
              ) : (
                <ul className="space-y-1">
                  {movedToday.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm text-text-primary">
                      <Moon className="h-3.5 w-3.5 shrink-0 text-accent-warm" />
                      <span className="truncate">{t.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface-2 p-3">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-accent-primary">Tomorrow&apos;s first task</p>
              {queue[0] ? (
                <>
                  <p className="truncate text-sm">{queue[0].title}</p>
                  <p className="mt-1 text-xs text-text-secondary">Lock it in now so tomorrow starts with a clear win.</p>
                </>
              ) : (
                <p className="text-sm text-text-disabled">No tasks queued for tomorrow.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWindDownOpen(false)}>Close</Button>
            {queue[0] && (
              <Button onClick={setTomorrowsBig1} disabled={windDownSaved}>
                {windDownSaved ? "Locked in ✓" : "Set as tomorrow's first task"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={big3Open} onOpenChange={setBig3Open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Today&apos;s Big 3</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">Pick 1–3 tasks that are the real win for today. They&apos;ll float to the top of this view.</p>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {queue.length === 0 && <p className="py-6 text-center text-sm text-text-disabled">No open tasks to pick from.</p>}
            {queue.slice(0, 15).map((t) => {
              const checked = selected.includes(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() =>
                    setSelected((s) =>
                      checked
                        ? s.filter((id) => id !== t.id)
                        : s.length < 3
                          ? [...s, t.id]
                          : s,
                    )
                  }
                  disabled={!checked && selected.length >= 3}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    checked
                      ? "border-accent-primary/50 bg-accent-primary/5"
                      : "border-border-subtle bg-surface-2 hover:border-accent-primary/30",
                    !checked && selected.length >= 3 && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => {}} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate", checked && "text-accent-primary")}>{t.title}</p>
                    {t.due_date && <p className="text-xs text-text-secondary">Due {format(new Date(t.due_date), "EEE, MMM d")}</p>}
                  </div>
                </button>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBig3Open(false)}>Cancel</Button>
            <Button onClick={saveBig3} disabled={savingBig3}>
              {savingBig3 ? "Saving…" : "Save for today"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🧊 ADHD Paralysis Breaker Single-Task Isolation Modal */}
      <ParalysisBreakerModal
        open={paralysisBreakerOpen}
        onOpenChange={setParalysisBreakerOpen}
        tasks={tasks ?? []}
      />
    </div>
  )
}

function ResumeBanner({ taskId, tasks }: { taskId: string; tasks: TaskRow[] }) {
  const task = tasks.find((t) => t.id === taskId)
  if (!task || task.status === "done") return null
  return (
    <div className="flex items-center gap-2 rounded-xl border border-accent-warm/30 bg-accent-warm/5 px-4 py-3 text-sm">
      <Timer className="h-4 w-4 shrink-0 text-accent-warm" />
      <span className="text-text-secondary">Where you left off:</span>
      <span className="truncate font-medium text-text-primary">{task.title}</span>
    </div>
  )
}

function ReminderToggle() {
  const [status, setStatus] = useState<"loading" | "on" | "off" | "unsupported">(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
    return Notification.permission === "granted" ? "on" : "off"
  })

  async function enable() {
    const perm = await requestNotificationPermission()
    if (perm === "granted") {
      setStatus("on")
      const registration = await registerServiceWorker()
      if (registration && "pushManager" in registration) {
        await subscribePush(registration).catch(() => {})
      }
      toast.success("Reminders on — you'll be nudged before tasks start.")
    } else {
      toast.info("Notifications are blocked in browser settings.")
    }
  }

  if (status === "unsupported") return null

  return (
    <button
      onClick={enable}
      disabled={status === "on"}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
        status === "on"
          ? "cursor-default border-accent-success/40 bg-accent-success/10 text-accent-success"
          : "border-border-subtle text-text-secondary hover:border-accent-primary/50 hover:text-accent-primary",
      )}
    >
      <Bell className="h-3.5 w-3.5" />
      {status === "on" ? "Reminders on" : "Enable reminders"}
    </button>
  )
}
