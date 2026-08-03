"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useGoals, useGoalProgress, useGoalForecast, type GoalRow } from "@/hooks/use-data"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, ChevronRight, ChevronDown, Flag, TrendingUp, Sparkles, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Horizon = GoalRow["horizon"]

type GoalTemplate = {
  id: string
  name: string
  goal_title: string
  goal_description: string | null
  horizon: Horizon
  data: { projects?: { name: string; color: string | null; tasks?: { title: string; priority: string; due_date: string | null }[] }[] }
  created_at: string
}

export default function GoalsPage() {
  const { data: goals, isLoading } = useGoals()
  const { data: progress } = useGoalProgress()
  const { data: forecasts } = useGoalForecast()
  const [creating, setCreating] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const roots = useMemo(
    () => (goals ?? []).filter((g) => !g.parent_goal_id && g.status === "active"),
    [goals],
  )

  const childrenOf = (id: string) => (goals ?? []).filter((g) => g.parent_goal_id === id)

  const progressOf = (id: string) =>
    progress?.find((p) => p.goal_id === id)?.progress_pct ?? 0

  const forecastOf = (id: string) => forecasts?.find((f) => f.goal_id === id)

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        description="Long-term → monthly → weekly. Progress rolls up from linked tasks."
        actions={
          <>
            <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4 text-accent-primary" />
              Templates
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New goal
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
      ) : !roots.length ? (
        <EmptyState
          icon={<Flag className="h-8 w-8 text-text-disabled" />}
          title="No goals yet"
          description="Start with one long-term goal, then break it into monthlies."
          action={
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              Create your first goal
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {roots.map((goal) => {
            const hasChildren = childrenOf(goal.id).length > 0
            const isOpen = expanded.has(goal.id)
            return (
              <Card key={goal.id} className="gap-0 p-0">
                <GoalRow
                  goal={goal}
                  depth={0}
                  isOpen={isOpen}
                  hasChildren={hasChildren}
                  onToggle={() => toggle(goal.id)}
                  progressPct={progressOf(goal.id)}
                  forecast={forecastOf(goal.id)}
                />
                {isOpen &&
                  childrenOf(goal.id).map((child) => (
                    <div key={child.id} className="border-t border-border-subtle">
                      <GoalRow
                        goal={child}
                        depth={1}
                        isOpen={false}
                        hasChildren={false}
                        onToggle={() => {}}
                        progressPct={progressOf(child.id)}
                        forecast={forecastOf(child.id)}
                      />
                    </div>
                  ))}
              </Card>
            )
          })}
        </div>
      )}

      <GoalDialog open={creating} onOpenChange={setCreating} goals={goals ?? []} />
      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
    </div>
  )
}

