import { describe, expect, it } from "vitest"
import { parseQuickAdd } from "./parseQuickAdd"

describe("parseQuickAdd", () => {
  it("strips a time and returns an ISO due date", () => {
    const r = parseQuickAdd("Finish slides tomorrow 5pm")
    expect(r.title).toBe("Finish slides")
    expect(r.dueDate).toBeTruthy()
    expect(new Date(r.dueDate!).getHours()).toBe(17)
  })

  it("keeps a plain title with no date", () => {
    const r = parseQuickAdd("Buy groceries")
    expect(r.title).toBe("Buy groceries")
    expect(r.dueDate).toBeNull()
  })

  it("treats 'note:' prefix as a note", () => {
    const r = parseQuickAdd("note: buy milk idea")
    expect(r.isReminder).toBe(true)
    expect(r.title).toBe("buy milk idea")
  })

  it("treats 'todo' prefix as a task", () => {
    const r = parseQuickAdd("todo: call dentist")
    expect(r.isReminder).toBe(false)
    expect(r.title).toBe("call dentist")
  })

  it("handles am/pm times", () => {
    const r = parseQuickAdd("Submit report tomorrow 9:30 am")
    expect(r.dueDate).toBeTruthy()
    const d = new Date(r.dueDate!)
    expect(d.getHours()).toBe(9)
    expect(d.getMinutes()).toBe(30)
  })

  it("collapses leftover whitespace after date removal", () => {
    const r = parseQuickAdd("Gym  tomorrow  6pm")
    expect(r.title).toBe("Gym")
  })
})
