import { useState, useCallback } from 'react';

const STORAGE_KEY = 'hanami_chats_v1';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(chats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch {
    // storage full – fail silently
  }
}

export function useChats() {
  const [chats, setChats] = useState(load);

  const createChat = useCallback((modelName) => {
    const chat = {
      id: crypto.randomUUID(),
      title: 'New conversation',
      modelName,
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setChats((prev) => {
      const next = [chat, ...prev];
      persist(next);
      return next;
    });
    return chat;
  }, []);

  /**
   * Append a message to an existing chat.
   * If isUser === true and the chat title is still the default, set it to the
   * first 50 chars of the content.
   */
  const addMessage = useCallback((chatId, { content, isUser }) => {
    const msg = {
      id: crypto.randomUUID(),
      content,
      isUser,
      timestamp: new Date().toISOString(),
    };
    setChats((prev) => {
      const next = prev.map((c) => {
        if (c.id !== chatId) return c;
        const title =
          isUser && c.title === 'New conversation'
            ? content.slice(0, 50)
            : c.title;
        return { ...c, title, messages: [...c.messages, msg] };
      });
      persist(next);
      return next;
    });
    return msg.id;
  }, []);

  /**
   * Replace the content of the last message in a chat (used while streaming).
   */
  const updateLastMessage = useCallback((chatId, content) => {
    setChats((prev) => {
      const next = prev.map((c) => {
        if (c.id !== chatId) return c;
        if (!c.messages.length) return c;
        const messages = [...c.messages];
        messages[messages.length - 1] = { ...messages[messages.length - 1], content };
        return { ...c, messages };
      });
      persist(next);
      return next;
    });
  }, []);

  const deleteChat = useCallback((chatId) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== chatId);
      persist(next);
      return next;
    });
  }, []);

  const getChat = useCallback(
    (chatId) => chats.find((c) => c.id === chatId) ?? null,
    [chats],
  );

  return { chats, createChat, addMessage, updateLastMessage, deleteChat, getChat };
}
