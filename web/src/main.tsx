import './index.css'
import ComponentShowcase  from './pages/ComponentShowcase.tsx'
import App from './App.tsx'
import './components/styles/tokens.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SettingsPage from './pages/SettingsPage';
import Layout from './pages/Layout';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<App />} />
          <Route path="/components" element={<ComponentShowcase />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
