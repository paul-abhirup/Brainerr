"use client"

import { useMemo } from "react"
import { subWeeks, startOfWeek, addDays, format } from "date-fns"
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import type { TaskRow } from "@/hooks/use-tasks"

export default function WeeklyChart({ tasks }: { tasks: TaskRow[] }) {
  const data = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 8 }).map((_, i) => {
      const weekStart = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 })
      const weekEnd = addDays(weekStart, 7)
      const inWeek = tasks.filter((t) => {
        const d = t.created_at ? new Date(t.created_at) : null
        return d && d >= weekStart && d < weekEnd
      })
      return {
        label: format(weekStart, "MMM d"),
        completed: inWeek.filter((t) => t.status === "done").length,
        open: inWeek.filter((t) => t.status !== "done").length,
      }
    })
  }, [tasks])

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} barSize={14}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={24} />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar name="Completed" dataKey="completed" fill="var(--accent-success)" radius={[4, 4, 0, 0]} />
          <Bar name="Open" dataKey="open" fill="var(--surface-3)" radius={[4, 4, 0, 0]} />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}
