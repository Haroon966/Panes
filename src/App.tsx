import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from './components/Layout/MainLayout';
import { StartupUpdateOverlay } from './components/Update/StartupUpdateOverlay';
import { TerminalBackgroundToasts } from './components/Terminal/TerminalBackgroundToasts';
import { TerminalOnlyPage } from './pages/TerminalOnlyPage';
import { PersistenceProvider } from './providers/PersistenceProvider';

export default function App() {
  return (
    <BrowserRouter>
      <PersistenceProvider>
        <TerminalBackgroundToasts />
        <StartupUpdateOverlay />
        <Routes>
          <Route path="/terminal-only" element={<TerminalOnlyPage />} />
          <Route path="/" element={<MainLayout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PersistenceProvider>
    </BrowserRouter>
  );
}
