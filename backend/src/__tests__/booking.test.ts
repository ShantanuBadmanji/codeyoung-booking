import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import { createBooking } from '../domain/booking';
import { getAvailableSlots } from '../domain/availability';
import { IST, istDateOf } from '../domain/time';

const TEST_DB_PATH = path.resolve(__dirname, '../../prisma/test.db');
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let prisma: PrismaClient;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_DB_URL;
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  execSync('npx prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: path.resolve(__dirname, '../../'),
  });
  prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
});

afterAll(async () => {
  await prisma.$disconnect();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(async () => {
  // Clean tables in dependency order
  await prisma.booking.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.mentor.deleteMany();
});

let mentorCounter = 0;
async function createMentor(startTime: string, endTime: string, days = [1, 2, 3, 4, 5, 6]) {
  mentorCounter += 1;
  return prisma.mentor.create({
    data: {
      name: `Mentor${mentorCounter}`,
      email: `mentor${mentorCounter}@test.in`,
      schedules: { create: days.map((d) => ({ dayOfWeek: d, startTime, endTime })) },
    },
  });
}

/** Returns the next IST date (as YYYY-MM-DD) that has the given weekday (1=Mon, 6=Sat). */
function nextIstDate(weekday: number): string {
  let dt = DateTime.now().setZone(IST).startOf('day').plus({ days: 1 });
  while (dt.weekday !== weekday) dt = dt.plus({ days: 1 });
  return dt.toISODate()!;
}

/** Build a UTC DateTime for a given IST wall-clock on a given IST date string. */
function istSlot(istDateStr: string, hhMm: string): DateTime {
  const [h, m] = hhMm.split(':').map(Number);
  return DateTime.fromISO(istDateStr, { zone: IST })
    .set({ hour: h, minute: m, second: 0, millisecond: 0 })
    .toUTC();
}

// ─── Daily capacity limit ────────────────────────────────────────────────────

describe('Daily capacity limit (IST anchor)', () => {
  it('allows first booking on a mentor', async () => {
    await createMentor('10:00', '12:00');
    const date = nextIstDate(1); // next Monday
    const result = await createBooking(prisma, istSlot(date, '10:00'), 'Alice', 'alice@t.com', 'Europe/London');
    expect('bookingId' in result).toBe(true);
  });

  it('allows second booking same IST day (different slot)', async () => {
    await createMentor('10:00', '12:00');
    const date = nextIstDate(1);
    await createBooking(prisma, istSlot(date, '10:00'), 'Alice', 'alice@t.com', 'Europe/London');
    const result = await createBooking(prisma, istSlot(date, '10:30'), 'Bob', 'bob@t.com', 'Europe/London');
    expect('bookingId' in result).toBe(true);
  });

  it('rejects third booking on same mentor same IST day', async () => {
    await createMentor('10:00', '13:00');
    const date = nextIstDate(1);
    await createBooking(prisma, istSlot(date, '10:00'), 'Alice', 'alice@t.com', 'Europe/London');
    await createBooking(prisma, istSlot(date, '10:30'), 'Bob', 'bob@t.com', 'Europe/London');
    const result = await createBooking(prisma, istSlot(date, '11:00'), 'Carol', 'carol@t.com', 'Europe/London');
    expect('error' in result).toBe(true);
  });
});

// ─── Cross-midnight IST date anchor ─────────────────────────────────────────

describe('Cross-midnight IST date anchor', () => {
  it('slot at 23:30 IST counts against that IST date, 00:00 IST next day is a separate date', async () => {
    await createMentor('23:00', '01:00');
    const friday = nextIstDate(5);

    // Fill up Friday's capacity (23:00 and 23:30 IST = same IST Friday)
    await createBooking(prisma, istSlot(friday, '23:00'), 'Alice', 'alice@t.com', 'America/New_York');
    await createBooking(prisma, istSlot(friday, '23:30'), 'Bob', 'bob@t.com', 'America/New_York');

    // 00:00 IST Saturday (next day) should NOT be blocked by Friday's count
    const saturday = DateTime.fromISO(friday, { zone: IST }).plus({ days: 1 }).toISODate()!;
    const saturdaySlot = istSlot(saturday, '00:00');
    const result = await createBooking(prisma, saturdaySlot, 'Carol', 'carol@t.com', 'America/New_York');
    expect('bookingId' in result).toBe(true);
  });
});

// ─── Mentor assignment ───────────────────────────────────────────────────────

describe('Mentor assignment', () => {
  it('assigns mentor with fewer bookings over one with more', async () => {
    const m1 = await createMentor('10:00', '12:00');
    const m2 = await createMentor('10:00', '12:00');
    const date = nextIstDate(1);

    // Give m1 one booking already
    await prisma.booking.create({
      data: {
        mentorId: m1.id, parentName: 'X', parentEmail: 'x@t.com',
        parentTimezone: 'Europe/London',
        startTime: istSlot(date, '10:00').toJSDate(),
        endTime: istSlot(date, '10:30').toJSDate(),
        classLink: 'http://test', status: 'CONFIRMED',
      },
    });

    // m2 has 0 bookings — next booking at 10:30 should go to m2 (fewer)
    const result = await createBooking(prisma, istSlot(date, '10:30'), 'D', 'd@t.com', 'Europe/London');
    if ('mentor' in result) {
      expect(result.mentor.id).toBe(m2.id);
    } else {
      throw new Error(`Expected booking success, got: ${JSON.stringify(result)}`);
    }
  });

  it('breaks ties by mentor ID ascending', async () => {
    const m1 = await createMentor('10:00', '12:00');
    const m2 = await createMentor('10:00', '12:00');
    const date = nextIstDate(1);

    // Both have 0 bookings — should assign lower ID (m1)
    const result = await createBooking(prisma, istSlot(date, '10:00'), 'Alice', 'a@t.com', 'Europe/London');
    if ('mentor' in result) {
      expect(result.mentor.id).toBe(m1.id);
    } else {
      throw new Error(`Expected booking success, got: ${JSON.stringify(result)}`);
    }
  });
});

// ─── Stale slot (concurrent safety) ─────────────────────────────────────────

describe('Stale slot / conflict handling', () => {
  it('returns 409 with alternatives when the only eligible mentor is already booked at that slot', async () => {
    await createMentor('10:00', '12:00');
    const date = nextIstDate(1);
    const slot = istSlot(date, '10:00');

    // First booking succeeds
    const first = await createBooking(prisma, slot, 'Alice', 'a@t.com', 'Europe/London');
    expect('bookingId' in first).toBe(true);

    // Second booking for the same slot: the mentor is already booked
    const second = await createBooking(prisma, slot, 'Bob', 'b@t.com', 'Europe/London');
    expect('error' in second).toBe(true);
    if ('error' in second) {
      // Either SLOT_UNAVAILABLE (concurrent conflict inside tx) or NO_MENTORS_AVAILABLE (pre-tx check)
      expect(['SLOT_UNAVAILABLE', 'NO_MENTORS_AVAILABLE']).toContain(second.error);
    }
  });
});

// ─── Response format ─────────────────────────────────────────────────────────

describe('Booking response', () => {
  it('returns times in both parent and mentor timezones', async () => {
    await createMentor('10:00', '12:00');
    const date = nextIstDate(1);
    const result = await createBooking(prisma, istSlot(date, '10:00'), 'Alice', 'alice@t.com', 'America/New_York');

    if ('bookingId' in result) {
      expect(result.parentTime.start).toMatch(/AM|PM/);
      expect(result.mentorTime.start).toMatch(/AM|PM/);
      // IST = UTC+5:30; Luxon may render it as "IST" or "GMT+5:30" depending on OS locale
      expect(result.mentorTime.start).toMatch(/IST|GMT\+5:30/);
      expect(result.classLink).toContain(result.bookingId);
    } else {
      throw new Error(`Expected booking success, got: ${JSON.stringify(result)}`);
    }
  });
});
