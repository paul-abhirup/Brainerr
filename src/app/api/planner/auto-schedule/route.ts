import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { scheduleTasks, type ScheduleInput } from "@/lib/scheduler/algorithm"

type WorkingHoursJson = Record<string, string[] | null> // key: 'mon'..'sun'

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

async function buildInput(userId: string, admin: ReturnType<typeof getAdminClient>): Promise<ScheduleInput> {
  const [
    { data: settings },
    { data: tasks },
    { data: busyRows },
    { data: productivity },
    { data: calibration },
  ] = await Promise.all([
    admin.from("user_settings").select("*").eq("user_id", userId).single(),
    admin.from("tasks").select("*").eq("user_id", userId),
    admin.from("calendar_busy").select("*").eq("user_id", userId),
    admin.from("productivity_patterns").select("*").eq("user_id", userId),
    admin.from("estimate_calibration").select("*").eq("user_id", userId),
  ])

  const calibrationByProject = new Map<string, number>()
  for (const row of calibration ?? []) {
    if (row.project_id && row.multiplier) calibrationByProject.set(row.project_id, row.multiplier)
  }

  const wh = (settings?.working_hours ?? {}) as WorkingHoursJson
  const workingHoursByWeekday: Record<number, { startMinutes: number; endMinutes: number } | null> = {}
  for (const [key, idx] of Object.entries(WEEKDAY_INDEX)) {
    const range = wh[key]
    if (Array.isArray(range) && range.length === 2) {
      const [h1, m1] = range[0].split(":").map(Number)
      const [h2, m2] = range[1].split(":").map(Number)
      workingHoursByWeekday[idx] = { startMinutes: h1 * 60 + m1, endMinutes: h2 * 60 + m2 }
    } else {
      workingHoursByWeekday[idx] = null
    }
  }

  const busyBlocks = (busyRows ?? []).map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }))

  // pinned/scheduled tasks act as fixed busy blocks too
  for (const t of tasks ?? []) {
    if (t.scheduled_start && t.scheduled_end) {
      busyBlocks.push({ start: new Date(t.scheduled_start).getTime(), end: new Date(t.scheduled_end).getTime() })
    }
  }

  return {
    tasks: (tasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      priority: t.priority,
      effort: t.effort,
      estimated_minutes: t.estimated_minutes
        ? Math.round(t.estimated_minutes * (calibrationByProject.get(t.project_id ?? "") ?? 1))
        : t.estimated_minutes,
      blocked_by_task_id: t.blocked_by_task_id,
      status: t.status,
      is_pinned: t.is_pinned,
      at_risk: t.at_risk,
      created_at: t.created_at,
      scheduled_end: t.scheduled_end,
    })),
    busyBlocks,
    settings: {
      bufferMinutes: settings?.buffer_minutes ?? 10,
      maxDailyTaskMinutes: settings?.max_daily_task_minutes ?? 240,
      horizonDays: settings?.scheduling_horizon_days ?? 7,
      workingHoursByWeekday,
    },
    now: Date.now(),
    productivity: (productivity ?? [])
      .filter((p): p is { user_id: string; hour_of_day: number; completion_rate: number } => p.completion_rate !== null)
      .map((p) => ({ hourOfDay: p.hour_of_day, completionRate: p.completion_rate })),
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getAdminClient()
  const input = await buildInput(user.id, admin)
  const result = scheduleTasks(input)

  // Diff vs. current schedule for the "re-optimize" review
  const { data: current } = await admin.from("tasks").select("id,scheduled_start,scheduled_end").eq("user_id", user.id)
  const currentMap = new Map((current ?? []).map((t) => [t.id, t.scheduled_start ?? null]))

  const moves = result.scheduled
    .map((p) => ({
      taskId: p.taskId,
      from: currentMap.get(p.taskId) ?? null,
      to: new Date(p.start).toISOString(),
      willMove: currentMap.get(p.taskId) !== new Date(p.start).toISOString(),
    }))
    .filter((m) => m.willMove)

  return NextResponse.json({ result, moves, movesCount: moves.length })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getAdminClient()
  const input = await buildInput(user.id, admin)
  const result = scheduleTasks(input)

  for (const p of result.scheduled) {
    await admin.from("tasks").update({
      scheduled_start: new Date(p.start).toISOString(),
      scheduled_end: new Date(p.end).toISOString(),
      at_risk: false,
    }).eq("id", p.taskId).eq("user_id", user.id)
  }
  for (const id of result.atRisk) {
    await admin.from("tasks").update({ at_risk: true }).eq("id", id).eq("user_id", user.id)
  }

  return NextResponse.json({
    ok: true,
    scheduled: result.scheduled.length,
    atRisk: result.atRisk.length,
  })
}
