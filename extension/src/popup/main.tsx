import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './popup.css';
import PopupApp from './PopupApp';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <PopupApp />
    </StrictMode>
  );
}
