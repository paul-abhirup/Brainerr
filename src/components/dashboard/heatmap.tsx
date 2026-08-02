"use client"

import { useMemo } from "react"
import { subDays, format } from "date-fns"
import CalendarHeatmap, { type HeatmapValue } from "react-calendar-heatmap"
import "react-calendar-heatmap/dist/styles.css"
import type { HabitRow } from "@/hooks/use-data"

interface HeatLog {
  habit_id: string
  date: string
  completed: boolean
}

export default function Heatmap({ logs, habits }: { logs: HeatLog[]; habits: HabitRow[] }) {
  const habitIds = useMemo(() => new Set((habits ?? []).map((h) => h.id)), [habits])

  const values = useMemo(() => {
    const counts = new Map<string, number>()
    for (const log of logs ?? []) {
      if (!habitIds.has(log.habit_id)) continue
      if (!log.completed) continue
      counts.set(log.date, (counts.get(log.date) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }))
  }, [logs, habitIds])

  const today = new Date()
  const start = subDays(today, 180)

  const classForValue = (v: HeatmapValue | null) => {
    if (!v || !v.count || v.count === 0) return "heat-empty"
    if (v.count === 1) return "heat-1"
    if (v.count === 2) return "heat-2"
    return "heat-3"
  }

  return (
    <div className="overflow-x-auto pb-2">
      <style>{`
        .react-calendar-heatmap .color-empty { fill: var(--surface-2); }
        .react-calendar-heatmap .color-scale-1 { fill: var(--accent-primary); }
        .react-calendar-heatmap .color-scale-2 { fill: var(--accent-primary); }
        .react-calendar-heatmap .color-scale-3 { fill: var(--accent-primary); }
        .react-calendar-heatmap .color-scale-4 { fill: var(--accent-primary); }
        .react-calendar-heatmap .color-scale-5 { fill: var(--accent-primary); }
        .react-calendar-heatmap .heat-empty { fill: var(--surface-2); }
        .react-calendar-heatmap .heat-1 { fill: color-mix(in srgb, var(--accent-primary) 40%, transparent); }
        .react-calendar-heatmap .heat-2 { fill: color-mix(in srgb, var(--accent-primary) 70%, transparent); }
        .react-calendar-heatmap .heat-3 { fill: var(--accent-primary); }
        .react-calendar-heatmap text { fill: var(--text-disabled); font-size: 10px; }
      `}</style>
      <CalendarHeatmap
        startDate={start}
        endDate={today}
        values={values}
        classForValue={classForValue}
        titleForValue={(v) => (v ? `${v.count} completed · ${format(new Date(v.date), "MMM d")}` : "")}
        showMonthLabels
        horizontal
      />
    </div>
  )
}
