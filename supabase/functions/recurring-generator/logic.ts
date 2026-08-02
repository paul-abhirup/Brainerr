import { RRule } from "rrule"

export function formatDtstart(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

export function nextOccurrence(rruleStr: string, after: Date): Date | null {
  let rule: RRule
  try {
    // Monthly/weekly rules without a BY* field anchor to DTSTART's day of
    // month / weekday. Ensure one is present so the rule is stable.
    if (!/dtstart/i.test(rruleStr)) {
      const anchor = new Date(after.getTime())
      rule = RRule.fromString(`DTSTART:${formatDtstart(anchor)}\n${rruleStr}`)
    } else {
      rule = RRule.fromString(rruleStr)
    }
  } catch {
    return null
  }
  // inc=false → strictly after the completion time (never re-create the done row).
  const next = rule.after(after, false)
  return next ? new Date(next.getTime()) : null
}

export function shouldSkipOccurrence(existingChildCount: number): boolean {
  // Already materialized an occurrence? Skip (prevents dupes when both a
  // recurring task and its completed child are picked up in the same run).
  return existingChildCount > 0
}
