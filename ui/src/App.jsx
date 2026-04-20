import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import DataSourcesPage from './pages/DataSourcesPage';
import GraphPage from './pages/GraphPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                        element={<Navigate to="/chat" replace />} />
        <Route path="/chat"                    element={<ChatPage />} />
        <Route path="/chat/:chatId"            element={<ChatPage />} />
        <Route path="/data-sources"            element={<DataSourcesPage />} />
        <Route path="/graph/:modelName"        element={<GraphPage />} />
        <Route path="*"                        element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
