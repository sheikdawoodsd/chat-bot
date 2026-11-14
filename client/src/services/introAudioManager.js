/**
 * introAudioManager - Synchronous audio initialization & playback manager
 * Resolves browser autoplay restrictions by unlocking/playing directly inside user click events.
 */

class IntroAudioManager {
  constructor() {
    this.audio = null;
    this.isMuted = false;
  }

  getAudio() {
    if (typeof window === 'undefined') return null;
    if (!this.audio) {
      this.audio = new Audio('/audio/intro-theme.mp3');
      this.audio.preload = 'auto';
      this.audio.loop = false;
    }
    return this.audio;
  }

  /**
   * Must be called synchronously inside user click event (e.g. Replay Intro button)
   * to guarantee browser autoplay authorization on the first click.
   * If already playing from a recent start (< 0.5s in), skip reset to prevent
   * the remount double-call from killing audio on first replay.
   */
  startReplayAudio() {
    const audio = this.getAudio();
    if (!audio) return null;

    try {
      // If audio is already playing and near the beginning, don't restart it.
      // This prevents the NovaIntro useEffect remount from killing the audio
      // that was just started synchronously in the user's click handler.
      if (!audio.paused && audio.currentTime < 0.5) {
        audio.muted = this.isMuted;
        return audio;
      }

      audio.pause();
      audio.currentTime = 0;
      audio.muted = this.isMuted;
      audio.volume = 0.75;

      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn('[Nova IntroAudio] Autoplay playback attempt notice:', err.message);
        });
      }
    } catch (e) {
      console.warn('[Nova IntroAudio] Initialization notice:', e);
    }
    return audio;
  }

  stopAudio() {
    if (!this.audio) return;
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
    } catch {}
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.audio) {
      this.audio.muted = muted;
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  fadeOutAndStop(durationMs = 600, onDone) {
    const audio = this.audio;
    if (!audio || audio.paused) {
      this.stopAudio();
      onDone?.();
      return;
    }

    const startVol = audio.volume;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const newVol = Math.max(0, startVol * (1 - progress));
      audio.volume = newVol;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.stopAudio();
        onDone?.();
      }
    };

    requestAnimationFrame(step);
  }
}

export const introAudioManager = new IntroAudioManager();

