"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useNotes } from "@/hooks/use-data"
import { useQueryClient } from "@tanstack/react-query"
import { NoteEditor, type NoteInput } from "@/components/notes/note-editor"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, Pencil, StickyNote, Trash2, Search, LayoutGrid, Rows3 } from "lucide-react"

type EditorState = {
  open: boolean
  note: NoteInput | null
  resetKey: number
}

function timeLabel(iso: string) {
  const date = new Date(iso)
  const days = (Date.now() - date.getTime()) / 86_400_000
  if (days < 6) return formatDistanceToNow(date, { addSuffix: true })
  return format(date, "MMM d")
}

export default function NotesPage() {
  const { data: notes, isLoading } = useNotes()
  const [editor, setEditor] = useState<EditorState>({ open: false, note: null, resetKey: 0 })
  const [search, setSearch] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [view, setView] = useState<"grid" | "list">(() =>
    typeof window === "undefined" ? "grid" : (localStorage.getItem("notes-view") as "grid" | "list") ?? "grid"
  )

  function openCreate() {
    setEditor((e) => ({ open: true, note: null, resetKey: e.resetKey + 1 }))
  }
  function openEdit(note: NoteInput) {
    setEditor((e) => ({ open: true, note, resetKey: e.resetKey + 1 }))
  }
  function closeEditor() {
    setEditor((e) => ({ ...e, open: false }))
  }

  const allTags = useMemo(() => {
    const set = new Set<string>()
    notes?.forEach((n) => n.tags.forEach((t) => set.add(t)))
    return [...set].sort()
  }, [notes])

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (
      notes?.filter((n) => {
        if (activeTag && !n.tags.includes(activeTag)) return false
        if (!q) return true
        return (
          (n.title?.toLowerCase().includes(q) ?? false) ||
          (n.body?.toLowerCase().includes(q) ?? false) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
        )
      }) ?? []
    )
  }, [notes, search, activeTag])

  function toggleView() {
    const next = view === "grid" ? "list" : "grid"
    setView(next)
    localStorage.setItem("notes-view", next)
  }

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
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New note
          </Button>
        }
      />

      <NoteEditor
        open={editor.open}
        onOpenChange={(open) => {
          if (!open) closeEditor()
        }}
        note={editor.note}
        resetKey={editor.resetKey}
        onSaved={closeEditor}
      />

      {!isLoading && !!notes?.length && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes…"
                className="pl-9"
                aria-label="Search notes"
              />
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={toggleView}
              aria-label={view === "grid" ? "Switch to list view" : "Switch to grid view"}
            >
              {view === "grid" ? <Rows3 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveTag(null)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  activeTag === null
                    ? "bg-accent-primary text-white"
                    : "bg-surface-2 text-text-secondary hover:bg-surface-3"
                )}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    tag === activeTag
                      ? "bg-accent-primary text-white"
                      : "bg-surface-2 text-text-secondary hover:bg-surface-3"
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-text-secondary">
            {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
          </p>
        </>
      )}

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
            <Button variant="outline" size="sm" onClick={openCreate}>
              Write your first note
            </Button>
          }
        />
      ) : filteredNotes.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8 text-text-disabled" />}
          title="No matching notes"
          description="Try a different search or clear the tag filter."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("")
                setActiveTag(null)
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div
          className={cn(
            view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2"
          )}
        >
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              className={cn("group", view === "list" ? "gap-1.5 p-3" : "gap-0")}
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/notes/${note.id}`} className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium hover:text-accent-primary">
                    {note.title || "Untitled"}
                  </h3>
                </Link>
                <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button variant="ghost" size="icon-sm" aria-label="Edit note" onClick={() => openEdit(note)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <DeleteNote id={note.id} />
                </div>
              </div>
              {note.body && view === "grid" && (
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-text-secondary">
                  {note.body}
                </p>
              )}
              {note.body && view === "list" && (
                <p className="line-clamp-1 whitespace-pre-wrap text-xs text-text-secondary">
                  {note.body}
                </p>
              )}
              <div className={cn("flex flex-wrap items-center gap-1.5", view === "grid" ? "mt-3" : "mt-1")}>
                {note.tags.slice(0, 3).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setActiveTag(tag)
                      setSearch("")
                    }}
                  >
                    <Badge variant="outline" className="text-xs hover:border-accent-primary/50">
                      #{tag}
                    </Badge>
                  </button>
                ))}
                {note.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{note.tags.length - 3}
                  </Badge>
                )}
                {note.linked_task_id && (
                  <Badge className="bg-accent-primary/10 text-accent-primary">task</Badge>
                )}
                {note.linked_goal_id && (
                  <Badge className="bg-accent-success/10 text-accent-success">goal</Badge>
                )}
                <span className="ml-auto shrink-0 text-xs text-text-disabled" title={format(new Date(note.updated_at), "PPp")}>
                  {timeLabel(note.updated_at)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
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
