"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useNotes } from "@/hooks/use-data"
import { useQueryClient } from "@tanstack/react-query"
import { NoteEditor } from "@/components/notes/note-editor"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { toast } from "sonner"
import { Plus, StickyNote, Trash2 } from "lucide-react"

export default function NotesPage() {
  const { data: notes, isLoading } = useNotes()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingNote = notes?.find((n) => n.id === editingId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes"
        description={
          <>
            Freeform capture. Type <span className="text-accent-primary">@</span> to link a task or goal.
          </>
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New note
          </Button>
        }
      />

      <NoteEditor
        open={creating}
        onOpenChange={setCreating}
        onSaved={() => setCreating(false)}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : !notes?.length ? (
        <EmptyState
          icon={<StickyNote className="h-8 w-8 text-text-disabled" />}
          title="No notes yet"
          description="Jot down ideas, links, or context without committing to a task."
          action={
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              Write your first note
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card key={note.id} className="group gap-0">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/notes/${note.id}`} className="min-w-0">
                  <h3 className="truncate text-sm font-medium hover:text-accent-primary">
                    {note.title || "Untitled"}
                  </h3>
                </Link>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon-sm" className="text-xs" onClick={() => setEditingId(note.id)}>
                    Edit
                  </Button>
                  <DeleteNote id={note.id} />
                </div>
              </div>
              {note.body && (
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-text-secondary">
                  {note.body}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {note.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
                {note.linked_task_id && (
                  <Badge className="bg-accent-primary/10 text-accent-primary">task</Badge>
                )}
                {note.linked_goal_id && (
                  <Badge className="bg-accent-success/10 text-accent-success">goal</Badge>
                )}
                <span className="ml-auto text-xs text-text-disabled">
                  {format(new Date(note.updated_at), "MMM d")}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NoteEditor
        key={editingId ?? "none"}
        open={!!editingNote}
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
        note={editingNote}
        onSaved={() => setEditingId(null)}
      />
    </div>
  )
}

function DeleteNote({ id }: { id: string }) {
  const supabase = createClient()
  const qc = useQueryClient()
  async function remove() {
    const { error } = await supabase.from("notes").delete().eq("id", id)
    if (error) toast.error(error.message)
    else {
      await qc.invalidateQueries({ queryKey: ["notes"] })
      toast.success("Note deleted")
    }
  }
  return (
    <Button variant="ghost" size="icon-sm" className="text-accent-danger" onClick={remove}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}
