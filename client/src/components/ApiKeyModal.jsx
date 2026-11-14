import { X, Key, ExternalLink, Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function ApiKeyModal({ isOpen, onClose }) {
  const [copiedStep, setCopiedStep] = useState(false);

  if (!isOpen) return null;

  const envLine = 'GEMINI_API_KEY=your_actual_key_here';

  const copyEnvLine = () => {
    navigator.clipboard.writeText(envLine);
    setCopiedStep(true);
    setTimeout(() => setCopiedStep(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg p-6 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-[#28283C] rounded-2xl shadow-2xl purple-glow text-left">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-[#1C1C28] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-[#A78BFA] border border-purple-500/20">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Connect Your Gemini API Key
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Free, takes 30 seconds at Google AI Studio
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3.5 text-sm text-gray-700 dark:text-zinc-300">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#181824] border border-gray-200/80 dark:border-[#232332]">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold shrink-0 mt-0.5">
              1
            </span>
            <div className="flex-1">
              <p className="font-semibold text-xs mb-1">Get your free API key</p>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-semibold underline"
              >
                <span>Open aistudio.google.com/apikey</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#181824] border border-gray-200/80 dark:border-[#232332]">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold shrink-0 mt-0.5">
              2
            </span>
            <div className="flex-1">
              <p className="font-semibold text-xs mb-1">Open <code className="font-mono text-purple-400">server/.env</code></p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1.5">
                Paste inside with no quotes and no spaces around =:
              </p>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/60 border border-purple-500/20 text-purple-200 font-mono text-xs">
                <span>GEMINI_API_KEY=AIzaSy...</span>
                <button
                  type="button"
                  onClick={copyEnvLine}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                >
                  {copiedStep ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedStep ? 'Copied' : 'Copy format'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/5 dark:bg-[#181824] border border-purple-500/20">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold shrink-0 mt-0.5">
              3
            </span>
            <div className="flex-1">
              <p className="font-semibold text-xs text-gray-900 dark:text-zinc-200">Restart the server</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Press <code className="font-mono text-purple-400">Ctrl+C</code> in the terminal and run <code className="font-mono text-purple-400">npm run dev</code> again to load the new key.
              </p>
            </div>
          </div>
        </div>

        {/* Done Button */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all shadow-md shadow-purple-600/30 purple-glow-sm"
          >
            Got it, ready!
          </button>
        </div>
      </div>
    </div>
  );
}
