import { describe, it, expect } from "vitest"
import { formatDtstart, nextOccurrence, shouldSkipOccurrence } from "./logic"

describe("recurring-generator edge function checks", () => {
  it("formatDtstart formats UTC date to standard ISO-basic DTSTART string", () => {
    const d = new Date(Date.UTC(2026, 7, 3, 14, 30, 0)) // Aug 3, 2026 14:30:00 UTC
    const formatted = formatDtstart(d)
    expect(formatted).toBe("20260803T143000Z")
  })

  it("nextOccurrence advances daily recurrence rule after completion date", () => {
    const after = new Date("2026-08-03T10:00:00Z")
    const rruleStr = "FREQ=DAILY"
    const next = nextOccurrence(rruleStr, after)

    expect(next).not.toBeNull()
    expect(next?.toISOString()).toBe("2026-08-04T10:00:00.000Z")
  })

  it("nextOccurrence handles weekly rules without pre-set DTSTART by inserting anchor", () => {
    const after = new Date("2026-08-03T10:00:00Z") // Monday
    const rruleStr = "FREQ=WEEKLY;INTERVAL=1"
    const next = nextOccurrence(rruleStr, after)

    expect(next).not.toBeNull()
    expect(next?.toISOString()).toBe("2026-08-10T10:00:00.000Z")
  })

  it("nextOccurrence uses inc=false to never materialize an occurrence at or before completion time", () => {
    const after = new Date("2026-08-03T10:00:00Z")
    const rruleStr = "FREQ=DAILY"
    const next = nextOccurrence(rruleStr, after)

    expect(next?.getTime()).toBeGreaterThan(after.getTime())
  })

  it("shouldSkipOccurrence prevents duplication when child task already materialized", () => {
    expect(shouldSkipOccurrence(0)).toBe(false)
    expect(shouldSkipOccurrence(1)).toBe(true)
    expect(shouldSkipOccurrence(2)).toBe(true)
  })

  it("returns null for invalid RRULE string", () => {
    const after = new Date("2026-08-03T10:00:00Z")
    const invalidRrule = "INVALID_RRULE_FORMAT"
    const next = nextOccurrence(invalidRrule, after)
    expect(next).toBeNull()
  })
})
