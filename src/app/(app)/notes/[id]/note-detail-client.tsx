"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ArrowLeft, Target, ListTodo, Trash2 } from "lucide-react"

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
  }
  linkedTask: { id: string; title: string; status: string } | null
  linkedGoal: { id: string; title: string; status: string } | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [title, setTitle] = useState(note.title ?? "")
  const [body, setBody] = useState(note.body ?? "")
  const [tags] = useState(note.tags.join(", "))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from("notes")
        .update({
          title: title.trim() || null,
          body: body.trim() || null,
          tags: tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
        })
        .eq("id", note.id)
      if (error) throw error
      toast.success("Saved")
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    const { error } = await supabase.from("notes").delete().eq("id", note.id)
    if (error) toast.error(error.message)
    else {
      toast.success("Deleted")
      router.push("/notes")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/notes" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Notes
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-accent-danger" onClick={remove}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-text-disabled"
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={16}
        placeholder="Write freely…"
        className="w-full resize-y rounded-xl border border-border-subtle bg-surface-1 p-4 text-sm leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">#</Badge>
        {note.tags.map((tag) => (
          <Badge key={tag} variant="outline">#{tag}</Badge>
        ))}
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
