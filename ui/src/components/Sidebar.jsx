import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  MessageSquare,
  Database,
  Trash2,
  ChevronRight,
  Search,
} from 'lucide-react';
import SakuraLogo from './SakuraLogo';

export default function Sidebar({ chats = [], activeChatId, onNewChat, onDeleteChat }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const [query, setQuery]   = useState('');
  const [hoverId, setHoverId] = useState(null);

  const isDataSources = location.pathname === '/data-sources';

  const filtered = chats.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()),
  );

  function handleNewChat() {
    if (onNewChat) onNewChat();
    else navigate('/chat');
  }

  return (
    <aside className="flex flex-col h-full w-64 shrink-0 bg-mist border-r border-sakura-100 select-none">
      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-3">
        <SakuraLogo size={26} />
        <span className="font-semibold text-[15px] tracking-tight text-gray-800">
          Hanami<span className="text-sakura-400"> RAG</span>
        </span>
      </div>

      {/* ── New chat button ── */}
      <div className="px-3 pb-3">
        <button
          onClick={handleNewChat}
          className="btn-sakura w-full text-sm py-2"
        >
          <Plus size={15} />
          New conversation
        </button>
      </div>

      {/* ── Nav tabs ── */}
      <nav className="px-3 pb-2 flex flex-col gap-0.5">
        <Link
          to="/chat"
          className={`sidebar-item ${!isDataSources ? 'active' : ''}`}
        >
          <MessageSquare size={16} />
          Chat
        </Link>
        <Link
          to="/data-sources"
          className={`sidebar-item ${isDataSources ? 'active' : ''}`}
        >
          <Database size={16} />
          Data Sources
          <ChevronRight size={13} className="ml-auto opacity-40" />
        </Link>
      </nav>

      <div className="mx-3 border-t border-sakura-100 my-1" />

      {/* ── Search ── */}
      {!isDataSources && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-sakura-100 px-3 py-1.5">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations…"
              className="text-xs bg-transparent outline-none text-gray-600 w-full placeholder:text-gray-400"
            />
          </div>
        </div>
      )}

      {/* ── Chat list ── */}
      {!isDataSources && (
        <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-8 px-2 leading-relaxed">
              No conversations yet.
              <br />
              Start one above ↑
            </p>
          )}
          {filtered.map((chat) => (
            <div
              key={chat.id}
              onMouseEnter={() => setHoverId(chat.id)}
              onMouseLeave={() => setHoverId(null)}
              className={`group relative flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-colors duration-100
                ${chat.id === activeChatId
                  ? 'bg-sakura-100 text-sakura-600'
                  : 'hover:bg-sakura-50 text-gray-600'
                }`}
              onClick={() => navigate(`/chat/${chat.id}`)}
            >
              <MessageSquare size={13} className="shrink-0 opacity-60" />
              <span className="text-xs font-medium truncate flex-1">{chat.title}</span>

              {hoverId === chat.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat?.(chat.id);
                    if (chat.id === activeChatId) navigate('/chat');
                  }}
                  className="shrink-0 p-1 rounded-lg hover:bg-sakura-200/60 text-sakura-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isDataSources && <div className="flex-1" />}

      {/* ── Decorative petal footer ── */}
      <div className="px-4 py-3 border-t border-sakura-100">
        <p className="text-[10px] text-gray-400 flex items-center gap-1">
          <span>🌸</span>
          <span>GraphMeRT · Spring 2025</span>
        </p>
      </div>
    </aside>
  );
}
