import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Menu,
  Plus,
  ArrowDown,
  Sparkles,
  Loader2,
  X,
  Lock,
  Shield,
  PanelLeftOpen,
  ChevronDown,
  Download,
  Settings,
  Check,
  MessageSquare,
  MessageSquareOff,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/AuthPage';
import { Sidebar, PERSONALIZED_CHAT_LABEL } from './components/Sidebar';
import { MessageBubble } from './components/MessageBubble';
import { MessageInput } from './components/MessageInput';
import { WelcomeScreen } from './components/WelcomeScreen';
import { TypingIndicator } from './components/TypingIndicator';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ThemeToggle } from './components/ThemeToggle';
const VoiceModeOverlay = lazy(() =>
  import('./components/VoiceModeOverlay').then((m) => ({ default: m.VoiceModeOverlay }))
);
import { ImageLightbox } from './components/ImageLightbox';
const ImageStudioWorkspace = lazy(() =>
  import('./components/ImageStudioWorkspace').then((m) => ({ default: m.ImageStudioWorkspace }))
);
import { CosmicBackground } from './components/CosmicBackground';
import { NovaIntro } from './components/NovaIntro';
import { LibraryModal } from './components/LibraryModal';
import { ArchiveModal } from './components/ArchiveModal';
import { ScheduledTasksModal } from './components/ScheduledTasksModal';
import { useChat } from './hooks/useChat';
import { audioPlayer } from './services/audioPlayer';
import { introAudioManager } from './services/introAudioManager';

function LoadingScreen() {
  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#07040D] text-white">
      <div className="relative mb-6">
        <div className="absolute -inset-4 rounded-full bg-purple-600/40 blur-2xl animate-pulse" />
        <img
          src="/logo.png"
          alt="Hi Nova!"
          className="relative w-16 h-16 rounded-full object-cover border-2 border-purple-400/50 shadow-2xl"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-purple-300 font-medium">
        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
        <span>Connecting to Hi Nova!...</span>
      </div>
    </div>
  );
}

