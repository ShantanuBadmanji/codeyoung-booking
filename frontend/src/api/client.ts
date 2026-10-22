const BASE = '/api';

export interface AvailableSlot {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  startDisplay: string;
  endDisplay: string;
  availableMentorCount: number;
}

export interface AvailabilityResponse {
  date: string;
  timezone: string;
  slots: AvailableSlot[];
}

export interface BookingResult {
  bookingId: string;
  classLink: string;
  mentor: { id: number; name: string };
  parentTime: { start: string; end: string; date: string };
  mentorTime: { start: string; end: string; date: string };
}

export interface BookingError {
  error: string;
  message: string;
  alternatives: AvailableSlot[];
}

export interface BookingRequest {
  slotStartUtc: string;
  parentName: string;
  parentEmail: string;
  parentTimezone: string;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data as T;
}

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data: data as T };
}

export interface MentorSummary {
  id: number;
  name: string;
}

export interface MentorSlot {
  bookingId: string;
  classLink: string;
  parentName: string;
  startDisplay: string;
  endDisplay: string;
  date: string;
  startUtc: string;
}

export interface MentorScheduleResponse {
  mentor: MentorSummary;
  slots: MentorSlot[];
}

export const api = {
  getAvailability: (date: string, timezone: string) =>
    get<AvailabilityResponse>('/availability', { date, timezone }),

  createBooking: (req: BookingRequest) =>
    post<BookingResult | BookingError>('/bookings', req),

  getBooking: (id: string) =>
    get<BookingResult>(`/bookings/${id}`, {}),

  getMentors: () =>
    get<{ mentors: MentorSummary[] }>('/mentors', {}),

  getMentorSchedule: (id: number) =>
    get<MentorScheduleResponse>(`/mentors/${id}/bookings`, {}),
};
