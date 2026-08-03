"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useProjects, useGoals } from "@/hooks/use-data"
import { useTasks } from "@/hooks/use-tasks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { FolderKanban, Plus, Pencil, Trash2, Target, CheckCircle2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

const COLORS = ["#7C9EFF", "#E8A34D", "#6FCF97", "#E5766D", "#C792EA", "#4DB8A6", "#5C5C5E"]

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects()
  const { data: goals } = useGoals()
  const { data: tasks } = useTasks()
  const supabase = createClient()
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: string; name: string; goal_id: string | null; color: string } | null>(null)
  const [name, setName] = useState("")
  const [goalId, setGoalId] = useState("")
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)

  function openNew() {
    setEditing(null)
    setName("")
    setGoalId("")
    setColor(COLORS[0])
    setOpen(true)
  }

  function openEdit(p: { id: string; name: string; goal_id: string | null; color: string | null }) {
    setEditing({ id: p.id, name: p.name, goal_id: p.goal_id, color: p.color ?? COLORS[0] })
    setName(p.name)
    setGoalId(p.goal_id ?? "")
    setColor(p.color ?? COLORS[0])
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from("projects").update({
          name: name.trim(),
          goal_id: goalId || null,
          color,
        }).eq("id", editing.id)
        if (error) throw error
        toast.success("Project updated")
      } else {
        const { error } = await supabase.from("projects").insert({
          name: name.trim(),
          goal_id: goalId || null,
          color,
        })
        if (error) throw error
        toast.success("Project created")
      }
      setOpen(false)
      await qc.invalidateQueries({ queryKey: ["projects"] })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const stats = (projectId: string) => {
    const list = (tasks ?? []).filter((t) => t.project_id === projectId)
    return {
      open: list.filter((t) => t.status !== "done").length,
      done: list.filter((t) => t.status === "done").length,
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Group tasks under a project, optionally under a goal. Projects feed goal progress and estimate calibration."
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Button>
        }
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
      ) : !projects?.length ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8 text-text-disabled" />}
          title="No projects yet"
          description="Projects group related tasks — try one per ongoing initiative."
          action={
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              Create your first project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const s = stats(p.id)
            const goal = goals?.find((g) => g.id === p.goal_id)
            return (
              <Card key={p.id} className="gap-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color ?? "#7C9EFF" }} />
                    <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit project"
                      onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <DeleteProject id={p.id} name={p.name} />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-accent-success" />
                    {s.done} done
                  </span>
                  <span>{s.open} open</span>
                  {goal && (
                    <Link href={`/goals/${goal.id}`} className="flex min-w-0 items-center gap-1 text-accent-primary hover:underline">
                      <Target className="h-3 w-3 shrink-0" />
                      <span className="truncate">{goal.title}</span>
                    </Link>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="GATE CS Prep" />
            </div>
            <div className="space-y-1.5">
              <Label>Goal</Label>
              <Select value={goalId || "none"} onValueChange={(v) => setGoalId(v === "none" ? "" : (v ?? ""))}>
                <SelectTrigger><SelectValue placeholder="No goal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No goal</SelectItem>
                  {(goals ?? []).filter((g) => g.status === "active").map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-pressed={color === c}
                    className={cn(
                      "h-7 w-7 rounded-full transition-transform cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                      color === c && "ring-2 ring-accent-primary ring-offset-2 ring-offset-surface-1",
                    )}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>{saving ? "Saving…" : editing ? "Save" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DeleteProject({ id, name }: { id: string; name: string }) {
  const supabase = createClient()
  const qc = useQueryClient()

  async function remove() {
    const { error } = await supabase.from("projects").delete().eq("id", id)
    if (error) toast.error(error.message)
    else {
      await qc.invalidateQueries({ queryKey: ["projects"] })
      toast.success("Project deleted")
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="text-accent-danger" aria-label="Delete project">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
          <AlertDialogDescription>
            “{name}” will be removed. Tasks keep their project assignment cleared.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={remove}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
