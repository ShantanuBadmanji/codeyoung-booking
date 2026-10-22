import { DateTime } from 'luxon';
import { IST, CLASS_DURATION_MINUTES, istWallClockOnDate } from './time';

export interface Slot {
  startUtc: DateTime;
  endUtc: DateTime;
}

/**
 * Generate all 30-minute candidate slots for a schedule on a given IST calendar date.
 *
 * A schedule stores IST wall-clock times. If endTime < startTime (lexicographically),
 * the shift crosses IST midnight — endTime is on the following IST calendar day.
 *
 * Returns half-open intervals [start, end) as UTC DateTime pairs.
 */
export function generateCandidateSlots(
  startTime: string,
  endTime: string,
  istDate: DateTime,
): Slot[] {
  const shiftStart = istWallClockOnDate(startTime, istDate);
  const crossesMidnight = endTime <= startTime; // e.g. "01:00" <= "19:00"
  const endIstDate = crossesMidnight ? istDate.plus({ days: 1 }) : istDate;
  const shiftEnd = istWallClockOnDate(endTime, endIstDate);

  const slots: Slot[] = [];
  let cursor = shiftStart;

  while (cursor.plus({ minutes: CLASS_DURATION_MINUTES }) <= shiftEnd) {
    slots.push({
      startUtc: cursor.toUTC(),
      endUtc: cursor.plus({ minutes: CLASS_DURATION_MINUTES }).toUTC(),
    });
    cursor = cursor.plus({ minutes: CLASS_DURATION_MINUTES });
  }

  return slots;
}

/**
 * Two half-open intervals [a.start, a.end) and [b.start, b.end) overlap when:
 *   a.start < b.end AND b.start < a.end
 */
export function intervalsOverlap(
  aStart: DateTime,
  aEnd: DateTime,
  bStart: DateTime,
  bEnd: DateTime,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
