import { describe, expect, it } from "vitest"
import { scheduleTasks, type ScheduleInput } from "./algorithm"

// Build times in local time so tests pass in any timezone.
const monday = new Date(2026, 0, 5) // local midnight, Monday Jan 5 2026
const NOW = monday.getTime()
const H = 3600e3
const MIN = 60e3

function baseInput(overrides: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    tasks: [],
    busyBlocks: [],
    settings: {
      bufferMinutes: 10,
      maxDailyTaskMinutes: 240,
      horizonDays: 7,
      workingHoursByWeekday: {
        0: null,
        1: { startMinutes: 9 * 60, endMinutes: 18 * 60 },
        2: { startMinutes: 9 * 60, endMinutes: 18 * 60 },
        3: { startMinutes: 9 * 60, endMinutes: 18 * 60 },
        4: { startMinutes: 9 * 60, endMinutes: 18 * 60 },
        5: { startMinutes: 9 * 60, endMinutes: 18 * 60 },
        6: null,
      },
    },
    now: NOW,
    productivity: [],
    ...overrides,
  }
}

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    title: "Task",
    due_date: null,
    priority: "medium" as const,
    effort: "medium" as const,
    estimated_minutes: 30,
    blocked_by_task_id: null,
    status: "todo",
    is_pinned: false,
    at_risk: false,
    created_at: new Date(NOW - 864e5).toISOString(),
    ...overrides,
  }
}

function hourOf(ts: number) {
  return new Date(ts).getHours()
}

describe("scheduleTasks", () => {
  it("places a task in the first free weekday slot", () => {
    const input = baseInput({ tasks: [task({ id: "a" })] })
    const result = scheduleTasks(input)
    expect(result.placedCount).toBe(1)
    const placement = result.scheduled[0]
    expect(placement.taskId).toBe("a")
    expect(hourOf(placement.start)).toBe(9)
    expect(placement.end - placement.start).toBe(30 * MIN)
  })

  it("does not schedule pinned tasks or completed tasks", () => {
    const input = baseInput({
      tasks: [
        task({ id: "pinned", is_pinned: true }),
        task({ id: "done", status: "done" }),
      ],
    })
    const result = scheduleTasks(input)
    expect(result.placedCount).toBe(0)
  })

  it("routes around busy blocks and enforces the buffer", () => {
    const input = baseInput({
      busyBlocks: [{ start: NOW + 9 * H, end: NOW + 10 * H }],
      tasks: [task({ id: "a", estimated_minutes: 30 })],
    })
    const result = scheduleTasks(input)
    const placement = result.scheduled[0]
    // busy ends 10:00 + 10min buffer → starts 10:10
    expect(placement.start).toBe(NOW + 10 * H + 10 * MIN)
  })

  it("enforces the buffer between consecutive scheduled tasks", () => {
    const input = baseInput({
      tasks: [
        task({ id: "a", estimated_minutes: 60 }),
        task({ id: "b", estimated_minutes: 30 }),
      ],
    })
    const result = scheduleTasks(input)
    const a = result.scheduled.find((p) => p.taskId === "a")!
    const b = result.scheduled.find((p) => p.taskId === "b")!
    expect(b.start).toBe(a.end + 10 * MIN)
  })

  it("orders by due date and schedules the earlier one first", () => {
    const input = baseInput({
      tasks: [
        task({ id: "later", due_date: new Date(NOW + 3 * 864e5).toISOString(), estimated_minutes: 60 }),
        task({ id: "sooner", due_date: new Date(NOW + 1 * 864e5).toISOString(), estimated_minutes: 60 }),
      ],
    })
    const result = scheduleTasks(input)
    expect(result.scheduled[0].taskId).toBe("sooner")
  })

  it("flags at_risk when a task can only fit past its due date", () => {
    // due date already in the past — no slot fits before it
    const input = baseInput({
      tasks: [task({ id: "late", due_date: new Date(NOW - 2 * 864e5).toISOString() })],
    })
    const result = scheduleTasks(input)
    expect(result.atRisk).toContain("late")
  })

  it("never schedules a task before its blocker finishes (with buffer)", () => {
    const input = baseInput({
      tasks: [
        task({ id: "b", estimated_minutes: 120 }),
        task({ id: "a", estimated_minutes: 30, blocked_by_task_id: "b" }),
      ],
    })
    const result = scheduleTasks(input)
    const b = result.scheduled.find((p) => p.taskId === "b")!
    const a = result.scheduled.find((p) => p.taskId === "a")!
    expect(a.start).toBeGreaterThanOrEqual(b.end + 10 * MIN)
  })

  it("respects the daily max task minutes cap", () => {
    const input = baseInput({
      settings: {
        ...baseInput().settings,
        maxDailyTaskMinutes: 60,
      },
      tasks: [
        task({ id: "a", estimated_minutes: 45 }),
        task({ id: "b", estimated_minutes: 45 }),
      ],
    })
    const result = scheduleTasks(input)
    const days = new Set(result.scheduled.map((p) => new Date(p.start).getDay()))
    expect(days.size).toBeGreaterThan(1)
  })

  it("shifts high-effort tasks into high-productivity hours", () => {
    const input = baseInput({
      productivity: [{ hourOfDay: 15, completionRate: 0.9 }],
      tasks: [task({ id: "a", effort: "high", estimated_minutes: 30 })],
    })
    const result = scheduleTasks(input)
    const placement = result.scheduled[0]
    expect(hourOf(placement.start)).toBe(15)
  })

  it("keeps low-productivity placement for low-effort tasks", () => {
    const input = baseInput({
      productivity: [{ hourOfDay: 15, completionRate: 0.9 }],
      tasks: [task({ id: "a", effort: "low", estimated_minutes: 30 })],
    })
    const result = scheduleTasks(input)
    expect(hourOf(result.scheduled[0].start)).toBe(9)
  })
})
