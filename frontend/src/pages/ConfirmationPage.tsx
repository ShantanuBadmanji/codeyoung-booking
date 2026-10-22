import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export default function ConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: booking, isLoading, isError } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.getBooking(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;
  }

  if (isError || !booking) {
    return (
      <div className="card">
        <div className="error-banner">Could not load booking details.</div>
        <button className="btn btn-outline" onClick={() => navigate('/')}>Back to booking</button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="success-banner" style={{ marginBottom: 20 }}>
        <strong>Your trial class is confirmed!</strong>
        <p style={{ marginTop: 4, fontSize: '0.85rem' }}>
          Check your email for a reminder. We're looking forward to seeing you!
        </p>
      </div>

      <h2 style={{ marginBottom: 16 }}>Booking details</h2>

      <div className="info-row">
        <span className="label">Booking ref</span>
        <span className="value" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{booking.bookingId}</span>
      </div>

      <div className="info-row">
        <span className="label">Mentor</span>
        <span className="value">{booking.mentor.name}</span>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
          Your local time
        </p>
        <div className="info-row">
          <span className="label">Date</span>
          <span className="value">{booking.parentTime.date}</span>
        </div>
        <div className="info-row">
          <span className="label">Time</span>
          <span className="value">{booking.parentTime.start} – {booking.parentTime.end}</span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
          Mentor's time (India)
        </p>
        <div className="info-row">
          <span className="label">Date</span>
          <span className="value">{booking.mentorTime.date}</span>
        </div>
        <div className="info-row">
          <span className="label">Time</span>
          <span className="value">{booking.mentorTime.start} – {booking.mentorTime.end}</span>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '0 0 20px' }} />

      <div>
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
          Class link
        </p>
        <a
          href={booking.classLink}
          target="_blank"
          rel="noreferrer"
          className="link-box"
          style={{ display: 'block' }}
        >
          {booking.classLink}
        </a>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
          Use this link to join your class at the scheduled time.
        </p>
      </div>

      <button
        className="btn btn-outline btn-full"
        style={{ marginTop: 24 }}
        onClick={() => navigate('/')}
      >
        Book another class
      </button>
    </div>
  );
}
