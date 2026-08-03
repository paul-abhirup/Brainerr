"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, addWeeks, startOfWeek, format } from "date-fns"
import { toast } from "sonner"
import { PlannerWeek } from "@/components/planner/planner-week"
import { useWeekTasks, useScheduleTask, useUnscheduleTask, useBusyBlocks } from "@/hooks/use-planner"
import { useTasks } from "@/hooks/use-tasks"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader as UIHeader } from "@/components/ui/page-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Sparkles, X, Loader2, ArrowRight } from "lucide-react"
import type { TaskRow } from "@/hooks/use-tasks"

export default function PlannerPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 7)
  const [reviewing, setReviewing] = useState(false)
  const [preview, setPreview] = useState<{ moves: { taskId: string; from: string | null; to: string }[]; result: { atRisk: string[]; scheduled: { taskId: string }[] } } | null>(null)
  const [running, setRunning] = useState(false)

  const { data: weekTasks, isLoading } = useWeekTasks(weekStart, weekEnd)
  const { data: allTasks } = useTasks()
  const { data: busy } = useBusyBlocks(weekStart, weekEnd)
  const scheduleTask = useScheduleTask()
  const unscheduleTask = useUnscheduleTask()

  const tasks = useMemo(() => {
    if (!allTasks) return []
    const within = new Set((weekTasks ?? []).map((t) => t.id))
    // Include unscheduled tasks not already in the week set.
    const extra = allTasks.filter((t) => !within.has(t.id) && !t.scheduled_start && t.status !== "done")
    return [...(weekTasks ?? []), ...extra]
  }, [allTasks, weekTasks])

  async function handleSchedule(task: TaskRow, start: Date) {
    const end = new Date(start.getTime() + Math.max(15, task.estimated_minutes ?? 30) * 60000)
    try {
      await scheduleTask.mutateAsync({ task, start, end })
      toast.success(`Scheduled for ${format(start, "EEE h:mm a")}`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleUnschedule() {
    const scheduledHere = tasks.filter((t) => t.scheduled_start)
    if (!scheduledHere.length) return
    const last = scheduledHere[0]
    try {
      await unscheduleTask.mutateAsync(last.id)
      toast.success("Moved back to unscheduled")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function runReoptimize() {
    setRunning(true)
    try {
      const res = await fetch("/api/planner/auto-schedule")
      const json = await res.json()
      setPreview(json)
      setReviewing(true)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  async function commitReoptimize() {
    setRunning(true)
    try {
      const res = await fetch("/api/planner/auto-schedule", { method: "POST" })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setReviewing(false)
      setPreview(null)
      toast.success(`${json.scheduled} tasks scheduled · ${json.atRisk} couldn't fit before their due date`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <UIHeader
        title="Planner"
        description="Drag tasks onto a time block. Manually-placed tasks stay put."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 border border-border-subtle/60 rounded-xl p-1 bg-surface-2/40">
              <Button variant="ghost" size="sm" onClick={() => setWeekOffset((o) => o - 1)} className="h-8 w-8 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[100px] text-center text-xs sm:text-sm font-medium tabular-nums px-1">
                {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setWeekOffset((o) => o + 1)} className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
              <span className="hidden sm:inline">This week</span>
              <span className="sm:hidden">Today</span>
            </Button>
            <Button size="sm" onClick={runReoptimize} disabled={running}>
              {running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              Re-optimize
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="week">
        <TabsList>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="eisenhower">Eisenhower</TabsTrigger>
        </TabsList>
        <TabsContent value="week" className="mt-4">
          {isLoading ? (
            <div className="h-96 animate-pulse rounded-xl bg-surface-2" />
          ) : (
            <PlannerWeek weekStart={weekStart} tasks={tasks} busy={busy} onSchedule={handleSchedule} />
          )}
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-text-secondary">
              {tasks.filter((t) => t.scheduled_start).length} scheduled ·{" "}
              {tasks.filter((t) => !t.scheduled_start && t.status !== "done").length} unscheduled
            </p>
            <Button variant="ghost" size="sm" onClick={handleUnschedule}>
              <X className="mr-1 h-3.5 w-3.5" /> Unschedule last
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="eisenhower" className="mt-4">
          <EisenhowerView tasks={allTasks ?? []} />
        </TabsContent>
      </Tabs>

      <Dialog open={reviewing} onOpenChange={setReviewing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-optimize your week</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                {preview.moves.length} task{preview.moves.length !== 1 ? "s" : ""} will move. Nothing changes until you confirm.
              </p>
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {preview.moves.length === 0 ? (
                  <p className="text-sm text-text-secondary">Your schedule already matches the best fit — nothing to move.</p>
                ) : (
                  preview.moves.map((m) => (
                    <div key={m.taskId} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      <span className="truncate text-text-secondary">{m.from ? format(new Date(m.from), "EEE h:mm a") : "unscheduled"}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent-primary" />
                      <span className="truncate text-text-primary">{format(new Date(m.to), "EEE h:mm a")}</span>
                    </div>
                  ))
                )}
              </div>
              {preview.result.atRisk.length > 0 && (
                <p className="text-xs text-accent-warm">
                  {preview.result.atRisk.length} task{preview.result.atRisk.length !== 1 ? "s" : ""} couldn&apos;t fit before their due date and will be flagged.
                </p>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setReviewing(false)}>Cancel</Button>
                <Button onClick={commitReoptimize} disabled={running || preview.moves.length === 0}>
                  {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Apply schedule
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EisenhowerView({ tasks }: { tasks: TaskRow[] }) {
  const open = tasks.filter((t) => t.status !== "done")
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const urgent = (t: TaskRow) => !!t.due_date && new Date(t.due_date).getTime() < now + 3 * 864e5
  const important = (t: TaskRow) => t.priority === "high"

  const quadrants = [
    { key: "do", label: "Do now", sub: "urgent + important", items: open.filter((t) => urgent(t) && important(t)), tone: "border-accent-warm" },
    { key: "schedule", label: "Schedule", sub: "important, not urgent", items: open.filter((t) => !urgent(t) && important(t)), tone: "border-accent-primary" },
    { key: "delegate", label: "Delegate / shorten", sub: "urgent, not important", items: open.filter((t) => urgent(t) && !important(t)), tone: "border-accent-success" },
    { key: "later", label: "Later / drop", sub: "neither", items: open.filter((t) => !urgent(t) && !important(t)), tone: "border-border-subtle" },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {quadrants.map((q) => (
        <Card key={q.key} className={`border-l-2 ${q.tone}`}>
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">{q.label}</h3>
            <span className="text-xs text-text-secondary">{q.items.length}</span>
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">{q.sub}</p>
          <ul className="mt-3 space-y-1.5">
            {q.items.length === 0 ? (
              <li className="text-xs text-text-disabled">Nothing here</li>
            ) : (
              q.items.slice(0, 8).map((t) => (
                <li key={t.id} className="truncate text-sm text-text-primary">
                  {t.title}
                </li>
              ))
            )}
          </ul>
        </Card>
      ))}
    </div>
  )
}