function ChatWorkspace({ onReplayIntro }) {
  const { user } = useAuth();
  const {
    chats,
    activeChat,
    activeChatId,
    setActiveChat,
    createFreshChat,
    isStreaming,
    isThinking,
    isPersonalized,
    togglePersonalized,
    serverHealth,
    localChatsToImport,
    isImporting,
    handleImportLocalChats,
    handleDismissLocalImport,
    setActiveChatId,
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
  } = useChat();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nova_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isScheduledModalOpen, setIsScheduledModalOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);

  // Read workspace mode from URL route (/project, /image, /presentation, /code)
  const getWorkspaceFromPath = useCallback(() => {
    if (typeof window === 'undefined') return 'general';
    const path = window.location.pathname.replace(/^\/+/g, '').split('/')[0].toLowerCase();
    if (['project', 'image', 'presentation', 'code'].includes(path)) return path;
    return 'general';
  }, []);

  const [workspaceMode, setWorkspaceMode] = useState(getWorkspaceFromPath);

  // Image Studio specific: Show/Hide Chat Box toggle state (persisted per session)
  const [isImageChatHidden, setIsImageChatHidden] = useState(() => {
    try {
      return sessionStorage.getItem('nova_image_studio_chat_hidden') === 'true';
    } catch {
      return false;
    }
  });

  const toggleImageStudioChat = useCallback(() => {
    setIsImageChatHidden((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('nova_image_studio_chat_hidden', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Persistent mapping of workspace mode -> active chat ID
  const storageKey = `nova_workspace_chats_${user?.id || 'guest'}`;
  const [workspaceChatMap, setWorkspaceChatMap] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // In-memory cache for instantaneous zero-delay switching across tabs
  const workspaceChatCacheRef = useRef({});

  // Keep in-memory cache and map updated as activeChat evolves
  useEffect(() => {
    if (!activeChat) return;
    const mode = activeChat.workspaceMode || workspaceMode || 'general';
    workspaceChatCacheRef.current[mode] = activeChat;
    if (activeChat.id && !activeChat.isFresh) {
      setWorkspaceChatMap((prev) => {
        if (prev[mode] === activeChat.id) return prev;
        const next = { ...prev, [mode]: activeChat.id };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [activeChat, workspaceMode, storageKey]);

  // Select a chat from the sidebar: restores associated workspace mode and active history
  const handleSelectChatFromSidebar = useCallback(
    (chatId) => {
      const targetChat = chats.find((c) => c.id === chatId);
      if (targetChat) {
        const chatMode = targetChat.workspaceMode || 'general';
        if (chatMode !== workspaceMode) {
          setWorkspaceMode(chatMode);
          const targetPath = chatMode === 'general' ? '/' : `/${chatMode}`;
          if (window.location.pathname !== targetPath) {
            window.history.pushState(null, '', targetPath);
          }
        }
        // Save project IDs if it is a project chat, otherwise clear
        try {
          if (targetChat.projectId) {
            localStorage.setItem('nova_active_project_id', targetChat.projectId);
            localStorage.setItem('nova_active_project_chat_id', targetChat.id);
          } else {
            localStorage.removeItem('nova_active_project_id');
            localStorage.removeItem('nova_active_project_chat_id');
          }
        } catch {}
      }
      setActiveChatId(chatId);
    },
    [chats, workspaceMode, setActiveChatId]
  );

  // Sync workspace mode with browser URL back/forward history
  useEffect(() => {
    const handlePopState = () => {
      const targetMode = getWorkspaceFromPath();
      setWorkspaceMode(targetMode);
      if (targetMode === 'project') {
        let savedProjectId = null;
        let savedProjectChatId = null;
        try {
          savedProjectId = localStorage.getItem('nova_active_project_id');
          savedProjectChatId = localStorage.getItem('nova_active_project_chat_id');
        } catch {}
        const projectChat = chats.find(
          (c) =>
            (savedProjectChatId && c.id === savedProjectChatId) ||
            (savedProjectId && c.projectId === savedProjectId) ||
            (c.workspaceMode === 'project' && c.projectId)
        );
        if (projectChat) {
          handleSelectChatFromSidebar(projectChat.id);
          return;
        }
      }
      // For temporary modes: restore cached session chat if present, or create fresh
      const cached = workspaceChatCacheRef.current[targetMode];
      if (cached) {
        setActiveChat(cached);
      } else {
        const fresh = createFreshChat(isPersonalized, targetMode);
        setActiveChat(fresh);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getWorkspaceFromPath, setActiveChat, createFreshChat, isPersonalized, chats, handleSelectChatFromSidebar]);

  // Workspace Switcher:
  // 1. Internal Navigation (Chat, Image Studio, AI Presentation, Dev Code):
  //    Preserve each section's ongoing conversation during internal switching!
  //    If a section hasn't been used yet in this browser session, start with a clean fresh chat.
  // 2. Workspace Project (SPECIAL RULE):
  //    Permanent persistence via SQLite DB and project linking.
  const handleSelectWorkspace = useCallback(
    (targetMode) => {
      // 1. Snapshot the outgoing workspace conversation into cache & session store
      if (activeChat) {
        const currentMode = activeChat.workspaceMode || workspaceMode || 'general';
        workspaceChatCacheRef.current[currentMode] = activeChat;
        try {
          if (currentMode !== 'project') {
            const safeChat = {
              ...activeChat,
              messages: (activeChat.messages || []).map((m) => ({
                ...m,
                attachments: (m.attachments || []).map((a) => {
                  if (a.dataUrl && a.dataUrl.length > 2048) {
                    const { dataUrl, ...rest } = a;
                    return rest;
                  }
                  return a;
                }),
              })),
            };
            sessionStorage.setItem(`nova_session_chat_${currentMode}`, JSON.stringify(safeChat));
          }
        } catch {}
      }

      setWorkspaceMode(targetMode);
      const targetPath = targetMode === 'general' ? '/' : `/${targetMode}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }

      // If switching to Workspace Project: Restore existing project conversation from DB / chats
      if (targetMode === 'project') {
        let savedProjectId = null;
        let savedProjectChatId = null;
        try {
          savedProjectId = localStorage.getItem('nova_active_project_id');
          savedProjectChatId = localStorage.getItem('nova_active_project_chat_id');
        } catch {}

        const projectChat = chats.find(
          (c) =>
            (savedProjectChatId && c.id === savedProjectChatId) ||
            (savedProjectId && c.projectId === savedProjectId) ||
            (c.workspaceMode === 'project' && c.projectId)
        );

        if (projectChat) {
          handleSelectChatFromSidebar(projectChat.id);
        } else {
          const fresh = createFreshChat(isPersonalized, 'project', savedProjectId || null);
          setActiveChat(fresh);
        }
        return;
      }

      // If switching to non-project workspace (chat, image, presentation, code):
      try {
        localStorage.removeItem('nova_active_project_id');
        localStorage.removeItem('nova_active_project_chat_id');
      } catch {}

      // Check in-memory cache first, then sessionStorage
      let cachedChat = workspaceChatCacheRef.current[targetMode];
      if (!cachedChat) {
        try {
          const stored = sessionStorage.getItem(`nova_session_chat_${targetMode}`);
          if (stored) {
            cachedChat = JSON.parse(stored);
            workspaceChatCacheRef.current[targetMode] = cachedChat;
          }
        } catch {}
      }

      if (cachedChat) {
        // Restore active conversation in this section exactly as it was
        setActiveChat(cachedChat);
      } else {
        // First visit in this session: start clean, fresh, empty conversation
        const fresh = createFreshChat(isPersonalized, targetMode);
        workspaceChatCacheRef.current[targetMode] = fresh;
        setActiveChat(fresh);
      }
    },
    [activeChat, workspaceMode, chats, createFreshChat, isPersonalized, setActiveChat, handleSelectChatFromSidebar]
  );

  // Resets / creates new chat within the active workspace
  const handleWorkspaceNewChat = useCallback(() => {
    let projId = null;
    if (workspaceMode === 'project') {
      try {
        projId = activeChat?.projectId || localStorage.getItem('nova_active_project_id');
      } catch {}
    }
    const fresh = createFreshChat(isPersonalized, workspaceMode, projId);
    workspaceChatCacheRef.current[workspaceMode] = fresh;
    try {
      if (workspaceMode !== 'project') {
        sessionStorage.removeItem(`nova_session_chat_${workspaceMode}`);
      }
    } catch {}
    setActiveChat(fresh);
  }, [createFreshChat, isPersonalized, workspaceMode, activeChat?.projectId, setActiveChat]);

  // Create a fresh project-linked chat in the sidebar
  const handleCreateProjectChat = useCallback(
    (projectId, projectName) => {
      const fresh = createFreshChat(isPersonalized, 'project', projectId);
      fresh.projectId = projectId;
      fresh.title = `${projectName} (project)`;
      setWorkspaceMode('project');
      const targetPath = '/project';
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
      try {
        localStorage.setItem('nova_active_project_id', projectId);
        localStorage.setItem('nova_active_project_chat_id', fresh.id);
      } catch {}
      setActiveChat(fresh);
    },
    [createFreshChat, isPersonalized, setActiveChat]
  );

  // Listen for global custom event 'nova:send-prompt' (used by CodeBlock Auto-Fix and Presentation Assistant)
  useEffect(() => {
    const handleCustomPrompt = (event) => {
      const prompt = event.detail?.prompt;
      if (prompt && typeof handleSendMessage === 'function') {
        handleSendMessage({ text: prompt });
      }
    };
    window.addEventListener('nova:send-prompt', handleCustomPrompt);
    return () => window.removeEventListener('nova:send-prompt', handleCustomPrompt);
  }, [handleSendMessage]);

  // Model Selection Dropdown (Zyricon Top Bar)
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef(null);

  const availableModels = [
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', badge: 'Default' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', badge: 'Speed' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', badge: 'Deep' },
    { id: 'gpt-4o-mini', name: 'OpenAI GPT-4o Mini', badge: 'Multi' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', badge: 'Code' },
  ];

  // Close model dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setIsModelDropdownOpen(false);
      }
    }
    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelDropdownOpen]);

  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isUserScrolledUpRef = useRef(false);

  // Toggle sidebar collapse and persist
  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nova_sidebar_collapsed', next.toString());
      } catch {}
      return next;
    });
  };

  // Keyboard shortcuts: Ctrl/Cmd+B (toggle sidebar)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (container) {
      if (behavior === 'auto') {
        container.scrollTop = container.scrollHeight;
      } else {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    const isScrolledUp = distanceToBottom > 150;
    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollBottom(isScrolledUp);
  };

  // Immediate auto-scroll when user submits a prompt via Enter or Send button
  const handleUserSendMessage = useCallback(
    (payload) => {
      // 1. Instantly unflag user scrolled up & hide floating scroll button
      isUserScrolledUpRef.current = false;
      setShowScrollBottom(false);

      // 2. Immediate scroll to bottom
      scrollToBottom('smooth');

      // 3. Smooth follow-up ticks as DOM mounts new user prompt and response placeholder
      requestAnimationFrame(() => scrollToBottom('smooth'));
      setTimeout(() => scrollToBottom('smooth'), 50);
      setTimeout(() => scrollToBottom('smooth'), 180);

      // 4. Send message with current workspace mode
      const augmented = {
        ...payload,
        workspaceMode: activeChat?.workspaceMode || workspaceMode || 'general',
      };
      handleSendMessage(augmented);
    },
    [activeChat?.workspaceMode, workspaceMode, handleSendMessage, scrollToBottom]
  );

  // Auto-scroll down while thinking or streaming response tokens
  useEffect(() => {
    if (!isUserScrolledUpRef.current) {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [activeChat?.messages, isThinking, isStreaming]);

  // When switching chats, reset scroll position
  useEffect(() => {
    isUserScrolledUpRef.current = false;
    setShowScrollBottom(false);
    scrollToBottom('auto');
  }, [activeChatId, scrollToBottom]);

  // Export current conversation to Markdown file (Zyricon Header: Export button)
  const handleExportChat = () => {
    const msgs = activeChat?.messages || [];
    if (msgs.length === 0) {
      alert('This conversation is empty. Send a message first to export.');
      return;
    }

    const title = activeChat?.title || 'Hi Nova Conversation';
    let md = `# ${title}\n\n*Exported from Hi Nova! on ${new Date().toLocaleString()}*\n\n---\n\n`;

    for (const msg of msgs) {
      const sender = msg.role === 'user' ? '👤 **You**' : '✨ **Nova**';
      md += `### ${sender}\n\n${msg.content || ''}\n\n`;
      if (msg.generatedImage?.url) {
        md += `![Generated Image](${msg.generatedImage.url})\n\n`;
      }
      md += `---\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]/gi, '_').slice(0, 28)}_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const messages = activeChat?.messages || [];
  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden text-[#F3F4F6] relative transition-colors bg-[#080512]">
      {/* Animated Purple Cosmic Silk Waves Background (Image 1) */}
      <CosmicBackground />

      {/* Sidebar Navigation (Zyricon Layout Adaptation) */}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChatFromSidebar}
        onNewChat={handleWorkspaceNewChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onClearAllChats={handleClearAllChats}
        onArchiveChat={handleArchiveChat}
        onOpenArchive={() => setIsArchiveModalOpen(true)}
        onOpenScheduled={() => setIsScheduledModalOpen(true)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isPersonalized={isPersonalized}
        onTogglePersonalized={togglePersonalized}
        onReplayIntro={onReplayIntro}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateProjectChat={handleCreateProjectChat}
      />

      {/* Main Content Column */}
      <div
        className={`flex-1 flex flex-col h-full min-w-0 transition-all duration-300 relative z-10 ${
          isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72'
        }`}
      >
        {/* Top Navbar (Zyricon Layout: Model selector dropdown + Configuration + Export) */}
        <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-purple-500/20 backdrop-blur-md bg-[#0B0716]/80 z-30 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop expand toggle */}
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={handleToggleCollapse}
                className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-purple-400 hover:bg-white/5 transition-colors"
                title="Expand sidebar (Ctrl+B)"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {/* Zyricon Model Selector Dropdown */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#160E28] hover:bg-[#1E1436] border border-purple-500/30 text-xs font-semibold text-zinc-200 hover:text-white shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  {availableModels.find((m) => m.id === selectedModel)?.name || 'Gemini 3.5 Flash'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {/* Model Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="absolute top-10 left-0 z-50 w-56 py-1.5 rounded-2xl bg-[#160E28] border border-purple-500/30 shadow-2xl purple-glow text-xs space-y-0.5 animate-scale-in">
                  {availableModels.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-zinc-200 hover:bg-purple-900/40 hover:text-purple-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {selectedModel === m.id ? (
                          <Check className="w-3.5 h-3.5 text-purple-400" />
                        ) : (
                          <span className="w-3.5 h-3.5" />
                        )}
                        <span className="font-medium">{m.name}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">{m.badge}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Workspace Tag or Private Mode Pill */}
            {workspaceMode !== 'general' && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 capitalize">
                <span>{workspaceMode} Workspace</span>
              </span>
            )}

            {/* Image Studio Show/Hide Chat Toggle (ONLY inside Image Studio) */}
            {workspaceMode === 'image' && (
              <button
                type="button"
                onClick={toggleImageStudioChat}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all shadow-sm active:scale-95 ${
                  isImageChatHidden
                    ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                    : 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border-purple-500/35'
                }`}
                title={isImageChatHidden ? 'Show Image Studio Chat Box' : 'Hide Chat Box to expand image workspace'}
              >
                {isImageChatHidden ? (
                  <>
                    <MessageSquare className="w-3.5 h-3.5 text-white" />
                    <span>Show Chat</span>
                  </>
                ) : (
                  <>
                    <MessageSquareOff className="w-3.5 h-3.5 text-purple-300" />
                    <span>Hide Chat</span>
                  </>
                )}
              </button>
            )}

            {isPersonalized && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Lock className="w-3 h-3 text-purple-400" />
                <span>Private Mode</span>
              </span>
            )}
          </div>

          {/* Right Header Controls (Zyricon Header: Configuration & Export buttons) */}
          <div className="flex items-center gap-2">
            {/* Configuration Button */}
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#160E28] hover:bg-[#1E1436] text-zinc-300 hover:text-white border border-purple-500/30 transition-colors shadow-xs"
              title="Configuration & API Key"
            >
              <Settings className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Configuration</span>
            </button>

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExportChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#160E28] hover:bg-[#1E1436] text-zinc-300 hover:text-white border border-purple-500/30 transition-colors shadow-xs"
              title="Export conversation to Markdown"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWorkspaceMode('general');
                handleNewChat();
              }}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>

            <ThemeToggle />
          </div>
        </header>

        {/* Personalized Mode Sticky Banner */}
        {isPersonalized && (
          <div className="bg-gradient-to-r from-purple-950/60 via-purple-900/40 to-purple-950/60 border-b border-purple-500/20 px-4 py-2 flex items-center justify-between text-xs text-purple-200">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                <strong>{PERSONALIZED_CHAT_LABEL} space:</strong> This chat is private. It won&apos;t be saved to history.
              </span>
            </div>
            <button
              type="button"
              onClick={togglePersonalized}
              className="text-xs font-semibold underline hover:no-underline text-purple-300 ml-2 shrink-0"
            >
              Exit
            </button>
          </div>
        )}

        {/* Local Chats One-Time Import Banner */}
        {!isPersonalized && localChatsToImport && localChatsToImport.length > 0 && (
          <div className="bg-gradient-to-r from-purple-500/15 via-indigo-500/15 to-purple-500/15 border-b border-purple-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-purple-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                Found <strong>{localChatsToImport.length}</strong> previous chats in your browser. Import them into your account?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleImportLocalChats}
                disabled={isImporting}
                className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-xs"
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
              <button
                type="button"
                onClick={handleDismissLocalImport}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Missing API Key Warning */}
        {!serverHealth.hasApiKey && (
          <div className="bg-amber-500/10 border-b border-amber-500/25 px-4 py-2 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <span className="font-bold">Notice:</span>
              <span>Gemini API key is not configured in server/.env.</span>
            </div>
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="font-semibold underline hover:no-underline ml-2 shrink-0"
            >
              Setup Guide →
            </button>
          </div>
        )}

        {/* Image Studio Expanded Workspace (When user selects 'Hide Chat') */}
        {workspaceMode === 'image' && isImageChatHidden ? (
          <Suspense fallback={null}>
          <ImageStudioWorkspace
            messages={messages}
            isStreaming={isStreaming}
            onSendImagePrompt={handleUserSendMessage}
            onRegenerateImage={handleRegenerateImage}
            onEnlargeImage={(img) => setActiveLightboxImage(img)}
            isChatHidden={true}
            onToggleChat={toggleImageStudioChat}
          />
          </Suspense>
        ) : (
          <>
            {/* Center Messages / Welcome Area */}
            <main
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto relative flex flex-col"
            >
              {!hasMessages ? (
                <WelcomeScreen workspaceMode={workspaceMode} />
              ) : (
                <div className="flex-1 py-4">
                  {messages.map((message, index) => {
                    const isLast = index === messages.length - 1;
                    const isMsgStreaming = isLast && isStreaming && message.role === 'assistant';

                    return (
                      <MessageBubble
                        key={message.id || index}
                        message={message}
                        isStreaming={isMsgStreaming}
                        onRetry={message.isError ? handleRetry : undefined}
                        onRegenerate={
                          !isStreaming && message.role === 'assistant'
                            ? () => handleRegenerate(message.id)
                            : undefined
                        }
                        onRegenerateImage={handleRegenerateImage}
                        onEnlargeImage={(img) => setActiveLightboxImage(img)}
                      />
                    );
                  })}

                  {isThinking && <TypingIndicator />}
                  <div ref={messagesEndRef} className="h-4" />
                </div>
              )}

              {/* Floating Scroll to Bottom button */}
              {showScrollBottom && (
                <button
                  type="button"
                  onClick={() => {
                    isUserScrolledUpRef.current = false;
                    scrollToBottom('smooth');
                  }}
                  className="fixed bottom-24 right-6 z-20 p-2.5 rounded-full bg-[#18112C] text-purple-300 border border-purple-500/30 shadow-xl purple-glow-sm hover:scale-105 transition-all animate-bounce"
                  title="Scroll to bottom"
                  aria-label="Scroll to bottom"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}
            </main>

            {/* Bottom Input Area with Image 1 Cosmic Dual Glow & Image 3 Glowing Send Button */}
            <footer className="shrink-0 bg-transparent">
              <MessageInput
                onSend={handleUserSendMessage}
                onStop={handleStop}
                onOpenVoiceMode={() => {
                  audioPlayer.unlockAudio();
                  setIsVoiceModeOpen(true);
                }}
                isStreaming={isStreaming}
                workspaceMode={workspaceMode}
                onSelectWorkspaceMode={handleSelectWorkspace}
              />
            </footer>
          </>
        )}
      </div>

      {/* Setup Guide Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => {
          setIsApiKeyModalOpen(false);
          checkHealth();
        }}
      />

      {/* Cosmic Library Modal (Features -> Library) */}
      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        chats={chats}
        onSelectPrompt={(p) => {
          setIsLibraryOpen(false);
          handleSendMessage(p);
        }}
        onEnlargeImage={(img) => setActiveLightboxImage(img)}
      />

      {/* Real Database Archive Management Modal (Section 3) */}
      <ArchiveModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onSelectChat={(chatId) => {
          handleSelectChatFromSidebar(chatId);
          setIsArchiveModalOpen(false);
        }}
        onChatRestored={() => {
          loadServerChats();
        }}
      />

      {/* Real Database Scheduled Tasks Modal (Image 3 / Section 4) */}
      <ScheduledTasksModal
        isOpen={isScheduledModalOpen}
        onClose={() => setIsScheduledModalOpen(false)}
      />

      {/* Redesigned Glassmorphism Voice Assistant Overlay (Image 2) */}
      {isVoiceModeOpen && (
        <Suspense fallback={null}>
          <VoiceModeOverlay
            isOpen={isVoiceModeOpen}
            onClose={() => setIsVoiceModeOpen(false)}
            onSendVoiceMessage={handleVoiceMessage}
          />
        </Suspense>
      )}

      {/* Image Lightbox Modal */}
      <ImageLightbox
        image={activeLightboxImage}
        onClose={() => setActiveLightboxImage(null)}
      />
    </div>
  );
}

function AuthenticatedApp() {
  const { user, isLoading, isJustRegistered, markIntroSeen } = useAuth();
  const [isReplayingIntro, setIsReplayingIntro] = useState(false);
  // replayKey forces a full NovaIntro remount (fresh audio + state) each time
  const [replayKey, setReplayKey] = useState(0);

  // Intro plays after every explicit login or signup (and on manual replay),
  // but NOT when an existing session is silently restored on page refresh.
  const showIntro = isReplayingIntro || Boolean(isJustRegistered);

  const handleCompleteIntro = () => {
    setIsReplayingIntro(false);
    markIntroSeen?.();
  };

  const handleReplayIntro = () => {
    introAudioManager.startReplayAudio();
    setReplayKey((k) => k + 1); // Increment key → forces NovaIntro to fully remount
    setIsReplayingIntro(true);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <>
      {showIntro && <NovaIntro key={replayKey} onComplete={handleCompleteIntro} />}
      <ChatWorkspace onReplayIntro={handleReplayIntro} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
