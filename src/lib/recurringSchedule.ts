export const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const
export type Frequency = (typeof FREQUENCIES)[number]

const DAY_MS = 24 * 60 * 60 * 1000

/** Real calendar-aware "add one period" — monthly uses actual month lengths (via Date's own
 *  rollover), not a fixed 30-day approximation, so a rule created on the 31st doesn't silently
 *  drift earlier every month it lands on a shorter one. */
export function nextDueDate(from: Date, frequency: Frequency): Date {
  const next = new Date(from)
  if (frequency === 'daily') {
    next.setTime(next.getTime() + DAY_MS)
  } else if (frequency === 'weekly') {
    next.setTime(next.getTime() + 7 * DAY_MS)
  } else {
    next.setMonth(next.getMonth() + 1)
  }
  return next
}

export function isDue(dueAt: Date | null): boolean {
  return dueAt !== null && dueAt.getTime() <= Date.now()
}

/** How overdue a rule is, in whole days — used for the "3 days overdue" style copy rather than a
 *  vague "due" badge with no sense of how stale it's gotten. */
export function daysOverdue(dueAt: Date | null): number {
  if (!dueAt) return 0
  return Math.max(0, Math.floor((Date.now() - dueAt.getTime()) / DAY_MS))
}
