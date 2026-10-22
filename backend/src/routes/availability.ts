import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { PrismaClient } from '@prisma/client';
import { isValidIana } from '../domain/time';
import { getAvailableSlots } from '../domain/availability';

export function availabilityRouter(prisma: PrismaClient): Router {
  const router = Router();

  const querySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    timezone: z.string().min(1),
  });

  router.get('/', async (req: Request, res: Response) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_PARAMS', details: parsed.error.flatten() });
      return;
    }

    const { date, timezone } = parsed.data;

    if (!isValidIana(timezone)) {
      res.status(400).json({ error: 'INVALID_TIMEZONE', message: `Unknown timezone: ${timezone}` });
      return;
    }

    const requestedDate = DateTime.fromISO(date, { zone: timezone });
    if (!requestedDate.isValid) {
      res.status(400).json({ error: 'INVALID_DATE', message: 'Could not parse the requested date.' });
      return;
    }

    const horizonDays = parseInt(process.env.BOOKING_HORIZON_DAYS ?? '14');
    const now = DateTime.now().setZone(timezone).startOf('day');
    const maxDate = now.plus({ days: horizonDays });

    if (requestedDate < now) {
      res.status(400).json({ error: 'DATE_IN_PAST', message: 'Cannot book slots in the past.' });
      return;
    }
    if (requestedDate > maxDate) {
      res.status(400).json({
        error: 'DATE_TOO_FAR',
        message: `Bookings are available up to ${horizonDays} days in advance.`,
      });
      return;
    }

    try {
      const slots = await getAvailableSlots(prisma, date, timezone);
      res.json({ date, timezone, slots });
    } catch (err) {
      console.error('availability error', err);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch availability.' });
    }
  });

  return router;
}
