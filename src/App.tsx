import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage';
import AiChatPage from './pages/AiChatPage';
import GameLauncherPage from './pages/GameLauncherPage';
import ProxyInputPage from './pages/ProxyInputPage';
import ProxyResultPage from './pages/ProxyResultPage';
import NotFoundPage from './pages/NotFoundPage';

import { AuthProvider } from './contexts/AuthContext';
import { ProxyProvider } from './contexts/ProxyContext';
import { SocketProvider } from './contexts/SocketContext';

const App: React.FC = () => (
  <AuthProvider>
    <ProxyProvider>
      <SocketProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/ai-chat" element={<AiChatPage />} />
            <Route path="/games" element={<GameLauncherPage />} />
            <Route path="/proxy" element={<ProxyInputPage />} />
            <Route path="/service/:encodedUrl" element={<ProxyResultPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
      </SocketProvider>
    </ProxyProvider>
  </AuthProvider>
);

export default App;
