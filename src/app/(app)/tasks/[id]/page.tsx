import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { TaskDetailClient } from "./task-detail-client"

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).single()
  if (!task) notFound()

  const [projectRes, parentRes, blockerRes, subtasksRes, blocksRes, notesRes, sessionsRes] = await Promise.all([
    task.project_id ? supabase.from("projects").select("id,name,color").eq("id", task.project_id).single() : null,
    task.parent_task_id ? supabase.from("tasks").select("id,title,status").eq("id", task.parent_task_id).single() : null,
    task.blocked_by_task_id ? supabase.from("tasks").select("id,title,status").eq("id", task.blocked_by_task_id).single() : null,
    supabase.from("tasks").select("id,title,status,priority,estimated_minutes,due_date").eq("parent_task_id", task.id).order("created_at"),
    supabase.from("tasks").select("id,title,status").eq("blocked_by_task_id", task.id).order("created_at"),
    supabase.from("notes").select("id,title,created_at,updated_at").eq("linked_task_id", task.id).order("updated_at", { ascending: false }),
    supabase.from("focus_sessions").select("id,duration_minutes,completed,started_at").eq("task_id", task.id).order("started_at", { ascending: false }),
  ])

  return (
    <TaskDetailClient
      task={task}
      project={projectRes?.error ? null : (projectRes?.data ?? null)}
      parent={parentRes?.error ? null : (parentRes?.data ?? null)}
      blocker={blockerRes?.error ? null : (blockerRes?.data ?? null)}
      subtasks={subtasksRes.error ? [] : (subtasksRes.data ?? [])}
      blocks={blocksRes.error ? [] : (blocksRes.data ?? [])}
      notes={notesRes.error ? [] : (notesRes.data ?? [])}
      sessions={sessionsRes.error ? [] : (sessionsRes.data ?? [])}
    />
  )
}
