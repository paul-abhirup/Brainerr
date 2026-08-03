"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { parseQuickAdd } from "@/lib/nlp/parseQuickAdd"
import { useQuickAdd } from "@/components/app/quick-add-provider"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CalendarClock, Inbox, Loader2, Plus, StickyNote } from "lucide-react"

export function CommandPalette() {
  const { isOpen, openQuickAdd, closeQuickAdd } = useQuickAdd()
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)

  const parsed = useMemo(() => (value.trim() ? parseQuickAdd(value) : null), [value])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        if (isOpen) closeQuickAdd()
        else {
          setValue("")
          openQuickAdd()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, openQuickAdd, closeQuickAdd])

  async function createTask() {
    if (!value.trim() || loading) return
    setLoading(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error("User not authenticated")
      const p = parseQuickAdd(value)
      if (p.isReminder) {
        const { error } = await supabase
          .from("notes")
          .insert({ user_id: user.id, title: p.title, body: p.title })
        if (error) throw error
        toast.success("Captured to notes")
      } else {
        const { error } = await supabase.from("tasks").insert({
          user_id: user.id,
          title: p.title,
          due_date: p.dueDate,
          status: "todo",
        })
        if (error) throw error
        toast.success("Added to inbox")
      }
      await queryClient.invalidateQueries()
      router.refresh()
      setValue("")
      closeQuickAdd()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? openQuickAdd() : closeQuickAdd())}>
      <DialogContent className="top-[20%] max-w-xl gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Quick add</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Plus className="h-4 w-4 text-disabled" />
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createTask()
              if (e.key === "Escape") closeQuickAdd()
            }}
            placeholder="Capture a task or note… try “finish slides tomorrow 5pm”"
            className="h-14 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              Task
            </span>
            {parsed?.dueDate && (
              <span className="flex items-center gap-1.5 text-warning">
                <CalendarClock className="h-3.5 w-3.5" />
                {new Date(parsed.dueDate).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5" />
              Prefix “note” to capture a note
            </span>
          </div>
          <Button size="sm" onClick={createTask} disabled={!value.trim() || loading}>
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
