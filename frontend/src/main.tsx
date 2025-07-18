import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Chat } from './pages/Chat';
import { Settings } from './pages/Settings';
import { MCP } from './pages/MCP';
import { useInitializeSettings } from './hooks/useInitializeSettings';
import { useInitializeMCP } from './hooks/useInitializeMCP';
import './index.css';

const App = () => {
  useInitializeSettings();
  useInitializeMCP();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/mcp" element={<MCP />} />
      </Routes>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
