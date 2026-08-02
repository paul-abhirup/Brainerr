import * as chrono from "chrono-node"

export interface ParsedQuickAdd {
  title: string
  dueDate: string | null
  isReminder?: boolean
}

// Longest prefixes first so "note:" matches before "note", "todo:" before "todo".
const TASK_PREFIXES = ["todo:", "task:", "todo", "task", "do "]
const NOTE_PREFIXES = ["remember", "note:", "note", "idea"]

/**
 * Parse a freeform quick-add string, extracting a natural-language date/time
 * ("finish slides tomorrow 5pm") from the title. Returns the cleaned title
 * plus an ISO due date when one is present.
 */
export function parseQuickAdd(input: string): ParsedQuickAdd {
  const trimmed = input.trim()

  let isNote = false
  let title = trimmed
  for (const p of NOTE_PREFIXES) {
    if (trimmed.toLowerCase().startsWith(p)) {
      isNote = true
      title = trimmed.slice(p.length).trim()
      break
    }
  }
  if (!isNote) {
    for (const p of TASK_PREFIXES) {
      if (trimmed.toLowerCase().startsWith(p)) {
        title = trimmed.slice(p.length).trim()
        break
      }
    }
  }

  const parsed = chrono.parse(title, new Date(), { forwardDate: true })
  let dueDate: string | null = null
  let cleanTitle = title

  if (parsed.length > 0) {
    const first = parsed[0]
    const text = first.text
    const hasTime = /\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)/i.test(text)

    if (hasTime) {
      const date = first.start.date()
      if (date.getFullYear() >= 2000) {
        dueDate = date.toISOString()
        cleanTitle = title.slice(0, first.index).concat(title.slice(first.index + text.length)).trim()
        // collapse leftover whitespace from the removal
        cleanTitle = cleanTitle.replace(/\s{2,}/g, " ").trim()
      }
    }
  }

  return {
    title: cleanTitle || trimmed,
    dueDate,
    isReminder: isNote,
  }
}
