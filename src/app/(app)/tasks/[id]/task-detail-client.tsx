"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks"
import { TaskForm } from "@/components/tasks/task-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ArrowLeft, Calendar, Clock, Link2, ListTodo, Pencil, StickyNote, Timer, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Row = {
  id: string
  title: string
  status: string
  priority?: string | null
  estimated_minutes?: number | null
  due_date?: string | null
  created_at?: string
  updated_at?: string
}

export function TaskDetailClient({
  task,
  project,
  parent,
  blocker,
  subtasks,
  blocks,
  notes,
  sessions,
}: {
  task: {
    id: string
    title: string
    description: string | null
    status: string
    priority: string
    effort: string | null
    dread_level: number | null
    due_date: string | null
    scheduled_start: string | null
    scheduled_end: string | null
    estimated_minutes: number | null
    actual_minutes: number | null
    reschedule_count: number
    recurring_rule: string | null
    at_risk: boolean
    is_pinned: boolean
    project_id: string | null
    created_at: string
    completed_at: string | null
  }
  project: { id: string; name: string; color: string | null } | null
  parent: Row | null
  blocker: Row | null
  subtasks: Row[]
  blocks: Row[]
  notes: { id: string; title: string | null; created_at: string; updated_at: string }[]
  sessions: { id: string; duration_minutes: number; completed: boolean; started_at: string }[]
}) {
  const router = useRouter()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [editing, setEditing] = useState(false)
  const [quick, setQuick] = useState("")
  const [adding, setAdding] = useState(false)

  const totalFocused = sessions.reduce((sum, s) => sum + s.duration_minutes, 0)

  async function toggleDone() {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        status: task.status === "done" ? "todo" : "done",
        completed_at: task.status === "done" ? null : new Date().toISOString(),
      })
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function remove() {
    await deleteTask.mutateAsync(task.id)
    toast.success("Task deleted")
    router.push("/inbox")
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault()
    if (!quick.trim() || adding) return
    setAdding(true)
    try {
      const supabase = (await import("@/lib/supabase/client")).createClient()
      const { error } = await supabase.from("tasks").insert({
        title: quick.trim(),
        parent_task_id: task.id,
        project_id: task.project_id,
        status: "todo",
      })
      if (error) throw error
      setQuick("")
      toast.success("Subtask added")
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function toggleSubtask(id: string, done: boolean) {
    try {
      await updateTask.mutateAsync({ id, status: done ? "done" : "todo" })
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/inbox" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Inbox
      </Link>

      <div className="rounded-xl border border-border-subtle bg-surface-1 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            <Checkbox
              checked={task.status === "done"}
              onCheckedChange={toggleDone}
              className="h-5 w-5 rounded-md data-[state=checked]:bg-accent-success data-[state=checked]:text-surface-base"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={cn("text-xl font-semibold tracking-tight", task.status === "done" && "text-text-disabled line-through")}>
              {task.title}
            </h1>
            {task.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{task.description}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Meta icon={Calendar} label={task.due_date ? `Due ${format(new Date(task.due_date), "EEE, MMM d h:mm a")}` : "No due date"} />
              <Meta icon={Clock} label={task.scheduled_start ? `Planned ${format(new Date(task.scheduled_start), "EEE, MMM d h:mm a")}` : "Not scheduled"} />
              <Meta icon={Timer} label={task.estimated_minutes ? `${task.estimated_minutes}m est${task.actual_minutes ? ` · ${task.actual_minutes}m actual` : ""}` : "No estimate"} />
              {task.reschedule_count > 0 && <Meta label={`rescheduled ×${task.reschedule_count}`} />}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="ghost" size="sm" className="text-accent-danger" onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {project && (
            <Link href={`/projects`} className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs hover:border-accent-primary/50">
              <span className="h-2 w-2 rounded-full" style={{ background: project.color ?? "#7C9EFF" }} />
              {project.name}
            </Link>
          )}
          <Badge className="bg-surface-2 text-text-secondary">Priority: {task.priority}</Badge>
          {task.effort && <Badge className="bg-surface-2 text-text-secondary">Effort: {task.effort}</Badge>}
          {task.dread_level && <Badge className="border-accent-warm/40 text-accent-warm">Dread {task.dread_level}</Badge>}
          {task.at_risk && <Badge className="border-accent-warm/40 text-accent-warm">At risk</Badge>}
          {task.is_pinned && <Badge className="bg-surface-2 text-text-secondary">Pinned</Badge>}
        </div>

        {(parent || blocker) && (
          <div className="mt-4 space-y-2 border-t border-border-subtle pt-4 text-sm">
            {parent && (
              <Link href={`/tasks/${parent.id}`} className="flex items-center gap-2 text-text-secondary hover:text-text-primary">
                <ListTodo className="h-4 w-4" /> Part of: <span className="font-medium text-text-primary">{parent.title}</span>
              </Link>
            )}
            {blocker && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Link2 className="h-4 w-4" />
                Blocked by:
                <Link href={`/tasks/${blocker.id}`} className="font-medium text-accent-warm hover:underline">
                  {blocker.title}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <section className="rounded-xl border border-border-subtle bg-surface-1 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Subtasks</h2>
          <span className="text-xs text-text-secondary">{subtasks.filter((s) => s.status === "done").length}/{subtasks.length} done</span>
        </div>
        <form onSubmit={addSubtask} className="mt-3 flex gap-2">
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="Add a smaller first step…"
            className="h-9 flex-1 rounded-lg border border-border-subtle bg-surface-2 px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button type="submit" size="sm" disabled={adding || !quick.trim()}>
            Add
          </Button>
        </form>
        {subtasks.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {subtasks.map((s) => (
              <li key={s.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                <Checkbox
                  checked={s.status === "done"}
                  onCheckedChange={(v) => toggleSubtask(s.id, !!v)}
                  className="h-4 w-4 rounded"
                />
                <Link href={`/tasks/${s.id}`} className={cn("min-w-0 flex-1 truncate text-sm", s.status === "done" && "text-text-disabled line-through")}>
                  {s.title}
                </Link>
                <span className="text-xs text-text-disabled">{s.estimated_minutes ? `${s.estimated_minutes}m` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {blocks.length > 0 && (
        <section className="rounded-xl border border-border-subtle bg-surface-1 p-5">
          <h2 className="text-sm font-semibold">Unblocks</h2>
          <ul className="mt-3 space-y-1.5">
            {blocks.map((b) => (
              <li key={b.id}>
                <Link href={`/tasks/${b.id}`} className="text-sm text-accent-primary hover:underline">
                  {b.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border-subtle bg-surface-1 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <StickyNote className="h-4 w-4 text-accent-primary" /> Notes
          </h2>
          <span className="text-xs text-text-secondary">{notes.length}</span>
        </div>
        {notes.length === 0 ? (
          <p className="mt-3 text-xs text-text-disabled">
            No notes linked yet — write one from the{" "}
            <Link href="/notes" className="text-accent-primary hover:underline">Notes</Link> page and tag this task with @.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {notes.map((n) => (
              <li key={n.id}>
                <Link href={`/notes/${n.id}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  <span className="font-medium">{n.title || "Untitled"}</span>
                  <span className="ml-2 text-xs text-text-disabled">{format(new Date(n.updated_at), "MMM d")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border-subtle bg-surface-1 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Timer className="h-4 w-4 text-accent-success" /> Focus time
          </h2>
          <span className="text-xs tabular-nums text-text-secondary">
            {totalFocused > 0 ? `${Math.round(totalFocused / 60 * 10) / 10} hr focused` : "no sessions yet"}
          </span>
        </div>
        {sessions.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {sessions.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                <span className="text-text-secondary">{format(new Date(s.started_at), "EEE, MMM d h:mm a")}</span>
                <span className={cn("tabular-nums", s.completed ? "text-accent-success" : "text-text-disabled")}>
                  {s.duration_minutes}m {!s.completed && "(abandoned)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TaskForm open={editing} onOpenChange={setEditing} task={task as never} />
    </div>
  )
}

function Meta({ icon: Icon, label }: { icon?: React.ElementType; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-text-secondary">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}
