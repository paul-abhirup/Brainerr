"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { parseQuickAdd } from "@/lib/nlp/parseQuickAdd"
import { useTasks } from "@/hooks/use-tasks"
import { TaskCard } from "@/components/tasks/task-card"
import { TaskForm } from "@/components/tasks/task-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { toast } from "sonner"
import { Plus, Dices, Loader2, Inbox as InboxIcon, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react"

export default function InboxPage() {
  const { data: tasks, isLoading } = useTasks()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const [quickText, setQuickText] = useState("")
  const [adding, setAdding] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const [showDone, setShowDone] = useState(false)

  const { openTasks, doneTasks } = useMemo(() => {
    if (!tasks) return { openTasks: [], doneTasks: [] }
    const open = tasks
      .filter((t) => t.status !== "done" && !t.parent_task_id)
      .sort((a, b) => {
        const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity
        const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity
        return aDue - bDue
      })
    const done = tasks.filter((t) => t.status === "done" && !t.parent_task_id)
    return { openTasks: open, doneTasks: done }
  }, [tasks])

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!quickText.trim() || adding) return
    setAdding(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error("User not authenticated")
      const p = parseQuickAdd(quickText)
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: p.title,
        due_date: p.dueDate,
        status: "todo",
      })
      if (error) throw error
      setQuickText("")
      await queryClient.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("Added to inbox")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function pickForMe() {
    const candidates = openTasks
    if (!candidates.length) {
      toast("Nothing to pick from yet")
      return
    }
    // Weighted: due-soonest and highest priority get more weight.
    const weighted = candidates.flatMap((t) => {
      const weight = (t.priority === "high" ? 3 : t.priority === "medium" ? 2 : 1) *
        (t.due_date && new Date(t.due_date) < new Date(Date.now() + 3 * 864e5) ? 2 : 1)
      return Array.from({ length: weight }, () => t)
    })
    const pick = weighted[Math.floor(Math.random() * weighted.length)]
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return
    const { error } = await supabase
      .from("user_state")
      .upsert({ user_id: user.id, last_active_task_id: pick.id })
      .eq("user_id", user.id)
    if (error) toast.error(error.message)
    toast.success(`Your pick: “${pick.title}”`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Everything unsorted lands here. Triage it whenever you like."
        actions={
          <>
            <Button variant="outline" onClick={pickForMe}>
              <Dices className="mr-2 h-4 w-4" />
              Pick for me
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New task
            </Button>
          </>
        }
      />

      <form onSubmit={handleQuickAdd} className="flex gap-2">
        <Input
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          placeholder="Quick add… try “finish slides tomorrow 5pm”"
          className="flex-1"
        />
        <Button type="submit" disabled={adding || !quickText.trim()}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </form>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      ) : openTasks.length === 0 && doneTasks.length === 0 ? (
        <EmptyState
          icon={<InboxIcon className="h-8 w-8 text-disabled" />}
          title="Your inbox is empty"
          description="Capture the first thing on your mind."
          action={
            <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
              Add your first task
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {openTasks.length > 0 && (
            <div className="space-y-2">
              {openTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}

          {doneTasks.length > 0 && (
            <div className="pt-4 border-t border-border space-y-3">
              <button
                onClick={() => setShowDone((prev) => !prev)}
                className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded"
                aria-expanded={showDone}
              >
                {showDone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Completed Tasks ({doneTasks.length}) — Click to view / unmark</span>
              </button>

              {showDone && (
                <div className="space-y-2 pl-2 border-l-2 border-success/20">
                  {doneTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <TaskForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
