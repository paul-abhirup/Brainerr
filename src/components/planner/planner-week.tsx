"use client"

import { useState } from "react"
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core"
import { format, addDays } from "date-fns"
import type { TaskRow } from "@/hooks/use-tasks"
import { cn } from "@/lib/utils"
import { Clock, GripVertical } from "lucide-react"

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i) // 8:00 → 19:00

function taskDuration(task: TaskRow) {
  return Math.max(15, task.estimated_minutes ?? 30)
}

export function PlannerWeek({
  weekStart,
  tasks,
  onSchedule,
}: {
  weekStart: Date
  tasks: TaskRow[]
  onSchedule: (task: TaskRow, start: Date) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Unscheduled tray */}
      <UnscheduledTray tasks={unscheduled} />

      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle">
          {Array.from({ length: 7 }).map((_, day) => {
            const date = addDays(weekStart, day)
            const dayTasks = scheduled
              .filter((t) => t.scheduled_start && new Date(t.scheduled_start).getDate() === date.getDate())
              .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())

            return (
              <div key={day} className="bg-surface-1">
                <div className={cn("px-3 py-2 text-center text-xs font-medium", isToday(date) ? "text-accent-primary" : "text-text-secondary")}>
                  <div className="uppercase tracking-wide">{format(date, "EEE")}</div>
                  <div className="mt-0.5 text-sm font-semibold text-text-primary">{format(date, "d")}</div>
                </div>
                <div className="divide-y divide-border-subtle/60">
                  {HOURS.map((hour) => (
                    <HourCell key={hour} hour={hour} dayOffset={day} tasks={dayTasks.filter((t) => new Date(t.scheduled_start!).getHours() === hour)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-56 rounded-lg border border-accent-primary/50 bg-surface-2 px-3 py-2 text-sm shadow-lg">
            {activeTask.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function HourCell({ hour, dayOffset, tasks }: { hour: number; dayOffset: number; tasks: TaskRow[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dayOffset}-${hour}`, data: { dayOffset, hour } })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative min-h-[44px] px-2 py-1 transition-colors",
        isOver && "bg-accent-primary/10 ring-1 ring-inset ring-accent-primary/40",
      )}
    >
      <span className="pointer-events-none absolute left-1 top-0.5 text-[10px] tabular-nums text-text-disabled">
        {hour}:00
      </span>
      <div className="ml-7 space-y-1">
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
        "group flex cursor-grab items-center gap-1 rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-xs text-text-primary active:cursor-grabbing",
        isDragging && "opacity-40",
        task.priority === "high" && "border-l-2 border-l-accent-warm",
        task.priority === "low" && "border-l-2 border-l-accent-success",
        task.priority === "medium" && "border-l-2 border-l-accent-primary",
        task.status === "done" && "text-text-disabled line-through",
      )}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-text-disabled" />
      <span className="truncate">{task.title}</span>
    </div>
  )
}

function UnscheduledTray({ tasks }: { tasks: TaskRow[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: "unscheduled-tray" })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[64px] flex-wrap items-center gap-2 rounded-xl border border-dashed border-border-subtle bg-surface-1 p-3 transition-colors",
        isOver && "border-accent-primary/60 bg-accent-primary/5",
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-disabled">
        <Clock className="h-3.5 w-3.5" />
        Unscheduled
      </span>
      {tasks.length === 0 ? (
        <span className="text-xs text-text-disabled">Nothing unscheduled — drag tasks here to free up time.</span>
      ) : (
        tasks.map((t) => (
          <TrayTask key={t.id} task={t} />
        ))
      )}
    </div>
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
        "flex cursor-grab items-center gap-2 rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-3 active:cursor-grabbing",
        isDragging && "opacity-40",
        task.priority === "high" && "border-l-2 border-l-accent-warm",
        task.priority === "low" && "border-l-2 border-l-accent-success",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-text-disabled" />
      <span className="max-w-[240px] truncate">{task.title}</span>
      <span className="text-xs tabular-nums text-text-disabled">{taskDuration(task)}m</span>
    </div>
  )
}

function isToday(d: Date) {
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}
