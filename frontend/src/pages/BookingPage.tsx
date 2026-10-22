import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, AvailableSlot, BookingError } from '../api/client';
import { detectTimezone, COMMON_TIMEZONES, localDateOffset } from '../utils/timezone';

type Step = 'select-slot' | 'enter-details' | 'submitting';

export default function BookingPage() {
  const navigate = useNavigate();

  const [timezone, setTimezone] = useState(
    () => localStorage.getItem('cy_timezone') ?? detectTimezone(),
  );
  const [selectedDate, setSelectedDate] = useState(
    () => localDateOffset(localStorage.getItem('cy_timezone') ?? detectTimezone(), 1),
  );
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [step, setStep] = useState<Step>('select-slot');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [bookingError, setBookingError] = useState<BookingError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});

  // Min/max date bounds
  const today = localDateOffset(timezone, 0);
  const maxDate = localDateOffset(timezone, 14);

  const {
    data: availability,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['availability', selectedDate, timezone],
    queryFn: () => api.getAvailability(selectedDate, timezone),
    enabled: !!selectedDate && !!timezone,
  });

  // Reset slot when date/tz changes
  useEffect(() => {
    setSelectedSlot(null);
    setBookingError(null);
    setStep('select-slot');
  }, [selectedDate, timezone]);

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setBookingError(null);
    setStep('enter-details');
    setFieldErrors({});
  };

  const handleAlternativeSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setBookingError(null);
    setStep('enter-details');
  };

  const validate = () => {
    const errors: { name?: string; email?: string } = {};
    if (!parentName.trim()) errors.name = 'Please enter your name.';
    if (!parentEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))
      errors.email = 'Please enter a valid email address.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBook = async () => {
    if (!selectedSlot || !validate()) return;
    setStep('submitting');

    const { ok, status, data } = await api.createBooking({
      slotStartUtc: selectedSlot.startUtc,
      parentName: parentName.trim(),
      parentEmail: parentEmail.trim(),
      parentTimezone: timezone,
    });

    if (ok && 'bookingId' in data) {
      navigate(`/confirmation/${data.bookingId}`);
      return;
    }

    const errData = data as BookingError;
    setBookingError(errData);
    setStep('select-slot');
    setSelectedSlot(null);
  };

  const slots = availability?.slots ?? [];

  return (
    <>
      <div className="step-indicator">
        <div className={`step ${step === 'select-slot' ? 'active' : step !== 'select-slot' ? 'done' : ''}`} />
        <div className={`step ${step === 'enter-details' || step === 'submitting' ? 'active' : ''}`} />
      </div>

      {/* Timezone + Date Selection */}
      <div className="card">
        <h2>Choose a date & time zone</h2>
        <div className="field">
          <label>Your time zone</label>
          <select
            value={timezone}
            onChange={(e) => {
              const tz = e.target.value;
              localStorage.setItem('cy_timezone', tz);
              setTimezone(tz);
            }}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
            {/* Show the detected timezone if it's not in the list */}
            {!COMMON_TIMEZONES.some((tz) => tz.value === timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
          </select>
          <p className="tz-note">Times shown in your local time zone. Mentors are in India (IST).</p>
        </div>
        <div className="field">
          <label>Select a date</label>
          <input
            type="date"
            value={selectedDate}
            min={today}
            max={maxDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Booking error with alternatives */}
      {bookingError && (
        <div className="error-banner">
          <strong>This slot is no longer available.</strong>
          <p style={{ marginTop: 6, marginBottom: bookingError.alternatives.length ? 10 : 0 }}>
            {bookingError.message}
          </p>
          {bookingError.alternatives.length > 0 && (
            <div className="alt-slots">
              <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>Try one of these:</p>
              {bookingError.alternatives.map((alt) => (
                <button key={alt.startUtc} className="alt-slot-btn" onClick={() => handleAlternativeSelect(alt)}>
                  {alt.startDisplay} – {alt.endDisplay}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Slot selection */}
      {step === 'select-slot' && (
        <div className="card">
          <h2>Available time slots</h2>
          {isLoading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
          {isError && (
            <p className="error-banner">
              {(error as { message?: string })?.message ?? 'Failed to load availability.'}
            </p>
          )}
          {!isLoading && !isError && slots.length === 0 && (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p>No available slots on this date.</p>
              <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Try a different date or time zone.</p>
            </div>
          )}
          {!isLoading && slots.length > 0 && (
            <div className="slot-grid">
              {slots.map((slot) => (
                <button
                  key={slot.startUtc}
                  className={`slot-btn ${selectedSlot?.startUtc === slot.startUtc ? 'selected' : ''}`}
                  onClick={() => handleSlotSelect(slot)}
                >
                  <div>{slot.startDisplay}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {slot.availableMentorCount} mentor{slot.availableMentorCount !== 1 ? 's' : ''} available
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Details form */}
      {(step === 'enter-details' || step === 'submitting') && selectedSlot && (
        <div className="card">
          <h2>Confirm your booking</h2>

          <div style={{ background: 'var(--brand-light)', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--brand)' }}>
              {selectedSlot.startDisplay} – {selectedSlot.endDisplay}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
              30-minute trial class · A mentor will be assigned from our team in India
            </div>
          </div>

          <div className="field">
            <label>Your name</label>
            <input
              type="text"
              placeholder="e.g. Jane Smith"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              disabled={step === 'submitting'}
            />
            {fieldErrors.name && <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: 4 }}>{fieldErrors.name}</p>}
          </div>

          <div className="field">
            <label>Email address</label>
            <input
              type="email"
              placeholder="e.g. jane@example.com"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              disabled={step === 'submitting'}
            />
            {fieldErrors.email && <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: 4 }}>{fieldErrors.email}</p>}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              className="btn btn-outline"
              onClick={() => { setStep('select-slot'); setSelectedSlot(null); }}
              disabled={step === 'submitting'}
            >
              Back
            </button>
            <button
              className="btn btn-primary btn-full"
              onClick={handleBook}
              disabled={step === 'submitting'}
            >
              {step === 'submitting' ? <><span className="spinner" /> Booking…</> : 'Book Trial Class'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
