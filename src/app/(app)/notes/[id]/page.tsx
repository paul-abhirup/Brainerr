import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { NoteDetailClient } from "./note-detail-client"

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: note } = await supabase.from("notes").select("*").eq("id", id).single()

  if (!note) notFound()

  let linkedTask = null
  let linkedGoal = null
  if (note.linked_task_id) {
    const { data } = await supabase.from("tasks").select("id,title,status").eq("id", note.linked_task_id).single()
    linkedTask = data
  }
  if (note.linked_goal_id) {
    const { data } = await supabase.from("goals").select("id,title,status").eq("id", note.linked_goal_id).single()
    linkedGoal = data
  }

  return <NoteDetailClient note={note} linkedTask={linkedTask} linkedGoal={linkedGoal} />
}
