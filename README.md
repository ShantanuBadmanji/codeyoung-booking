# CodeYoung Trial-Class Booking

A web application that lets parents in the US and UK book 30-minute trial coding classes with mentors in India. It handles time zones, Daylight Saving Time, mentor capacity, and concurrent booking conflicts.

---

## Prerequisites

- Node.js v18+ (tested on v21.7.2)
- npm v9+

---

## Setup

### 1. Clone and install dependencies

```bash
# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

### 2. Set up the backend environment

```bash
cd backend
cp ../.env.example .env
```

The default `.env` works out of the box with SQLite:

```
DATABASE_URL="file:./dev.db"
PORT=3001
BOOKING_HORIZON_DAYS=14
```

### 3. Create the database and seed data

```bash
cd backend
npm run db:push    # creates dev.db and runs Prisma generate
npm run db:seed    # seeds 10 mentors with schedules + a few demo bookings
```

---

## Running the application

### Development (both servers)

From the project root:

```bash
# Terminal 1 — backend
cd backend && npm run dev
# → http://localhost:3001

# Terminal 2 — frontend
cd frontend && npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:3001`.

---

## Running tests

```bash
cd backend
npm test
```

26 tests covering:
- Interval overlap (half-open semantics)
- Candidate slot generation — same-day and cross-midnight IST shifts
- IST calendar-date anchoring for the daily booking limit
- US DST spring-forward and fall-back (America/New_York)
- UK BST start/end (Europe/London)
- Daily capacity enforcement
- Cross-midnight IST date boundary (00:00 IST Saturday counts against Saturday, not Friday)
- Mentor assignment (fewest bookings, tie-break by ID)
- Stale slot / concurrent conflict handling

---

## API

### `GET /api/availability?date=YYYY-MM-DD&timezone=IANA`

Returns available 30-minute slots for the given parent-local date.

```json
{
  "date": "2024-11-15",
  "timezone": "America/New_York",
  "slots": [
    {
      "startUtc": "2024-11-15T14:00:00.000Z",
      "endUtc":   "2024-11-15T14:30:00.000Z",
      "startLocal": "2024-11-15T09:00:00-05:00",
      "endLocal":   "2024-11-15T09:30:00-05:00",
      "startDisplay": "9:00 AM EST",
      "endDisplay":   "9:30 AM EST",
      "availableMentorCount": 3
    }
  ]
}
```

### `POST /api/bookings`

```json
{
  "slotStartUtc": "2024-11-15T14:00:00.000Z",
  "parentName": "Jane Smith",
  "parentEmail": "jane@example.com",
  "parentTimezone": "America/New_York"
}
```

**201 response:**

```json
{
  "bookingId": "clxyz...",
  "classLink": "https://class.codeyoung.com/session/clxyz...",
  "mentor": { "id": 5, "name": "Arjun Kumar" },
  "parentTime": { "start": "9:00 AM EST", "end": "9:30 AM EST", "date": "Friday, Nov 15, 2024" },
  "mentorTime": { "start": "7:30 PM GMT+5:30", "end": "8:00 PM GMT+5:30", "date": "Friday, Nov 15, 2024" }
}
```

**409 response (slot unavailable):**

```json
{
  "error": "SLOT_UNAVAILABLE",
  "message": "This slot is no longer available.",
  "alternatives": [ ... up to 5 next available slots ... ]
}
```

### `GET /api/bookings/:id`

Returns full booking detail in the same shape as the POST response.

---

## Architecture

```
backend/
├── prisma/schema.prisma     # Mentor, Schedule, Booking models
├── prisma/seed.ts           # 10 mentors (3 shift groups) + demo bookings
└── src/
    ├── domain/
    │   ├── time.ts          # Luxon timezone utilities (IST, formatDisplay, etc.)
    │   ├── slots.ts         # Candidate slot generation + overlap predicate
    │   ├── availability.ts  # Full availability query (capacity + overlap filtering)
    │   └── booking.ts       # Mentor assignment + transactional booking creation
    ├── routes/
    │   ├── availability.ts  # GET /api/availability (Zod validation)
    │   └── bookings.ts      # POST /api/bookings, GET /api/bookings/:id
    └── server.ts            # Express app + SQLite WAL mode

frontend/
└── src/
    ├── pages/
    │   ├── BookingPage.tsx      # Date/tz picker → slot grid → booking form
    │   └── ConfirmationPage.tsx # Booking confirmation with both local times
    ├── api/client.ts            # Typed fetch wrappers
    └── utils/timezone.ts        # Browser timezone detection, common TZ list
```

### Key design decisions

| Decision | Value |
|---|---|
| Class duration | 30 minutes |
| Slot increment | 30 minutes |
| Mentor daily limit | 2 bookings per **IST calendar date of the slot's start time** |
| Cross-midnight shifts | Supported — Group C mentors work 19:00–01:00 IST covering UK evenings and US East afternoons |
| Concurrency safety | SQLite serialises writes; `UNIQUE(mentorId, startTime)` is a hard backstop; availability is re-validated inside the transaction |
| Timezone display | Luxon `ZZZZ` format — shows abbreviation or UTC offset (e.g. `GMT+5:30`) depending on OS locale |
| Mentor assignment | Fewest IST-day bookings, tie-break by mentor ID ascending |
| Alternatives | Next 5 available slots returned in the 409 response |
| Cancellation | Out of scope |

### Assumptions documented

1. Class duration is 30 minutes (not specified in the assignment).
2. Mentor working hours are seeded — there is no mentor management UI.
3. The daily capacity limit uses the **IST calendar date of the booking's start time**, not UTC or the parent's date.
4. A slot at 00:30 IST Saturday (from a Friday 23:00–01:00 IST shift) counts against **Saturday's** capacity, not Friday's.
5. Nonexistent local times (DST spring-forward gap) are handled by Luxon's `Intl` layer; ambiguous times use the DST (earlier) offset.
6. The demo class link is a deterministic fake URL: `https://class.codeyoung.com/session/{bookingId}`.
7. The booking horizon is 14 days from today (configurable via `BOOKING_HORIZON_DAYS`).
8. Cancellation is out of scope for this MVP.

---

## Mentor shifts (seed data)

| Mentors | IST shift | Covers |
|---|---|---|
| Aarav, Diya, Kabir, Ishaan | 12:00–18:00 | UK morning/afternoon |
| Ananya, Rohan, Priya | 15:00–21:00 | UK afternoon, US East morning |
| Vivaan, Saanvi, Arjun | 19:00–01:00 | UK evening, US East afternoon, US Pacific morning |

All shifts run Monday–Saturday (IST). The Group C shift crosses IST midnight.

---

## Submitting

After completing development, export the full AI conversation transcript:

1. In Claude Code, run `/export`
2. Save the exported file as `TRANSCRIPT.md` in the project root
3. Verify it captures the planning session, implementation decisions, and test results
