import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app';

const prisma = new PrismaClient();

// Enable WAL mode for better concurrent read performance with SQLite
prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL').catch(console.error);

const PORT = parseInt(process.env.PORT ?? '3001');
const app = createApp(prisma);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
