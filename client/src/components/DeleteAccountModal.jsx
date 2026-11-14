import { useState } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function DeleteAccountModal({ isOpen, onClose }) {
  const { deleteAccount, user } = useAuth();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmEmail.toLowerCase().trim() !== user?.email?.toLowerCase().trim()) {
      setError('Please type your exact email to confirm deletion.');
      return;
    }

    setIsDeleting(true);
    setError('');
    try {
      await deleteAccount();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete account.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#12121A] border border-rose-500/30 shadow-2xl p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-[#1C1C28]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4 text-rose-500">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white">Delete Account</h3>
            <p className="text-xs text-rose-500 font-medium">Permanent Action</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 dark:text-zinc-300 leading-relaxed mb-4">
          This will permanently delete your user account, <strong>all of your server-saved chats, messages, and uploaded files</strong>. This action cannot be undone.
        </p>

        {error && (
          <div className="mb-4 text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
            {error}
          </div>
        )}

        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
            Type your email <span className="text-purple-600 dark:text-purple-400">({user?.email})</span> to confirm:
          </label>
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Type your email"
            className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-[#181824] border border-gray-200 dark:border-[#2A2A3E] text-xs text-gray-900 dark:text-zinc-100 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
          />
        </div>

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
            onClick={handleDelete}
            disabled={isDeleting || confirmEmail.toLowerCase().trim() !== user?.email?.toLowerCase().trim()}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-1.5"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Permanently Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

