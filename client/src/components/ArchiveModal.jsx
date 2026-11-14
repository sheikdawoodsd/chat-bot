import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Archive,
  Search,
  RotateCcw,
  Trash2,
  ExternalLink,
  X,
  Clock,
  Sparkles,
  MessageSquare,
  Code,
  Presentation,
  FolderGit2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export function ArchiveModal({ isOpen, onClose, onSelectChat, onChatRestored }) {
  const [archivedList, setArchivedList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const fetchArchived = useCallback(async (query = '') => {
    setIsLoading(true);
    try {
      const url = query ? `/api/chats/archived?q=${encodeURIComponent(query)}` : '/api/chats/archived';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.archived)) {
        setArchivedList(data.archived);
      }
    } catch (err) {
      console.error('[Nova Archive] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setDeleteConfirmId(null);
      fetchArchived();
    }
  }, [isOpen, fetchArchived]);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => {
      fetchArchived(searchQuery);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchQuery, isOpen, fetchArchived]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleRestore = async (chatId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/chats/${chatId}/unarchive`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setArchivedList((prev) => prev.filter((c) => c.id !== chatId));
        showToast('Conversation restored to active sidebar!');
        onChatRestored?.(chatId);
      }
    } catch (err) {
      console.error('[Nova Archive] Restore error:', err);
    }
  };

  const handleDeletePermanent = async (chatId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setArchivedList((prev) => prev.filter((c) => c.id !== chatId));
        setDeleteConfirmId(null);
        showToast('Archived conversation permanently deleted.');
      }
    } catch (err) {
      console.error('[Nova Archive] Delete error:', err);
    }
  };

  const filteredItems = useMemo(() => {
    return archivedList.filter((item) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'code') return item.workspaceMode === 'code';
      if (activeFilter === 'presentation') return item.workspaceMode === 'presentation';
      if (activeFilter === 'project') return item.workspaceMode === 'project';
      return item.workspaceMode === 'general' || !item.workspaceMode;
    });
  }, [archivedList, activeFilter]);

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'code':
        return <Code className="w-4 h-4 text-emerald-400" />;
      case 'presentation':
        return <Presentation className="w-4 h-4 text-purple-400" />;
      case 'project':
        return <FolderGit2 className="w-4 h-4 text-blue-400" />;
      default:
        return <MessageSquare className="w-4 h-4 text-zinc-400" />;
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Recently';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0D081E] border border-purple-500/30 rounded-3xl shadow-2xl shadow-purple-950/50 flex flex-col max-h-[85vh] overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="p-6 border-b border-purple-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Archived Conversations</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {archivedList.length}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Search, review, restore, or permanently delete archived items.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-700/80 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 bg-[#110B27]/80 border-b border-purple-900/30 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived items..."
              className="w-full bg-[#1A1235] border border-purple-500/30 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
            {['all', 'general', 'code', 'presentation', 'project'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveFilter(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${
                  activeFilter === tab
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span className="text-xs">Loading archived conversations...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
                <Archive className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-300">No archived conversations</h3>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                {searchQuery
                  ? 'No archived items match your search. Try adjusting the query.'
                  : 'Items you archive from the sidebar will appear here.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="group p-4 rounded-2xl bg-[#140D2E]/70 hover:bg-[#1A123B] border border-purple-900/40 hover:border-purple-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div
                  onClick={() => {
                    onSelectChat?.(item.id);
                    onClose();
                  }}
                  className="flex items-start gap-3 cursor-pointer flex-1 min-w-0"
                >
                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 shrink-0 mt-0.5">
                    {getModeIcon(item.workspaceMode)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-purple-300 transition-colors truncate">
                        {item.title || 'Untitled Conversation'}
                      </h4>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider shrink-0">
                        {item.workspaceMode || 'chat'}
                      </span>
                    </div>
                    {item.snippet ? (
                      <p className="text-xs text-zinc-400 line-clamp-1 mt-1">
                        {item.snippet}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500 mt-1">
                        Archived on {formatDate(item.archivedAt || item.updatedAt)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectChat?.(item.id);
                      onClose();
                    }}
                    title="Open and Review Conversation"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-medium border border-purple-500/25 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Review</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleRestore(item.id, e)}
                    title="Restore to Active Sidebar"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-medium border border-emerald-500/25 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>

                  {deleteConfirmId === item.id ? (
                    <div className="flex items-center gap-1 bg-rose-950/60 border border-rose-500/40 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={(e) => handleDeletePermanent(item.id, e)}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        className="px-1.5 py-1 text-zinc-400 hover:text-white text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(item.id);
                      }}
                      title="Permanently Delete"
                      className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-600 text-white text-xs font-medium shadow-xl shadow-purple-950/80 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}

