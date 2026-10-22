// Detect the browser's IANA timezone
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

// A curated list of common parent-facing timezones (US + UK/Ireland)
export const COMMON_TIMEZONES = [
  { label: 'London / Dublin (UK & Ireland)', value: 'Europe/London' },
  { label: 'Dublin (Ireland)', value: 'Europe/Dublin' },
  { label: 'Eastern Time (New York, Toronto)', value: 'America/New_York' },
  { label: 'Central Time (Chicago)', value: 'America/Chicago' },
  { label: 'Mountain Time (Denver)', value: 'America/Denver' },
  { label: 'Pacific Time (Los Angeles)', value: 'America/Los_Angeles' },
  { label: 'India (IST)', value: 'Asia/Kolkata' },
  { label: 'UTC', value: 'UTC' },
];

/** Return a UTC YYYY-MM-DD date string for today + offset days in the given timezone. */
export function localDateOffset(timezone: string, offsetDays: number): string {
  const dt = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // Advance by offsetDays in UTC (close enough for the booking horizon)
  const target = new Date(dt.getTime() + offsetDays * 86400_000);
  return formatter.format(target); // "YYYY-MM-DD"
}

/** Format a Date as "YYYY-MM-DD" in the given timezone. */
export function formatLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
