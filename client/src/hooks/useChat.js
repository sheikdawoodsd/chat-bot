import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllChats, clearAllLocalChats } from '../services/storage';

export function formatChatTitle(rawTitle = '', workspaceMode = 'general') {
  let title = (rawTitle || '').replace(/^[\p{Emoji}\uFE0F\s]+/u, '').trim();
  if (!title) title = 'New Chat';
  const mode = workspaceMode || 'general';
  if (mode === 'code' && !title.toLowerCase().includes('(code)')) {
    title = `${title} (code)`;
  } else if (mode === 'presentation' && !title.toLowerCase().includes('(presentation)')) {
    title = `${title} (presentation)`;
  } else if (mode === 'image' && !title.toLowerCase().includes('(image)')) {
    title = `${title} (image)`;
  } else if (mode === 'project' && !title.toLowerCase().includes('(project)')) {
    title = `${title} (project)`;
  }
  return title;
}

export function createFreshChat(isTemporary = false, workspaceMode = 'general', projectId = null) {
  const id = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id,
    title: isTemporary ? 'Personalized Chat' : 'New Chat',
    workspaceMode: workspaceMode || 'general',
    projectId: projectId || null,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isFresh: true,
    isTemporary,
  };
}

function isImagePrompt(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  if (t.startsWith('/image')) return true;

  const promptPattern =
    /^(?:(?:can|could)\s+you\s+)?(?:please\s+)?(?:show\s+me\s+)?(?:generate|create|draw|paint|render|make|illustrate|sketch|show)?\s*(?:me\s+an?\s+|an?\s+|the\s+)?(?:image|picture|photo|illustration|drawing|art|graphic|portrait|wallpaper|scene|visual)\s+(?:of|with|showing|depicting|about)?\s*/i;
  const directDrawPattern =
    /^(?:(?:can|could)\s+you\s+)?(?:please\s+)?(?:show\s+me\s+)?(?:draw|paint|illustrate|sketch|render)\s+(?:me\s+an?\s+|an?\s+|the\s+)?/i;

  return promptPattern.test(t) || directDrawPattern.test(t);
}

function extractImagePrompt(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('/image')) {
    return cleaned.replace(/^\/image\s*/i, '').trim();
  }

  if (/^(?:create|generate)\s+image$/i.test(cleaned)) {
    return 'A breathtaking cosmic nebula with a glowing purple planet and crystal stars in deep space, digital art, 4k';
  }

  cleaned = cleaned.replace(
    /^(?:(?:can|could)\s+you\s+)?(?:please\s+)?(?:show\s+me\s+)?(?:generate|create|draw|paint|render|make|illustrate|sketch|show)?\s*(?:me\s+an?\s+|an?\s+|the\s+)?(?:image|picture|photo|illustration|drawing|art|graphic|portrait|wallpaper|scene|visual)?\s*(?:of|with|showing|depicting|about)?\s*/i,
    ''
  );

  return cleaned.trim() || text.trim();
}

