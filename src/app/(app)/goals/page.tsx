"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useGoals, useGoalProgress, useGoalForecast, type GoalRow } from "@/hooks/use-data"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, ChevronRight, ChevronDown, Flag, TrendingUp, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

type Horizon = GoalRow["horizon"]

export default function GoalsPage() {
  const { data: goals, isLoading } = useGoals()
  const { data: progress } = useGoalProgress()
  const { data: forecasts } = useGoalForecast()
  const [creating, setCreating] = useState(false)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Long-term → monthly → weekly. Progress rolls up from linked tasks.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New goal
        </Button>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
      ) : !roots.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-subtle py-16 text-center">
          <Flag className="h-8 w-8 text-text-disabled" />
          <p className="text-sm text-text-secondary">No goals yet</p>
          <p className="text-xs text-text-disabled">Start with one long-term goal, then break it into monthlies.</p>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            Create your first goal
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {roots.map((goal) => {
            const hasChildren = childrenOf(goal.id).length > 0
            const isOpen = expanded.has(goal.id)
            return (
              <div key={goal.id} className="rounded-xl border border-border-subtle bg-surface-1">
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
              </div>
            )
          })}
        </div>
      )}

      <GoalDialog open={creating} onOpenChange={setCreating} goals={goals ?? []} />
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
    <div className={cn("flex items-center gap-3 p-4", depth > 0 && "bg-surface-1/60 pl-10")}>
      {hasChildren ? (
        <button onClick={onToggle} className="text-text-secondary">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ) : (
        <span className="w-4" />
      )}
      <Link href={`/goals/${goal.id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            {goal.horizon.replace("_", " ")}
          </span>
          <p className="truncate text-sm font-medium">{goal.title}</p>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={progressPct} className="h-1.5 w-40 bg-surface-2" />
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
