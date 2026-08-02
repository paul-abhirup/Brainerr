// Greedy, priority-ordered first-fit auto-scheduler (doc §14).
// Pure logic — no I/O — so it can run identically in Next.js routes and Edge Functions.

export type Priority = "low" | "medium" | "high"
export type Effort = "low" | "medium" | "high"

export interface TaskLike {
  id: string
  title: string
  due_date: string | null
  priority: Priority
  effort: Effort | null
  estimated_minutes: number | null
  blocked_by_task_id: string | null
  status: string
  is_pinned: boolean
  at_risk: boolean
  created_at: string
  scheduled_end?: string | null
}

export interface BusyBlock {
  start: number // epoch ms
  end: number
}

export interface WorkingHours {
  startMinutes: number // e.g. 9*60
  endMinutes: number
}

export interface Settings {
  bufferMinutes: number
  maxDailyTaskMinutes: number
  horizonDays: number
  workingHoursByWeekday: Record<number, WorkingHours | null> // 0=Sun..6=Sat
}

export interface ProductivityPatterns {
  hourOfDay: number
  completionRate: number
}

export interface ScheduleInput {
  tasks: TaskLike[]
  busyBlocks: BusyBlock[]
  settings: Settings
  now: number
  productivity: ProductivityPatterns[]
}

export interface ScheduledPlacement {
  taskId: string
  start: number
  end: number
  day: string
}

export interface ScheduleResult {
  scheduled: ScheduledPlacement[]
  atRisk: string[]
  skippedNoTime: string[]
  placedCount: number
}

