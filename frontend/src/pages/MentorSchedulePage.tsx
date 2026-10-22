import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, MentorSummary } from '../api/client';

export default function MentorSchedulePage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: mentorList, isLoading: loadingList } = useQuery({
    queryKey: ['mentors'],
    queryFn: () => api.getMentors(),
  });

  const { data: schedule, isLoading: loadingSchedule } = useQuery({
    queryKey: ['mentor-schedule', selectedId],
    queryFn: () => api.getMentorSchedule(selectedId!),
    enabled: selectedId !== null,
  });

  const mentors: MentorSummary[] = mentorList?.mentors ?? [];

  // Group slots by date
  const slotsByDate: Record<string, NonNullable<typeof schedule>['slots']> = {};
  if (schedule?.slots) {
    for (const slot of schedule.slots) {
      if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
      slotsByDate[slot.date].push(slot);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Mentor schedule</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          View upcoming confirmed bookings for any mentor. All times are shown in India Standard Time (IST).
        </p>
        <div className="field">
          <label>Select a mentor</label>
          {loadingList ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading…</p>
          ) : (
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— choose a mentor —</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {selectedId !== null && (
        <div className="card">
          {loadingSchedule && (
            <p style={{ color: 'var(--text-muted)' }}>Loading schedule…</p>
          )}

          {!loadingSchedule && schedule && schedule.slots.length === 0 && (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p>No upcoming bookings for {schedule.mentor.name}.</p>
              <p style={{ fontSize: '0.85rem', marginTop: 4 }}>New bookings will appear here once confirmed.</p>
            </div>
          )}

          {!loadingSchedule && schedule && schedule.slots.length > 0 && (
            <>
              <h2 style={{ marginBottom: 4 }}>{schedule.mentor.name}</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                {schedule.slots.length} upcoming class{schedule.slots.length !== 1 ? 'es' : ''}
              </p>

              {Object.entries(slotsByDate).map(([date, slots]) => (
                <div key={date} style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {date}
                  </p>
                  {slots.map((slot) => (
                    <div key={slot.bookingId} className="mentor-slot-row">
                      <div className="mentor-slot-time">
                        {slot.startDisplay} – {slot.endDisplay}
                      </div>
                      <div className="mentor-slot-meta">
                        <span style={{ fontWeight: 600 }}>{slot.parentName}</span>
                        <a
                          href={slot.classLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mentor-slot-link"
                        >
                          Join class
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
