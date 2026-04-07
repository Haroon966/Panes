import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from './components/Layout/MainLayout';
import { StartupUpdateNotification } from './components/Update/StartupUpdateNotification';
import { TerminalBackgroundToasts } from './components/Terminal/TerminalBackgroundToasts';
import { TerminalOnlyPage } from './pages/TerminalOnlyPage';
import { PersistenceProvider } from './providers/PersistenceProvider';

export default function App() {
  return (
    <BrowserRouter>
      <PersistenceProvider>
        <TerminalBackgroundToasts />
        <StartupUpdateNotification />
        <Routes>
          <Route path="/terminal-only" element={<TerminalOnlyPage />} />
          <Route path="/" element={<MainLayout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PersistenceProvider>
    </BrowserRouter>
  );
}
