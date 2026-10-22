import { DateTime, IANAZone } from 'luxon';

export const IST = 'Asia/Kolkata';
export const CLASS_DURATION_MINUTES = 30;

export function isValidIana(tz: string): boolean {
  return IANAZone.isValidZone(tz);
}

export function toIst(utc: DateTime): DateTime {
  return utc.setZone(IST);
}

/** Returns "YYYY-MM-DD" of the IST calendar date the UTC instant falls on. */
export function istDateOf(utc: DateTime): string {
  return toIst(utc).toISODate()!;
}

export function toZone(utc: DateTime, iana: string): DateTime {
  return utc.setZone(iana);
}

/** "9:00 AM EST" or "2:30 PM IST" — includes abbreviated zone name. */
export function formatDisplay(dt: DateTime): string {
  return dt.toFormat("h:mm a ZZZZ");
}

/** "Friday, Nov 15, 2024" */
export function formatDateDisplay(dt: DateTime): string {
  return dt.toFormat("EEEE, MMM d, yyyy");
}

/**
 * Convert a local wall-clock time string "HH:MM" on a given IST date to a UTC DateTime.
 * If the resulting local time is nonexistent (DST spring-forward gap), throws.
 * This function is used for parent-facing input only; mentor schedules are always in IST (no DST).
 */
export function localWallClockToUtc(timeStr: string, dateStr: string, iana: string): DateTime {
  const [hour, minute] = timeStr.split(':').map(Number);
  const local = DateTime.fromObject({ year: 0, month: 0, day: 0 }, { zone: iana })
    .set({
      year: parseInt(dateStr.slice(0, 4)),
      month: parseInt(dateStr.slice(5, 7)),
      day: parseInt(dateStr.slice(8, 10)),
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });

  if (!local.isValid) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr} in ${iana}`);
  }
  if (local.isOffsetFixed === false && local.offset !== local.toLocal().offset) {
    // Ambiguous time during fall-back: Luxon uses the DST (earlier) offset by default — this is our documented policy
  }

  return local.toUTC();
}

/**
 * Build IST DateTime from a "HH:MM" wall-clock string on a given IST date.
 * IST has no DST so this is always unambiguous.
 */
export function istWallClockOnDate(timeStr: string, istDate: DateTime): DateTime {
  const [hour, minute] = timeStr.split(':').map(Number);
  return istDate.setZone(IST).set({ hour, minute, second: 0, millisecond: 0 });
}
