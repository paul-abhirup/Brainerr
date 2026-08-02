// recurring-generator — Supabase Edge Function (Deno).
//
// Nightly cron via supabase config:
//   [functions.recurring-generator]
//   schedule = "0 1 * * *"
//
// Materializes the next occurrence of completed recurring tasks (tasks with a
// recurring_rule RRULE). Creates a fresh task row (children of the source task
// via parent_task_id) with the due date advanced by the rule, so the planner
// only ever reads simple date-bound rows.

import { RRule } from "npm:rrule"
import { createClient } from "npm:@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
)

function nextOccurrence(rrule: string, after: Date): Date | null {
  let rule: RRule
  try {
    rule = RRule.fromString(rrule)
  } catch {
    return null
  }
  const next = rule.after(after, true)
  return next ? new Date(next.getTime()) : null
}

Deno.serve(async () => {
  const { data: templates, error } = await supabase
    .from("tasks")
    .select("*")
    .not("recurring_rule", "is", null)
    .eq("status", "done")

  if (error) return new Response(error.message, { status: 500 })

  let created = 0
  for (const tpl of templates ?? []) {
    // Already materialized an open occurrence? Skip (prevents dupes on re-run).
    const { data: open } = await supabase
      .from("tasks")
      .select("id")
      .eq("parent_task_id", tpl.id)
      .not("status", "eq", "done")
      .limit(1)
    if (open && open.length > 0) continue

    const after = tpl.completed_at ? new Date(tpl.completed_at) : new Date()
    const due = nextOccurrence(tpl.recurring_rule, after)
    if (!due) continue

    const { error: insertError } = await supabase.from("tasks").insert({
      user_id: tpl.user_id,
      project_id: tpl.project_id,
      parent_task_id: tpl.id,
      title: tpl.title,
      description: tpl.description,
      due_date: due.toISOString(),
      priority: tpl.priority,
      effort: tpl.effort,
      dread_level: tpl.dread_level,
      estimated_minutes: tpl.estimated_minutes,
      recurring_rule: tpl.recurring_rule,
      status: "todo",
      is_pinned: false,
      at_risk: false,
    })
    if (!insertError) created++
  }

  return new Response(JSON.stringify({ ok: true, created }), {
    headers: { "Content-Type": "application/json" },
  })
})
