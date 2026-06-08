import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { DesignVariantProvider } from './contexts/DesignVariantContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignVariantProvider>
      <App />
    </DesignVariantProvider>
  </StrictMode>
);
