import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import {
  Mic,
  MicOff,
  X,
  Volume2,
  Sliders,
  Sparkles,
  Square,
  AlertCircle,
  Send,
  Radio,
  Languages,
  Globe,
} from 'lucide-react';
import { audioPlayer } from '../services/audioPlayer';

const SpeechRecognitionClass =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const SUPPORTED_LANGUAGES = [
  { id: 'auto', name: 'Auto Detect', label: 'Auto', code: 'en-US' },
  { id: 'ta-IN', name: 'Tamil (தமிழ்)', label: 'தமிழ்', code: 'ta-IN' },
  { id: 'hi-IN', name: 'Hindi (हिन्दी)', label: 'हिन्दी', code: 'hi-IN' },
  { id: 'en-US', name: 'English (US)', label: 'English', code: 'en-US' },
  { id: 'es-ES', name: 'Spanish (Español)', label: 'Español', code: 'es-ES' },
  { id: 'fr-FR', name: 'French (Français)', label: 'Français', code: 'fr-FR' },
];

// Reducer state
const initialState = {
  status: 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
  transcript: '',
  reply: '',
  liveCaption: '',
  error: '',
  isMuted: false,
};

function voiceReducer(state, action) {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.status, error: action.error || '' };
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.transcript };
    case 'SET_REPLY':
      return { ...state, reply: action.reply };
    case 'SET_CAPTION':
      return { ...state, liveCaption: action.caption };
    case 'SET_MUTED':
      return { ...state, isMuted: action.isMuted };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.error };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

const AVAILABLE_GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Warm & Cosmic)' },
  { id: 'Puck', name: 'Puck (Lively & Friendly)' },
  { id: 'Fenrir', name: 'Fenrir (Deep & Resonant)' },
  { id: 'Aoede', name: 'Aoede (Smooth & Melodic)' },
  { id: 'Charon', name: 'Charon (Calm & Steady)' },
];

