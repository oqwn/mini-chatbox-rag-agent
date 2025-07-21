import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Chat } from './pages/Chat';
import { ChatMultimodal } from './pages/ChatMultimodal';
import { Settings } from './pages/Settings';
import { MCP } from './pages/MCP';
import { RagManagement } from './pages/RagManagement';
import { DocumentDetail } from './pages/DocumentDetail';
import { useInitializeSettings } from './hooks/useInitializeSettings';
import { useInitializeMCP } from './hooks/useInitializeMCP';
import './index.css';

const App = () => {
  useInitializeSettings();
  useInitializeMCP();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/chat/multimodal" replace />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/multimodal" element={<ChatMultimodal />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/mcp" element={<MCP />} />
        <Route path="/rag" element={<RagManagement />} />
        <Route path="/rag/documents/:id" element={<DocumentDetail />} />
      </Routes>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
