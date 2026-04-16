import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import DataSourcesPage from './pages/DataSourcesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"               element={<Navigate to="/chat" replace />} />
        <Route path="/chat"           element={<ChatPage />} />
        <Route path="/chat/:chatId"   element={<ChatPage />} />
        <Route path="/data-sources"   element={<DataSourcesPage />} />
        <Route path="*"               element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
