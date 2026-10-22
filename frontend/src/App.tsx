import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import ConfirmationPage from './pages/ConfirmationPage';
import MentorSchedulePage from './pages/MentorSchedulePage';

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>CodeYoung</h1>
        <p>Book a free trial coding class for your child</p>
        <nav className="header-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Book a class
          </NavLink>
          <NavLink to="/mentors" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Mentor view
          </NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/confirmation/:id" element={<ConfirmationPage />} />
        <Route path="/mentors" element={<MentorSchedulePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
