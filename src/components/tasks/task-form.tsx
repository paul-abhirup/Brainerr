"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useCreateTask, useUpdateTask, type TaskRow } from "@/hooks/use-tasks"
import { useProjects } from "@/hooks/use-data"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

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
  const { data: projects } = useProjects()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const supabase = createClient()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState<string>("")
  const [priority, setPriority] = useState<TaskRow["priority"]>("medium")
  const [effort, setEffort] = useState<TaskRow["effort"]>(null)
  const [dread, setDread] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState("")
  const [estimated, setEstimated] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? "")
    setDescription(task?.description ?? "")
    setProjectId(task?.project_id ?? defaultProjectId ?? "")
    setPriority(task?.priority ?? "medium")
    setEffort(task?.effort ?? null)
    setDread(task?.dread_level ?? null)
    setDueDate(task?.due_date ? toLocalInput(task.due_date) : "")
    setEstimated(task?.estimated_minutes ? String(task.estimated_minutes) : "")
  }, [open, task, defaultProjectId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        project_id: projectId || null,
        priority,
        effort,
        dread_level: dread,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        estimated_minutes: estimated ? Number(estimated) : null,
      }
      if (task) {
        await updateTask.mutateAsync({ id: task.id, ...body })
        toast.success("Task updated")
      } else {
        await createTask.mutateAsync(body)
        toast.success("Added to inbox")
      }
      onOpenChange(false)
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

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {task ? "Save changes" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
