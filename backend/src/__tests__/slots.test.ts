import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { generateCandidateSlots, intervalsOverlap } from '../domain/slots';
import { IST } from '../domain/time';

const istDay = (dateStr: string) => DateTime.fromISO(dateStr, { zone: IST });

describe('intervalsOverlap (half-open [start, end))', () => {
  it('does not overlap adjacent intervals', () => {
    const a = DateTime.fromISO('2024-11-15T09:00:00Z');
    const b = DateTime.fromISO('2024-11-15T09:30:00Z');
    const c = DateTime.fromISO('2024-11-15T10:00:00Z');
    expect(intervalsOverlap(a, b, b, c)).toBe(false);
  });

  it('overlaps when one starts inside another', () => {
    const a = DateTime.fromISO('2024-11-15T09:00:00Z');
    const b = DateTime.fromISO('2024-11-15T09:30:00Z');
    const c = DateTime.fromISO('2024-11-15T09:15:00Z');
    const d = DateTime.fromISO('2024-11-15T09:45:00Z');
    expect(intervalsOverlap(a, b, c, d)).toBe(true);
  });

  it('overlaps identical intervals', () => {
    const a = DateTime.fromISO('2024-11-15T09:00:00Z');
    const b = DateTime.fromISO('2024-11-15T09:30:00Z');
    expect(intervalsOverlap(a, b, a, b)).toBe(true);
  });

  it('does not overlap when b ends exactly when a starts', () => {
    const a = DateTime.fromISO('2024-11-15T09:30:00Z');
    const b = DateTime.fromISO('2024-11-15T10:00:00Z');
    const c = DateTime.fromISO('2024-11-15T09:00:00Z');
    const d = DateTime.fromISO('2024-11-15T09:30:00Z');
    expect(intervalsOverlap(a, b, c, d)).toBe(false);
  });
});

describe('generateCandidateSlots', () => {
  it('generates correct slots for a same-day IST shift', () => {
    const slots = generateCandidateSlots('12:00', '14:00', istDay('2024-11-15'));
    expect(slots).toHaveLength(4); // 12:00, 12:30, 13:00, 13:30
    expect(slots[0].startUtc.setZone(IST).toFormat('HH:mm')).toBe('12:00');
    expect(slots[3].startUtc.setZone(IST).toFormat('HH:mm')).toBe('13:30');
  });

  it('last slot ends exactly at shift end — does not overflow', () => {
    const slots = generateCandidateSlots('20:00', '21:00', istDay('2024-11-15'));
    expect(slots).toHaveLength(2);
    expect(slots[1].endUtc.setZone(IST).toFormat('HH:mm')).toBe('21:00');
  });

  it('generates slots across IST midnight for cross-midnight shift', () => {
    const slots = generateCandidateSlots('23:00', '01:00', istDay('2024-11-15'));
    // 23:00, 23:30 → 2 slots; ends at 01:00 IST Nov 16
    expect(slots).toHaveLength(4); // 23:00, 23:30, 00:00, 00:30
    const startTimes = slots.map((s) => s.startUtc.setZone(IST).toFormat('HH:mm'));
    expect(startTimes).toEqual(['23:00', '23:30', '00:00', '00:30']);
  });

  it('slot at 23:30 IST Nov 14 has IST date Nov 14 (not Nov 15)', () => {
    const slots = generateCandidateSlots('23:00', '01:00', istDay('2024-11-14'));
    const lastPreMidnight = slots.find((s) => s.startUtc.setZone(IST).toFormat('HH:mm') === '23:30')!;
    expect(lastPreMidnight).toBeDefined();
    // The UTC date may be Nov 14 or Nov 15 depending on offset, but IST date must be Nov 14
    expect(lastPreMidnight.startUtc.setZone(IST).toISODate()).toBe('2024-11-14');
  });

  it('cross-midnight slot at 00:00 IST Nov 15 has IST date Nov 15', () => {
    const slots = generateCandidateSlots('23:00', '01:00', istDay('2024-11-14'));
    const postMidnight = slots.find((s) => s.startUtc.setZone(IST).toFormat('HH:mm') === '00:00')!;
    expect(postMidnight.startUtc.setZone(IST).toISODate()).toBe('2024-11-15');
  });

  it('generates zero slots when shift is less than 30 minutes', () => {
    const slots = generateCandidateSlots('12:00', '12:20', istDay('2024-11-15'));
    expect(slots).toHaveLength(0);
  });
});
