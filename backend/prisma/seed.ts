import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

const IST = 'Asia/Kolkata';

// 10 mentors in 3 shift groups
const MENTORS = [
  // Group A: 12:00–18:00 IST (Mon–Sat) — covers UK morning/afternoon
  { name: 'Aarav Sharma',   email: 'aarav@codeyoung.in',   shift: { start: '12:00', end: '18:00' } },
  { name: 'Diya Patel',     email: 'diya@codeyoung.in',    shift: { start: '12:00', end: '18:00' } },
  { name: 'Kabir Mehta',    email: 'kabir@codeyoung.in',   shift: { start: '12:00', end: '18:00' } },
  { name: 'Ishaan Verma',   email: 'ishaan@codeyoung.in',  shift: { start: '12:00', end: '18:00' } },
  // Group B: 15:00–21:00 IST (Mon–Sat) — covers UK afternoon, US East morning
  { name: 'Ananya Singh',   email: 'ananya@codeyoung.in',  shift: { start: '15:00', end: '21:00' } },
  { name: 'Rohan Gupta',    email: 'rohan@codeyoung.in',   shift: { start: '15:00', end: '21:00' } },
  { name: 'Priya Nair',     email: 'priya@codeyoung.in',   shift: { start: '15:00', end: '21:00' } },
  // Group C: 19:00–01:00 IST (Mon–Sat, crosses midnight) — covers UK evening, US East afternoon, US Pacific morning
  { name: 'Vivaan Joshi',   email: 'vivaan@codeyoung.in',  shift: { start: '19:00', end: '01:00' } },
  { name: 'Saanvi Reddy',   email: 'saanvi@codeyoung.in',  shift: { start: '19:00', end: '01:00' } },
  { name: 'Arjun Kumar',    email: 'arjun@codeyoung.in',   shift: { start: '19:00', end: '01:00' } },
];

// Mon–Sat = dayOfWeek 1–6
const WORKING_DAYS = [1, 2, 3, 4, 5, 6];

async function main() {
  console.log('Seeding database...');

  await prisma.booking.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.mentor.deleteMany();

  for (const m of MENTORS) {
    const mentor = await prisma.mentor.create({
      data: {
        name: m.name,
        email: m.email,
        schedules: {
          create: WORKING_DAYS.map((day) => ({
            dayOfWeek: day,
            startTime: m.shift.start,
            endTime: m.shift.end,
          })),
        },
      },
    });

    console.log(`Created mentor: ${mentor.name} (${m.shift.start}–${m.shift.end} IST)`);
  }

  // Seed a handful of existing bookings so availability + alternatives logic is exercisable from day one.
  // Pick slots in the next 2 days to guarantee they're within the booking horizon.
  const allMentors = await prisma.mentor.findMany();
  const today = DateTime.now().setZone(IST).startOf('day');

  const preBookings: Array<{ mentorIndex: number; dayOffset: number; slotHour: number; slotMinute: number }> = [
    { mentorIndex: 0, dayOffset: 1, slotHour: 14, slotMinute: 0 },
    { mentorIndex: 0, dayOffset: 1, slotHour: 15, slotMinute: 0 },  // fills mentor 0 on day+1
    { mentorIndex: 1, dayOffset: 1, slotHour: 14, slotMinute: 0 },
    { mentorIndex: 4, dayOffset: 1, slotHour: 17, slotMinute: 0 },
    { mentorIndex: 4, dayOffset: 1, slotHour: 17, slotMinute: 30 }, // fills mentor 4 on day+1
    { mentorIndex: 5, dayOffset: 2, slotHour: 16, slotMinute: 0 },
    { mentorIndex: 7, dayOffset: 1, slotHour: 20, slotMinute: 0 },
    { mentorIndex: 8, dayOffset: 2, slotHour: 21, slotMinute: 0 },
  ];

  for (const pb of preBookings) {
    const mentor = allMentors[pb.mentorIndex];
    const slotStart = today
      .plus({ days: pb.dayOffset })
      .set({ hour: pb.slotHour, minute: pb.slotMinute, second: 0, millisecond: 0 });

    // Skip if the IST day is a Sunday (dayOfWeek = 7 in Luxon)
    if (slotStart.weekday === 7) continue;

    const startUtc = slotStart.toUTC();
    const endUtc = startUtc.plus({ minutes: 30 });
    const bookingId = `seed_${mentor.id}_${startUtc.toISO()}`;

    await prisma.booking.upsert({
      where: { mentorId_startTime: { mentorId: mentor.id, startTime: startUtc.toJSDate() } },
      create: {
        id: bookingId,
        mentorId: mentor.id,
        parentName: 'Demo Parent',
        parentEmail: 'demo@example.com',
        parentTimezone: 'Europe/London',
        startTime: startUtc.toJSDate(),
        endTime: endUtc.toJSDate(),
        classLink: `https://class.codeyoung.com/session/${bookingId}`,
        status: 'CONFIRMED',
      },
      update: {},
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
