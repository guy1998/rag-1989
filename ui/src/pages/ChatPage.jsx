import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Sparkles } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import { useChats } from '../hooks/useChats';
import { fetchModels, generateStream } from '../services/api';

// ── Welcome screen shown when no chat is selected ──────────────────────────
function WelcomeScreen({ models, selectedModel, onModelChange }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
      {/* Decorative sakura */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sakura-100 to-sky-100 flex items-center justify-center shadow-sakura-lg">
          <Sparkles size={32} className="text-sakura-400" />
        </div>
        {/* Floating petals */}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute text-lg"
            style={{
              top:  `${[-18, -10, -20][i]}px`,
              left: `${[64, -14, 28][i]}px`,
              animation: `petal-fall ${2.5 + i * 0.7}s ease-in ${i * 0.8}s infinite`,
              opacity: 0.7,
            }}
          >
            🌸
          </span>
        ))}
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Welcome to Hanami</h1>
        <p className="text-gray-500 mt-2 text-sm max-w-sm leading-relaxed">
          Ask questions about your documents. Select a data source below, then start a conversation.
        </p>
      </div>

      {/* Quick model selector */}
      {models.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Choose a data source</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => onModelChange(m.name)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
                  ${selectedModel === m.name
                    ? 'bg-sakura-200 border-sakura-300 text-sakura-700'
                    : 'bg-white border-sakura-200 text-gray-600 hover:bg-sakura-50 hover:border-sakura-300'
                  }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {models.length === 0 && (
        <div className="text-sm text-gray-400 bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100">
          No data sources yet.{' '}
          <a href="/data-sources" className="text-sakura-500 underline">Create one →</a>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { chatId } = useParams();
  const navigate   = useNavigate();
  const { chats, createChat, addMessage, updateLastMessage, deleteChat, getChat } = useChats();

  const [models,        setModels]   = useState([]);
  const [selectedModel, setModel]    = useState(() => localStorage.getItem('hanami_model') || '');
  const [streaming,     setStreaming] = useState(false);
  const [error,         setError]    = useState('');

  const bottomRef  = useRef(null);
  const abortRef   = useRef(null);

  const activeChat = chatId ? getChat(chatId) : null;

  // Load models
  useEffect(() => {
    fetchModels()
      .then(({ models: ms }) => {
        setModels(ms || []);
        if (!selectedModel && ms?.length) {
          setModel(ms[0].name);
          localStorage.setItem('hanami_model', ms[0].name);
        }
      })
      .catch(() => {});
  }, []);

  // Persist selected model
  const handleModelChange = useCallback((name) => {
    setModel(name);
    localStorage.setItem('hanami_model', name);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages?.length, streaming]);

  async function handleSend(text) {
    if (!selectedModel) return;
    setError('');

    let currentChatId = chatId;

    // Create a new chat if needed
    if (!currentChatId) {
      const newChat = createChat(selectedModel);
      currentChatId = newChat.id;
      navigate(`/chat/${newChat.id}`, { replace: true });
      // Give React one tick to re-render before proceeding
      await new Promise((r) => setTimeout(r, 0));
    }

    // User message
    addMessage(currentChatId, { content: text, isUser: true });

    // Placeholder AI message (empty, will be streamed into)
    addMessage(currentChatId, { content: '', isUser: false });

    setStreaming(true);
    let accumulated = '';

    abortRef.current = generateStream({
      modelName: selectedModel,
      question:  text,
      onChunk: (chunk) => {
        accumulated += chunk;
        updateLastMessage(currentChatId, accumulated);
      },
      onDone: () => {
        setStreaming(false);
        abortRef.current = null;
      },
      onError: (msg) => {
        setError(msg);
        updateLastMessage(currentChatId, `⚠ Error: ${msg}`);
        setStreaming(false);
        abortRef.current = null;
      },
    });
  }

  // Cleanup on unmount
  useEffect(() => () => abortRef.current?.(), []);

  const messages = activeChat?.messages ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        chats={chats}
        activeChatId={chatId}
        onNewChat={() => navigate('/chat')}
        onDeleteChat={deleteChat}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3.5 border-b border-sakura-100 bg-white/90 backdrop-blur-sm shrink-0">
          <h2 className="text-sm font-medium text-gray-700">
            {activeChat ? activeChat.title : 'New conversation'}
          </h2>
          {activeChat?.modelName && (
            <span className="text-[11px] font-medium text-sakura-400 bg-sakura-50 border border-sakura-200 rounded-full px-3 py-1">
              {activeChat.modelName}
            </span>
          )}
        </header>

        {/* Messages or welcome */}
        {!activeChat ? (
          <WelcomeScreen
            models={models}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 flex flex-col gap-5">
            {messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;
              const isStreamingMsg = isLast && streaming && !msg.isUser;
              return (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreamingMsg}
                />
              );
            })}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 rounded-2xl px-4 py-3 border border-red-100 animate-fade-in">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          loading={streaming}
          disabled={streaming}
          models={models}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
        />
      </main>
    </div>
  );
}