const MIN_DURATION_MS = 15 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function dayStartOf(ts: number): Date {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Ordered list of free intervals per day within the horizon. */
function buildFreeMap(input: ScheduleInput): { dayIndex: number; slots: { start: number; end: number }[] }[] {
  const { settings, now, busyBlocks } = input
  const result: { dayIndex: number; slots: { start: number; end: number }[] }[] = []

  for (let day = 0; day < settings.horizonDays; day++) {
    const date = dayStartOf(now + day * DAY_MS)
    const weekday = date.getDay()
    const wh = settings.workingHoursByWeekday[weekday]
    if (!wh) continue

    const dayStart = date.getTime()
    const workStart = dayStart + wh.startMinutes * 60000
    const workEnd = dayStart + wh.endMinutes * 60000

    const busyInDay = busyBlocks
      .filter((b) => b.end > workStart && b.start < workEnd)
      .map((b) => ({ start: Math.max(b.start, workStart), end: Math.min(b.end, workEnd) }))
      .sort((a, b) => a.start - b.start)

    // subtract busy intervals with buffer padding
    const buffer = settings.bufferMinutes * 60000
    const slots: { start: number; end: number }[] = []
    let cursor = workStart
    for (const b of busyInDay) {
      if (b.start > cursor) {
        slots.push({ start: cursor, end: Math.min(b.start, workEnd) })
      }
      cursor = Math.max(cursor, b.end + buffer)
      if (cursor >= workEnd) break
    }
    if (cursor < workEnd) {
      slots.push({ start: cursor, end: workEnd })
    }

    // merge/compact adjacent slots (dropping ones too small to matter is done at placement)
    if (slots.length) result.push({ dayIndex: day, slots })
  }
  return result
}

/** Exclude tasks with incomplete dependencies (blocker not yet scheduled/complete). */
function orderByDependencies(tasks: TaskLike[], placements: Map<string, ScheduledPlacement>): TaskLike[] {
  const ordered: TaskLike[] = []
  const remaining = [...tasks]
  const done = new Map<string, boolean>()
  for (const t of tasks) done.set(t.id, false)

  let progressed = true
  while (remaining.length && progressed) {
    progressed = false
    for (let i = 0; i < remaining.length; i++) {
      const t = remaining[i]
      const blocker = t.blocked_by_task_id
      const blockerReady = !blocker || placements.has(blocker) || done.get(blocker) === true
      if (blockerReady) {
        ordered.push(t)
        remaining.splice(i, 1)
        done.set(t.id, true)
        progressed = true
        break
      }
    }
  }
  // leftover (blocked by something never placed) goes at the end, in stable order
  return [...ordered, ...remaining]
}

function findFirstFit(
  freeMap: ReturnType<typeof buildFreeMap>,
  earliestStart: number,
  durationMs: number,
  beforeDue: number | null,
  preferHours?: number[],
): { start: number; end: number; day: number; pastDue: boolean } | null {
  let candidates: { slot: { start: number; end: number }; day: number; start: number; end: number }[] = []

  for (const day of freeMap) {
    for (const slot of day.slots) {
      const start = Math.max(slot.start, earliestStart)
      const end = start + durationMs
      if (end <= slot.end) {
        candidates.push({ slot, day: day.dayIndex, start, end })
      }
    }
  }

  // Productivity-hour refinement: if a preferred hour fits within a slot,
  // shift the start forward to it rather than anchoring at slot start.
  if (preferHours?.length) {
    const preferred: typeof candidates = []
    for (const c of candidates) {
      for (const hour of preferHours) {
        const start = new Date(c.slot.start)
        start.setHours(hour, 0, 0, 0)
        const s = Math.max(start.getTime(), c.slot.start)
        const e = s + durationMs
        if (s >= c.slot.start && e <= c.slot.end && s >= earliestStart) {
          preferred.push({ ...c, start: s, end: e })
          break
        }
      }
    }
    if (preferred.length) candidates = preferred
  }

  candidates.sort((a, b) => a.start - b.start)

  const firstWithinDue = candidates.find((c) => !beforeDue || c.end <= beforeDue)
  const first = candidates[0]

  if (firstWithinDue) {
    return { start: firstWithinDue.start, end: firstWithinDue.end, day: firstWithinDue.day, pastDue: false }
  }
  if (first) {
    // Only available slot is past the due date — place it anyway and let the
    // caller flag it at_risk.
    return { start: first.start, end: first.end, day: first.day, pastDue: true }
  }
  return null
}

export function scheduleTasks(input: ScheduleInput): ScheduleResult {
  const { tasks, settings, now, productivity } = input

  const horizonEnd = now + settings.horizonDays * DAY_MS
  const eligible = tasks
    .filter((t) => t.status === "todo" && !t.is_pinned)
    .map((t) => ({ ...t, estimated_minutes: t.estimated_minutes ?? 30 }))

  // Sort queue per doc §14.3 step 2.
  eligible.sort((a, b) => {
    const aDue = a.due_date ? new Date(a.due_date).getTime() : null
    const bDue = b.due_date ? new Date(b.due_date).getTime() : null
    const aDueSoon = aDue !== null && aDue <= horizonEnd
    const bDueSoon = bDue !== null && bDue <= horizonEnd
    if (aDueSoon !== bDueSoon) return aDueSoon ? -1 : 1
    if (aDueSoon && bDueSoon) {
      if (aDue !== bDue) return (aDue ?? 0) - (bDue ?? 0)
    }
    const prio = { high: 0, medium: 1, low: 2 }
    if (prio[a.priority] !== prio[b.priority]) return prio[a.priority] - prio[b.priority]
    // no due date → oldest first
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  let freeMap = buildFreeMap(input)
  const placements = new Map<string, ScheduledPlacement>()
  const scheduled: ScheduledPlacement[] = []
  const atRisk: string[] = []
  const skippedNoTime: string[] = []
  const dailyMinutes = new Map<number, number>()

  const ordered = orderByDependencies(eligible, placements)

  // top productivity hours for effort-aware placement (optional refinement)
  const topHours = productivity
    .filter((p) => p.completionRate != null && p.completionRate >= 0.6)
    .sort((a, b) => (b.completionRate ?? 0) - (a.completionRate ?? 0))
    .slice(0, 4)
    .map((p) => p.hourOfDay)

  for (const task of ordered) {
    const durationMs = Math.max(MIN_DURATION_MS, task.estimated_minutes! * 60000)
    const blocker = task.blocked_by_task_id ? placements.get(task.blocked_by_task_id) : null
    const earliestStart = Math.max(now, blocker ? blocker.end + settings.bufferMinutes * 60000 : now)

    const due = task.due_date ? new Date(task.due_date).getTime() : null
    const beforeDue = due && due <= horizonEnd ? due : null

    let candidate = findFirstFit(
      freeMap,
      earliestStart,
      durationMs,
      beforeDue,
      task.effort === "high" && topHours.length ? topHours : undefined,
    )

    if (!candidate) {
      atRisk.push(task.id)
      continue
    }

    // daily cap
    const dayTotal = dailyMinutes.get(candidate.day) ?? 0
    if (dayTotal + durationMs / 60000 > settings.maxDailyTaskMinutes) {
      const nextDayStart = dayStartOf(now + (candidate.day + 1) * DAY_MS).getTime()
      candidate = findFirstFit(freeMap, Math.max(earliestStart, nextDayStart), durationMs, beforeDue)
      if (!candidate) {
        atRisk.push(task.id)
        continue
      }
    }

    if (candidate.pastDue && beforeDue) {
      atRisk.push(task.id)
    }

    const placement: ScheduledPlacement = {
      taskId: task.id,
      start: candidate.start,
      end: candidate.end,
      day: new Date(candidate.start).toISOString().slice(0, 10),
    }
    placements.set(task.id, placement)
    scheduled.push(placement)
    dailyMinutes.set(candidate.day, (dailyMinutes.get(candidate.day) ?? 0) + durationMs / 60000)

    // subtract from free map, enforcing the inter-task buffer
    const bufferMs = settings.bufferMinutes * 60000
    freeMap = freeMap.map((day) => {
      if (day.dayIndex !== candidate!.day) return day
      const newSlots: { start: number; end: number }[] = []
      for (const slot of day.slots) {
        if (candidate!.start >= slot.end || candidate!.end <= slot.start) {
          newSlots.push(slot)
        } else {
          if (candidate!.start > slot.start) newSlots.push({ start: slot.start, end: candidate!.start })
          const after = candidate!.end + bufferMs
          if (after < slot.end) newSlots.push({ start: after, end: slot.end })
        }
      }
      return { dayIndex: day.dayIndex, slots: newSlots }
    })
  }

  return { scheduled, atRisk, skippedNoTime, placedCount: scheduled.length }
}
