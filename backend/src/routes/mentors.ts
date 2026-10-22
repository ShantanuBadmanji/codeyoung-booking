import { Router, Request, Response } from 'express';
import { DateTime } from 'luxon';
import { PrismaClient } from '@prisma/client';
import { toIst, formatDisplay, formatDateDisplay } from '../domain/time';

export function mentorsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const mentors = await prisma.mentor.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });
    res.json({ mentors });
  });

  router.get('/:id/bookings', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Mentor ID must be an integer.' });
      return;
    }

    const mentor = await prisma.mentor.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!mentor) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Mentor not found.' });
      return;
    }

    const now = DateTime.now().toJSDate();
    const bookings = await prisma.booking.findMany({
      where: { mentorId: id, startTime: { gte: now }, status: 'CONFIRMED' },
      orderBy: { startTime: 'asc' },
    });

    const slots = bookings.map((b) => {
      const startIst = toIst(DateTime.fromJSDate(b.startTime));
      const endIst = toIst(DateTime.fromJSDate(b.endTime));
      return {
        bookingId: b.id,
        classLink: b.classLink,
        parentName: b.parentName,
        startDisplay: formatDisplay(startIst),
        endDisplay: formatDisplay(endIst),
        date: formatDateDisplay(startIst),
        startUtc: b.startTime.toISOString(),
      };
    });

    res.json({ mentor, slots });
  });

  return router;
}
