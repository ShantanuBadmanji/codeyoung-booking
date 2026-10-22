import { Routes, Route, Navigate } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import ConfirmationPage from './pages/ConfirmationPage';

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>CodeYoung</h1>
        <p>Book a free trial coding class for your child</p>
      </header>
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/confirmation/:id" element={<ConfirmationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
