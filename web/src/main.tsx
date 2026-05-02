import './index.css'
import ComponentShowcase  from './pages/ComponentShowcase.tsx'
import App from './App.tsx'
import './components/styles/tokens.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/components" element={<ComponentShowcase />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
