"use client"

import { useState } from "react"
import { useCreateTask, useUpdateTask, useTasks, type TaskRow } from "@/hooks/use-tasks"
import { useProjects } from "@/hooks/use-data"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const REPEAT_OPTIONS: { value: string; label: string; rrule: string | null }[] = [
  { value: "none", label: "Doesn't repeat", rrule: null },
  { value: "daily", label: "Daily", rrule: "FREQ=DAILY" },
  { value: "weekly", label: "Weekly", rrule: "FREQ=WEEKLY" },
  { value: "monthly", label: "Monthly", rrule: "FREQ=MONTHLY" },
  { value: "custom", label: "Custom…", rrule: null },
]

function rruleToOption(rule: string | null): { kind: string; custom: string } {
  if (!rule) return { kind: "none", custom: "" }
  const normalized = rule.toUpperCase().replace(/\s+/g, "")
  if (normalized === "FREQ=DAILY") return { kind: "daily", custom: "" }
  if (normalized === "FREQ=WEEKLY") return { kind: "weekly", custom: "" }
  if (normalized === "FREQ=MONTHLY") return { kind: "monthly", custom: "" }
  return { kind: "custom", custom: rule }
}

export function TaskForm({
  open,
  onOpenChange,
  task,
  defaultProjectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: TaskRow | null
  defaultProjectId?: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TaskFormFields
        key={open ? task?.id ?? "new" : "closed"}
        task={task}
        defaultProjectId={defaultProjectId}
        onClose={() => onOpenChange(false)}
      />
    </Dialog>
  )
}

function TaskFormFields({
  task,
  defaultProjectId,
  onClose,
}: {
  task?: TaskRow | null
  defaultProjectId?: string | null
  onClose: () => void
}) {
  const { data: projects } = useProjects()
  const { data: allTasks } = useTasks()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [projectId, setProjectId] = useState<string>(task?.project_id ?? defaultProjectId ?? "")
  const [priority, setPriority] = useState<TaskRow["priority"]>(task?.priority ?? "medium")
  const [effort, setEffort] = useState<TaskRow["effort"]>(task?.effort ?? null)
  const [dread, setDread] = useState<number | null>(task?.dread_level ?? null)
  const [dueDate, setDueDate] = useState(task?.due_date ? toLocalInput(task.due_date) : "")
  const [estimated, setEstimated] = useState(task?.estimated_minutes ? String(task.estimated_minutes) : "")
  const [blockedBy, setBlockedBy] = useState(task?.blocked_by_task_id ?? "")
  const r = rruleToOption(task?.recurring_rule ?? null)
  const [recurring, setRecurring] = useState(r.kind)
  const [customRrule, setCustomRrule] = useState(r.custom)
  const [saving, setSaving] = useState(false)

  const blockerCandidates = (allTasks ?? []).filter(
    (t) => t.status !== "done" && t.id !== task?.id && t.id !== task?.parent_task_id,
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const rrule =
        recurring === "custom"
          ? customRrule.trim() || null
          : (REPEAT_OPTIONS.find((o) => o.value === recurring)?.rrule ?? null)
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        project_id: projectId || null,
        priority,
        effort,
        dread_level: dread,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        estimated_minutes: estimated ? Number(estimated) : null,
        blocked_by_task_id: blockedBy || null,
        recurring_rule: rrule,
      }
      if (task) {
        await updateTask.mutateAsync({ id: task.id, ...body })
        toast.success("Task updated")
      } else {
        await createTask.mutateAsync(body)
        toast.success("Added to inbox")
      }
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
      </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tf-title">What needs doing?</Label>
            <Input
              id="tf-title"
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Write the report"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tf-desc">Details</Label>
            <Textarea
              id="tf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : (v ?? ""))}>
                <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskRow["priority"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Effort</Label>
              <Select value={effort ?? "none"} onValueChange={(v) => setEffort(v === "none" ? null : (v as TaskRow["effort"]))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unknown</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dread (1–5)</Label>
              <Select value={dread ? String(dread) : "none"} onValueChange={(v) => setDread(v === "none" ? null : Number(v))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf-due">Due</Label>
              <Input id="tf-due" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf-est">Estimate (min)</Label>
              <Input id="tf-est" type="number" min={1} value={estimated} onChange={(e) => setEstimated(e.target.value)} placeholder="30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Depends on</Label>
              <Select value={blockedBy || "none"} onValueChange={(v) => setBlockedBy(v === "none" ? "" : (v ?? ""))}>
                <SelectTrigger><SelectValue placeholder="Nothing" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nothing</SelectItem>
                  {blockerCandidates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Repeats</Label>
              <Select value={recurring || "none"} onValueChange={(v) => setRecurring(v ?? "none")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPEAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {recurring === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="tf-rrule">RRULE</Label>
              <Input
                id="tf-rrule"
                value={customRrule}
                onChange={(e) => setCustomRrule(e.target.value)}
                placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
              />
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" onClick={(e) => { e.preventDefault(); onClose(); }} />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {task ? "Save changes" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
    </DialogContent>
  )
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
