import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { setupMonacoEnvironment } from '@/lib/setupMonaco';
import App from './App';
import './styles/globals.css';

setupMonacoEnvironment();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>
);