export function useChat() {
  // Sidebar list of chats from server
  const [chats, setChats] = useState([]);
  // Currently active chat object (with messages)
  const [activeChat, setActiveChat] = useState(() => createFreshChat(false));
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const savedNormalChatRef = useRef(null);

  const [serverHealth, setServerHealth] = useState({
    status: 'checking',
    hasApiKey: false,
    provider: 'gemini',
    model: 'gemini-3.5-flash',
    imageModel: 'gemini-2.5-flash-image',
  });

  // One-time local chats import state
  const [localChatsToImport, setLocalChatsToImport] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const abortControllerRef = useRef(null);
  const voiceAbortControllerRef = useRef(null);
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;
  const isPersonalizedRef = useRef(isPersonalized);
  isPersonalizedRef.current = isPersonalized;

  // Select an old chat from the sidebar or restore on page reload
  const handleSelectChat = useCallback(async (chatId) => {
    if (isPersonalizedRef.current) return;
    if (activeChatRef.current?.id === chatId && !activeChatRef.current?.isFresh) {
      return;
    }

    try {
      try {
        localStorage.setItem('nova_active_chat_id', chatId);
      } catch {}

      const res = await fetch(`/api/chats/${chatId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.chat) {
          const formattedMessages = (data.chat.messages || []).map((msg) => {
            const hasImageAtt = (msg.attachments || []).find((a) => a.type?.startsWith('image/'));
            return {
              id: msg.id,
              role: msg.role,
              content: msg.content,
              feedback: msg.feedback || null,
              timestamp: msg.timestamp || msg.createdAt,
              // Never leave messages stuck in generating/loading state upon reload
              isGeneratingImage: false,
              attachments: (msg.attachments || []).map((att) => ({
                id: att.id,
                name: att.name,
                type: att.type,
                size: att.size,
                url: att.url,
                dataUrl: att.url,
              })),
              generatedImage:
                msg.role === 'assistant' && hasImageAtt
                  ? {
                      url: hasImageAtt.url,
                      prompt: msg.content || 'Generated Image',
                      geminiPrompt: msg.content || '',
                      geminiUrl: 'https://gemini.google.com/app',
                      mimeType: hasImageAtt.type,
                    }
                  : undefined,
            };
          });

          const chatProjectId = data.chat.projectId || null;
          try {
            if (chatProjectId) {
              localStorage.setItem('nova_active_project_id', chatProjectId);
              localStorage.setItem('nova_active_project_chat_id', data.chat.id);
            } else {
              localStorage.removeItem('nova_active_project_id');
              localStorage.removeItem('nova_active_project_chat_id');
            }
          } catch {}

          setActiveChat({
            id: data.chat.id,
            title: data.chat.title,
            workspaceMode: data.chat.workspaceMode || 'general',
            projectId: chatProjectId,
            messages: formattedMessages,
            createdAt: data.chat.createdAt,
            updatedAt: data.chat.updatedAt,
            isFresh: false,
            isTemporary: false,
          });
        }
      }
    } catch (err) {
      console.error('[Nova Chat] Failed to load chat:', err);
    }
  }, []);

  // Load server-side chats list on mount and restore last active conversation
  const loadServerChats = useCallback(async () => {
    if (isPersonalizedRef.current) return;
    try {
      const res = await fetch('/api/chats', { headers: { 'Cache-Control': 'no-cache' } });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.chats)) {
          const cleaned = data.chats.map((c) => ({
            ...c,
            title: formatChatTitle(c.title, c.workspaceMode),
          }));
          setChats(cleaned);

          // Chat Session & History Rules:
          // 1. General Chat, Image Studio, AI Presentation, Dev Code -> ALWAYS start a brand-new, empty chat on reload/login.
          // 2. Workspace Project (SPECIAL RULE) -> ONLY Workspace projects preserve and restore previous project conversations.
          const isProjectRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/project');
          let savedProjectId = null;
          let savedProjectChatId = null;
          try {
            savedProjectId = localStorage.getItem('nova_active_project_id');
            savedProjectChatId = localStorage.getItem('nova_active_project_chat_id');
          } catch {}

          if (isProjectRoute || savedProjectId) {
            // Find the project's chat to restore
            const projectChat = cleaned.find((c) =>
              (savedProjectChatId && c.id === savedProjectChatId) ||
              (savedProjectId && c.projectId === savedProjectId) ||
              (c.workspaceMode === 'project' && c.projectId)
            );
            if (projectChat) {
              handleSelectChat(projectChat.id);
            }
          }
          // For all other sections (general, image, presentation, code):
          // Leave activeChat as a clean, fresh, empty conversation! Previous chats remain safely listed in sidebar.
        }
      }
    } catch (err) {
      console.warn('[Nova Chat] Failed to load server chats:', err);
    }
  }, [handleSelectChat]);

  // Check if browser has old local chats in IndexedDB/localStorage
  const checkLocalChatsForImport = useCallback(async () => {
    try {
      const local = await getAllChats();
      const validWithMessages = (local || []).filter(
        (c) => c && Array.isArray(c.messages) && c.messages.length > 0
      );
      if (validWithMessages.length > 0) {
        setLocalChatsToImport(validWithMessages);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadServerChats();
    checkLocalChatsForImport();
  }, [loadServerChats, checkLocalChatsForImport]);

  // Check backend health
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setServerHealth(data);
      }
    } catch {
      setServerHealth((prev) => ({ ...prev, status: 'offline' }));
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Clear all chats (PART 3)
  const handleClearAllChats = useCallback(async () => {
    try {
      const res = await fetch('/api/chats', { method: 'DELETE' });
      if (res.ok) {
        setChats([]);
        setActiveChat(createFreshChat(isPersonalizedRef.current));
      }
    } catch (err) {
      console.error('[Nova Chat] Clear all failed:', err);
    }
  }, []);

  // Toggle Personalized (Incognito) Mode (PART 3)
  const togglePersonalized = useCallback(() => {
    if (!isPersonalizedRef.current) {
      // Enter personalized mode
      savedNormalChatRef.current = activeChatRef.current;
      setIsPersonalized(true);
      setActiveChat(createFreshChat(true));
    } else {
      // Exit personalized mode: completely wipe memory chat
      setIsPersonalized(false);
      setActiveChat(savedNormalChatRef.current || createFreshChat(false));
      savedNormalChatRef.current = null;
      loadServerChats();
    }
  }, [loadServerChats]);

  // Execute one-time import of local chats to server
  const handleImportLocalChats = useCallback(async () => {
    if (!localChatsToImport || localChatsToImport.length === 0) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/chats/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chats: localChatsToImport }),
      });
      if (res.ok) {
        await clearAllLocalChats();
        setLocalChatsToImport(null);
        await loadServerChats();
      }
    } catch (err) {
      console.error('[Nova Chat] Import failed:', err);
    } finally {
      setIsImporting(false);
    }
  }, [localChatsToImport, loadServerChats]);

  const handleDismissLocalImport = useCallback(() => {
    clearAllLocalChats();
    setLocalChatsToImport(null);
  }, []);

  // Create a brand new chat (only when user explicitly clicks New Chat)
  const handleNewChat = useCallback((workspaceMode) => {
    const mode = workspaceMode || activeChatRef.current?.workspaceMode || 'general';
    if (activeChatRef.current?.isFresh && activeChatRef.current?.messages?.length === 0 && activeChatRef.current?.workspaceMode === mode) {
      return;
    }
    try {
      localStorage.removeItem('nova_active_chat_id');
    } catch {}
    setActiveChat(createFreshChat(isPersonalizedRef.current, mode));
  }, []);

  // Rename Chat
  const handleRenameChat = useCallback(
    async (id, newTitle) => {
      if (isPersonalizedRef.current) {
        setActiveChat((prev) => ({ ...prev, title: newTitle }));
        return;
      }
      try {
        const res = await fetch(`/api/chats/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
        if (res.ok) {
          setChats((prev) =>
            prev.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
          );
          if (activeChatRef.current?.id === id) {
            setActiveChat((prev) => ({ ...prev, title: newTitle }));
          }
        }
      } catch (err) {
        console.error('[Nova Chat] Rename failed:', err);
      }
    },
    []
  );

  // Delete Chat
  const handleDeleteChat = useCallback(
    async (id) => {
      if (isPersonalizedRef.current) {
        setActiveChat(createFreshChat(true));
        return;
      }
      try {
        const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setChats((prev) => prev.filter((c) => c.id !== id));
          if (activeChatRef.current?.id === id) {
            setActiveChat(createFreshChat(false));
          }
        }
      } catch (err) {
        console.error('[Nova Chat] Delete failed:', err);
      }
    },
    []
  );

  // Handle generating image (PART 5 & Dual Engine)
  const handleGenerateImage = useCallback(
    async (rawPrompt, { aspectRatio = '1:1', style = 'Realistic' } = {}, overrideMessages) => {
      const prompt = extractImagePrompt(rawPrompt);
      const currentChat = activeChatRef.current;
      const isFreshChat = currentChat?.isFresh;
      const isTemp = isPersonalizedRef.current;
      const chatId = currentChat?.id || `chat_${Date.now()}`;

      // Check if there is a previous image for editing context
      let previousImageBase64 = null;
      const currentMessages = overrideMessages || currentChat?.messages || [];
      for (let i = currentMessages.length - 1; i >= 0; i--) {
        const m = currentMessages[i];
        if (m.generatedImage?.url) {
          previousImageBase64 = m.generatedImage.url;
          break;
        }
        const imgAtt = (m.attachments || []).find((a) => a.type?.startsWith('image/'));
        if (imgAtt?.dataUrl || imgAtt?.url) {
          previousImageBase64 = imgAtt.dataUrl || imgAtt.url;
          break;
        }
      }

      const userMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: rawPrompt,
        timestamp: Date.now(),
      };

      const updatedMessagesWithUser = [...currentMessages, userMessage];

      const assistantMessageId = `msg_ai_img_${Date.now()}`;
      const assistantPlaceholder = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isGeneratingImage: true,
        timestamp: Date.now(),
      };

      setActiveChat((prev) => ({
        ...prev,
        title: isFreshChat ? `${prompt.slice(0, 26).trim()} (image)` : prev.title,
        messages: [...updatedMessagesWithUser, assistantPlaceholder],
        isFresh: false,
      }));

      setIsStreaming(true);

      const controller = new AbortController();
      const abortTimeout = setTimeout(() => controller.abort(), 55000);

      try {
        const res = await fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            prompt,
            userMessageId: userMessage.id,
            chatId,
            aspectRatio,
            style,
            previousImageBase64,
            isTemporary: isTemp,
          }),
        });
        clearTimeout(abortTimeout);

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to generate image.');
        }

        const displayUrl = data.fileUrl || data.imageUrl;

        setActiveChat((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  isGeneratingImage: false,
                  content: data.geminiPrompt || data.promptUsed || '',
                  generatedImage: {
                    url: displayUrl,
                    prompt,
                    promptUsed: data.promptUsed,
                    geminiPrompt: data.geminiPrompt,
                    geminiUrl: data.geminiUrl || 'https://gemini.google.com/app',
                    aspectRatio: data.aspectRatio,
                    style: data.style,
                    mimeType: data.mimeType,
                    text: data.text,
                  },
                }
              : m
          ),
          updatedAt: Date.now(),
        }));

        if (!isTemp) {
          setTimeout(() => loadServerChats(), 500);
        }
      } catch (err) {
        clearTimeout(abortTimeout);
        console.error('[Nova Chat] Image generation error:', err);
        const errMsg =
          err.name === 'AbortError'
            ? 'Image generation timed out. The server was busy, please click Retry.'
            : err.message || 'Unable to generate image.';

        setActiveChat((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  isGeneratingImage: false,
                  content: errMsg,
                  isError: true,
                  failedPrompt: prompt,
                  failedOptions: { aspectRatio, style },
                }
              : m
          ),
        }));
      } finally {
        setIsStreaming(false);
      }
    },
    [loadServerChats]
  );

  // Send message and stream response
  const handleSendMessage = useCallback(
    async (payload, overrideMessages) => {
      const text = typeof payload === 'string' ? payload : (payload?.text || payload?.content || '');
      const attachments = payload?.attachments || [];
      const isExplicitImageGen =
        payload?.isImageGen || payload?.isImageMode || payload?.workspaceMode === 'image' || false;
      const workspaceMode = payload?.workspaceMode || 'general';
      const aspectRatio = payload?.aspectRatio || '1:1';
      const style = payload?.style || 'Realistic';

      if (!text && attachments.length === 0) return;
      if (isStreaming) return;

      if (isExplicitImageGen || (attachments.length === 0 && isImagePrompt(text))) {
        return handleGenerateImage(text, { aspectRatio, style }, overrideMessages);
      }

      const currentChat = activeChatRef.current;
      const isFreshChat = currentChat?.isFresh;
      const isTemp = isPersonalizedRef.current;
      const chatId = currentChat?.id || `chat_${Date.now()}`;

      const userTimezone =
        typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

      const userMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: text,
        attachments: attachments.map((att) => ({
          id: att.id || `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: att.name,
          type: att.type,
          size: att.size,
          dataUrl: att.dataUrl,
          url: att.url,
        })),
        timestamp: Date.now(),
      };

      const currentMessages = overrideMessages || currentChat?.messages || [];
      const updatedMessagesWithUser = [...currentMessages, userMessage];

      const assistantMessageId = `msg_ai_${Date.now()}`;
      const assistantPlaceholder = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        sources: [],
        timestamp: Date.now(),
      };

      const rawTitle = isFreshChat
        ? (text || attachments[0]?.name || 'Conversation').slice(0, 32).trim()
        : currentChat?.title;
      const autoTitle = formatChatTitle(rawTitle, workspaceMode);

      setActiveChat((prev) => ({
        ...prev,
        title: autoTitle || prev.title,
        messages: [...updatedMessagesWithUser, assistantPlaceholder],
        isFresh: false,
      }));

      setIsStreaming(true);
      setIsThinking(true);

      // Abort any previous in-flight request to prevent duplicate streams
      if (abortControllerRef.current) {
        try { abortControllerRef.current.abort(); } catch {}
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        let response;
        const rawFiles = attachments.map((a) => a.file).filter(Boolean);

        if (rawFiles.length > 0) {
          const formData = new FormData();
          formData.append('chatId', chatId);
          formData.append('userMessageId', userMessage.id);
          formData.append('isTemporary', isTemp ? 'true' : 'false');
          formData.append('workspaceMode', workspaceMode);
          if (currentChat?.projectId) {
            formData.append('projectId', currentChat.projectId);
          }
          formData.append('userTimezone', userTimezone);
          formData.append(
            'messages',
            JSON.stringify(
              updatedMessagesWithUser.slice(-20).map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                attachments: Array.isArray(m.attachments)
                  ? m.attachments.map((a) => ({
                      id: a.id,
                      name: a.name,
                      type: a.type || a.mimeType,
                      url: a.url,
                      dataUrl: a.dataUrl,
                    }))
                  : [],
              }))
            )
          );

          rawFiles.forEach((file) => {
            formData.append('files', file);
          });

          response = await fetch('/api/chat', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
        } else {
          response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId,
              userMessageId: userMessage.id,
              isTemporary: isTemp,
              workspaceMode,
              projectId: currentChat?.projectId || null,
              userTimezone,
              workspaceMode,
              userTimezone,
              messages: updatedMessagesWithUser.slice(-20).map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                attachments: Array.isArray(m.attachments)
                  ? m.attachments.map((a) => ({
                      id: a.id,
                      name: a.name,
                      type: a.type || a.mimeType,
                      url: a.url,
                      dataUrl: a.dataUrl,
                    }))
                  : [],
              })),
            }),
            signal: controller.signal,
          });
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedContent = '';
        let detectedSources = [];
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'meta') {
                if (event.title && !isTemp) {
                  setActiveChat((prev) => ({ ...prev, title: event.title }));
                }
                if (Array.isArray(event.savedAttachments) && event.savedAttachments.length > 0) {
                  setActiveChat((prev) => ({
                    ...prev,
                    messages: prev.messages.map((m) =>
                      m.id === userMessage.id
                        ? {
                            ...m,
                            attachments: event.savedAttachments.map((sa) => ({
                              id: sa.id,
                              name: sa.name,
                              type: sa.type,
                              size: sa.size,
                              url: sa.url,
                            })),
                          }
                        : m
                    ),
                  }));
                }
              } else if (event.type === 'sources') {
                if (Array.isArray(event.sources)) {
                  detectedSources = event.sources;
                  setActiveChat((prev) => ({
                    ...prev,
                    messages: prev.messages.map((m) =>
                      m.id === assistantMessageId ? { ...m, sources: detectedSources } : m
                    ),
                  }));
                }
              } else if (event.type === 'content') {
                setIsThinking(false);
                accumulatedContent += event.content;

                setActiveChat((prev) => ({
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: accumulatedContent, sources: detectedSources }
                      : m
                  ),
                }));
              } else if (event.type === 'error') {
                throw new Error(event.error || 'Stream error');
              }
            } catch (parseErr) {
              if (parseErr.message !== 'Stream error') {
                console.warn('SSE line parse error:', parseErr);
              } else {
                throw parseErr;
              }
            }
          }
        }

        if (!isTemp) {
          setTimeout(() => loadServerChats(), 500);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('Stream aborted by user');
        } else {
          console.error('[Nova Chat] Send message error:', err);
          setActiveChat((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: m.content || `⚠️ ${err.message || 'Failed to get response.'}`,
                    isError: true,
                  }
                : m
            ),
          }));
        }
      } finally {
        setIsStreaming(false);
        setIsThinking(false);
        abortControllerRef.current = null;
      }
    },
    [handleGenerateImage, isStreaming, loadServerChats]
  );

  // Send voice message for Voice Mode with real-time sentence-by-sentence streaming
  const handleVoiceMessage = useCallback(
    async (spokenText, { onSentenceChunk } = {}) => {
      if (!spokenText?.trim()) return '';

      // Cancel any previous in-flight voice turn to prevent race conditions & hanging
      if (voiceAbortControllerRef.current) {
        try { voiceAbortControllerRef.current.abort(); } catch {}
      }
      const controller = new AbortController();
      voiceAbortControllerRef.current = controller;

      // 22-second watchdog timeout so voice turn NEVER hangs indefinitely
      const timeoutId = setTimeout(() => {
        try { controller.abort(); } catch {}
      }, 22000);

      const currentChat = activeChatRef.current;
      const isFreshChat = currentChat?.isFresh;
      const isTemp = isPersonalizedRef.current;
      const chatId = currentChat?.id || `chat_${Date.now()}`;

      const userTimezone =
        typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

      const userMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: spokenText.trim(),
        timestamp: Date.now(),
      };

      const currentMessages = currentChat?.messages || [];
      const updatedMessagesWithUser = [...currentMessages, userMessage];

      const assistantMessageId = `msg_ai_${Date.now()}`;
      const assistantPlaceholder = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setActiveChat((prev) => ({
        ...prev,
        title: isFreshChat ? formatChatTitle(spokenText.slice(0, 32).trim(), currentChat?.workspaceMode) : prev.title,
        messages: [...updatedMessagesWithUser, assistantPlaceholder],
        isFresh: false,
      }));

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId,
            userMessageId: userMessage.id,
            isVoiceMode: true,
            isTemporary: isTemp,
            workspaceMode: currentChat?.workspaceMode || 'general',
            projectId: currentChat?.projectId || null,
            userTimezone,
            messages: updatedMessagesWithUser.slice(-20).map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              attachments: Array.isArray(m.attachments)
                ? m.attachments.map((a) => ({
                    id: a.id,
                    name: a.name,
                    type: a.type || a.mimeType,
                    url: a.url,
                    dataUrl: a.dataUrl,
                  }))
                : [],
            })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) return "I'm having trouble connecting right now.";

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulated = '';
        let sentenceBuffer = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'content') {
                accumulated += event.content;
                sentenceBuffer += event.content;

                // Protect common abbreviations and decimals from premature sentence splitting
                const safeBuffer = sentenceBuffer
                  .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|vs|etc|e\.g|i\.e|Rs)\./gi, '$1__DOT__')
                  .replace(/(\d+)\.(\d+)/g, '$1__DECIMAL__$2');

                // Split at sentence ending punctuation (. ? !) followed by whitespace
                const boundaryMatch = safeBuffer.match(/^([\s\S]*?[.?!])(?:\s+|$)([\s\S]*)$/);
                if (boundaryMatch) {
                  const completed = boundaryMatch[1]
                    .replace(/__DOT__/g, '.')
                    .replace(/__DECIMAL__/g, '.')
                    .trim();
                  sentenceBuffer = (boundaryMatch[2] || '')
                    .replace(/__DOT__/g, '.')
                    .replace(/__DECIMAL__/g, '.');

                  // Only emit chunk if it has substantive content (at least 3 characters or 1 real word)
                  if (completed && completed.length >= 3 && onSentenceChunk) {
                    onSentenceChunk(completed);
                  }
                }
              }
            } catch {}
          }
        }

        // Flush any trailing sentence text at the end of the stream
        if (sentenceBuffer.trim() && onSentenceChunk) {
          onSentenceChunk(sentenceBuffer.trim());
        }

        // Finalize assistant message in chat state
        if (accumulated) {
          setActiveChat((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantMessageId ? { ...m, content: accumulated } : m
            ),
          }));
        }

        if (!isTemp) {
          setTimeout(() => loadServerChats(), 500);
        }
        return accumulated;
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[Nova Voice] Voice turn aborted or timed out');
        } else {
          console.error('[Nova Chat] Voice turn error:', err);
        }
        return "I'm having trouble processing that voice request. Please try again.";
      } finally {
        clearTimeout(timeoutId);
        if (voiceAbortControllerRef.current === controller) {
          voiceAbortControllerRef.current = null;
        }
      }
    },
    [loadServerChats]
  );

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (voiceAbortControllerRef.current) {
      voiceAbortControllerRef.current.abort();
    }
  }, []);

  const handleRetry = useCallback(() => {
    const messages = activeChatRef.current?.messages || [];
    if (messages.length === 0) return;

    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex === -1) return;

    const lastUserMessage = messages[lastUserIndex];
    const previousMessages = messages.slice(0, lastUserIndex);

    handleSendMessage(
      {
        text: lastUserMessage.content,
        attachments: lastUserMessage.attachments || [],
      },
      previousMessages
    );
  }, [handleSendMessage]);

  const handleRegenerate = useCallback(
    (messageId) => {
      const messages = activeChatRef.current?.messages || [];
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      let userMsgIndex = -1;
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userMsgIndex = i;
          break;
        }
      }
      if (userMsgIndex === -1) return;

      const userMessage = messages[userMsgIndex];
      const contextMessages = messages.slice(0, userMsgIndex);

      handleSendMessage(
        {
          text: userMessage.content,
          attachments: userMessage.attachments || [],
        },
        contextMessages
      );
    },
    [handleSendMessage]
  );

  const handleRegenerateImage = useCallback(
    (prompt) => {
      handleGenerateImage(prompt);
    },
    [handleGenerateImage]
  );

  const handleArchiveChat = useCallback(
    async (chatId) => {
      if (!chatId) return;
      try {
        const res = await fetch(`/api/chats/${chatId}/archive`, {
          method: 'POST',
        });
        const data = await res.json();
        if (data.success) {
          setChats((prev) => prev.filter((c) => c.id !== chatId));
          if (activeChatRef.current?.id === chatId) {
            handleNewChat(activeChatRef.current?.workspaceMode || 'general');
          }
        }
      } catch (err) {
        console.error('[Nova Chat] Archive error:', err);
      }
    },
    [handleNewChat]
  );

  return {
    chats,
    activeChat,
    activeChatId: activeChat?.id,
    isStreaming,
    isThinking,
    isPersonalized,
    togglePersonalized,
    serverHealth,
    localChatsToImport,
    isImporting,
    handleImportLocalChats,
    handleDismissLocalImport,
    setActiveChatId: handleSelectChat,
    setActiveChat,
    createFreshChat,
    handleNewChat,
    handleRenameChat,
    handleDeleteChat,
    handleArchiveChat,
    handleClearAllChats,
    handleSendMessage,
    handleVoiceMessage,
    handleStop,
    handleRetry,
    handleRegenerate,
    handleRegenerateImage,
    checkHealth,
    loadServerChats,
  };
}
