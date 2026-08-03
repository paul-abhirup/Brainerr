"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks"
import { TaskForm } from "@/components/tasks/task-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { toast } from "sonner"
import { Calendar, Clock, Link2, ListTodo, Pencil, StickyNote, Timer, Trash2, RotateCcw, Check } from "lucide-react"
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
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error("User not authenticated")
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
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
      <PageHeader
        backHref="/inbox"
        backLabel="Inbox"
        title={
          <span className={cn("break-words", task.status === "done" && "text-disabled line-through")}>
            {task.title}
          </span>
        }
        description={task.description ?? undefined}
        actions={
          <div className="flex shrink-0 gap-1.5">
            <Button
              variant={task.status === "done" ? "outline" : "default"}
              size="sm"
              onClick={toggleDone}
              className={cn(task.status === "done" && "border-primary text-primary hover:bg-primary/10")}
            >
              {task.status === "done" ? (
                <>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Unmark as Done (Reopen)
                </>
              ) : (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Mark Done
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="ghost" size="sm" className="text-destructive" aria-label="Delete task">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{task.title}” will be permanently removed. This can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={remove}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <Card size="lg" className="gap-4">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={task.status === "done"}
            onCheckedChange={toggleDone}
            className="h-5 w-5 rounded-md data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
          />
          <span className={cn("text-sm font-medium", task.status === "done" ? "text-disabled" : "text-muted-foreground")}>
            {task.status === "done" ? "Reopen task" : "Mark done"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Meta icon={Calendar} label={task.due_date ? `Due ${format(new Date(task.due_date), "EEE, MMM d h:mm a")}` : "No due date"} />
          <Meta icon={Clock} label={task.scheduled_start ? `Planned ${format(new Date(task.scheduled_start), "EEE, MMM d h:mm a")}` : "Not scheduled"} />
          <Meta icon={Timer} label={task.estimated_minutes ? `${task.estimated_minutes}m est${task.actual_minutes ? ` · ${task.actual_minutes}m actual` : ""}` : "No estimate"} />
          {task.reschedule_count > 0 && <Meta label={`rescheduled ×${task.reschedule_count}`} />}
        </div>

        <div className="flex flex-wrap gap-2">
          {project && (
            <Badge
              render={<Link href="/projects" />}
              className="gap-1.5 bg-secondary text-muted-foreground hover:border-primary/50"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: project.color ?? "#7C9EFF" }} />
              {project.name}
            </Badge>
          )}
          <Badge className="bg-secondary text-muted-foreground">Priority: {task.priority}</Badge>
          {task.effort && <Badge className="bg-secondary text-muted-foreground">Effort: {task.effort}</Badge>}
          {task.dread_level && <Badge className="border-warning/40 text-warning">Dread {task.dread_level}</Badge>}
          {task.at_risk && <Badge className="border-warning/40 text-warning">At risk</Badge>}
          {task.is_pinned && <Badge className="bg-secondary text-muted-foreground">Pinned</Badge>}
        </div>

        {(parent || blocker) && (
          <div className="space-y-2 border-t border-border pt-4 text-sm">
            {parent && (
              <Link href={`/tasks/${parent.id}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <ListTodo className="h-4 w-4" /> Part of: <span className="font-medium text-foreground">{parent.title}</span>
              </Link>
            )}
            {blocker && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Link2 className="h-4 w-4" />
                Blocked by:
                <Link href={`/tasks/${blocker.id}`} className="font-medium text-warning hover:underline">
                  {blocker.title}
                </Link>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Subtasks</h2>
          <span className="text-xs text-muted-foreground">{subtasks.filter((s) => s.status === "done").length}/{subtasks.length} done</span>
        </div>
        <form onSubmit={addSubtask} className="flex gap-2">
          <Input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="Add a smaller first step…"
            className="flex-1 bg-secondary"
          />
          <Button type="submit" disabled={adding || !quick.trim()}>
            Add
          </Button>
        </form>
        {subtasks.length > 0 && (
          <ul className="space-y-1.5">
            {subtasks.map((s) => (
              <li key={s.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary">
                <Checkbox
                  checked={s.status === "done"}
                  onCheckedChange={(v) => toggleSubtask(s.id, !!v)}
                />
                <Link href={`/tasks/${s.id}`} className={cn("min-w-0 flex-1 truncate text-sm", s.status === "done" && "text-disabled line-through")}>
                  {s.title}
                </Link>
                <span className="text-xs text-disabled">{s.estimated_minutes ? `${s.estimated_minutes}m` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {blocks.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold">Unblocks</h2>
          <ul className="space-y-1.5">
            {blocks.map((b) => (
              <li key={b.id}>
                <Link href={`/tasks/${b.id}`} className="text-sm text-primary hover:underline">
                  {b.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <StickyNote className="h-4 w-4 text-primary" /> Notes
          </h2>
          <span className="text-xs text-muted-foreground">{notes.length}</span>
        </div>
        {notes.length === 0 ? (
          <p className="text-xs text-disabled">
            No notes linked yet — write one from the{" "}
            <Link href="/notes" className="text-primary hover:underline">Notes</Link> page and tag this task with @.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {notes.map((n) => (
              <li key={n.id}>
                <Link href={`/notes/${n.id}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
                  <span className="font-medium">{n.title || "Untitled"}</span>
                  <span className="ml-2 text-xs text-disabled">{format(new Date(n.updated_at), "MMM d")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Timer className="h-4 w-4 text-success" /> Focus time
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {totalFocused > 0 ? `${Math.round(totalFocused / 60 * 10) / 10} hr focused` : "no sessions yet"}
          </span>
        </div>
        {sessions.length > 0 && (
          <ul className="space-y-1.5">
            {sessions.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
                <span className="text-muted-foreground">{format(new Date(s.started_at), "EEE, MMM d h:mm a")}</span>
                <span className={cn("tabular-nums", s.completed ? "text-success" : "text-disabled")}>
                  {s.duration_minutes}m {!s.completed && "(abandoned)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <TaskForm open={editing} onOpenChange={setEditing} task={task as never} />
    </div>
  )
}

function Meta({ icon: Icon, label }: { icon?: React.ElementType; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}
