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

import { createClient } from "npm:@supabase/supabase-js@2"
import { nextOccurrence, shouldSkipOccurrence } from "./logic.ts"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
)

Deno.serve(async () => {
  const { data: templates, error } = await supabase
    .from("tasks")
    .select("*")
    .not("recurring_rule", "is", null)
    .eq("status", "done")

  if (error) return new Response(error.message, { status: 500 })

  let created = 0
  for (const tpl of templates ?? []) {
    // Already materialized an occurrence? Skip (prevents dupes when both a
    // recurring task and its completed child are picked up in the same run).
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("parent_task_id", tpl.id)
      .limit(1)
    if (shouldSkipOccurrence(existing?.length ?? 0)) continue

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

