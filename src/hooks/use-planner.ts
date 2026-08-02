"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"
import type { TaskRow } from "@/hooks/use-tasks"

const supabase = () => createClient()

export type FocusSessionRow = Database["public"]["Tables"]["focus_sessions"]["Row"]

/** Tasks relevant to a planner week: scheduled inside the window, due inside it, or unscheduled. */
export function useWeekTasks(weekStart: Date, weekEnd: Date) {
  const isoStart = weekStart.toISOString()
  const isoEnd = weekEnd.toISOString()
  return useQuery({
    queryKey: ["planner", "week", isoStart],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .or(`scheduled_start.gte.${isoStart},scheduled_start.is.null`)
        .lte("scheduled_start", isoEnd)
        .or(`due_date.gte.${isoStart},due_date.is.null`)
        .order("scheduled_start")
      if (error) throw error
      return (data ?? []) as TaskRow[]
    },
  })
}

/** Schedule (or reschedule) a task to a concrete slot. Logs scheduling_feedback when it overrides an auto-placed slot, and pins it. */
export function useScheduleTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      task,
      start,
      end,
    }: {
      task: TaskRow
      start: Date
      end: Date
    }) => {
      const { error } = await supabase().from("tasks").update({
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        is_pinned: true,
      }).eq("id", task.id)
      if (error) throw error

      if (task.scheduled_start && task.scheduled_start !== start.toISOString()) {
        const user = (await supabase().auth.getUser()).data.user
        if (user) {
          await supabase().from("scheduling_feedback").insert({
            user_id: user.id,
            task_id: task.id,
            suggested_start: task.scheduled_start,
            user_chosen_start: start.toISOString(),
          })
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["planner"] })
    },
  })
}

export function useUnscheduleTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase().from("tasks").update({
        scheduled_start: null,
        scheduled_end: null,
        is_pinned: false,
      }).eq("id", taskId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["planner"] })
    },
  })
}

export interface BusyBlock {
  id: string
  title: string | null
  start: Date
  end: Date
  source: "task" | "calendar"
}

/** Busy time for the planner: scheduled tasks plus synced Google events. */
export function useBusyBlocks(from: Date, to: Date) {
  const isoStart = from.toISOString()
  const isoEnd = to.toISOString()
  return useQuery({
    queryKey: ["busy_blocks", isoStart],
    queryFn: async () => {
      const client = supabase()
      const [tasksRes, calendarRes] = await Promise.all([
        client
          .from("tasks")
          .select("id,title,scheduled_start,scheduled_end")
          .gte("scheduled_start", isoStart)
          .lte("scheduled_end", isoEnd),
        client
          .from("calendar_busy")
          .select("id,title,start,end")
          .lte("start", isoEnd)
          .gte("end", isoStart),
      ])
      if (tasksRes.error) throw tasksRes.error
      if (calendarRes.error) throw calendarRes.error

      const tasks: BusyBlock[] = (tasksRes.data ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        start: new Date(t.scheduled_start!),
        end: new Date(t.scheduled_end!),
        source: "task",
      }))
      const calendar: BusyBlock[] = (calendarRes.data ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        start: new Date(b.start),
        end: new Date(b.end),
        source: "calendar",
      }))
      return [...tasks, ...calendar].sort((a, b) => a.start.getTime() - b.start.getTime())
    },
  })
}
