import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { istDateOf, toZone, formatDisplay, isValidIana } from '../domain/time';
import { IST } from '../domain/time';

describe('istDateOf', () => {
  it('returns the IST calendar date for a UTC instant before IST midnight', () => {
    // 2024-11-14T18:00:00Z = 2024-11-14T23:30:00+05:30 IST → Nov 14
    const utc = DateTime.fromISO('2024-11-14T18:00:00Z');
    expect(istDateOf(utc)).toBe('2024-11-14');
  });

  it('returns the IST calendar date for a UTC instant after IST midnight', () => {
    // 2024-11-14T19:00:00Z = 2024-11-15T00:30:00+05:30 IST → Nov 15
    const utc = DateTime.fromISO('2024-11-14T19:00:00Z');
    expect(istDateOf(utc)).toBe('2024-11-15');
  });
});

describe('US DST — spring-forward (America/New_York)', () => {
  it('displays times correctly just before and after spring-forward', () => {
    // US/Eastern spring-forward 2024: March 10 at 2:00 AM → 3:00 AM
    // 2024-03-10T07:00:00Z = 2:00 AM EST = 3:00 AM EDT (the gap)
    // 2024-03-10T06:59:00Z = 1:59 AM EST
    const beforeGap = DateTime.fromISO('2024-03-10T06:59:00Z').setZone('America/New_York');
    const afterGap = DateTime.fromISO('2024-03-10T07:01:00Z').setZone('America/New_York');
    expect(beforeGap.toFormat('HH:mm')).toBe('01:59');
    expect(afterGap.toFormat('HH:mm')).toBe('03:01');
    // Check abbreviations
    expect(formatDisplay(beforeGap)).toContain('EST');
    expect(formatDisplay(afterGap)).toContain('EDT');
  });
});

describe('US DST — fall-back (America/New_York)', () => {
  it('1:30 AM EDT and 1:30 AM EST are distinct UTC instants', () => {
    // US/Eastern fall-back 2024: November 3 at 2:00 AM EDT → 1:00 AM EST
    // So 1:30 AM occurs twice: once as EDT (UTC-4) and once as EST (UTC-5)
    const edt = DateTime.fromISO('2024-11-03T05:30:00Z').setZone('America/New_York'); // 1:30 AM EDT
    const est = DateTime.fromISO('2024-11-03T06:30:00Z').setZone('America/New_York'); // 1:30 AM EST
    expect(edt.toFormat('HH:mm')).toBe('01:30');
    expect(est.toFormat('HH:mm')).toBe('01:30');
    // They should have different offsets
    expect(edt.offset).toBe(-240); // UTC-4 (DST)
    expect(est.offset).toBe(-300); // UTC-5 (standard)
  });
});

describe('UK BST transitions', () => {
  it('displays times correctly around UK spring-forward (last Sunday March)', () => {
    // UK BST start 2024: March 31 at 1:00 AM → 2:00 AM
    const beforeBst = DateTime.fromISO('2024-03-31T00:59:00Z').setZone('Europe/London');
    const afterBst = DateTime.fromISO('2024-03-31T01:01:00Z').setZone('Europe/London');
    expect(beforeBst.toFormat('HH:mm')).toBe('00:59');
    expect(afterBst.toFormat('HH:mm')).toBe('02:01');
    // Before spring-forward: UTC offset is 0
    expect(beforeBst.offset).toBe(0);
    // After spring-forward: UTC offset is +60 min (BST / GMT+1)
    expect(afterBst.offset).toBe(60);
  });

  it('displays times correctly around UK fall-back (last Sunday October)', () => {
    // UK BST end 2024: October 27 at 2:00 AM BST → 1:00 AM GMT
    const bst = DateTime.fromISO('2024-10-27T00:30:00Z').setZone('Europe/London'); // 1:30 AM BST
    const gmt = DateTime.fromISO('2024-10-27T01:30:00Z').setZone('Europe/London'); // 1:30 AM GMT
    expect(bst.toFormat('HH:mm')).toBe('01:30');
    expect(gmt.toFormat('HH:mm')).toBe('01:30');
    expect(bst.offset).toBe(60);  // BST = UTC+1
    expect(gmt.offset).toBe(0);   // GMT = UTC+0
  });
});

describe('isValidIana', () => {
  it('accepts valid IANA names', () => {
    expect(isValidIana('America/New_York')).toBe(true);
    expect(isValidIana('Europe/London')).toBe(true);
    expect(isValidIana('Asia/Kolkata')).toBe(true);
  });

  it('rejects invalid names', () => {
    expect(isValidIana('UTC+5:30')).toBe(false);
    expect(isValidIana('India Standard Time')).toBe(false);
    expect(isValidIana('')).toBe(false);
  });
});
