import { DateTime } from 'luxon';
import { PrismaClient } from '@prisma/client';
import { IST, CLASS_DURATION_MINUTES, istDateOf, toZone, formatDisplay, formatDateDisplay } from './time';
import { generateCandidateSlots, intervalsOverlap } from './slots';

export interface AvailableSlot {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  startDisplay: string;
  endDisplay: string;
  availableMentorCount: number;
}

/**
 * Return all available slots for a given parent-local date.
 *
 * Algorithm:
 * 1. Determine the UTC range that encompasses the parent's local date.
 * 2. For each IST calendar date that overlaps that UTC range, check each mentor's schedule.
 * 3. Generate candidate slots and filter out:
 *    a) Slots where the mentor already has 2 CONFIRMED bookings on that IST calendar date.
 *    b) Slots that overlap any existing CONFIRMED booking for that mentor.
 * 4. Collect unique slot start times, counting available mentors per slot.
 */
export async function getAvailableSlots(
  prisma: PrismaClient,
  dateStr: string,      // "YYYY-MM-DD" in the parent's timezone
  parentTimezone: string,
): Promise<AvailableSlot[]> {
  // Determine UTC range for the parent's local date
  const localDayStart = DateTime.fromISO(dateStr, { zone: parentTimezone }).startOf('day');
  const localDayEnd = localDayStart.endOf('day');
  const utcStart = localDayStart.toUTC();
  const utcEnd = localDayEnd.toUTC();

  // Determine which IST calendar dates could have slots overlapping this UTC range
  const istDates = new Set<string>();
  istDates.add(istDateOf(utcStart));
  istDates.add(istDateOf(utcEnd));
  // For cross-midnight shifts: also the previous IST day (a slot starting IST-yesterday may fall in today UTC)
  istDates.add(istDateOf(utcStart.minus({ hours: 6 })));

  // Load all mentors with their schedules
  const mentors = await prisma.mentor.findMany({ include: { schedules: true } });

  // Gather all candidate slots that fall within the parent's local date window
  // key: startUtc ISO string → set of mentor IDs available
  const slotMentors = new Map<string, Set<number>>();

  for (const mentor of mentors) {
    // Load this mentor's bookings for the relevant period (a bit wider than needed for safety)
    const bookings = await prisma.booking.findMany({
      where: {
        mentorId: mentor.id,
        status: 'CONFIRMED',
        startTime: {
          gte: utcStart.minus({ days: 1 }).toJSDate(),
          lte: utcEnd.plus({ days: 1 }).toJSDate(),
        },
      },
    });

    for (const istDateStr of istDates) {
      const istDate = DateTime.fromISO(istDateStr, { zone: IST });
      const weekday = istDate.weekday; // 1=Mon…7=Sun

      const schedules = mentor.schedules.filter((s) => s.dayOfWeek === weekday);

      for (const schedule of schedules) {
        const candidates = generateCandidateSlots(schedule.startTime, schedule.endTime, istDate);

        for (const slot of candidates) {
          // Must fall within the parent's local date
          const slotLocalStart = toZone(slot.startUtc, parentTimezone);
          const slotLocalDateStr = slotLocalStart.toISODate();
          if (slotLocalDateStr !== dateStr) continue;

          // Capacity check: use the slot's own IST date (not the schedule's IST date).
          // Cross-midnight slots (e.g. 00:00 IST Nov 15 on a Nov 14 schedule) count against Nov 15.
          const slotIstDateStr = istDateOf(slot.startUtc);
          const slotDailyCount = bookings.filter(
            (b) => istDateOf(DateTime.fromJSDate(b.startTime)) === slotIstDateStr,
          ).length;
          if (slotDailyCount >= 2) continue;

          // Overlap check against existing bookings
          const overlaps = bookings.some((b) =>
            intervalsOverlap(
              slot.startUtc,
              slot.endUtc,
              DateTime.fromJSDate(b.startTime),
              DateTime.fromJSDate(b.endTime),
            ),
          );
          if (overlaps) continue;

          const key = slot.startUtc.toISO()!;
          if (!slotMentors.has(key)) slotMentors.set(key, new Set());
          slotMentors.get(key)!.add(mentor.id);
        }
      }
    }
  }

  // Build result sorted chronologically
  const result: AvailableSlot[] = [];
  for (const [startIso, mentorIds] of slotMentors.entries()) {
    const startUtc = DateTime.fromISO(startIso, { zone: 'UTC' });
    const endUtc = startUtc.plus({ minutes: CLASS_DURATION_MINUTES });
    const startLocal = toZone(startUtc, parentTimezone);
    const endLocal = toZone(endUtc, parentTimezone);

    result.push({
      startUtc: startIso,
      endUtc: endUtc.toISO()!,
      startLocal: startLocal.toISO()!,
      endLocal: endLocal.toISO()!,
      startDisplay: formatDisplay(startLocal),
      endDisplay: formatDisplay(endLocal),
      availableMentorCount: mentorIds.size,
    });
  }

  result.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return result;
}

/**
 * Find the next N available slots after a given UTC instant, across all mentors.
 * Used to populate alternatives when a booking fails.
 */
export async function findNextAvailableSlots(
  prisma: PrismaClient,
  afterUtc: DateTime,
  parentTimezone: string,
  count: number,
): Promise<AvailableSlot[]> {
  const horizonDays = parseInt(process.env.BOOKING_HORIZON_DAYS ?? '14');
  const collected: AvailableSlot[] = [];
  let checkDate = afterUtc.setZone(parentTimezone);

  // Search forward day by day until we have enough alternatives or exhaust the horizon
  const maxDate = DateTime.now().setZone(parentTimezone).plus({ days: horizonDays });

  while (collected.length < count && checkDate <= maxDate) {
    const dateStr = checkDate.toISODate()!;
    const slots = await getAvailableSlots(prisma, dateStr, parentTimezone);

    for (const slot of slots) {
      if (DateTime.fromISO(slot.startUtc) > afterUtc) {
        collected.push(slot);
        if (collected.length >= count) break;
      }
    }

    checkDate = checkDate.plus({ days: 1 });
  }

  return collected;
}
