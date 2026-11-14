import { useState, useRef, useEffect } from 'react';
import { ArrowRight, Volume2, VolumeX, Sparkles } from 'lucide-react';

/**
 * IntroSplash - Plays the Claude Intro Video from Pinterest
 * (Downloaded from https://in.pinterest.com/pin/1102256077580224155/)
 * Features autoplay, sound unmute toggle, smooth letterbox and skip button.
 */
export function IntroSplash({ onComplete }) {
  const [isMuted, setIsMuted] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Start playing immediately
    video.play().catch((err) => {
      console.warn('Autoplay requires user gesture:', err);
    });
  }, []);

  const handleFinish = () => {
    setIsEnding(true);
    setTimeout(() => {
      onComplete?.();
    }, 600);
  };

  const handleToggleSound = (e) => {
    e.stopPropagation();
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
      }
      return next;
    });
  };

  return (
    <div
      onClick={handleFinish}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black select-none transition-opacity duration-700 cursor-pointer ${
        isEnding ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-purple-950/40 via-black to-black pointer-events-none" />

      {/* Top Controls: Sound Toggle & Skip Button */}
      <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggleSound}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-white/10 text-xs text-zinc-300 hover:text-white border border-white/15 backdrop-blur-md transition-all"
        >
          {isMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
              <span>Unmute</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Sound On</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleFinish();
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-600/40 hover:bg-purple-600/70 text-xs text-white border border-purple-400/40 backdrop-blur-md transition-all shadow-lg shadow-purple-600/20"
        >
          <span>Skip</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Intro Video Element */}
      <div className="relative w-full h-full max-w-5xl max-h-[85vh] flex items-center justify-center p-4">
        <video
          ref={videoRef}
          src="/intro-video.mp4"
          autoPlay
          playsInline
          muted={isMuted}
          onEnded={handleFinish}
          className="w-full h-full object-contain rounded-3xl shadow-2xl border border-purple-500/20"
        />
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-6 inset-x-0 flex items-center justify-center text-center pointer-events-none">
        <p className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono tracking-wider uppercase">
          <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
          <span>Click anywhere to start chatting with Nova</span>
        </p>
      </div>
    </div>
  );
}
