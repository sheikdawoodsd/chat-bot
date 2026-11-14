import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Sparkles, Plus, Mic, Send, BookOpen, Radio, FolderPlus, Terminal, Search, Check, Volume2, VolumeX } from 'lucide-react';
import { introAudioManager } from '../services/introAudioManager';

/**
 * INTRO_CONFIG - Production 4K 60FPS Sequence Configuration
 * Sequencing:
 * 1. 0.0s – 2.5s: Welcome Nova Intro (responsive sizing - mobile compact, desktop prominent 4K)
 * 2. 2.5s – 5.0s: Chat interaction ("Hi Nova, how can I help you?" types out)
 * 3. 5.0s – 5.8s: Action animation - Enter button press with pulse ripple
 * 4. 5.8s – 9.4s: Generated Clip 1 - Motion graphics styled after Video Project 6 (Nova Theme)
 * 5. 9.4s – 12.8s: Continuation - Ambient code flow & capability words (Writing, Coding, Research, Chat)
 * 6. 12.8s – 16.2s: Generated Clip 2 - Motion graphics styled after Video Project 4 (Nova Theme)
 * 7. 16.2s – 17.5s: Finale handover into live app
 */
export const INTRO_CONFIG = {
  phase1_revealEnd: 2500,     // 0.0s – 2.5s: Logo & "Nova" letter-by-letter reveal
  phase2_chatEnd: 5000,       // 2.5s – 5.0s: "Welcome to Nova" + typing "Hi Nova, how can I help you?"
  phase3_enterPressEnd: 5800, // 5.0s – 5.8s: Realistic Enter button press animation
  phase4_clip1End: 9400,      // 5.8s – 9.4s: Generated Clip 1 (Styled after Video Project 6)
  phase5_flowEnd: 12800,      // 9.4s – 12.8s: Code stream & capability words pulse
  phase6_clip2End: 16200,     // 12.8s – 16.2s: Generated Clip 2 (Styled after Video Project 4)
  phase7_finaleEnd: 17500,    // 16.2s – 17.5s: Logo pulse & handover dissolve into main chat

  typingText: 'Hi Nova, how can I help you?',
  words: ['Writing', 'Coding', 'Research', 'Chat'],
  codeSnippets: [
    'const assistant = new Nova({ model: "gemini-3.5-flash", mode: "code" });',
    'await assistant.generate({ prompt: "Real-time streaming pipeline", stream: true });',
    'export async function optimizeAST(node, options = {}) {',
    '  const cacheKey = hashBuffer(node.source);',
    '  return workerPool.dispatch("transform", { node, cacheKey });',
    '}',
    '// Fast vectorized inference connected to Nova Engine',
    'const response = await engine.streamTokens({ temperature: 0.7 });',
  ],
};

/**
 * GeneratedClip1 - Motion Graphic styled after Video Project 6 (100% Nova Theme)
 * Features:
 * - 3D perspective cyber grid with glowing vertices
 * - Ambient cosmic purple aura
 * - Floating 3D perspective user question card & Nova AI step-by-step code response card
 */
