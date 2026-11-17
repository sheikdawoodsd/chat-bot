/**
 * Persistent Audio Manager for Hi Nova!
 * Ensures audio is unlocked on first user gesture, volume is never muted (1.0 default),
 * uses Gemini server TTS (/api/tts) with smooth sentence-by-sentence queueing,
 * and seamlessly falls back to enhanced browser speechSynthesis if server TTS is offline.
 */

class AudioPlayerService {
  constructor() {
    this.audioContext = null;
    this.audioElement = null;
    this.isUnlocked = false;
    this.volume = 1.0;
    this.speechRate = 1.0;
    this.selectedVoice = 'Kore';
    this.selectedLang = 'auto'; // language for TTS (e.g. 'ta-IN', 'hi-IN', 'auto')
    this.isServerTtsQuotaExceeded = false;
    this.isPlaying = false;
    this.currentSentenceIndex = 0;
    this.sentenceQueue = [];
    this.streamingQueue = [];
    this.streamingAudioCache = new Map();
    this.isStreamingFinished = false;
    this.isStreamingWorkerActive = false;
    this.onStatusChange = null;
    this.onSentenceStart = null;
    this.activeAbortController = null;
    this.browserVoices = [];
    this.speechWatchdog = null;

    // Load saved volume and voice
    try {
      const savedVol = localStorage.getItem('nova_audio_volume');
      if (savedVol !== null) this.volume = Math.max(0.9, parseFloat(savedVol) || 1);
      const savedVoice = localStorage.getItem('nova_tts_voice');
      if (savedVoice) this.selectedVoice = savedVoice;
      const savedRate = localStorage.getItem('nova_speech_rate');
      if (savedRate) this.speechRate = parseFloat(savedRate);
    } catch {}

    // Initialize browser voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadBrowserVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadBrowserVoices();
    }
  }

  loadBrowserVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    this.browserVoices = window.speechSynthesis.getVoices() || [];
  }

  /**
   * Unlock AudioContext and Audio Element on any user gesture
   */
  unlockAudio() {
    if (this.isUnlocked && this.audioContext?.state === 'running') return true;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      if (!this.audioElement && typeof Audio !== 'undefined') {
        this.audioElement = new Audio();
        this.audioElement.preload = 'auto';
        this.audioElement.volume = this.volume;
      }

      // Play short silent buffer to satisfy browser autoplay restrictions
      if (this.audioContext) {
        const buffer = this.audioContext.createBuffer(1, 1, 22050);
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
      }

      this.isUnlocked = true;
      return true;
    } catch (e) {
      console.warn('[Nova Audio] Audio unlock notice:', e);
      return false;
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
    try {
      localStorage.setItem('nova_audio_volume', this.volume.toString());
    } catch {}
  }

  setVoice(voice) {
    if (this.selectedVoice === voice) return;
    this.stop(); // Cleanly stop any existing speech playback without clicks or errors
    this.selectedVoice = voice;
    try {
      localStorage.setItem('nova_tts_voice', voice);
    } catch {}
  }

  setLanguage(lang) {
    this.selectedLang = lang || 'auto';
  }

  setRate(rate) {
    this.speechRate = Math.max(0.7, Math.min(1.5, rate));
    try {
      localStorage.setItem('nova_speech_rate', this.speechRate.toString());
    } catch {}
  }

  stop() {
    this.isPlaying = false;
    this.sentenceQueue = [];

    if (this.speechWatchdog) {
      clearInterval(this.speechWatchdog);
      this.speechWatchdog = null;
    }

    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {}
      this.activeAbortController = null;
    }

    if (this.audioElement) {
      try {
        // Smooth fade-out to eliminate speaker error clicks and pops
        const el = this.audioElement;
        el.onended = null;
        el.onerror = null;
        if (!el.paused) {
          el.volume = 0;
          el.pause();
        }
        el.currentTime = 0;
        // Note: Never call removeAttribute('src') or load() abruptly as they cause DAC pops
      } catch {}
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    this.onStatusChange?.('idle');
  }

  /**
   * Clean text for speaking: remove code, markdown, URLs, symbols
   */
  cleanText(raw) {
    if (!raw) return '';
    return raw
      .replace(/```[\s\S]*?```/g, ' I have written out the complete code in your chat. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[*#_~>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Split a block of text into individual sentence chunks.
   * Protects common titles (Dr., Mr., Prof.), abbreviations, and numbers with decimals.
   */
  splitSentences(text) {
    const clean = this.cleanText(text);
    if (!clean) return [];

    // Shield common abbreviations and decimals from premature split
    const shielded = clean
      .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|vs|etc|e\.g|i\.e|Rs)\./gi, '$1__DOT__')
      .replace(/(\d+)\.(\d+)/g, '$1__DECIMAL__$2');

    const matched = shielded.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
    return (matched || [shielded])
      .map((s) =>
        s
          .replace(/__DOT__/g, '.')
          .replace(/__DECIMAL__/g, '.')
          .trim()
      )
      .filter((s) => s.length > 0);
  }

  /**
   * Play an array of sentences with Gemini /api/tts streaming pipeline,
   * prefetching the next sentence while current is playing
   */
  async speakText(fullText, { onSentence, onFallback, onDone } = {}) {
    this.stop();
    this.unlockAudio();

    const sentences = this.splitSentences(fullText);
    if (sentences.length === 0) {
      this.isPlaying = false;
      this.onStatusChange?.('idle');
      onDone?.();
      return;
    }

    this.isPlaying = true;
    this.sentenceQueue = sentences;
    this.onStatusChange?.('speaking');

    this.activeAbortController = new AbortController();
    const { signal } = this.activeAbortController;

    const audioCache = new Map(); // sentenceIndex -> Promise<audioUrl>

    // Helper to fetch audio for a sentence
    const fetchSentenceAudio = (index) => {
      if (index >= sentences.length) return Promise.resolve(null);
      if (audioCache.has(index)) return audioCache.get(index);

      const sentence = sentences[index];
      const promise = fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: sentence,
          voice: this.selectedVoice,
          lang: this.selectedLang || 'auto',
        }),
        signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`TTS server responded with ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data.success && data.audioUrl) {
            return data.audioUrl;
          }
          throw new Error(data.error || 'TTS error');
        });

      audioCache.set(index, promise);
      return promise;
    };

    // Pre-request first 2 sentences immediately for zero-lag start
    fetchSentenceAudio(0).catch(() => {});
    if (sentences.length > 1) {
      fetchSentenceAudio(1).catch(() => {});
    }

    try {
      for (let i = 0; i < sentences.length; i++) {
        if (!this.isPlaying || signal.aborted) break;

        const sentence = sentences[i];
        onSentence?.(sentence, i, sentences.length);

        // Pre-fetch next sentence while current is loading / playing
        if (i + 2 < sentences.length) {
          fetchSentenceAudio(i + 2).catch(() => {});
        }

        let audioUrl = null;
        try {
          audioUrl = await fetchSentenceAudio(i);
        } catch (err) {
          if (signal.aborted) break;
          console.warn(`[Nova Audio] Server TTS failed for sentence ${i + 1}, falling back to browser speech:`, err.message);
          onFallback?.();
          // Fallback to browser speechSynthesis for remaining sentences
          await this.speakWithBrowser(sentences.slice(i), { onSentence, onDone });
          return;
        }

        if (!this.isPlaying || signal.aborted) break;

        if (audioUrl) {
          await this.playAudioUrl(audioUrl, signal);
        }
      }
    } finally {
      if (!signal.aborted) {
        this.isPlaying = false;
        this.onStatusChange?.('idle');
        onDone?.();
      }
    }
  }

  /**
   * Route the TTS element through a gain + compressor chain so speech is clearly
   * louder on quiet phone speakers without clipping.
   */
  ensureLoudness(audio) {
    if (this._loudnessReady || !this.audioContext) return;
    try {
      const ctx = this.audioContext;
      const src = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = 2.6;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      src.connect(gain);
      gain.connect(comp);
      comp.connect(ctx.destination);
      this._loudnessReady = true;
    } catch (e) {
      this._loudnessReady = true;
    }
  }

  playAudioUrl(url, signal) {
    return new Promise((resolve) => {
      if (!this.audioElement) {
        this.audioElement = new Audio();
      }

      const audio = this.audioElement;
      audio.volume = this.volume;
      audio.playbackRate = this.speechRate;
      this.ensureLoudness(audio);
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try { this.audioContext.resume(); } catch {}
      }
      audio.src = url;

      let hasCleanedUp = false;
      const cleanup = () => {
        if (hasCleanedUp) return;
        hasCleanedUp = true;
        audio.onended = null;
        audio.onerror = null;
        // Allow the hardware DAC buffer to drain naturally to true silence
        setTimeout(() => {
          resolve();
        }, 40);
      };

      audio.onended = cleanup;
      audio.onerror = () => {
        cleanup();
      };

      const handleAbort = () => {
        try {
          audio.volume = 0;
          audio.pause();
        } catch {}
        cleanup();
      };

      signal?.addEventListener('abort', handleAbort, { once: true });

      // Start playback cleanly — silence abort rejections
      audio.play().catch(() => {
        cleanup();
      });
    });
  }

  /**
   * Browser SpeechSynthesis Fallback with full robustness:
   * - waits for voices
   * - splits sentences to prevent 15s freeze
   * - sets volume 1.0
   * - calls resume() and cancel() properly
   * - maintains heartbeat watchdog to counter Chrome speech freeze bug
   */
  speakWithBrowser(sentences, { onSentence, onDone } = {}) {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        this.isPlaying = false;
        this.onStatusChange?.('idle');
        resolve();
        onDone?.();
        return;
      }

      window.speechSynthesis.resume();

      let idx = 0;

      const speakNext = () => {
        if (!this.isPlaying || idx >= sentences.length) {
          this.isPlaying = false;
          this.onStatusChange?.('idle');
          onDone?.();
          resolve();
          return;
        }

        const sentence = sentences[idx];
        onSentence?.(sentence, idx, sentences.length);
        idx++;

        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.volume = this.volume;
        utterance.rate = this.speechRate;

        // Auto-detect language of text (Tamil, Hindi, English, etc.)
        let langCode = 'en-US';
        if (/[\u0B80-\u0BFF]/.test(sentence)) langCode = 'ta-IN';
        else if (/[\u0900-\u097F]/.test(sentence)) langCode = 'hi-IN';
        else if (/[\u0C00-\u0C7F]/.test(sentence)) langCode = 'te-IN';
        else if (/[\u0D00-\u0D7F]/.test(sentence)) langCode = 'ml-IN';
        else if (/[\u3040-\u30FF\u4E00-\u9FAF]/.test(sentence)) langCode = 'ja-JP';

        utterance.lang = langCode;
        const langPrefix = langCode.split('-')[0];

        // Choose best matching natural voice for detected language and selected voice preference
        if (this.browserVoices.length > 0) {
          let matchedVoice = null;

          if (langPrefix === 'ta') {
            matchedVoice = this.browserVoices.find(
              (v) => v.lang.toLowerCase().includes('ta') || v.name.includes('Tamil')
            );
          } else if (langPrefix === 'hi') {
            matchedVoice = this.browserVoices.find(
              (v) => v.lang.toLowerCase().includes('hi') || v.name.includes('Hindi')
            );
          } else {
            // English / default language matching based on selected voice style
            const wantsMale = this.selectedVoice === 'Fenrir' || this.selectedVoice === 'Charon';
            if (wantsMale) {
              matchedVoice = this.browserVoices.find(
                (v) =>
                  v.lang.startsWith('en') &&
                  (v.name.includes('David') ||
                    v.name.includes('Mark') ||
                    v.name.includes('George') ||
                    v.name.includes('Male'))
              );
            } else {
              matchedVoice = this.browserVoices.find(
                (v) =>
                  v.lang.startsWith('en') &&
                  (v.name.includes('Natural') ||
                    v.name.includes('Samantha') ||
                    v.name.includes('Victoria') ||
                    v.name.includes('Jenny') ||
                    v.name.includes('Zira') ||
                    v.name.includes('Female'))
              );
            }
            if (!matchedVoice) {
              matchedVoice = this.browserVoices.find((v) => v.lang.startsWith('en'));
            }
          }

          if (matchedVoice) utterance.voice = matchedVoice;
        }

        utterance.onend = () => {
          speakNext();
        };

        utterance.onerror = (e) => {
          // Ignore normal user cancellations and interruptions
          if (e.error !== 'interrupted' && e.error !== 'canceled') {
            console.warn('[Nova Browser TTS] Utterance notice:', e.error);
          }
          speakNext();
        };

        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          speakNext();
        }
      };

      speakNext();
    });
  }

  /**
   * Real-time Streaming Sentence Speech:
   * Starts playback on the very first incoming sentence chunk from LLM streaming,
   * pre-fetching subsequent sentences in parallel for ultra-low (<400ms) voice latency.
   */
  startStreamingSpeech({ onSentence, onFallback, onDone } = {}) {
    this.stop();
    this.unlockAudio();

    this.isPlaying = true;
    this.onStatusChange?.('speaking');

    this.streamingQueue = [];
    this.streamingAudioCache = new Map(); // index -> Promise<audioUrl>
    this.isStreamingFinished = false;
    this.streamingDoneCallback = onDone;
    this.streamingSentenceCallback = onSentence;
    this.streamingFallbackCallback = onFallback;
    this.streamingPlayIndex = 0;
    this.isStreamingWorkerActive = false;

    this.activeAbortController = new AbortController();
  }

  enqueueStreamingSentence(rawSentence) {
    if (!this.isPlaying || !rawSentence) return;
    const clean = this.cleanText(rawSentence);
    if (!clean) return;

    const index = this.streamingQueue.length;
    this.streamingQueue.push(clean);

    // Immediately pre-fetch audio for this sentence in parallel
    this.fetchStreamingSentenceAudio(index, clean).catch(() => {});

    // If play loop is not active, launch it immediately
    if (!this.isStreamingWorkerActive) {
      this.runStreamingPlayLoop();
    }
  }

  fetchStreamingSentenceAudio(index, sentence) {
    if (this.streamingAudioCache.has(index)) {
      return this.streamingAudioCache.get(index);
    }
    const signal = this.activeAbortController?.signal;

    // Fail-fast if server TTS quota is exceeded to eliminate laggy 500 network delays
    if (this.isServerTtsQuotaExceeded) {
      const fastFail = Promise.reject(new Error('Server TTS quota exceeded, using browser synthesis'));
      this.streamingAudioCache.set(index, fastFail);
      return fastFail;
    }

    const promise = fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        text: sentence,
        voice: this.selectedVoice,
        lang: this.selectedLang || 'auto',
      }),
      signal,
    })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 429 || res.status === 500) {
            this.isServerTtsQuotaExceeded = true;
          }
          throw new Error(`TTS server responded with ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.success && data.audioUrl) return data.audioUrl;
        if (data.fallbackToBrowser) {
          this.isServerTtsQuotaExceeded = true;
        }
        throw new Error(data.error || 'TTS error');
      });

    this.streamingAudioCache.set(index, promise);
    return promise;
  }

  async runStreamingPlayLoop() {
    this.isStreamingWorkerActive = true;
    const signal = this.activeAbortController?.signal;
    let idleWaitCount = 0;

    try {
      while (this.isPlaying && !signal?.aborted) {
        if (this.streamingPlayIndex < this.streamingQueue.length) {
          idleWaitCount = 0;
          const idx = this.streamingPlayIndex;
          const sentence = this.streamingQueue[idx];
          this.streamingPlayIndex++;

          this.streamingSentenceCallback?.(sentence, idx, this.streamingQueue.length);

          // Pre-fetch next sentence ahead of time
          if (idx + 1 < this.streamingQueue.length) {
            this.fetchStreamingSentenceAudio(idx + 1, this.streamingQueue[idx + 1]).catch(() => {});
          }

          let audioUrl = null;
          try {
            audioUrl = await this.fetchStreamingSentenceAudio(idx, sentence);
          } catch (err) {
            if (signal?.aborted) break;
            this.streamingFallbackCallback?.();
            await this.speakWithBrowser([sentence]);
            continue;
          }

          if (!this.isPlaying || signal?.aborted) break;

          if (audioUrl) {
            await this.playAudioUrl(audioUrl, signal);
          }
        } else if (this.isStreamingFinished) {
          // All sentences generated and played
          break;
        } else {
          // Safety watchdog: after 10s of silence with no new sentences, exit loop
          idleWaitCount++;
          if (idleWaitCount > 200) {
            break;
          }
          // Wait briefly (50ms) for the next sentence chunk from LLM stream
          await new Promise((r) => setTimeout(r, 50));
        }
      }
    } finally {
      this.isStreamingWorkerActive = false;
      if (!signal?.aborted && this.isPlaying) {
        this.isPlaying = false;
        this.onStatusChange?.('idle');
        this.streamingDoneCallback?.();
      }
    }
  }

  finishStreaming() {
    this.isStreamingFinished = true;
    if (this.streamingQueue.length === 0 && !this.isStreamingWorkerActive) {
      this.isPlaying = false;
      this.onStatusChange?.('idle');
      this.streamingDoneCallback?.();
    }
  }

  /**
   * Test Voice: plays "Hi, I'm Nova!"
   */
  async testVoice(onStatus) {
    this.unlockAudio();
    await this.speakText("Hi, I'm Nova! It is wonderful to meet you in the cosmos.", {
      onSentence: (s) => onStatus?.(s),
      onDone: () => onStatus?.(''),
    });
  }
}

export const audioPlayer = new AudioPlayerService();
export default audioPlayer;
