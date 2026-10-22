import { DateTime } from 'luxon';
import { PrismaClient, Prisma } from '@prisma/client';
import { IST, CLASS_DURATION_MINUTES, istDateOf, toIst, toZone, formatDisplay, formatDateDisplay } from './time';
import { generateCandidateSlots, intervalsOverlap } from './slots';
import { findNextAvailableSlots, AvailableSlot } from './availability';

export interface BookingResult {
  bookingId: string;
  classLink: string;
  mentor: { id: number; name: string };
  parentTime: { start: string; end: string; date: string };
  mentorTime: { start: string; end: string; date: string };
}

export interface BookingError {
  error: 'SLOT_UNAVAILABLE' | 'NO_MENTORS_AVAILABLE' | 'INVALID_SLOT';
  message: string;
  alternatives: AvailableSlot[];
}

/**
 * Create a booking inside a Prisma transaction.
 *
 * Steps (all within the transaction):
 * 1. Validate slotStartUtc is a real 30-min boundary on a working schedule.
 * 2. Find eligible mentors: working that slot + < 2 IST-day bookings + no overlap.
 * 3. Assign mentor with fewest IST-day bookings, tie-break by mentor ID ascending.
 * 4. Insert booking. On UNIQUE constraint violation, retry with next eligible mentor.
 * 5. If none succeed, return 409 with alternatives.
 */
export async function createBooking(
  prisma: PrismaClient,
  slotStartUtc: DateTime,
  parentName: string,
  parentEmail: string,
  parentTimezone: string,
): Promise<BookingResult | BookingError> {
  const slotEndUtc = slotStartUtc.plus({ minutes: CLASS_DURATION_MINUTES });
  const slotIstDate = istDateOf(slotStartUtc);
  const slotIstDateDt = DateTime.fromISO(slotIstDate, { zone: IST });

  // Load all mentors with schedules
  const mentors = await prisma.mentor.findMany({ include: { schedules: true } });

  // For each mentor, determine eligibility
  type EligibleMentor = { mentorId: number; mentorName: string; dailyCount: number };
  const eligible: EligibleMentor[] = [];

  for (const mentor of mentors) {
    // A slot might come from the same IST day's schedule OR from the previous IST day's
    // cross-midnight schedule (e.g. 00:00 IST Saturday is on Friday's 23:00–01:00 IST shift).
    // We check both the current and previous IST days.
    const prevIstDateDt = slotIstDateDt.minus({ days: 1 });
    const istDatesToCheck = [slotIstDateDt, prevIstDateDt];

    let slotInSchedule = false;
    for (const checkDate of istDatesToCheck) {
      const weekday = checkDate.weekday;
      const schedulesForDay = mentor.schedules.filter((s) => s.dayOfWeek === weekday);
      for (const schedule of schedulesForDay) {
        const candidates = generateCandidateSlots(schedule.startTime, schedule.endTime, checkDate);
        if (candidates.some((c) => c.startUtc.toISO() === slotStartUtc.toISO())) {
          slotInSchedule = true;
          break;
        }
      }
      if (slotInSchedule) break;
    }
    if (!slotInSchedule) continue;

    // Load existing confirmed bookings for this mentor around this slot
    const bookings = await prisma.booking.findMany({
      where: {
        mentorId: mentor.id,
        status: 'CONFIRMED',
        startTime: {
          gte: slotIstDateDt.toUTC().toJSDate(),
          lte: slotIstDateDt.plus({ days: 2 }).toUTC().toJSDate(),
        },
      },
    });

    // Daily capacity check (IST calendar date anchor)
    const dailyCount = bookings.filter(
      (b) => istDateOf(DateTime.fromJSDate(b.startTime)) === slotIstDate,
    ).length;
    if (dailyCount >= 2) continue;

    // Overlap check
    const hasOverlap = bookings.some((b) =>
      intervalsOverlap(
        slotStartUtc,
        slotEndUtc,
        DateTime.fromJSDate(b.startTime),
        DateTime.fromJSDate(b.endTime),
      ),
    );
    if (hasOverlap) continue;

    eligible.push({ mentorId: mentor.id, mentorName: mentor.name, dailyCount });
  }

  if (eligible.length === 0) {
    const alternatives = await findNextAvailableSlots(prisma, slotStartUtc, parentTimezone, 5);
    return {
      error: 'NO_MENTORS_AVAILABLE',
      message: 'No mentor is available for this slot.',
      alternatives,
    };
  }

  // Sort: fewest daily bookings first, then by mentor ID ascending (stable tie-break)
  eligible.sort((a, b) => a.dailyCount - b.dailyCount || a.mentorId - b.mentorId);

  // Try to create the booking; retry with next mentor on UNIQUE violation
  for (const { mentorId, mentorName } of eligible) {
    try {
      const booking = await prisma.$transaction(async (tx) => {
        // Re-check inside the transaction for concurrency safety
        const existing = await tx.booking.findFirst({
          where: {
            mentorId,
            status: 'CONFIRMED',
            startTime: slotStartUtc.toJSDate(),
          },
        });
        if (existing) throw new UniqueViolationError();

        // Also re-check daily count inside tx
        const txDailyBookings = await tx.booking.findMany({
          where: {
            mentorId,
            status: 'CONFIRMED',
            startTime: {
              gte: slotIstDateDt.toUTC().toJSDate(),
              lte: slotIstDateDt.plus({ days: 2 }).toUTC().toJSDate(),
            },
          },
        });
        const txDailyCount = txDailyBookings.filter(
          (b) => istDateOf(DateTime.fromJSDate(b.startTime)) === slotIstDate,
        ).length;
        if (txDailyCount >= 2) throw new UniqueViolationError();

        return tx.booking.create({
          data: {
            mentorId,
            parentName,
            parentEmail,
            parentTimezone,
            startTime: slotStartUtc.toJSDate(),
            endTime: slotEndUtc.toJSDate(),
            classLink: '', // filled after ID is known
            status: 'CONFIRMED',
          },
        });
      });

      // Update with the class link derived from the generated ID
      const classLink = `https://class.codeyoung.com/session/${booking.id}`;
      await prisma.booking.update({ where: { id: booking.id }, data: { classLink } });

      const parentStart = toZone(slotStartUtc, parentTimezone);
      const parentEnd = toZone(slotEndUtc, parentTimezone);
      const mentorStart = toIst(slotStartUtc);
      const mentorEnd = toIst(slotEndUtc);

      return {
        bookingId: booking.id,
        classLink,
        mentor: { id: mentorId, name: mentorName },
        parentTime: {
          start: formatDisplay(parentStart),
          end: formatDisplay(parentEnd),
          date: formatDateDisplay(parentStart),
        },
        mentorTime: {
          start: formatDisplay(mentorStart),
          end: formatDisplay(mentorEnd),
          date: formatDateDisplay(mentorStart),
        },
      };
    } catch (err) {
      if (err instanceof UniqueViolationError) continue;
      if (isPrismaUniqueError(err)) continue;
      throw err;
    }
  }

  // All eligible mentors were taken by concurrent requests
  const alternatives = await findNextAvailableSlots(prisma, slotStartUtc, parentTimezone, 5);
  return {
    error: 'SLOT_UNAVAILABLE',
    message: 'This slot is no longer available. Please choose another time.',
    alternatives,
  };
}

class UniqueViolationError extends Error {}

function isPrismaUniqueError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