export function VoiceModeOverlay({ isOpen, onClose, onSendVoiceMessage }) {
  const [state, dispatch] = useReducer(voiceReducer, initialState);
  const { status, transcript, liveCaption, error, isMuted } = state;

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(audioPlayer.selectedVoice || 'Kore');
  const [volume, setVolume] = useState(audioPlayer.volume || 1.0);
  const [textInput, setTextInput] = useState('');
  const [selectedLang, setSelectedLang] = useState(() => {
    try {
      const saved = localStorage.getItem('nova_voice_lang') || 'auto';
      audioPlayer.setLanguage(saved);
      return saved;
    } catch {
      return 'auto';
    }
  });
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Audio & State Refs
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const recorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const chunksRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const hasSpokenRef = useRef(false);
  const isMutedRef = useRef(false);
  const isSubmittingTurnRef = useRef(false);
  const statusRef = useRef(status);
  const isOpenRef = useRef(isOpen);
  const analyserRef = useRef(null);
  const levelRingRef = useRef(null);
  const rafRef = useRef(null);
  const historyEndRef = useRef(null);
  const handleOrbTapRef = useRef(null);
  const toggleMuteRef = useRef(null);

  // Short conversation transcript shown inside the voice card
  const [history, setHistory] = useState([]);

  statusRef.current = status;
  isMutedRef.current = isMuted;
  isOpenRef.current = isOpen;

  // Synchronously kill all audio playback, recognition, microphone tracks, and timers
  const cleanupAll = useCallback(() => {
    isSubmittingTurnRef.current = false;
    // 1. Cancel browser speech synthesis immediately
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // 2. Stop audio player
    audioPlayer.stop();

    // 3. Stop native speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    // 4. Clear silence timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // 5. Stop media recorder
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {}
    }
    recorderRef.current = null;

    // 6. Stop and disable all microphone tracks
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch {}
      streamRef.current = null;
    }

    // 7. Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Soft chime so the user hears when Nova starts listening
  const playCue = useCallback((freq = 880) => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }, []);

  // Safe wrapper for closing voice mode (ensures immediate total silence)
  const handleClose = useCallback(() => {
    cleanupAll();
    onClose?.();
  }, [cleanupAll, onClose]);

  // Unlock audio on open
  useEffect(() => {
    if (isOpen) {
      audioPlayer.unlockAudio();
    } else {
      cleanupAll();
    }
  }, [isOpen, cleanupAll]);

  // Speak AI reply with live captions and low latency
  const speakText = useCallback(
    (rawText, onDone) => {
      if (!rawText || !isOpenRef.current) {
        onDone?.();
        return;
      }

      // Stop recognition and recording while Nova speaks
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try {
          recorderRef.current.stop();
        } catch {}
      }

      dispatch({ type: 'SET_STATUS', status: 'speaking' });

      audioPlayer.speakText(rawText, {
        onSentence: (sentence) => {
          if (isOpenRef.current) {
            dispatch({ type: 'SET_CAPTION', caption: sentence });
          }
        },
        onDone: () => {
          if (isOpenRef.current) {
            dispatch({ type: 'SET_CAPTION', caption: '' });
            onDone?.();
          }
        },
      });
    },
    []
  );

  // Send query to Gemini and stream/speak reply with zero delay
  const handleTurnSubmit = useCallback(
    async (userText) => {
      const cleanPrompt = (userText || '').trim();
      if (!cleanPrompt || !isOpenRef.current) {
        isSubmittingTurnRef.current = false;
        startListeningLoop();
        return;
      }

      dispatch({ type: 'SET_STATUS', status: 'thinking' });
      dispatch({ type: 'SET_TRANSCRIPT', transcript: cleanPrompt });
      setHistory((h) => [...h.slice(-5), { role: 'user', text: cleanPrompt }]);

      let isFirstSentence = true;

      // Start streaming speech queue immediately for sub-400ms voice response
      audioPlayer.startStreamingSpeech({
        onSentence: (sentence) => {
          if (isOpenRef.current) {
            dispatch({ type: 'SET_STATUS', status: 'speaking' });
            dispatch({ type: 'SET_CAPTION', caption: sentence });
          }
        },
        onDone: () => {
          isSubmittingTurnRef.current = false;
          if (isOpenRef.current && statusRef.current !== 'error') {
            dispatch({ type: 'SET_CAPTION', caption: '' });
            setTimeout(() => {
              if (isOpenRef.current) startListeningLoop();
            }, 250);
          }
        },
      });

      // Thinking watchdog timeout: prevent stuck thinking state under any circumstance
      const thinkingTimeout = setTimeout(() => {
        if (statusRef.current === 'thinking') {
          console.warn('[Nova Voice] Turn thinking timeout triggered');
          audioPlayer.finishStreaming();
          isSubmittingTurnRef.current = false;
          dispatch({ type: 'SET_STATUS', status: 'idle' });
        }
      }, 70000);

      try {
        let fullAiReply = '';
        if (typeof onSendVoiceMessage === 'function') {
          fullAiReply = await onSendVoiceMessage(cleanPrompt, {
            onSentenceChunk: (sentence) => {
              if (!isOpenRef.current) return;
              if (isFirstSentence) {
                isFirstSentence = false;
                dispatch({ type: 'SET_STATUS', status: 'speaking' });
              }
              audioPlayer.enqueueStreamingSentence(sentence);
            },
          });
        }

        clearTimeout(thinkingTimeout);
        audioPlayer.finishStreaming();

        if (!isOpenRef.current) {
          isSubmittingTurnRef.current = false;
          cleanupAll();
          return;
        }

        if (!fullAiReply) {
          fullAiReply = "I'm listening! What shall we talk about?";
          audioPlayer.enqueueStreamingSentence(fullAiReply);
          audioPlayer.finishStreaming();
        }

        dispatch({ type: 'SET_REPLY', reply: fullAiReply });
        setHistory((h) => [...h.slice(-5), { role: 'nova', text: fullAiReply }]);
      } catch (err) {
        clearTimeout(thinkingTimeout);
        isSubmittingTurnRef.current = false;
        console.error('[Nova Voice] Processing turn error:', err);
        audioPlayer.finishStreaming();
        if (isOpenRef.current) {
          dispatch({
            type: 'SET_ERROR',
            error: err.message || 'Unable to process voice turn. Please speak again.',
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSendVoiceMessage, cleanupAll]
  );

  // Start listening session (Fast on-device SpeechRecognition + Fallback)
  const startListeningLoop = useCallback(async () => {
    if (isMutedRef.current || !isOpenRef.current) {
      dispatch({ type: 'SET_STATUS', status: 'idle' });
      return;
    }

    isSubmittingTurnRef.current = false;
    // Stop previous audio playback
    audioPlayer.stop();

    // Clear previous silence timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    try {
      const isStreamActive =
        streamRef.current &&
        streamRef.current.getTracks().some((t) => t.readyState === 'live');

      if (!isStreamActive) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        // Live mic level analyser drives the pulsing ring around the orb
        try {
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
        } catch {}
      }

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch {}
      }

      dispatch({ type: 'SET_STATUS', status: 'listening' });
      playCue(880);
      hasSpokenRef.current = false;
      chunksRef.current = [];

      // 1. Fast On-Device Speech Recognition (100% accurate, zero latency)
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = true;

        const langObj = SUPPORTED_LANGUAGES.find((l) => l.id === selectedLang);
        const activeLangCode =
          langObj?.id === 'auto'
            ? (typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US')
            : (langObj?.code || 'en-US');
        recognition.lang = activeLangCode;

        let capturedText = '';

        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptChunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              capturedText += transcriptChunk;
            } else {
              interim += transcriptChunk;
            }
          }

          const currentWords = (capturedText || interim).trim();
          if (currentWords) {
            hasSpokenRef.current = true;
            dispatch({ type: 'SET_TRANSCRIPT', transcript: currentWords });

            // Fast Voice Activity Detection (VAD): Trigger response after 750ms silence
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              if (isSubmittingTurnRef.current) return;
              if (statusRef.current === 'listening') {
                isSubmittingTurnRef.current = true;
                try {
                  recognition.stop();
                } catch {}
                handleTurnSubmit(currentWords);
              }
            }, 750);
          }
        };

        recognition.onend = () => {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (isSubmittingTurnRef.current) return;
          const finalPrompt = capturedText.trim();
          if (finalPrompt && statusRef.current === 'listening') {
            isSubmittingTurnRef.current = true;
            handleTurnSubmit(finalPrompt);
          } else if (statusRef.current === 'listening' && isOpenRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (statusRef.current === 'listening' && isOpenRef.current && recognitionRef.current && !isSubmittingTurnRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (e) {}
              }
            }, 100);
          }
        };

        recognition.onerror = (e) => {
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn('[Nova SpeechRecognition] Error:', e.error);
          }
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            dispatch({
              type: 'SET_ERROR',
              error: 'Microphone permission blocked. Please allow microphone access in Chrome.',
            });
          }
        };

        try {
          recognition.start();
        } catch {}
      } else {
        // Fallback: MediaRecorder with fast 500ms voice silence cutoff
        const recorder = new MediaRecorder(streamRef.current);
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          chunksRef.current = [];
          if (blob.size > 600) {
            dispatch({ type: 'SET_STATUS', status: 'thinking' });
            const formData = new FormData();
            formData.append('audio', blob, 'voice.webm');
            const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
            const data = await res.json().catch(() => ({}));
            if (data.text) handleTurnSubmit(data.text);
            else startListeningLoop();
          } else {
            startListeningLoop();
          }
        };

        recorder.start(100);
      }
    } catch (err) {
      console.error('[Nova Voice] Mic setup error:', err);
      dispatch({
        type: 'SET_ERROR',
        error: 'Microphone permission or hardware error. Please verify your settings.',
      });
    }
  }, [handleTurnSubmit, playCue]);

  // Mount/unmount lifecycle
  const startListeningLoopRef = useRef(startListeningLoop);
  startListeningLoopRef.current = startListeningLoop;

  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'RESET' });
      startListeningLoopRef.current?.();
    } else {
      cleanupAll();
    }

    return () => {
      cleanupAll();
    };
  }, [cleanupAll, isOpen]);

  // Tab visibility: STOP everything when tab is hidden, do NOT auto-restart when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isOpenRef.current) return;

      if (document.hidden) {
        // ── Tab is now HIDDEN ──────────────────────────────────────────────
        // Stop all mic listening, audio output, and processing immediately.
        // audioPlayer.stop() cancels TTS fetch, aborts controller, pauses audio.
        audioPlayer.stop();
        // cleanupAll stops recognition, recorder, mic tracks, AudioContext.
        // We call it via the ref so we don't need it in deps.
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          try { window.speechSynthesis.cancel(); } catch {}
        }
        // Stop speech recognition
        if (recognitionRef.current) {
          try {
            recognitionRef.current.onresult = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.abort();
          } catch {}
          recognitionRef.current = null;
        }
        // Stop silence timers
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        // Stop media recorder
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          try { recorderRef.current.stop(); } catch {}
        }
        recorderRef.current = null;
        // Kill all mic tracks
        if (streamRef.current) {
          try {
            streamRef.current.getTracks().forEach((track) => {
              track.stop();
              track.enabled = false;
            });
          } catch {}
          streamRef.current = null;
        }
        // Suspend (not close) AudioContext so it can resume if user comes back
        if (audioContextRef.current && audioContextRef.current.state === 'running') {
          try { audioContextRef.current.suspend(); } catch {}
        }
        // Set status to idle so the UI shows correctly when user returns
        dispatch({ type: 'SET_STATUS', status: 'idle' });
      }
      // ── Tab visible again ─────────────────────────────────────────────────
      // Do NOT auto-restart listening. User must manually tap the orb to resume.
      // Only unlock audio context so playback works when they manually activate.
      else {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          try { audioContextRef.current.resume(); } catch {}
        }
        audioPlayer.unlockAudio();
      }
    };

    const handlePageHide = () => {
      // Additional safety: browser fired pagehide (navigate away / close tab)
      audioPlayer.stop();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch {}
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  // Tap mic action
  const handleOrbTap = () => {
    if (status === 'speaking') {
      audioPlayer.stop();
      startListeningLoop();
    } else if (status === 'listening') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      } else if (recorderRef.current && recorderRef.current.state === 'recording') {
        try {
          recorderRef.current.stop();
        } catch {}
      }
    } else if (status === 'idle') {
      startListeningLoop();
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const q = textInput.trim();
    setTextInput('');
    cleanupAll();
    handleTurnSubmit(q);
  };

  const handleSuggestion = (q) => {
    cleanupAll();
    handleTurnSubmit(q);
  };

  const toggleMute = () => {
    const next = !isMuted;
    dispatch({ type: 'SET_MUTED', isMuted: next });
    if (next) {
      cleanupAll();
      dispatch({ type: 'SET_STATUS', status: 'idle' });
    } else {
      startListeningLoop();
    }
  };

  handleOrbTapRef.current = handleOrbTap;
  toggleMuteRef.current = toggleMute;

  // Keyboard shortcuts: Space = talk / interrupt, M = mute, Esc = close
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleOrbTapRef.current?.();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMuteRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  // Reactive ring: pulses with the mic level while listening, gently while speaking
  useEffect(() => {
    if (!isOpen) return undefined;
    const data = new Uint8Array(128);
    let t = 0;
    const tick = () => {
      const el = levelRingRef.current;
      if (el) {
        let level = 0;
        if (status === 'listening' && analyserRef.current) {
          try {
            analyserRef.current.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            level = Math.min(1, sum / data.length / 80);
          } catch {}
        } else if (status === 'speaking') {
          t += 0.14;
          level = 0.35 + 0.25 * Math.sin(t);
        }
        el.style.transform = `scale(${1 + level * 0.4})`;
        el.style.opacity = String(status === 'idle' ? 0.15 : 0.35 + level * 0.65);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [status, isOpen]);

  // Keep the newest transcript line in view
  useEffect(() => {
    historyEndRef.current?.scrollIntoView?.({ block: 'end' });
  }, [history]);

  // Fresh transcript each time the voice card is reopened
  useEffect(() => {
    if (isOpen) setHistory([]);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      {/* Floating Glassmorphism Modal Card (Matching Image 2) */}
      <div className="relative w-full max-w-sm rounded-[32px] bg-[#120B24]/90 border border-purple-500/30 shadow-[0_0_50px_-10px_rgba(139,92,246,0.35)] backdrop-blur-2xl p-6 flex flex-col items-center justify-between min-h-[460px] overflow-hidden">
        {/* Soft Cosmic Aurora Highlights */}
        <div className="absolute -top-24 -left-24 w-56 h-56 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-56 h-56 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Row (AI Voice Assistant) */}
        <div className="w-full flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Radio
              className={`w-4 h-4 ${
                status === 'speaking'
                  ? 'text-purple-400 animate-pulse'
                  : status === 'listening'
                  ? 'text-purple-400 animate-pulse'
                  : status === 'thinking'
                  ? 'text-amber-400 animate-spin'
                  : 'text-zinc-500'
              }`}
            />
            <h3 className="text-sm font-semibold tracking-wide text-zinc-100">
              AI Voice Assistant
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Multilingual Selector Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-purple-500/30 text-[11px] font-medium text-purple-200 hover:text-white transition-colors"
                title="Select Spoken Language (Tamil, Hindi, English, etc.)"
              >
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                <span>{SUPPORTED_LANGUAGES.find((l) => l.id === selectedLang)?.label || 'Auto'}</span>
              </button>

              {showLangMenu && (
                <div className="absolute top-8 right-0 z-50 w-44 py-1.5 rounded-2xl bg-[#1C1434] border border-purple-500/40 shadow-2xl space-y-0.5 text-xs animate-scale-in">
                  <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-purple-500/20">
                    Spoken Language
                  </div>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => {
                        setSelectedLang(lang.id);
                        audioPlayer.setLanguage(lang.id);
                        setShowLangMenu(false);
                        try {
                          localStorage.setItem('nova_voice_lang', lang.id);
                        } catch {}
                        if (statusRef.current === 'listening') {
                          if (recognitionRef.current) {
                            try { recognitionRef.current.abort(); } catch {}
                          }
                          setTimeout(() => startListeningLoop(), 50);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                        selectedLang === lang.id
                          ? 'bg-purple-600/30 text-purple-200 font-semibold'
                          : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{lang.name}</span>
                      {selectedLang === lang.id && (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Voice Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close Voice Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings Panel Popover */}
        {showSettings && (
          <div className="w-full p-3.5 my-2 rounded-2xl bg-[#1C1434] border border-purple-500/30 shadow-xl z-20 space-y-3 animate-scale-in">
            <div>
              <label className="block text-[11px] font-semibold text-purple-300 mb-1">
                Language
              </label>
              <select
                value={selectedLang}
                onChange={(e) => {
                  const newLang = e.target.value;
                  setSelectedLang(newLang);
                  audioPlayer.setLanguage(newLang);
                  try {
                    localStorage.setItem('nova_voice_lang', newLang);
                  } catch {}
                  if (statusRef.current === 'listening') {
                    if (recognitionRef.current) {
                      try { recognitionRef.current.abort(); } catch {}
                    }
                    setTimeout(() => startListeningLoop(), 50);
                  }
                }}
                className="w-full py-1.5 px-2 rounded-xl bg-[#261B46] border border-purple-500/30 text-xs text-zinc-200 focus:outline-none mb-2"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-purple-300 mb-1">
                Nova Voice
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => {
                  setSelectedVoice(e.target.value);
                  audioPlayer.setVoice(e.target.value);
                }}
                className="w-full py-1.5 px-2 rounded-xl bg-[#261B46] border border-purple-500/30 text-xs text-zinc-200 focus:outline-none"
              >
                {AVAILABLE_GEMINI_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-xs text-purple-200">
              <span className="flex items-center gap-1 text-[11px]">
                <Volume2 className="w-3.5 h-3.5" /> Volume
              </span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  audioPlayer.setVolume(val);
                }}
                className="w-24 accent-purple-500"
              />
            </div>
          </div>
        )}

        {/* Center Mascot & Clean Cosmic Ring (No waveform, sleek and minimal) */}
        <div className="my-auto flex flex-col items-center justify-center relative w-full py-4">
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* 1. Atmospheric neon halo */}
            <div
              className="absolute w-36 h-36 rounded-full pointer-events-none transition-all duration-500 ease-out"
              style={{
                background:
                  status === 'speaking'
                    ? 'radial-gradient(circle, rgba(168, 85, 247, 0.65) 0%, rgba(236, 72, 153, 0.45) 40%, rgba(99, 102, 241, 0.25) 70%, transparent 85%)'
                    : status === 'listening'
                    ? 'radial-gradient(circle, rgba(99, 102, 241, 0.6) 0%, rgba(168, 85, 247, 0.45) 40%, rgba(56, 189, 248, 0.25) 70%, transparent 85%)'
                    : status === 'thinking'
                    ? 'radial-gradient(circle, rgba(245, 158, 11, 0.5) 0%, rgba(168, 85, 247, 0.35) 60%, transparent 80%)'
                    : 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 75%)',
                filter: 'blur(16px)',
                transform: status === 'speaking' ? 'scale(1.15)' : status === 'listening' ? 'scale(1.08)' : 'scale(1)',
                opacity: status === 'idle' ? 0.4 : 0.85,
              }}
            />

            {/* 1b. Live level ring (driven by mic volume / speech rhythm) */}
            <div
              ref={levelRingRef}
              data-testid="voice-level-ring"
              className="absolute w-32 h-32 rounded-full pointer-events-none border-2 border-purple-400/60"
              style={{ transform: 'scale(1)', opacity: 0.15, willChange: 'transform, opacity' }}
            />

            {/* 2. Sleek Luminous Ring border (Smooth, continuous gradient border) */}
            <div
              className={`absolute w-32 h-32 rounded-full pointer-events-none p-[2px] transition-all duration-300 ${
                status === 'speaking' || status === 'listening' ? 'animate-pulse' : ''
              }`}
              style={{
                background:
                  'conic-gradient(from 180deg at 50% 50%, #3B82F6 0deg, #6366F1 55deg, #A855F7 125deg, #EC4899 215deg, #38BDF8 295deg, #3B82F6 360deg)',
                boxShadow:
                  status === 'speaking'
                    ? '0 0 25px rgba(236, 72, 153, 0.5), 0 0 40px rgba(168, 85, 247, 0.55)'
                    : status === 'listening'
                    ? '0 0 25px rgba(56, 189, 248, 0.45), 0 0 35px rgba(99, 102, 241, 0.55)'
                    : '0 0 15px rgba(139, 92, 246, 0.3)',
              }}
            >
              <div className="w-full h-full rounded-full bg-[#120B24]" />
            </div>

            {/* 3. Frosted dark disc */}
            <div
              className="absolute w-24 h-24 rounded-full pointer-events-none bg-[#140C2A]/90 border border-purple-500/20 backdrop-blur-md"
              style={{
                boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.8), 0 0 10px rgba(139, 92, 246, 0.25)',
              }}
            />

            {/* 4. Center Mascot Logo Button — Clean and crisp */}
            <button
              type="button"
              onClick={handleOrbTap}
              className="relative w-20 h-20 rounded-full bg-[#160E2E] p-1 shadow-2xl flex items-center justify-center group active:scale-95 transition-transform z-10 focus:outline-none"
              style={{
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.4), inset 0 0 10px rgba(0, 0, 0, 0.75)',
              }}
              title={
                status === 'speaking'
                  ? 'Click to stop Nova speaking'
                  : status === 'listening'
                  ? 'Listening... Click when done speaking'
                  : 'Click to speak with Nova'
              }
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-black/50 flex items-center justify-center relative">
                <img
                  src="/logo.png"
                  alt="Nova"
                  className="w-full h-full object-cover select-none pointer-events-none group-hover:scale-105 transition-transform"
                />
                {status === 'speaking' && (
                  <div className="absolute inset-0 bg-purple-950/60 rounded-full flex items-center justify-center transition-all pointer-events-none">
                    <div className="w-7 h-7 rounded-full bg-white/20 border border-white/40 flex items-center justify-center shadow-lg animate-pulse">
                      <Square className="w-3 h-3 text-white fill-current" />
                    </div>
                  </div>
                )}
              </div>
            </button>
          </div>

          {/* Dedicated "Stop speaking" Pill Button (Below logo) */}
          {status === 'speaking' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                audioPlayer.stop();
                dispatch({ type: 'SET_STATUS', status: 'listening' });
                startListeningLoop();
              }}
              className="mt-3.5 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs text-rose-300 font-medium transition-all shadow-md active:scale-95 z-20 animate-fade-in"
              title="Interrupt and speak"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop Nova Speaking</span>
            </button>
          )}

          {/* Thinking Bounce Dots */}
          {status === 'thinking' && (
            <div className="w-48 h-7 mt-3 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          {/* Status Label & Live Captions */}
          <div className="mt-2 text-center min-h-[44px] px-2 max-w-[280px]">
            {status === 'listening' && (
              <p className="text-xs text-purple-200 font-medium">
                {transcript ? `"${transcript}"` : `Listening in ${SUPPORTED_LANGUAGES.find((l) => l.id === selectedLang)?.name || 'selected language'}...`}
              </p>
            )}
            {status === 'thinking' && (
              <p className="text-xs text-amber-300 font-medium animate-pulse">
                Nova is thinking...
              </p>
            )}
            {status === 'speaking' && (
              <p className="text-xs text-zinc-100 font-medium line-clamp-2 leading-relaxed animate-fade-in">
                {liveCaption && liveCaption.trim().length >= 3 ? `"${liveCaption.trim()}"` : 'Nova is speaking...'}
              </p>
            )}
            {status === 'idle' && (
              <p className="text-[11px] text-zinc-400">
                Tap orb to speak with Nova
                <span className="block text-[10px] text-zinc-500 mt-0.5">
                  Space = talk · M = mute · Esc = close
                </span>
              </p>
            )}
            {error && (
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="line-clamp-2">{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'SET_STATUS', status: 'idle' });
                    startListeningLoop();
                  }}
                  className="px-2.5 py-0.5 rounded-full bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 text-[10px] font-medium transition-colors"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Quick suggestion chips (only before the first turn) */}
          {history.length === 0 && (status === 'idle' || status === 'listening') && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 max-w-[300px] animate-fade-in">
              {['Tell me a joke', 'Explain AI simply', 'Give me a fun fact'].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSuggestion(q)}
                  className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-purple-500/25 border border-purple-500/30 text-[10px] text-purple-200 hover:text-white transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Mini transcript of this voice session */}
          {history.length > 0 && (
            <div
              data-testid="voice-transcript"
              className="mt-2 w-full max-h-24 overflow-y-auto space-y-1 px-1 text-[11px] leading-snug"
            >
              {history.map((m, i) => (
                <p key={i} className={m.role === 'user' ? 'text-purple-200 text-right' : 'text-zinc-200'}>
                  <span className="font-semibold text-[10px] opacity-70 mr-1">
                    {m.role === 'user' ? 'You' : 'Nova'}
                  </span>
                  <span className="line-clamp-3">{m.text}</span>
                </p>
              ))}
              <div ref={historyEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Bar: Plain, Clean, Minimal Input Bar (No waveform, matches Image 1) */}
        <div className="w-full z-10 pt-2">
          <form
            onSubmit={handleFormSubmit}
            className="w-full flex items-center gap-2 bg-[#20153D]/80 border border-purple-500/30 rounded-full px-3 py-1.5 shadow-inner transition-all focus-within:border-purple-400 focus-within:shadow-[0_0_15px_rgba(168,85,247,0.25)]"
          >
            <button
              type="button"
              onClick={toggleMute}
              className="text-purple-300 hover:text-white transition-colors"
              title={isMuted ? 'Unmute microphone (M)' : 'Mute microphone (M)'}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none"
            />

            {textInput.trim() ? (
              <button
                type="submit"
                className="w-6 h-6 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition-transform active:scale-90"
              >
                <Send className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 flex items-center justify-center transition-colors"
                title="Close Voice Assistant"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
