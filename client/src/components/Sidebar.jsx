import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  XCircle,
  Search,
  MoreVertical,
  User,
  LogOut,
  SunMoon,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  Sparkles,
  Archive,
  Clock,
  BookMarked,
  FolderPlus,
  Image as ImageIcon,
  Presentation,
  Code2,
  PlayCircle,
  Folder,
  ChevronDown,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { ProfileModal } from './ProfileModal';
import { DeleteAccountModal } from './DeleteAccountModal';
import { ClearChatsModal } from './ClearChatsModal';
import { UserAvatar } from './UserAvatar';
import { introAudioManager } from '../services/introAudioManager';

export const PERSONALIZED_CHAT_LABEL = 'Personalized';

export function cleanTitle(raw = '', workspaceMode = 'general') {
  if (!raw) return 'Untitled Chat';
  // Strip ALL emojis anywhere in the string (leading, middle, trailing)
  let text = raw
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Format with module tag if not present
  const mode = workspaceMode || 'general';
  if (mode === 'code' && !text.toLowerCase().includes('(code)')) {
    text = `${text} (code)`;
  } else if (mode === 'presentation' && !text.toLowerCase().includes('(presentation)')) {
    text = `${text} (presentation)`;
  } else if (mode === 'image' && !text.toLowerCase().includes('(image)')) {
    text = `${text} (image)`;
  } else if (mode === 'project' && !text.toLowerCase().includes('(project)')) {
    text = `${text} (project)`;
  }
  return text || 'Chat';
}

function categorizeChats(chats = []) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfLast7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const groups = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  };

  for (const chat of chats) {
    const timestamp = chat.updatedAt || chat.createdAt || 0;
    if (timestamp >= startOfToday) {
      groups.today.push(chat);
    } else if (timestamp >= startOfYesterday) {
      groups.yesterday.push(chat);
    } else if (timestamp >= startOfLast7Days) {
      groups.previous7Days.push(chat);
    } else {
      groups.older.push(chat);
    }
  }

  return groups;
}

