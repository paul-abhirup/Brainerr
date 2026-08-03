"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useTasks } from "@/hooks/use-tasks"
import { useGoals } from "@/hooks/use-data"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2, Target, ListTodo } from "lucide-react"

export type NoteInput = {
  id?: string
  title: string | null
  body: string | null
  tags: string[]
  linked_task_id: string | null
  linked_goal_id: string | null
}

export function NoteEditor({
  open,
  onOpenChange,
  note,
  onSaved,
  resetKey = 0,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  note?: NoteInput | null
  onSaved?: () => void
  resetKey?: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <NoteEditorForm
        key={resetKey}
        note={note}
        onClose={() => onOpenChange(false)}
        onSaved={onSaved}
      />
    </Dialog>
  )
}

function NoteEditorForm({
  note,
  onClose,
  onSaved,
}: {
  note?: NoteInput | null
  onClose: () => void
  onSaved?: () => void
}) {
  const supabase = createClient()
  const qc = useQueryClient()
  const { data: tasks } = useTasks()
  const { data: goals } = useGoals()

  const [title, setTitle] = useState(note?.title ?? "")
  const [body, setBody] = useState(note?.body ?? "")
  const [tags, setTags] = useState((note?.tags ?? []).join(", "))
  const [linkedTask, setLinkedTask] = useState<string | null>(note?.linked_task_id ?? null)
  const [linkedGoal, setLinkedGoal] = useState<string | null>(note?.linked_goal_id ?? null)
  const [saving, setSaving] = useState(false)

  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [focusTick, setFocusTick] = useState(0)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (focusTick === 0) return
    bodyRef.current?.focus()
  }, [focusTick])

  const mentionMatches = [...(tasks ?? []), ...(goals ?? [])]
    .filter((x) => !("status" in x) || x.status !== "done")
    .filter((x) => x.title.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 8)

  function handleBodyChange(value: string) {
    setBody(value)
    const atIndex = value.lastIndexOf("@")
    if (atIndex >= 0 && atIndex === value.length - 1 || (atIndex >= 0 && /[@]\S*$/.test(value.slice(atIndex)))) {
      const afterAt = value.slice(atIndex + 1)
      if (!afterAt.includes(" ")) {
        setMentionQuery(afterAt)
        setMentionOpen(true)
        return
      }
    }
    setMentionOpen(false)
  }

  function pickMention(item: { id: string; title: string }) {
    const full = "@" + item.title
    const before = body.slice(0, body.lastIndexOf("@"))
    const newBody = before + full
    setBody(newBody)
    setMentionOpen(false)
    if ("status" in item && "priority" in item) {
      setLinkedTask(item.id)
    } else {
      setLinkedGoal(item.id)
    }
    setFocusTick((t) => t + 1)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const parsedTags = tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean)
      const payload = {
        title: title.trim() || null,
        body: body.trim() || null,
        tags: parsedTags,
        linked_task_id: linkedTask,
        linked_goal_id: linkedGoal,
      }
      if (note?.id) {
        const { error } = await supabase.from("notes").update(payload).eq("id", note.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("notes").insert(payload)
        if (error) throw error
      }
      await qc.invalidateQueries({ queryKey: ["notes"] })
      onClose()
      onSaved?.()
      toast.success(note?.id ? "Note updated" : "Note saved")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{note?.id ? "Edit note" : "New note"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={submit}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault()
              submit(e)
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="n-title">Title</Label>
            <Input id="n-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-body">Body</Label>
            <div className="relative">
              <Textarea
                id="n-body"
                ref={bodyRef}
                rows={6}
                value={body}
                onChange={(e) => handleBodyChange(e.target.value)}
                placeholder="Write freely. Type @ to link a task or goal…"
              />
              {mentionOpen && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                  {mentionMatches.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-disabled">No matches</p>
                  ) : (
                    mentionMatches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => pickMention(item)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted outline-none"
                      >
                        {"priority" in item ? (
                          <ListTodo className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Target className="h-3.5 w-3.5 text-success" />
                        )}
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-tags">Tags (comma-separated)</Label>
            <Input id="n-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="research, idea" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
    </DialogContent>
  )
}
