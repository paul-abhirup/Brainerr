"use client"

import { useState, useMemo } from "react"
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core"
import { format, addDays } from "date-fns"
import type { TaskRow } from "@/hooks/use-tasks"
import type { BusyBlock } from "@/hooks/use-planner"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Clock, GripVertical } from "lucide-react"
import { useIsMobile } from "@/hooks/use-media-query"

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i) // 8:00 → 19:00

function taskDuration(task: TaskRow) {
  return Math.max(15, task.estimated_minutes ?? 30)
}

export function PlannerWeek({
  weekStart,
  tasks,
  busy,
  onSchedule,
}: {
  weekStart: Date
  tasks: TaskRow[]
  busy?: BusyBlock[]
  onSchedule: (task: TaskRow, start: Date) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  // Mouse drags start after 6px; touch drags require a 220ms long-press so
  // vertical scrolling through the week is never hijacked by a task chip.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  const scheduled = tasks.filter((t) => t.scheduled_start)
  const unscheduled = tasks.filter((t) => !t.scheduled_start && t.status !== "done")

  const activeTask = tasks.find((t) => t.id === activeId)

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const over = e.over
    if (!over || !activeTask) return
    const data = over.data.current as { dayOffset: number; hour: number } | undefined
    if (!data) return
    const start = addDays(weekStart, data.dayOffset)
    start.setHours(data.hour, 0, 0, 0)
    onSchedule(activeTask, start)
  }

  const isMobile = useIsMobile()
  const [viewCount, setViewCount] = useState<1 | 3 | 7>(3)

  // Default phones to the 1-day view (adjusts state during render — no effect needed).
  const [wasMobile, setWasMobile] = useState(isMobile)
  if (wasMobile !== isMobile) {
    setWasMobile(isMobile)
    setViewCount(isMobile ? 1 : 3)
  }

  const displayedDays = useMemo(() => {
    if (viewCount === 7) return Array.from({ length: 7 }, (_, i) => i)
    if (viewCount === 3) return [0, 1, 2]
    // 1 day (today or selected)
    return [0]
  }, [viewCount])

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Unscheduled tray */}
      <UnscheduledTray tasks={unscheduled} />

      {/* Mobile-Friendly View Switcher */}
      <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl border border-border text-xs font-semibold">
          <button
            onClick={() => setViewCount(1)}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
              viewCount === 1 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            1 Day
          </button>
          <button
            onClick={() => setViewCount(3)}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
              viewCount === 3 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            3 Days
          </button>
          <button
            onClick={() => setViewCount(7)}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
              viewCount === 7 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Full Week (7D)
          </button>
        </div>
      </div>

      {viewCount === 7 && isMobile ? (
        /* 7-day grid doesn't fit phones — show an agenda list grouped by day.
           Dropping a task on a day schedules it for 9:00. */
        <div className="mt-3 space-y-2">
          {displayedDays.map((day) => {
            const date = addDays(weekStart, day)
            const dayTasks = scheduled
              .filter((t) => t.scheduled_start && new Date(t.scheduled_start).getDate() === date.getDate())
              .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())
            const dayBusy = (busy ?? []).filter(
              (b) =>
                b.start.getFullYear() === date.getFullYear() &&
                b.start.getMonth() === date.getMonth() &&
                b.start.getDate() === date.getDate(),
            )
            return <DayAgendaRow key={day} day={day} date={date} tasks={dayTasks} busy={dayBusy} />
          })}
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div
            className={cn(
              "grid gap-px overflow-hidden rounded-xl border border-border bg-border transition-all",
              viewCount === 1 && "grid-cols-1 w-full min-w-0",
              viewCount === 3 && "grid-cols-1 sm:grid-cols-3 w-full min-w-0",
              viewCount === 7 && "grid-cols-7 min-w-[850px]",
            )}
          >
            {displayedDays.map((day) => {
              const date = addDays(weekStart, day)
              const dayTasks = scheduled
                .filter((t) => t.scheduled_start && new Date(t.scheduled_start).getDate() === date.getDate())
                .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())
              const dayBusy = (busy ?? []).filter(
                (b) =>
                  b.start.getFullYear() === date.getFullYear() &&
                  b.start.getMonth() === date.getMonth() &&
                  b.start.getDate() === date.getDate(),
              )

              return (
                <div key={day} className="bg-card">
                  <div className={cn("px-3 py-2 text-center text-xs font-medium", isToday(date) ? "text-primary" : "text-muted-foreground")}>
                    <div className="uppercase tracking-wide">{format(date, "EEE")}</div>
                    <div className="mt-0.5 text-sm font-semibold text-foreground">{format(date, "d")}</div>
                  </div>
                  <div className="divide-y divide-border/60">
                    {HOURS.map((hour) => (
                      <HourCell
                        key={hour}
                        hour={hour}
                        dayOffset={day}
                        tasks={dayTasks.filter((t) => new Date(t.scheduled_start!).getHours() === hour)}
                        busy={dayBusy.filter((b) => b.start.getHours() === hour)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <DragOverlay>
        {activeTask ? (
          <div className="w-56 rounded-lg border border-primary/50 bg-secondary px-3 py-2 text-sm shadow-lg">
            {activeTask.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function HourCell({ hour, dayOffset, tasks, busy }: { hour: number; dayOffset: number; tasks: TaskRow[]; busy: BusyBlock[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dayOffset}-${hour}`, data: { dayOffset, hour } })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative min-h-[44px] px-2 py-1 transition-colors",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/40",
      )}
    >
      <span className="pointer-events-none absolute left-1 top-0.5 text-xs tabular-nums text-disabled">
        {hour}:00
      </span>
      <div className="ml-7 space-y-1">
        {busy.map((b) => (
          <div
            key={b.id}
            title={`Busy — ${b.title ?? "event"}`}
            className="pointer-events-none rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-xs text-warning/80"
          >
            <span className="truncate">▤ {b.title ?? "Busy"}</span>
          </div>
        ))}
        {tasks.map((t) => (
          <PlannedTask key={t.id} task={t} />
        ))}
      </div>
    </div>
  )
}

function PlannedTask({ task }: { task: TaskRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "group flex cursor-grab items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground active:cursor-grabbing",
        isDragging && "opacity-40",
        task.priority === "high" && "border-l-2 border-l-warning",
        task.priority === "low" && "border-l-2 border-l-success",
        task.priority === "medium" && "border-l-2 border-l-primary",
        task.status === "done" && "text-disabled line-through",
      )}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-disabled" />
      <span className="truncate">{task.title}</span>
    </div>
  )
}

function UnscheduledTray({ tasks }: { tasks: TaskRow[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: "unscheduled-tray" })
  return (
    <Card
      ref={setNodeRef}
      size="sm"
      className={cn(
        "flex-row flex-wrap items-center gap-2 border-dashed transition-colors",
        isOver && "border-primary/60 bg-primary/5",
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-disabled">
        <Clock className="h-3.5 w-3.5" />
        Unscheduled
      </span>
      {tasks.length === 0 ? (
        <span className="text-xs text-disabled">Nothing unscheduled — drag tasks here to free up time.</span>
      ) : (
        tasks.map((t) => (
          <TrayTask key={t.id} task={t} />
        ))
      )}
    </Card>
  )
}

function TrayTask({ task }: { task: TaskRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted active:cursor-grabbing",
        isDragging && "opacity-40",
        task.priority === "high" && "border-l-2 border-l-warning",
        task.priority === "low" && "border-l-2 border-l-success",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-disabled" />
      <span className="max-w-[240px] truncate">{task.title}</span>
      <span className="text-xs tabular-nums text-disabled">{taskDuration(task)}m</span>
    </div>
  )
}

function DayAgendaRow({ day, date, tasks, busy }: { day: number; date: Date; tasks: TaskRow[]; busy: BusyBlock[] }) {
  // Dropping on a day row schedules the task at 9:00 that day.
  const { isOver, setNodeRef } = useDroppable({ id: `agenda-day-${day}`, data: { dayOffset: day, hour: 9 } })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border border-border bg-card p-3 transition-colors",
        isOver && "border-primary/60 bg-primary/5",
      )}
    >
      <div className={cn("flex items-baseline gap-2 text-xs font-medium", isToday(date) ? "text-primary" : "text-muted-foreground")}>
        <span className="uppercase tracking-wide">{format(date, "EEE")}</span>
        <span className="text-sm font-semibold text-foreground">{format(date, "MMM d")}</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {busy.map((b) => (
          <div
            key={b.id}
            className="pointer-events-none rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning/80"
          >
            <span className="truncate">
              Busy {format(b.start, "HH:mm")} — {b.title ?? "event"}
            </span>
          </div>
        ))}
        {tasks.length === 0 && busy.length === 0 ? (
          <p className="text-xs text-disabled">Nothing scheduled — drop a task to plan 9:00.</p>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs tabular-nums text-disabled">
                {format(new Date(t.scheduled_start!), "HH:mm")}
              </span>
              <div className="min-w-0 flex-1">
                <PlannedTask task={t} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function isToday(d: Date) {
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}