function GoalRow({
  goal,
  depth,
  isOpen,
  hasChildren,
  onToggle,
  progressPct,
  forecast,
}: {
  goal: GoalRow
  depth: number
  isOpen: boolean
  hasChildren: boolean
  onToggle: () => void
  progressPct: number
  forecast?: { projected_completion: string | null; done_per_week: number; remaining_tasks: number }
}) {
  return (
    <div className={cn("flex items-center gap-3 p-4", depth > 0 && "bg-surface-1/60 pl-4 sm:pl-10")}>
      {hasChildren ? (
        <button
          onClick={onToggle}
          className="text-text-secondary cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/60 outline-none rounded"
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ) : (
        <span className="w-4" />
      )}
      <Link href={`/goals/${goal.id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-text-secondary">
            {goal.horizon.replace("_", " ")}
          </span>
          <p className="truncate text-sm font-medium">{goal.title}</p>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={progressPct} className="h-1.5 flex-1 max-w-64 bg-surface-2" />
          <span className="text-xs tabular-nums text-text-secondary">{progressPct}%</span>
          {forecast?.projected_completion && forecast.remaining_tasks > 0 && (
            <span className="hidden items-center gap-1 text-xs text-text-secondary md:flex">
              <TrendingUp className="h-3 w-3 text-accent-success" />
              At this pace, done around {format(new Date(forecast.projected_completion), "MMM d")}
            </span>
          )}
          {goal.target_date && (
            <span className="hidden text-xs text-text-secondary md:block">
              Target {format(new Date(goal.target_date), "MMM d")}
            </span>
          )}
        </div>
      </Link>
      <GoalActions goal={goal} />
    </div>
  )
}

function GoalActions({ goal }: { goal: GoalRow }) {
  const supabase = createClient()
  const qc = useQueryClient()

  async function markDone() {
    const { error } = await supabase.from("goals").update({ status: "done" }).eq("id", goal.id)
    if (error) toast.error(error.message)
    else {
      await qc.invalidateQueries({ queryKey: ["goals"] })
      toast.success("Goal complete! +50 points")
    }
  }

  async function archive() {
    const { error } = await supabase.from("goals").update({ status: "archived" }).eq("id", goal.id)
    if (error) toast.error(error.message)
    else await qc.invalidateQueries({ queryKey: ["goals"] })
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" onClick={markDone} className="text-accent-success">
        Done
      </Button>
      <Button variant="ghost" size="sm" onClick={archive}>
        Archive
      </Button>
    </div>
  )
}

function GoalDialog({
  open,
  onOpenChange,
  goals,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  goals: GoalRow[]
}) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [horizon, setHorizon] = useState<Horizon>("long_term")
  const [parentId, setParentId] = useState("")
  const [saving, setSaving] = useState(false)

  const parentCandidates = goals.filter((g) => g.status === "active" && g.horizon !== "weekly")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from("goals").insert({
        title: title.trim(),
        description: description.trim() || null,
        horizon,
        parent_goal_id: parentId || null,
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ["goals"] })
      setTitle("")
      setDescription("")
      setParentId("")
      onOpenChange(false)
      toast.success("Goal created")
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
          <DialogTitle>New goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-title">Goal</Label>
            <Input id="g-title" autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="GATE CS prep" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Description</Label>
            <Textarea id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Horizon</Label>
              <Select value={horizon} onValueChange={(v) => setHorizon(v as Horizon)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long_term">Long-term</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parent goal</Label>
              <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : (v ?? ""))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {parentCandidates.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

function TemplatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [templates, setTemplates] = useState<GoalTemplate[] | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from("goal_templates").select("*").order("created_at", { ascending: false })
    if (error) toast.error(error.message)
    else setTemplates((data ?? []) as unknown as GoalTemplate[])
  }

  function onOpenChangeInner(v: boolean) {
    onOpenChange(v)
    if (v) load()
  }

  async function apply(tpl: GoalTemplate) {
    setApplying(tpl.id)
    try {
      const { data: goal, error: goalError } = await supabase
        .from("goals")
        .insert({
          title: tpl.goal_title,
          description: tpl.goal_description,
          horizon: tpl.horizon,
        })
        .select()
        .single()
      if (goalError) throw goalError

      for (const p of tpl.data?.projects ?? []) {
        const { data: project, error: projError } = await supabase
          .from("projects")
          .insert({ name: p.name, color: p.color, goal_id: goal.id })
          .select()
          .single()
        if (projError) throw projError
        for (const t of p.tasks ?? []) {
          const { error: taskError } = await supabase.from("tasks").insert({
            title: t.title,
            priority: t.priority as TaskPriority,
            project_id: project.id,
            status: "todo",
          })
          if (taskError) throw taskError
        }
      }

      await qc.invalidateQueries({ queryKey: ["goals"] })
      await qc.invalidateQueries({ queryKey: ["tasks"] })
      await qc.invalidateQueries({ queryKey: ["projects"] })
      toast.success("Goal created from template")
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setApplying(null)
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("goal_templates").delete().eq("id", id)
    if (error) toast.error(error.message)
    else {
      toast.success("Template deleted")
      load()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeInner}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Goal templates</DialogTitle>
        </DialogHeader>
        {templates === null ? (
          <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
        ) : templates.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-disabled">
            No templates yet. Open a goal and hit “Save as template” to reuse its structure next cycle.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {templates.map((tpl) => (
              <li key={tpl.id} className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{tpl.name}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {tpl.goal_title} · {tpl.horizon.replace("_", " ")} · {(tpl.data?.projects ?? []).length} project
                    {(tpl.data?.projects ?? []).length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => apply(tpl)} disabled={applying === tpl.id}>
                  {applying === tpl.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                  Use
                </Button>
                <Button variant="ghost" size="icon" className="text-accent-danger" onClick={() => remove(tpl.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

type TaskPriority = "low" | "medium" | "high"