function GeneratedClip1({ elapsed, startTime, endTime }) {
  const localElapsed = Math.max(0, elapsed - startTime);
  const duration = endTime - startTime;
  const progress = Math.min(1, localElapsed / duration);
  const floatY = Math.sin(localElapsed / 500) * 6;

  // Fade in during first 400ms, fade out during last 400ms
  const opacity =
    localElapsed < 400
      ? localElapsed / 400
      : localElapsed > duration - 400
      ? (duration - localElapsed) / 400
      : 1;

  return (
    <div
      className="relative w-full max-w-4xl px-4 flex flex-col items-center justify-center transition-all duration-300"
      style={{
        opacity,
        transform: `perspective(1000px) rotateX(${4 - progress * 4}deg) translateY(${floatY}px)`,
      }}
    >
      {/* 3D Horizon Grid Background */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none overflow-hidden">
        <div
          className="w-[120%] h-96 opacity-35"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(168, 85, 247, 0.2) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(139, 92, 246, 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(65deg) translateY(60px)',
            maskImage: 'linear-gradient(to top, black, transparent 80%)',
            WebkitMaskImage: 'linear-gradient(to top, black, transparent 80%)',
          }}
        />
        {/* Ambient Radial Aura */}
        <div className="absolute w-[32rem] h-[32rem] rounded-full bg-purple-600/20 blur-3xl" />
      </div>

      {/* Top Floating Glass Card: User Message */}
      <div className="w-full max-w-2xl flex items-center gap-3 sm:gap-4 mb-4 p-3.5 sm:p-4 rounded-2xl bg-[#120B22]/90 border border-purple-500/40 shadow-[0_8px_30px_rgba(139,92,246,0.25)] backdrop-blur-xl animate-fade-in">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 border border-purple-400/50 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
          <span>U</span>
        </div>
        <div className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight">
          How can I implement Nova AI in Next.js?
        </div>
      </div>

      {/* Bottom Floating Glass Card: Nova AI Step-by-Step Response */}
      <div className="w-full max-w-2xl flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-[#0F091E]/95 border border-purple-500/50 shadow-[0_15px_45px_rgba(139,92,246,0.35)] backdrop-blur-2xl">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-400 p-0.5 border border-purple-400/60 shrink-0 shadow-lg purple-glow-sm">
          <img src="/logo.png" alt="Nova Mascot" className="w-full h-full rounded-full object-cover" />
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="font-bold text-sm sm:text-base text-purple-200">
            Steps to implement Nova AI in Next.js
          </div>

          <div className="space-y-1.5">
            <p className="text-xs sm:text-sm text-zinc-300">
              1. Install the official Nova AI client package:
            </p>
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#18112C] border border-purple-500/30 font-mono text-xs text-cyan-300 shadow-inner">
              <span>$ npm i @nova/ai</span>
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs sm:text-sm text-zinc-300">
              2. Connect real-time streaming with Gemini 3.5 Flash:
            </p>
            <div className="px-3.5 py-2 rounded-xl bg-[#18112C] border border-purple-500/30 font-mono text-xs text-purple-300 overflow-x-auto">
              <code>const nova = new Nova({'{'} model: &apos;gemini-3.5-flash&apos;, stream: true {'}'});</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * GeneratedClip2 - Motion Graphic styled after Video Project 4 (100% Nova Theme)
 * Features:
 * - Headline & Cosmic Search Bar with "Ask Nova" pill
 * - 3 Cascading 3D Cards fanning out smoothly in perspective:
 *   1. Knowledge & Docs AI
 *   2. Multilingual Voice Assistant
 *   3. Cosmic Workspace Suite
 */
function GeneratedClip2({ elapsed, startTime, endTime }) {
  const localElapsed = Math.max(0, elapsed - startTime);
  const duration = endTime - startTime;
  const progress = Math.min(1, localElapsed / 1400);

  // Fade in / out
  const opacity =
    localElapsed < 400
      ? localElapsed / 400
      : localElapsed > duration - 400
      ? (duration - localElapsed) / 400
      : 1;

  return (
    <div
      className="relative w-full max-w-3xl px-4 flex flex-col items-center justify-center transition-all duration-300"
      style={{ opacity }}
    >
      {/* Background Soft Purple Aurora Glow */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
        <div className="w-[36rem] h-[28rem] rounded-full bg-purple-600/20 blur-3xl animate-pulse" />
        <div className="w-[28rem] h-[24rem] rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      {/* Top Title & Subtitle */}
      <div className="text-center mb-5 select-none">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-1.5 drop-shadow-md">
          Nova AI Ecosystem
        </h2>
        <p className="text-xs sm:text-sm text-purple-300 font-medium">
          Next-Generation Autonomous Intelligence
        </p>
      </div>

      {/* Floating 3D Search Pill Bar */}
      <div className="w-full max-w-lg mb-6 relative">
        <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-[#140E24]/90 border border-purple-500/40 shadow-[0_8px_30px_rgba(139,92,246,0.3)] backdrop-blur-xl">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-400">
            <Search className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="truncate">Search Nova docs & workspace with AI...</span>
          </div>
          <div className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold shadow-xs shrink-0">
            Ask Nova
          </div>
        </div>
      </div>

      {/* 3 Cascading 3D Cards Fanning Out */}
      <div className="relative w-full max-w-lg h-56 select-none">
        {/* Card 1: Knowledge & Docs Engine (Back) */}
        <div
          className="absolute inset-x-0 p-4 rounded-2xl bg-[#140E26]/90 border border-purple-500/30 shadow-lg backdrop-blur-xl transition-all duration-700 ease-out flex items-center gap-3.5"
          style={{
            transform: `translateY(${-44 * progress}px) scale(${0.92 + progress * 0.02})`,
            zIndex: 10,
            opacity: 0.85 + progress * 0.15,
          }}
        >
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
                Docs
              </span>
              <span className="text-xs sm:text-sm font-bold text-white">Nova Knowledge Engine</span>
            </div>
            <p className="text-[11px] text-zinc-400 line-clamp-1">
              Contextual neural retrieval, enterprise vector indexing & deep memory.
            </p>
          </div>
        </div>

        {/* Card 2: Multilingual Real-Time Voice Assistant (Middle) */}
        <div
          className="absolute inset-x-0 p-4 rounded-2xl bg-[#1A1232]/95 border border-purple-500/40 shadow-xl backdrop-blur-xl transition-all duration-700 ease-out flex items-center gap-3.5"
          style={{
            transform: `translateY(${-18 * progress}px) scale(${0.96 + progress * 0.01})`,
            zIndex: 20,
          }}
        >
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 bg-violet-500/20 px-2 py-0.5 rounded">
                Voice
              </span>
              <span className="text-xs sm:text-sm font-bold text-white">Multilingual Voice Assistant</span>
            </div>
            <p className="text-[11px] text-zinc-300 line-clamp-1">
              Ultra-low latency conversational AI with Tamil, Hindi & English speech synthesis.
            </p>
          </div>
        </div>

        {/* Card 3: Intelligent Cosmic Workspace Suite (Front & Prominent) */}
        <div
          className="absolute inset-x-0 p-4 rounded-2xl bg-gradient-to-r from-[#20143D] to-[#170E2D] border border-purple-400/50 shadow-[0_15px_45px_rgba(139,92,246,0.4)] backdrop-blur-2xl transition-all duration-700 ease-out flex items-center gap-3.5"
          style={{
            transform: `translateY(${12 * progress}px) scale(1)`,
            zIndex: 30,
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 border border-purple-400/60 flex items-center justify-center text-white shrink-0 shadow-md">
            <FolderPlus className="w-5 h-5 text-purple-200" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-purple-600 px-2 py-0.5 rounded shadow-xs">
                Workspace
              </span>
              <span className="text-xs sm:text-sm font-bold text-white">Cosmic Intelligence Suite</span>
            </div>
            <p className="text-[11px] text-purple-200 line-clamp-1">
              Interactive Dev Code sandbox, Gemini Image Studio & Presentation builder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NovaIntro({ onComplete }) {
  const [elapsed, setElapsed] = useState(0);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);
  const completedRef = useRef(false);
  const audioRef = useRef(null);

  // Synced ambient audio soundtrack — initialized synchronously on user gesture for 100% reliable 1st-click playback
  useEffect(() => {
    let isMounted = true;

    // Ensure audio is playing (started synchronously on click, or triggered here as fallback)
    const audio = introAudioManager.startReplayAudio();
    audioRef.current = audio;

    const handleDocInteraction = () => {
      if (!isMounted) return;
      introAudioManager.startReplayAudio();
    };

    if (audio && audio.paused) {
      document.addEventListener('click', handleDocInteraction, { once: true });
      document.addEventListener('keydown', handleDocInteraction, { once: true });
    }

    return () => {
      isMounted = false;
      document.removeEventListener('click', handleDocInteraction);
      document.removeEventListener('keydown', handleDocInteraction);
      audioRef.current = null;
    };
  }, []);

  const toggleAudio = (e) => {
    if (e) e.stopPropagation();
    const muted = introAudioManager.toggleMute();
    setIsAudioMuted(muted);
  };

  const finishIntro = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    introAudioManager.fadeOutAndStop(600, () => {
      onComplete?.();
    });
  }, [onComplete]);

  // Handle immediate skip with smooth 350ms fade
  const handleSkip = useCallback(
    (e) => {
      if (e) e.stopPropagation();
      if (isSkipping || completedRef.current) return;
      setIsSkipping(true);
      introAudioManager.fadeOutAndStop(250, () => {
        completedRef.current = true;
        onComplete?.();
      });
    },
    [isSkipping, onComplete]
  );

  // Keyboard shortcut: Escape to skip
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  // Preload logo and check reduced motion
  useEffect(() => {
    const img = new Image();
    img.src = '/logo.png';
    img.onload = () => setIsReady(true);
    img.onerror = () => setIsReady(true);

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      const t = setTimeout(() => {
        handleSkip();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [handleSkip]);

  // 60 FPS cinematic animation loop synchronized frame-by-frame with audio soundtrack
  useEffect(() => {
    if (!isReady || isSkipping) return;

    const tick = (now) => {
      if (!startTimeRef.current) startTimeRef.current = now;

      // Sync elapsed with audio time when audio is playing for 100% video-audio lockstep
      let diff;
      const audio = introAudioManager.getAudio();
      if (audio && !audio.paused && audio.currentTime > 0) {
        diff = audio.currentTime * 1000;
      } else {
        diff = now - startTimeRef.current;
      }

      setElapsed(diff);

      if (diff >= INTRO_CONFIG.phase7_finaleEnd) {
        finishIntro();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isReady, isSkipping, finishIntro]);

  // Derived timeline variables
  const {
    phase1_revealEnd,
    phase2_chatEnd,
    phase3_enterPressEnd,
    phase4_clip1End,
    phase5_flowEnd,
    phase6_clip2End,
    phase7_finaleEnd,
    typingText,
    words,
    codeSnippets,
  } = INTRO_CONFIG;

  // Phase 1: Reveal (0.0s -> 2.5s)
  const isPhase1 = elapsed < phase2_chatEnd;
  const p1Time = Math.min(elapsed, phase1_revealEnd);
  const p1LogoScale = 0.92 + 0.08 * Math.min(1, p1Time / 1400);
  const p1LogoOpacity = Math.min(1, p1Time / 1000);

  // Letter by letter "Nova" reveal
  const wordLetters = ['N', 'o', 'v', 'a'];
  const letterDelays = [800, 1100, 1350, 1600];

  // Phase 2: Chat Box & Typing (2.5s -> 5.0s)
  const isPhase2 = elapsed >= phase1_revealEnd && elapsed < phase4_clip1End;
  const p2Progress = Math.min(1, Math.max(0, (elapsed - phase1_revealEnd) / 1000));
  const typingElapsed = Math.max(0, elapsed - phase1_revealEnd - 400);
  const typingDuration = 1800;
  const charIndex = Math.min(
    typingText.length,
    Math.floor((typingElapsed / typingDuration) * typingText.length)
  );
  const currentTypedText = isPhase2 ? typingText.slice(0, charIndex) : '';

  // Phase 3: Action Animation - Enter Button Press (5.0s -> 5.8s)
  const isEnterPressing = elapsed >= phase2_chatEnd && elapsed < phase3_enterPressEnd;
  const enterPressProgress = isEnterPressing
    ? (elapsed - phase2_chatEnd) / (phase3_enterPressEnd - phase2_chatEnd)
    : 0;
  const sendButtonScale = isEnterPressing
    ? enterPressProgress < 0.5
      ? 1 - enterPressProgress * 0.3
      : 0.85 + (enterPressProgress - 0.5) * 0.3
    : 1.0;

  // Phase 4: Generated Clip 1 - Motion Graphics styled after Video Project 6 (5.8s -> 9.4s)
  const isPhase4_Clip1 = elapsed >= phase3_enterPressEnd && elapsed < phase4_clip1End;

  // Phase 5: Continuation - Code Stream & Capability Words (9.4s -> 12.8s)
  const isPhase5_Flow = elapsed >= phase4_clip1End && elapsed < phase6_clip2End;
  const p5Elapsed = Math.max(0, elapsed - phase4_clip1End);
  const isCodeStream = p5Elapsed < 1800;
  const isWordsPhase = p5Elapsed >= 1600 && p5Elapsed < 3400;
  const wordsElapsed = Math.max(0, p5Elapsed - 1600);
  const activeWordIdx = Math.min(3, Math.floor(wordsElapsed / 450));
  const activeWord = words[activeWordIdx] || words[3];
  const wordSubProgress = (wordsElapsed % 450) / 450;
  const wordOpacity =
    wordSubProgress < 0.2
      ? wordSubProgress / 0.2
      : wordSubProgress > 0.8
      ? (1 - wordSubProgress) / 0.2
      : 1;

  // Phase 6: Generated Clip 2 - Motion Graphics styled after Video Project 4 (12.8s -> 16.2s)
  const isPhase6_Clip2 = elapsed >= phase5_flowEnd && elapsed < phase7_finaleEnd;

  // Phase 7: Finale Handover (16.2s -> 17.5s)
  const isPhase7_Finale = elapsed >= phase6_clip2End;
  const finaleElapsed = Math.max(0, elapsed - phase6_clip2End);
  const isHandoverDissolve = finaleElapsed >= 900;
  const handoverProgress = Math.min(1, Math.max(0, (finaleElapsed - 600) / 900));

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050308] select-none overflow-hidden transition-opacity duration-500 cursor-pointer ${
        isSkipping || isHandoverDissolve ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        willChange: 'opacity, transform',
      }}
    >
      {/* Dynamic Ambient Background Blobs (Drifting slowly, 4K smooth grading) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 lg:w-[36rem] lg:h-[36rem] rounded-full bg-[#8B5CF6]/15 blur-3xl"
          style={{
            transform: `translate3d(${Math.sin(elapsed / 2000) * 20}px, ${
              Math.cos(elapsed / 2500) * 20
            }px, 0)`,
          }}
        />
        <div
          className="absolute top-1/3 -right-24 w-[28rem] h-[28rem] lg:w-[40rem] lg:h-[40rem] rounded-full bg-[#A855F7]/12 blur-3xl"
          style={{
            transform: `translate3d(${Math.cos(elapsed / 2200) * -25}px, ${
              Math.sin(elapsed / 2800) * 20
            }px, 0)`,
          }}
        />
        <div
          className="absolute -bottom-24 left-1/4 w-[32rem] h-[32rem] lg:w-[44rem] lg:h-[44rem] rounded-full bg-[#6366F1]/10 blur-3xl"
          style={{
            transform: `translate3d(${Math.sin(elapsed / 1800) * 15}px, ${
              Math.cos(elapsed / 2100) * -15
            }px, 0)`,
          }}
        />
      </div>

      {/* Sound Toggle Button in Bottom-Left */}
      <div className="absolute bottom-6 left-6 z-50">
        <button
          type="button"
          onClick={toggleAudio}
          className="group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-400 hover:text-zinc-200 border border-white/10 backdrop-blur-md transition-all duration-200"
          title={isAudioMuted ? 'Unmute intro audio' : 'Mute intro audio'}
        >
          {isAudioMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
              <span>Sound off</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Sound on</span>
            </>
          )}
        </button>
      </div>

      {/* Subtle Skip Button in Bottom-Right */}
      <div className="absolute bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={handleSkip}
          className="group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-400 hover:text-zinc-200 border border-white/10 backdrop-blur-md transition-all duration-200"
          title="Press Esc or click anywhere to skip"
        >
          <span>Skip intro</span>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Main Presentation Container */}
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
        {/* ========================================================
            PHASE 1: Welcome Nova Reveal (0.0s – 2.5s)
            Responsive Sizing: Mobile compact (w-16 h-16), Desktop prominent (md:w-36 md:h-36 lg:w-44 lg:h-44)
            ======================================================== */}
        {isPhase1 && (
          <div
            className="flex items-center gap-4 sm:gap-6 md:gap-8 transition-all duration-700 ease-out"
            style={{
              opacity: p1LogoOpacity * (1 - p2Progress),
              transform: `scale(${p1LogoScale}) translateY(${p2Progress * -50}px)`,
            }}
          >
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-36 md:h-36 lg:w-44 lg:h-44 rounded-full flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Nova"
                className="w-full h-full object-contain select-none"
                style={{
                  filter: 'drop-shadow(0 0 14px rgba(139, 92, 246, 0.22))',
                }}
              />
            </div>

            <div className="flex items-center text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white">
              {wordLetters.map((char, i) => {
                const charReady = elapsed >= letterDelays[i];
                return (
                  <span
                    key={i}
                    className="inline-block transition-all duration-500 ease-out"
                    style={{
                      opacity: charReady ? 1 : 0,
                      transform: charReady ? 'translateY(0)' : 'translateY(8px)',
                      filter: charReady ? 'blur(0px)' : 'blur(4px)',
                    }}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================
            PHASE 2 & 3: "Welcome to Nova" + Chat Box + Enter Press Animation (2.5s – 5.8s)
            ======================================================== */}
        {isPhase2 && !isPhase4_Clip1 && (
          <div
            className="flex flex-col items-center w-full max-w-xl mx-auto px-4 transition-all duration-700 ease-out"
            style={{
              opacity: p2Progress,
              transform: `translateY(${(1 - p2Progress) * 35}px)`,
            }}
          >
            <div className="flex items-center gap-3 mb-6 sm:mb-8 select-none">
              <img
                src="/logo.png"
                alt="Nova Icon"
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                style={{
                  filter: 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.22))',
                }}
              />
              <h1
                className="text-2xl sm:text-3xl md:text-4xl text-zinc-100 font-normal tracking-wide"
                style={{
                  fontFamily: '"Newsreader", "Playfair Display", Georgia, serif',
                }}
              >
                Welcome to Nova
              </h1>
            </div>

            <div className="relative w-full group">
              <div className="absolute -inset-0.5 rounded-2xl sm:rounded-full bg-gradient-to-r from-purple-600/30 via-indigo-500/25 to-purple-500/30 blur-md opacity-75" />

              <div className="relative flex items-center justify-between w-full px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl sm:rounded-full bg-[#110B1E]/90 backdrop-blur-xl border border-purple-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.65)] text-left">
                <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center text-zinc-400 mr-3 shrink-0">
                  <Plus className="w-4 h-4" />
                </div>

                <div className="flex-1 flex items-center text-sm sm:text-base text-zinc-200 font-normal tracking-normal overflow-hidden whitespace-nowrap">
                  <span>{currentTypedText}</span>
                  <span className="inline-block w-[2px] h-5 bg-purple-400 ml-0.5 animate-pulse" />
                </div>

                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center text-zinc-400">
                    <Mic className="w-4 h-4" />
                  </div>

                  <div
                    className="relative w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/40 transition-transform duration-150"
                    style={{
                      transform: `scale(${sendButtonScale})`,
                      boxShadow: isEnterPressing
                        ? '0 0 20px rgba(168, 85, 247, 0.8), 0 0 40px rgba(99, 102, 241, 0.6)'
                        : '0 4px 14px rgba(139, 92, 246, 0.4)',
                    }}
                  >
                    <Send className="w-3.5 h-3.5 transform -rotate-45 -translate-y-0.5 translate-x-0.5" />
                    {isEnterPressing && (
                      <span className="absolute inset-0 rounded-full bg-white/40 animate-ping pointer-events-none" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            PHASE 4: Generated Clip 1 - Motion Graphics styled after Video Project 6
            Custom-built in code with Nova theme, cyber grid, and streaming code
            ======================================================== */}
        {isPhase4_Clip1 && (
          <GeneratedClip1
            elapsed={elapsed}
            startTime={phase3_enterPressEnd}
            endTime={phase4_clip1End}
          />
        )}

        {/* ========================================================
            PHASE 5: Continuation - Code Stream & Capability Words (9.4s – 12.8s)
            "Writing" -> "Coding" -> "Research" -> "Chat"
            ======================================================== */}
        {isPhase5_Flow && !isPhase6_Clip2 && (
          <div className="relative w-full h-full flex items-center justify-center">
            {isCodeStream && (
              <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none p-6 animate-fade-in">
                <div className="absolute top-10 right-8 sm:right-16 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A1230]/80 border border-purple-500/40 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.25)]">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                  <span className="text-xs font-medium text-purple-200">
                    Help me in coding
                  </span>
                </div>

                <div
                  className="w-full max-w-3xl space-y-2 text-xs sm:text-sm font-mono text-purple-300/40 select-none overflow-hidden opacity-75"
                  style={{
                    maskImage: 'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)',
                  }}
                >
                  {codeSnippets.map((line, idx) => (
                    <div
                      key={idx}
                      className="tracking-wide"
                      style={{
                        paddingLeft: `${(idx % 4) * 1.5}rem`,
                        color:
                          idx % 3 === 0
                            ? 'rgba(168, 85, 247, 0.65)'
                            : idx % 2 === 0
                            ? 'rgba(139, 92, 246, 0.55)'
                            : 'rgba(99, 102, 241, 0.45)',
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isWordsPhase && (
              <div className="relative flex flex-col items-center justify-center text-center">
                <div className="absolute w-64 h-64 rounded-full bg-purple-600/20 blur-3xl -z-10 animate-pulse" />
                <div
                  className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white transition-all duration-300 ease-out"
                  style={{
                    opacity: wordOpacity,
                    transform: `translateY(${(1 - wordOpacity) * 15}px) scale(${0.96 + wordOpacity * 0.04})`,
                    textShadow: '0 0 25px rgba(139, 92, 246, 0.35)',
                  }}
                >
                  {activeWord}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            PHASE 6: Generated Clip 2 - Motion Graphics styled after Video Project 4
            Custom-built in code with Nova theme, search bar & 3 fanning cascading cards
            ======================================================== */}
        {isPhase6_Clip2 && !isPhase7_Finale && (
          <GeneratedClip2
            elapsed={elapsed}
            startTime={phase5_flowEnd}
            endTime={phase6_clip2End}
          />
        )}

        {/* ========================================================
            PHASE 7: Finale Handover into Nova (16.2s – 17.5s)
            Logo pulses at center and glides towards app navbar
            ======================================================== */}
        {isPhase7_Finale && (
          <div
            className="flex items-center justify-center transition-all duration-700 ease-in-out"
            style={{
              transform: `translate3d(${
                handoverProgress * -window.innerWidth * 0.42
              }px, ${
                handoverProgress * -window.innerHeight * 0.42
              }px, 0) scale(${1 - handoverProgress * 0.6})`,
              opacity: 1 - handoverProgress * 0.3,
            }}
          >
            <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center animate-pulse">
              <img
                src="/logo.png"
                alt="Nova Finale"
                className="w-full h-full object-contain"
                style={{
                  filter: 'drop-shadow(0 0 14px rgba(139, 92, 246, 0.25))',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