export function Sidebar({
  chats = [],
  activeChatId,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  onClearAllChats,
  onArchiveChat,
  onOpenArchive,
  onOpenScheduled,
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  isPersonalized = false,
  onTogglePersonalized,
  onPersonalizedToggle,
  onReplayIntro,
  onOpenLibrary,
  onSelectWorkspace,
  onCreateProjectChat,
}) {
  const { user, logout } = useAuth();
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Projects state
  const [projects, setProjects] = useState([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [expandedProjects, setExpandedProjects] = useState({});

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.projects)) {
          setProjects(data.projects);
          setExpandedProjects((prev) => {
            const next = { ...prev };
            data.projects.forEach((p) => {
              if (next[p.id] === undefined) next[p.id] = true;
            });
            return next;
          });
        }
      }
    } catch (err) {
      console.warn('[Nova Projects] Load error:', err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async (e) => {
    e?.preventDefault();
    if (!newProjectName.trim()) return;
    const name = newProjectName.trim();
    setNewProjectName('');
    setIsCreatingProject(false);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.project) {
          setProjects((prev) => [data.project, ...prev.filter((p) => p.id !== data.project.id)]);
          setExpandedProjects((prev) => ({ ...prev, [data.project.id]: true }));
          if (onCreateProjectChat) {
            onCreateProjectChat(data.project.id, data.project.name);
          } else {
            onNewChat?.();
          }
        }
      }
    } catch (err) {
      console.error('[Nova Projects] Create failed:', err);
    }
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('[Nova Projects] Delete error:', err);
    }
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);

  // Profile menu popup
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isClearChatsOpen, setIsClearChatsOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false);
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  // Debounced server search for chat titles + message contents
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/chats/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json().catch(() => ({}));
        if (data.success && Array.isArray(data.results)) {
          setSearchResults(data.results);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.warn('[Nova Search] Error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Group normal chats (excluding chats grouped into dedicated projects)
  const groupedChats = useMemo(() => {
    const nonProjectChats = (chats || []).filter((c) => !c.projectId);
    return categorizeChats(nonProjectChats);
  }, [chats]);

  const startEditing = (chat, e) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditingTitle(chat.title);
  };

  const saveEditing = (id, e) => {
    e?.stopPropagation();
    if (editingTitle.trim()) {
      onRenameChat(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const handleKeyDown = (id, e) => {
    if (e.key === 'Enter') {
      saveEditing(id, e);
    } else if (e.key === 'Escape') {
      cancelEditing(e);
    }
  };

  // Render a chat group
  const renderChatGroup = (title, items) => {
    if (!items || items.length === 0) return null;

    return (
      <div key={title} className="mb-2">
        <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          {title}
        </div>
        <div className="space-y-0.5">
          {items.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isEditing = chat.id === editingId;
            const isDeleting = chat.id === confirmDeleteId;

            return (
              <div
                key={chat.id}
                onClick={() => {
                  if (!isEditing && !isDeleting) {
                    onSelectChat(chat.id);
                    onClose?.();
                  }
                }}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                  isActive
                    ? 'bg-purple-600/20 text-purple-200 font-medium border border-purple-500/30 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1230]/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-purple-400' : 'text-zinc-500 group-hover:text-zinc-400'
                    }`}
                  />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(chat.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="w-full bg-[#18112C] border border-purple-500 px-1.5 py-0.5 rounded text-xs text-white focus:outline-none"
                    />
                  ) : (
                    <span className="truncate">{cleanTitle(chat.title, chat.workspaceMode)}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => saveEditing(chat.id, e)}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        title="Save title"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="p-1 text-zinc-400 hover:text-zinc-200"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : isDeleting ? (
                    <div
                      className="flex items-center gap-1 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-900"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[10px] text-rose-400 font-medium">Delete?</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat(chat.id);
                          setConfirmDeleteId(null);
                        }}
                        className="p-0.5 text-rose-400 hover:text-rose-300"
                        title="Confirm"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="p-0.5 text-zinc-400 hover:text-zinc-200"
                        title="Cancel"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchiveChat?.(chat.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-purple-300 rounded"
                        title="Archive conversation"
                      >
                        <Archive className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => startEditing(chat, e)}
                        className="p-1 text-zinc-500 hover:text-zinc-300 rounded"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(chat.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-rose-400 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Slim Rail View on Desktop
  if (isCollapsed) {
    return (
      <aside className="hidden lg:flex fixed top-0 bottom-0 left-0 z-40 w-16 bg-[#0A0714] border-r border-purple-500/20 flex-col items-center py-4 justify-between transition-all duration-300 select-none">
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 rounded-xl text-zinc-400 hover:text-purple-400 hover:bg-[#1A1230] transition-colors"
            title="Expand sidebar (Ctrl+B)"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onNewChat}
            className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md hover:scale-105 active:scale-95 transition-all"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleCollapse?.();
              setTimeout(() => searchInputRef.current?.focus(), 150);
            }}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1A1230] transition-colors"
            title="Search chats (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* User Avatar */}
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="w-9 h-9 flex items-center justify-center hover:ring-2 hover:ring-purple-400/50 transition-all rounded-full"
            title={user?.fullName || 'Account menu'}
          >
            <UserAvatar user={user} className="w-9 h-9" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#0B0716] border-r border-purple-500/20 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header & Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-purple-500/20">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 purple-glow-sm">
              <img
                src="/logo.png"
                alt="Nova"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white leading-none tracking-tight">
                Nova AI
              </h1>
              <span className="text-[10px] text-purple-400 font-medium">
                Cosmic Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse Toggle icon */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Collapse sidebar (Ctrl+B)"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose?.();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#1A1230] hover:bg-[#221740] border border-purple-500/30 text-white font-semibold text-xs shadow-md transition-all active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 text-purple-400" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Scrollable Center Section */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-3 custom-scrollbar">
          {/* Section 1: Features */}
          <div>
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Features
            </div>
            <div className="space-y-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => {
                  onSelectWorkspace?.('general');
                  onClose?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-[#1A1230]/60 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenArchive?.()}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1230]/60 transition-colors"
              >
                <Archive className="w-3.5 h-3.5 text-purple-400" />
                <span>Archived</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenScheduled?.()}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1230]/60 transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>Scheduled</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenLibrary?.()}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1230]/60 transition-colors"
              >
                <BookMarked className="w-3.5 h-3.5 text-purple-400" />
                <span>Library</span>
              </button>
            </div>
          </div>

          {/* Section 2: Workspaces */}
          <div>
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Workspaces
            </div>
            <div className="space-y-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingProject(true);
                  onSelectWorkspace?.('project');
                  onClose?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1230]/60 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
                <span>New Project</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectWorkspace?.('image');
                  onClose?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1230]/60 transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
                <span>Image Studio</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectWorkspace?.('presentation');
                  onClose?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1230]/60 transition-colors"
              >
                <Presentation className="w-3.5 h-3.5 text-amber-400" />
                <span>AI Presentation</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectWorkspace?.('code');
                  onClose?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1230]/60 transition-colors"
              >
                <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dev Code</span>
              </button>
            </div>
          </div>

          {/* ChatGPT-Style Projects Section (Reference Image 2) */}
          <div className="pt-1">
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Projects</span>
              <button
                type="button"
                onClick={() => setIsCreatingProject((v) => !v)}
                className="p-1 rounded text-purple-400 hover:text-purple-200 hover:bg-purple-500/10 transition-colors flex items-center gap-1 text-[10px] font-medium"
                title="Add new project"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Project</span>
              </button>
            </div>

            {/* Inline Add Project Input */}
            {isCreatingProject && (
              <form onSubmit={handleCreateProject} className="px-3 py-1.5 flex items-center gap-1.5 animate-scale-in">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name (e.g. to do list)..."
                  autoFocus
                  className="flex-1 bg-[#1A1230] border border-purple-500/40 rounded-lg px-2 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="p-1 text-emerald-400 hover:text-emerald-300 rounded"
                  title="Create project"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingProject(false);
                    setNewProjectName('');
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-200"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {/* List of Projects (Reference Image 2: 📁 folder with nested chats) */}
            <div className="space-y-1 mt-1">
              {projects.map((project) => {
                const isExpanded = expandedProjects[project.id] !== false;
                const projectChats = (chats || []).filter((c) => c.projectId === project.id);

                return (
                  <div
                    key={project.id}
                    className="rounded-xl overflow-hidden bg-[#130D26]/40 border border-purple-500/15"
                  >
                    {/* Project Header Row */}
                    <div
                      onClick={() => {
                        setExpandedProjects((prev) => ({ ...prev, [project.id]: true }));
                        if (projectChats.length > 0) {
                          onSelectChat(projectChats[0].id);
                          onClose?.();
                        } else if (onCreateProjectChat) {
                          onCreateProjectChat(project.id, project.name);
                          onClose?.();
                        }
                      }}
                      className="group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#1A1230]/70 text-zinc-300 hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-xs font-medium truncate">{project.name}</span>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (onCreateProjectChat) {
                              onCreateProjectChat(project.id, project.name);
                            } else {
                              onNewChat?.();
                            }
                            onClose?.();
                          }}
                          className="p-1 text-zinc-400 hover:text-purple-300 rounded"
                          title={`New chat in ${project.name}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="p-1 text-zinc-500 hover:text-rose-400 rounded"
                          title="Delete project"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Child chats belonging to project (Reference Image 2) */}
                    {isExpanded && (
                      <div className="pl-6 pr-2 pb-1.5 space-y-0.5 border-t border-purple-500/10">
                        {projectChats.length === 0 ? (
                          <div
                            onClick={() => {
                              if (onCreateProjectChat) {
                                onCreateProjectChat(project.id, project.name);
                              } else {
                                onNewChat?.();
                              }
                              onClose?.();
                            }}
                            className="px-2 py-1.5 text-[11px] text-zinc-500 hover:text-purple-300 cursor-pointer flex items-center gap-1 italic"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Start chat in this project</span>
                          </div>
                        ) : (
                          projectChats.map((c) => {
                            const isActive = c.id === activeChatId;
                            return (
                              <div
                                key={c.id}
                                onClick={() => {
                                  onSelectChat(c.id);
                                  onClose?.();
                                }}
                                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                  isActive
                                    ? 'bg-purple-600/20 text-purple-200 font-medium'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1230]/50'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <MessageSquare className="w-3 h-3 text-zinc-500 shrink-0" />
                                  <span className="truncate">{cleanTitle(c.title, c.workspaceMode)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteChat(c.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-rose-400"
                                  title="Delete chat"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search Box */}
          <div className="pt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats... (Ctrl+K)"
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-[#140E24] border border-purple-500/20 focus:border-purple-500/50 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Chat History List */}
          <div className="pt-1">
            {searchResults !== null ? (
              <div>
                <div className="px-3 py-1 text-[10px] font-semibold text-purple-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Search Results</span>
                  <span className="text-[9px] text-zinc-500 font-normal">{searchResults.length} found</span>
                </div>
                {searchResults.length === 0 ? (
                  <div className="text-center py-4 text-xs text-zinc-500">
                    No results for &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  searchResults.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        onSelectChat(res.id);
                        onClose?.();
                      }}
                      className="px-3 py-2 rounded-xl text-xs hover:bg-[#1A1230]/70 cursor-pointer transition-colors"
                    >
                      <div className="font-medium text-zinc-200 truncate">{cleanTitle(res.title)}</div>
                      {res.snippet && (
                        <div className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{res.snippet}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : chats.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-zinc-500">No chat history yet</div>
            ) : (
              <>
                {renderChatGroup('Today', groupedChats.today)}
                {renderChatGroup('Yesterday', groupedChats.yesterday)}
                {renderChatGroup('Previous 7 Days', groupedChats.previous7Days)}
                {renderChatGroup('Older', groupedChats.older)}
              </>
            )}
          </div>
        </div>

        {/* User Account / Profile Footer Card */}
        <div className="p-3 border-t border-purple-500/20 bg-[#080510] relative">
          <div
            ref={profileMenuRef}
            className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar user={user} className="w-8 h-8" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white truncate">
                  {user?.fullName || 'User'}
                </span>
                <span className="text-[10px] text-purple-400 truncate max-w-[130px]">
                  @{user?.username || 'user'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Profile Dropdown Popup Menu */}
            {isProfileMenuOpen && (
              <div
                className="absolute bottom-16 left-3 right-3 z-50 py-1.5 rounded-2xl bg-[#18112C] border border-purple-500/30 shadow-2xl purple-glow text-xs space-y-0.5 animate-scale-in"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfileMenuOpen(false);
                    setIsEditProfileOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-zinc-200 hover:bg-purple-900/40 hover:text-purple-300 transition-colors"
                >
                  <User className="w-4 h-4 text-purple-400" />
                  <span>Edit profile</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfileMenuOpen(false);
                    introAudioManager.startReplayAudio();
                    onReplayIntro?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-zinc-200 hover:bg-purple-900/40 hover:text-purple-300 transition-colors"
                >
                  <PlayCircle className="w-4 h-4 text-amber-400" />
                  <span>Replay Cosmic Intro</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfileMenuOpen(false);
                    onTogglePersonalized?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-zinc-200 hover:bg-purple-900/40 hover:text-purple-300 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{PERSONALIZED_CHAT_LABEL} Space</span>
                </button>

                <div
                  className="w-full flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-purple-900/40 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2.5">
                    <SunMoon className="w-4 h-4 text-purple-400" />
                    <span>Theme</span>
                  </div>
                  <ThemeToggle />
                </div>

                <div className="h-px bg-purple-500/20 my-1" />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfileMenuOpen(false);
                    setIsClearChatsOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-zinc-300 hover:bg-rose-950/40 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-zinc-400" />
                  <span>Clear all chats</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfileMenuOpen(false);
                    setIsDeleteAccountOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-rose-400 hover:bg-rose-950/40 transition-colors"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Delete account</span>
                </button>

                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setIsProfileMenuOpen(false);
                    await logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4 text-zinc-400" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Edit Profile Modal */}
      <ProfileModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />

      {/* Clear All Chats Modal */}
      <ClearChatsModal
        isOpen={isClearChatsOpen}
        onClose={() => setIsClearChatsOpen(false)}
        onConfirm={onClearAllChats}
      />

      {/* Delete Account Confirmation Modal */}
      <DeleteAccountModal
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
      />
    </>
  );
}
