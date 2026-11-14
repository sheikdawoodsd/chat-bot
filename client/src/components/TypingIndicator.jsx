export function TypingIndicator() {
  return (
    <div className="flex items-start gap-4 max-w-3xl mx-auto px-4 py-3 animate-fade-in">
      {/* Bot Avatar with Logo */}
      <div className="shrink-0 relative">
        <img
          src="/logo.png"
          alt="Nova"
          className="w-8 h-8 rounded-full object-cover purple-glow-sm border border-purple-400/40 animate-pulse"
        />
      </div>

      {/* Bubble */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-[#12121A] border border-gray-200 dark:border-[#232332] shadow-sm text-gray-500 dark:text-zinc-400 text-sm">
        <span className="font-semibold text-xs text-purple-600 dark:text-[#A78BFA] tracking-wide">
          Nova is thinking
        </span>
        <div className="flex items-center gap-1.5 ml-1">
          <div className="w-2 h-2 rounded-full bg-[#7C3AED] typing-dot"></div>
          <div className="w-2 h-2 rounded-full bg-[#8B5CF6] typing-dot"></div>
          <div className="w-2 h-2 rounded-full bg-[#A78BFA] typing-dot"></div>
        </div>
      </div>
    </div>
  );
}
