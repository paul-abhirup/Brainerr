import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { GoalDetailClient } from "./goal-detail-client"

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: goal } = await supabase.from("goals").select("*").eq("id", id).single()
  if (!goal) notFound()

  const [childrenRes, projectsRes, progressRes, forecastRes, allTasksRes] = await Promise.all([
    supabase.from("goals").select("*").eq("parent_goal_id", goal.id).order("created_at"),
    supabase.from("projects").select("*").eq("goal_id", goal.id).order("name"),
    supabase.from("goal_progress").select("*").eq("goal_id", goal.id).single(),
    supabase.from("goal_forecast").select("*").eq("goal_id", goal.id).single(),
    supabase.from("tasks").select("*"),
  ])

  const children = childrenRes.error ? [] : (childrenRes.data ?? [])
  const projects = projectsRes.error ? [] : (projectsRes.data ?? [])
  const projectIds = new Set(projects.map((p) => p.id))
  const tasks = (allTasksRes.error ? [] : (allTasksRes.data ?? [])).filter((t) => t.project_id && projectIds.has(t.project_id))

  return (
    <GoalDetailClient
      goal={goal}
      subGoals={children}
      projects={projects}
      progress={progressRes.error ? null : (progressRes.data ?? null)}
      forecast={forecastRes.error ? null : (forecastRes.data ?? null)}
      tasks={tasks}
    />
  )
}
