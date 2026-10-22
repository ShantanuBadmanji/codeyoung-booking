import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { availabilityRouter } from './routes/availability';
import { bookingsRouter } from './routes/bookings';
import { mentorsRouter } from './routes/mentors';

export function createApp(prisma: PrismaClient) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/availability', availabilityRouter(prisma));
  app.use('/api/bookings', bookingsRouter(prisma));
  app.use('/api/mentors', mentorsRouter(prisma));

  return app;
}
