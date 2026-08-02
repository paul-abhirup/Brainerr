"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

const supabase = () => createClient()

export const projectKeys = { all: ["projects"] as const }

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase().from("projects").select("*").order("name")
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; goal_id?: string | null; color?: string }) => {
      const { data, error } = await supabase().from("projects").insert(input).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

export type GoalRow = {
  id: string
  user_id: string
  parent_goal_id: string | null
  title: string
  description: string | null
  horizon: "long_term" | "monthly" | "weekly"
  target_date: string | null
  status: "active" | "done" | "archived"
  created_at: string
  updated_at: string
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase().from("goals").select("*").order("created_at")
      if (error) throw error
      return (data ?? []) as GoalRow[]
    },
  })
}

export function useGoalProgress() {
  return useQuery({
    queryKey: ["goal_progress"],
    queryFn: async () => {
      const { data, error } = await supabase().from("goal_progress").select("*")
      if (error) throw error
      return data ?? []
    },
  })
}

export function useGoalForecast() {
  return useQuery({
    queryKey: ["goal_forecast"],
    queryFn: async () => {
      const { data, error } = await supabase().from("goal_forecast").select("*")
      if (error) throw error
      return data ?? []
    },
  })
}

export type HabitRow = {
  id: string
  user_id: string
  title: string
  frequency: "daily" | "weekly" | "custom"
  target_days_per_week: number
  active: boolean
  current_streak: number
  best_streak: number
  streak_frozen: boolean
  created_at: string
  updated_at: string
}

export function useHabits() {
  return useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase().from("habits").select("*").order("created_at")
      if (error) throw error
      return (data ?? []) as HabitRow[]
    },
  })
}

export function useHabitLogs(from: string, to: string) {
  return useQuery({
    queryKey: ["habit_logs", from, to],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("habit_logs")
        .select("*")
        .gte("date", from)
        .lte("date", to)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useNotes() {
  return useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase().from("notes").select("*").order("updated_at", { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useUserState() {
  return useQuery({
    queryKey: ["user_state"],
    queryFn: async () => {
      const { data, error } = await supabase().from("user_state").select("*").single()
      if (error) return null
      return data
    },
  })
}

export function useUserSettings() {
  return useQuery({
    queryKey: ["user_settings"],
    queryFn: async () => {
      const { data, error } = await supabase().from("user_settings").select("*").single()
      if (error) return null
      return data
    },
  })
}

export function useUpdateUserState() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: {
      last_active_task_id?: string | null
      last_active_note_id?: string | null
      mood_energy?: "low" | "medium" | "high" | null
      last_mood_checkin?: string | null
      last_opened_at?: string
    }) => {
      const user = (await supabase().auth.getUser()).data.user
      if (!user) throw new Error("Not signed in")
      const { error } = await supabase().from("user_state").update(patch).eq("user_id", user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_state"] }),
  })
}
