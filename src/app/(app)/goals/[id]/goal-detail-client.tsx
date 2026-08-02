"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle2, Save, Target, TrendingUp, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Goal = {
  id: string
  parent_goal_id: string | null
  title: string
  description: string | null
  horizon: "long_term" | "monthly" | "weekly"
  target_date: string | null
  status: "active" | "done" | "archived"
  created_at: string
}
type Task = { id: string; title: string; status: string; priority: string; due_date: string | null; project_id: string | null; created_at: string }
type Project = { id: string; name: string; color: string | null; goal_id: string | null }

export function GoalDetailClient({
  goal,
  subGoals,
  projects,
  progress,
  forecast,
  tasks,
}: {
  goal: Goal
  subGoals: Goal[]
  projects: Project[]
  progress: { total_tasks: number; done_tasks: number; progress_pct: number } | null
  forecast: { projected_completion: string | null; done_per_week: number; remaining_tasks: number } | null
  tasks: Task[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const qc = useQueryClient()

  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [working, setWorking] = useState(false)

  const open = tasks.filter((t) => t.status !== "done")
  const done = tasks.filter((t) => t.status === "done")

  const byProject = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.project_id) continue
      const list = map.get(t.project_id) ?? []
      list.push(t)
      map.set(t.project_id, list)
    }
    return map
  }, [tasks])

  async function markDone() {
    setWorking(true)
    try {
      const { error } = await supabase.from("goals").update({ status: "done" }).eq("id", goal.id)
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ["goals"] })
      toast.success("Goal complete! +50 points")
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setWorking(false)
    }
  }

  async function archive() {
    setWorking(true)
    try {
      const { error } = await supabase.from("goals").update({ status: "archived" }).eq("id", goal.id)
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ["goals"] })
      toast.success("Goal archived")
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setWorking(false)
    }
  }

  async function saveTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    try {
      const data = {
        projects: projects.map((p) => ({
          name: p.name,
          color: p.color,
          tasks: (byProject.get(p.id) ?? []).map((t) => ({
            title: t.title,
            priority: t.priority,
            due_date: null,
          })),
        })),
      }
      const { error } = await supabase.from("goal_templates").insert({
        name: templateName.trim(),
        goal_title: goal.title,
        goal_description: goal.description,
        horizon: goal.horizon,
        data,
      })
      if (error) throw error
      toast.success("Template saved")
      setTemplateOpen(false)
      setTemplateName("")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/goals" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Goals
      </Link>

      <div className="rounded-xl border border-border-subtle bg-surface-1 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge className="bg-surface-2 text-text-secondary">{goal.horizon.replace("_", " ")}</Badge>
              {goal.status === "done" && <Badge className="bg-accent-success/15 text-accent-success">Done</Badge>}
              {goal.status === "archived" && <Badge variant="outline">Archived</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{goal.title}</h1>
            {goal.description && <p className="mt-1.5 text-sm text-text-secondary">{goal.description}</p>}
            {goal.target_date && (
              <p className="mt-2 text-xs text-text-secondary">Target {format(new Date(goal.target_date), "MMMM d, yyyy")}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {goal.status === "active" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Save as template
                </Button>
                <Button size="sm" onClick={markDone} disabled={working} className="text-accent-success">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark done
                </Button>
              </>
            )}
            {goal.status === "active" && (
              <Button variant="ghost" size="sm" onClick={archive} disabled={working}>Archive</Button>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-surface-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span className="tabular-nums text-text-secondary">
              {progress ? `${progress.done_tasks}/${progress.total_tasks} tasks · ${progress.progress_pct}%` : "No tasks linked yet"}
            </span>
          </div>
          <Progress value={progress?.progress_pct ?? 0} className="mt-2 h-2 bg-surface-3" />
          {forecast?.projected_completion && forecast.remaining_tasks > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary">
              <TrendingUp className="h-3.5 w-3.5 text-accent-success" />
              At {forecast.done_per_week.toFixed(1)} done/week, this finishes around{" "}
              <span className="font-medium text-text-primary">{format(new Date(forecast.projected_completion), "MMMM d, yyyy")}</span>{" "}
              ({forecast.remaining_tasks} tasks left)
            </p>
          )}
        </div>
      </div>

      {subGoals.length > 0 && (
        <section className="rounded-xl border border-border-subtle bg-surface-1 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-accent-primary" /> Sub-goals
          </h2>
          <ul className="mt-3 space-y-1.5">
            {subGoals.map((c) => (
              <li key={c.id}>
                <Link href={`/goals/${c.id}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  <span className="font-medium">{c.title}</span>
                  <span className="ml-2 text-xs text-text-disabled">{c.horizon}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border-subtle bg-surface-1 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Projects</h2>
          <span className="text-xs text-text-secondary">{projects.length}</span>
        </div>
        {projects.length === 0 ? (
          <p className="mt-3 text-xs text-text-disabled">
            No projects linked. Create one and assign it to this goal from{" "}
            <Link href="/projects" className="text-accent-primary hover:underline">Projects</Link>.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {projects.map((p) => {
              const pTasks = byProject.get(p.id) ?? []
              const pDone = pTasks.filter((t) => t.status === "done").length
              return (
                <li key={p.id} className="rounded-lg border border-border-subtle bg-surface-2 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color ?? "#7C9EFF" }} />
                      {p.name}
                    </span>
                    <span className="text-xs tabular-nums text-text-secondary">{pDone}/{pTasks.length} done</span>
                  </div>
                  {pTasks.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {pTasks.map((t) => (
                        <li key={t.id}>
                          <Link href={`/tasks/${t.id}`} className={cn("block truncate rounded px-2 py-1 text-sm hover:bg-surface-3", t.status === "done" && "text-text-disabled line-through")}>
                            {t.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border-subtle bg-surface-1 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tasks</h2>
          <span className="text-xs text-text-secondary">{open.length} open · {done.length} done</span>
        </div>
        {tasks.length === 0 ? (
          <p className="mt-3 text-xs text-text-disabled">No tasks under this goal yet.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {[...open, ...done].map((t) => (
              <li key={t.id}>
                <Link href={`/tasks/${t.id}`} className={cn("block truncate rounded px-2 py-1.5 text-sm hover:bg-surface-2", t.status === "done" && "text-text-disabled line-through")}>
                  {t.title}
                  {t.due_date && <span className="ml-2 text-xs text-text-disabled">{format(new Date(t.due_date), "MMM d")}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Reuse this goal&apos;s structure ({projects.length} projects, {tasks.length} tasks, dates stripped) for the next cycle.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Template name</Label>
              <Input id="tpl-name" autoFocus value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Exam prep cycle" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setTemplateOpen(false)}>Cancel</Button>
              <Button onClick={saveTemplate} disabled={savingTemplate || !templateName.trim()}>
                {savingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save template
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
