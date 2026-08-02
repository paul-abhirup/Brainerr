"use client"

import { useState } from "react"
import { format } from "date-fns"
import { useUpdateTask, useDeleteTask, type TaskRow } from "@/hooks/use-tasks"
import { useProjects } from "@/hooks/use-data"
import { useQuickAdd } from "@/components/app/quick-add-provider"
import { TaskForm } from "@/components/tasks/task-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Calendar, Clock, MoreHorizontal, Pencil, Trash2, AlarmClockOff } from "lucide-react"
import { cn } from "@/lib/utils"

const priorityColors: Record<TaskRow["priority"], string> = {
  high: "bg-accent-warm",
  medium: "bg-accent-primary",
  low: "bg-accent-success",
}

export function TaskCard({ task, highlightDue = true }: { task: TaskRow; highlightDue?: boolean }) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { data: projects } = useProjects()
  const { openQuickAdd } = useQuickAdd()
  const [editing, setEditing] = useState(false)

  const project = projects?.find((p) => p.id === task.project_id)
  const overdue =
    highlightDue &&
    !!task.due_date &&
    task.status !== "done" &&
    new Date(task.due_date) < new Date()

  async function toggleDone() {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        status: task.status === "done" ? "todo" : "done",
        completed_at: task.status === "done" ? null : new Date().toISOString(),
      })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function snooze() {
    try {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await updateTask.mutateAsync({
        id: task.id,
        due_date: task.due_date
          ? new Date(new Date(task.due_date).getTime() + 24 * 60 * 60 * 1000).toISOString()
          : tomorrow.toISOString(),
        reschedule_count: (task.reschedule_count ?? 0) + 1,
      })
      toast.success("Moved to tomorrow")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function remove() {
    await deleteTask.mutateAsync(task.id)
    toast.success("Task deleted")
  }

  return (
    <>
      <div className="group flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3 transition-colors hover:bg-surface-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center">
          <Checkbox
            checked={task.status === "done"}
            onCheckedChange={toggleDone}
            className="h-5 w-5 rounded-md data-[state=checked]:bg-accent-success data-[state=checked]:text-surface-base"
          />
        </div>

        <div className="relative min-w-0 flex-1 pt-0.5">
          <span
            className={cn(
              "absolute -left-3 top-1.5 h-5 w-[3px] rounded-full",
              task.status === "done" ? "bg-transparent" : priorityColors[task.priority],
            )}
            aria-hidden
          />
          <p
            className={cn(
              "text-sm font-medium leading-snug",
              task.status === "done" && "text-text-disabled line-through",
            )}
          >
            {task.title}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            {overdue && (
              <span className="flex items-center gap-1 text-accent-warm">
                <Calendar className="h-3 w-3" />
                Overdue · {format(new Date(task.due_date!), "MMM d")}
              </span>
            )}
            {task.due_date && !overdue && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(task.due_date), "MMM d h:mm a")}
              </span>
            )}
            {task.estimated_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.estimated_minutes}m
              </span>
            )}
            {project && (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: project.color ?? "#7C9EFF" }}
                />
                {project.name}
              </span>
            )}
            {task.dread_level && task.dread_level > 2 && (
              <Badge variant="outline" className="border-accent-warm/40 text-accent-warm">
                Dread {task.dread_level}
              </Badge>
            )}
            {task.reschedule_count > 0 && (
              <span className="text-text-disabled">rescheduled ×{task.reschedule_count}</span>
            )}
            {task.status === "in_progress" && (
              <Badge className="bg-accent-primary/15 text-accent-primary">In progress</Badge>
            )}
            {task.status === "snoozed" && <Badge variant="outline">Snoozed</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => openQuickAdd()}
            title="Break this down (quick add a first step)"
          >
            <AlarmClockOff className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={snooze}>
                <Clock className="mr-2 h-4 w-4" /> Push to tomorrow
              </DropdownMenuItem>
              <DropdownMenuItem className="text-accent-danger" onClick={remove}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <TaskForm open={editing} onOpenChange={setEditing} task={task} />
    </>
  )
}
