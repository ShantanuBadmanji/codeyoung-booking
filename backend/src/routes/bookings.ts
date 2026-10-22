import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { PrismaClient } from '@prisma/client';
import { isValidIana, toZone, toIst, formatDisplay, formatDateDisplay } from '../domain/time';
import { createBooking } from '../domain/booking';

export function bookingsRouter(prisma: PrismaClient): Router {
  const router = Router();

  const createSchema = z.object({
    slotStartUtc: z.string().min(1),
    parentName: z.string().min(1).max(100),
    parentEmail: z.string().email(),
    parentTimezone: z.string().min(1),
  });

  router.post('/', async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_PARAMS', details: parsed.error.flatten() });
      return;
    }

    const { slotStartUtc, parentName, parentEmail, parentTimezone } = parsed.data;

    if (!isValidIana(parentTimezone)) {
      res.status(400).json({ error: 'INVALID_TIMEZONE', message: `Unknown timezone: ${parentTimezone}` });
      return;
    }

    const slotStart = DateTime.fromISO(slotStartUtc, { zone: 'UTC' });
    if (!slotStart.isValid) {
      res.status(400).json({ error: 'INVALID_SLOT', message: 'slotStartUtc must be a valid ISO 8601 UTC instant.' });
      return;
    }

    // Must be on a 30-minute boundary
    if (slotStart.minute % 30 !== 0 || slotStart.second !== 0 || slotStart.millisecond !== 0) {
      res.status(400).json({ error: 'INVALID_SLOT', message: 'Slot must start on a 30-minute boundary.' });
      return;
    }

    const horizonDays = parseInt(process.env.BOOKING_HORIZON_DAYS ?? '14');
    const now = DateTime.now();
    if (slotStart < now) {
      res.status(400).json({ error: 'SLOT_IN_PAST', message: 'Cannot book a slot in the past.' });
      return;
    }
    if (slotStart > now.plus({ days: horizonDays })) {
      res.status(400).json({ error: 'SLOT_TOO_FAR', message: 'Slot is outside the booking horizon.' });
      return;
    }

    try {
      const result = await createBooking(prisma, slotStart, parentName, parentEmail, parentTimezone);

      if ('error' in result) {
        res.status(409).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (err) {
      console.error('booking error', err);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create booking.' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { mentor: true },
    });

    if (!booking) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Booking not found.' });
      return;
    }

    const slotStartUtc = DateTime.fromJSDate(booking.startTime);
    const slotEndUtc = DateTime.fromJSDate(booking.endTime);
    const parentStart = toZone(slotStartUtc, booking.parentTimezone);
    const parentEnd = toZone(slotEndUtc, booking.parentTimezone);
    const mentorStart = toIst(slotStartUtc);
    const mentorEnd = toIst(slotEndUtc);

    res.json({
      bookingId: booking.id,
      classLink: booking.classLink,
      mentor: { id: booking.mentor.id, name: booking.mentor.name },
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
    });
  });

  return router;
}
