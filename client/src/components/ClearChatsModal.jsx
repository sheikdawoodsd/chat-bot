import { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

export function ClearChatsModal({ isOpen, onClose, onConfirm }) {
  const [isClearing, setIsClearing] = useState(false);

  if (!isOpen) return null;

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12121A] border border-gray-200 dark:border-[#232332] shadow-2xl p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-[#1C1C28]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Clear All Chats?</h3>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 dark:text-zinc-300 mb-5 leading-relaxed">
          This will permanently delete all your conversation histories, messages, and uploaded files. Your account will remain active.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-[#1A1A26] border border-gray-200 dark:border-[#2A2A3E]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isClearing}
            onClick={handleClear}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isClearing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Clearing...</span>
              </>
            ) : (
              <span>Clear All</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

