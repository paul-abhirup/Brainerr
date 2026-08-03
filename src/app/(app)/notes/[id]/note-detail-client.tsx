"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
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
import { ArrowLeft, Target, ListTodo, Trash2, Check, Loader2, AlertTriangle } from "lucide-react"

type SaveStatus = "saved" | "saving" | "error"

export function NoteDetailClient({
  note,
  linkedTask,
  linkedGoal,
}: {
  note: {
    id: string
    title: string | null
    body: string | null
    tags: string[]
    linked_task_id: string | null
    linked_goal_id: string | null
    updated_at: string
  }
  linkedTask: { id: string; title: string; status: string } | null
  linkedGoal: { id: string; title: string; status: string } | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const qc = useQueryClient()
  const [title, setTitle] = useState(note.title ?? "")
  const [body, setBody] = useState(note.body ?? "")
  const [tags, setTags] = useState(note.tags.join(", "))
  const [status, setStatus] = useState<SaveStatus>("saved")
  const [savedAt, setSavedAt] = useState(() => new Date(note.updated_at))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initial = useRef(true)

  async function persist() {
    try {
      const parsedTags = tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean)
      const { error } = await supabase
        .from("notes")
        .update({
          title: title.trim() || null,
          body: body.trim() || null,
          tags: parsedTags,
        })
        .eq("id", note.id)
      if (error) throw error
      setSavedAt(new Date())
      setStatus("saved")
      await qc.invalidateQueries({ queryKey: ["notes"] })
    } catch (err) {
      setStatus("error")
      toast.error((err as Error).message)
    }
  }

  const persistRef = useRef(persist)
  useEffect(() => {
    persistRef.current = persist
  })

  useEffect(() => {
    if (initial.current) {
      initial.current = false
      return
    }
    setStatus("saving")
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void persistRef.current()
    }, 700)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [title, body, tags])

  async function remove() {
    const { error } = await supabase.from("notes").delete().eq("id", note.id)
    if (error) toast.error(error.message)
    else {
      toast.success("Deleted")
      router.push("/notes")
    }
  }

  const words = body.trim() ? body.trim().split(/\s+/).length : 0

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/notes" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Notes
        </Link>
        <div className="flex items-center gap-2">
          {status === "saving" && (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </span>
          )}
          {status === "saved" && (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Check className="h-3.5 w-3.5 text-accent-success" /> Saved
              {savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1 text-xs text-accent-danger">
              <AlertTriangle className="h-3.5 w-3.5" /> Save failed
            </span>
          )}
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="outline" size="sm" className="text-accent-danger">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                </Button>
              }
            />
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{note.title || "Untitled"}&rdquo; will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={remove}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        aria-label="Note title"
        className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-text-disabled"
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={18}
        placeholder="Write freely…"
        aria-label="Note body"
        className="w-full resize-y rounded-xl border border-border-subtle bg-surface-1 p-4 text-sm leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      <div className="space-y-1.5">
        <label htmlFor="n-detail-tags" className="text-xs font-medium text-text-secondary">
          Tags
        </label>
        <Input
          id="n-detail-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="research, idea"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        {words > 0 && <span>{words} {words === 1 ? "word" : "words"}</span>}
        {body.length > 0 && <span>· {body.length} characters</span>}
        {savedAt && <span>· Updated {savedAt.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {linkedTask && (
          <Link href={`/tasks/${linkedTask.id}`} className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 hover:border-accent-primary/50">
            <ListTodo className="h-3.5 w-3.5 text-accent-primary" />
            Linked task: {linkedTask.title}
          </Link>
        )}
        {linkedGoal && (
          <Link href={`/goals/${linkedGoal.id}`} className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 hover:border-accent-success/50">
            <Target className="h-3.5 w-3.5 text-accent-success" />
            Linked goal: {linkedGoal.title}
          </Link>
        )}
      </div>
    </div>
  )
}
