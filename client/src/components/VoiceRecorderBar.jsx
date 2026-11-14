import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Square, ArrowUp, Loader2, AlertCircle } from 'lucide-react';

export function VoiceRecorderBar({ onTranscribed, onSendAudio, onCancel }) {
  const canvasRef = useRef(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const animFrameRef = useRef(null);
  const barsRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const autoSendRef = useRef(false);
  const lastBlobRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechTextRef = useRef('');

  // Cleanly teardown microphone stream and audio context
  const cleanupAudio = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {}
    }
    recorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
    }
  }, []);

  // Send recorded audio to backend /api/transcribe with 60s timeout and Web Speech instant resolution
  const handleFinishRecording = useCallback(
    async (blob, shouldAutoSend) => {
      if (!blob || blob.size < 500) {
        onCancel?.();
        return;
      }

      lastBlobRef.current = blob;

      // 1. Instant Zero-Latency Resolution: If browser SpeechRecognition already transcribed the speech, use it immediately!
      if (speechTextRef.current && speechTextRef.current.trim().length > 0) {
        const directText = speechTextRef.current.trim();
        setIsTranscribing(false);
        if (onTranscribed) {
          onTranscribed(directText, shouldAutoSend);
        } else if (onSendAudio) {
          onSendAudio(directText);
        }
        return;
      }

      setIsTranscribing(true);
      setError('');

      // 60-second generous timeout for multimodal audio processing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const formData = new FormData();
        const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('wav') ? 'wav' : 'webm';
        formData.append('audio', blob, `voice_${Date.now()}.${ext}`);

        const res = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to transcribe audio.');
        }

        let text = (data.text || '').trim();
        // Fallback to speechText if API text is empty
        if (!text && speechTextRef.current.trim()) {
          text = speechTextRef.current.trim();
        }

        setIsTranscribing(false);
        if (onTranscribed) {
          onTranscribed(text, shouldAutoSend);
        } else if (onSendAudio) {
          onSendAudio(text || blob);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('[Nova Voice] Transcription error:', err);

        // If local speech recognition captured the words, recover immediately!
        if (speechTextRef.current.trim()) {
          const recovered = speechTextRef.current.trim();
          setIsTranscribing(false);
          if (onTranscribed) {
            onTranscribed(recovered, shouldAutoSend);
          } else if (onSendAudio) {
            onSendAudio(recovered);
          }
          return;
        }

        setError(
          err.name === 'AbortError'
            ? 'Transcription timed out. Please try again or click Retry.'
            : (err.message || 'Unable to transcribe audio. Please try again.')
        );
        setIsTranscribing(false);
      }
    },
    [onCancel, onTranscribed, onSendAudio]
  );

  const handleRetryTranscription = () => {
    if (lastBlobRef.current) {
      handleFinishRecording(lastBlobRef.current, autoSendRef.current);
    }
  };

  // Stop recording trigger
  const stopRecording = useCallback(
    (shouldAutoSend = false) => {
      autoSendRef.current = shouldAutoSend;
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try {
          recorderRef.current.stop();
        } catch {
          cleanupAudio();
        }
      } else {
        cleanupAudio();
        onCancel?.();
      }
    },
    [cleanupAudio, onCancel]
  );

  // Initialize Microphone & Canvas Visualizer
  useEffect(() => {
    let isMounted = true;

    async function initMicrophone() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Voice recording is not supported in this browser. Please use Chrome, Edge, or Safari.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Determine supported audio mime type
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = '';
            }
          }
        }

        const options = mimeType ? { mimeType } : undefined;
        const recorder = new MediaRecorder(stream, options);
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const actualMime = recorder.mimeType || mimeType || 'audio/webm';
          const audioBlob = new Blob(chunksRef.current, { type: actualMime });
          chunksRef.current = [];
          cleanupAudio();
          handleFinishRecording(audioBlob, autoSendRef.current);
        };

        recorder.start(100);

        // Start parallel native browser speech recognition for instant 0ms transcription
        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognitionClass) {
          try {
            const recognition = new SpeechRecognitionClass();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = navigator.language || 'en-US';
            speechTextRef.current = '';

            recognition.onresult = (event) => {
              let accumulated = '';
              for (let i = 0; i < event.results.length; i++) {
                accumulated += event.results[i][0].transcript + ' ';
              }
              speechTextRef.current = accumulated.trim();
            };

            recognition.onerror = (e) => {
              console.warn('[Nova Voice] Speech recognition notice:', e.error);
            };

            recognition.start();
            recognitionRef.current = recognition;
          } catch (e) {
            console.warn('[Nova Voice] Speech recognition could not start:', e);
          }
        }

        // Setup Web Audio Analyser
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Start duration timer (auto-stop at 5 mins)
        setRecordingSeconds(0);
        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds((prev) => {
            if (prev >= 300) {
              stopRecording(false);
              return prev;
            }
            return prev + 1;
          });
        }, 1000);

        // Render waveform canvas loop
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        barsRef.current = [];

        const barWidth = 3;
        const barGap = 2.5;
        const step = barWidth + barGap;
        const maxBars = Math.floor(rect.width / step);

        let lastTime = performance.now();

        function draw(now) {
          if (!isMounted) return;
          animFrameRef.current = requestAnimationFrame(draw);

          // Update bars every ~40ms for smooth fluid scrolling
          if (now - lastTime > 40) {
            lastTime = now;
            analyser.getByteFrequencyData(freqData);

            // Compute volume/energy
            let sum = 0;
            const len = Math.min(freqData.length, 64);
            for (let i = 0; i < len; i++) {
              sum += freqData[i];
            }
            const avg = sum / len; // 0 to 255
            const normalized = Math.min(Math.max((avg - 10) / 120, 0), 1);

            // Minimum height for subtle baseline dotted line
            const minH = 3;
            const maxH = rect.height - 4;
            const height = minH + normalized * (maxH - minH);

            barsRef.current.push(height);
            if (barsRef.current.length > maxBars) {
              barsRef.current.shift();
            }
          }

          // Clear Canvas
          ctx.clearRect(0, 0, rect.width, rect.height);

          const isDark = document.documentElement.classList.contains('dark');
          const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
          if (isDark) {
            gradient.addColorStop(0, '#C4B5FD');
            gradient.addColorStop(0.5, '#8B5CF6');
            gradient.addColorStop(1, '#6D28D9');
          } else {
            gradient.addColorStop(0, '#7C3AED');
            gradient.addColorStop(0.5, '#8B5CF6');
            gradient.addColorStop(1, '#A78BFA');
          }
          ctx.fillStyle = gradient;

          // Draw vertical rounded bars from right to left
          const count = barsRef.current.length;
          const startX = rect.width - count * step;

          for (let i = 0; i < count; i++) {
            const h = barsRef.current[i];
            const x = startX + i * step;
            const y = (rect.height - h) / 2;
            const radius = barWidth / 2;

            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(x, y, barWidth, h, radius);
            } else {
              ctx.rect(x, y, barWidth, h);
            }
            ctx.fill();
          }
        }

        animFrameRef.current = requestAnimationFrame(draw);
      } catch (err) {
        console.error('[Nova Voice] Mic access error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please click the camera/mic icon in your address bar and allow permission.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else {
          setError(`Microphone error: ${err.message || 'Could not access audio input'}`);
        }
      }
    }

    initMicrophone();

    return () => {
      isMounted = false;
      cleanupAudio();
    };
  }, [cleanupAudio, handleFinishRecording, stopRecording]);

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full">
      {error ? (
        <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex items-center gap-2">
            {lastBlobRef.current && (
              <button
                type="button"
                onClick={handleRetryTranscription}
                className="px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 text-rose-300 font-medium transition-colors"
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      ) : isTranscribing ? (
        <div className="flex items-center justify-center gap-3 py-3 px-6 rounded-3xl bg-white dark:bg-[#12121A] border border-purple-500/40 shadow-xl purple-glow text-xs text-purple-600 dark:text-purple-300 font-medium animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          <span>Transcribing your speech with Gemini...</span>
        </div>
      ) : (
        <div className="relative flex items-center justify-between gap-2.5 px-3 py-2 rounded-3xl bg-white dark:bg-[#12121A] border border-purple-500/50 dark:border-purple-500/40 shadow-xl purple-glow transition-all">
          {/* Round X Button (Cancel & Discard) */}
          <button
            type="button"
            onClick={() => {
              cleanupAudio();
              onCancel?.();
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-rose-100 dark:bg-[#1C1C28] dark:hover:bg-rose-950/40 text-gray-500 hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-400 transition-colors shrink-0"
            title="Cancel recording"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Live Waveform Canvas */}
          <div className="flex-1 h-9 relative flex items-center overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full block" />
          </div>

          {/* Duration Badge */}
          <div className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 font-mono text-[11px] font-semibold shrink-0">
            {formatTimer(recordingSeconds)}
          </div>

          {/* Round Stop Button (Puts text in input box) */}
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-[#1C1C28] dark:hover:bg-[#2A2A3E] text-gray-700 dark:text-zinc-200 transition-colors shrink-0"
            title="Stop and edit text in box"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Round Send Button (Transcribes and sends immediately) */}
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/30 transition-transform active:scale-95 shrink-0"
            title="Stop and send message"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
}

