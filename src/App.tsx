import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from './components/Layout/MainLayout';
import { TerminalOnlyPage } from './pages/TerminalOnlyPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/terminal-only" element={<TerminalOnlyPage />} />
        <Route path="/" element={<MainLayout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
