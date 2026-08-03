"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

const supabase = () => createClient()

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...taskKeys.lists(), filters] as const,
  detail: (id: string) => [...taskKeys.all, id] as const,
}

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"]

export function useTasks() {
  return useQuery({
    queryKey: taskKeys.lists(),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as TaskRow[]
    },
  })
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? "none"),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .eq("id", id!)
        .single()
      if (error) throw error
      return data as TaskRow
    },
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<TaskRow>) => {
      const user = (await supabase().auth.getUser()).data.user
      if (!user) throw new Error("User not authenticated")
      const payload = input.user_id ? input : { ...input, user_id: user.id }
      const { data, error } = await supabase()
        .from("tasks")
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Partial<TaskRow> & { id: string }) => {
      const { data, error } = await supabase()
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("tasks").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}
