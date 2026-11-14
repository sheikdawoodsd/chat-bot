/**
 * Helper to manage intro seen state in localStorage and backend SQLite database.
 */

const INTRO_STORAGE_KEY_PREFIX = 'nova_intro_seen_';

export function hasUserSeenIntro(userId) {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${INTRO_STORAGE_KEY_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
}

export async function markIntroAsSeen(userId) {
  if (!userId) return;
  // 1. Write localStorage fallback immediately
  try {
    localStorage.setItem(`${INTRO_STORAGE_KEY_PREFIX}${userId}`, 'true');
  } catch (e) {
    console.warn('[Nova Intro] LocalStorage write error:', e);
  }

  // 2. Persist to server SQLite
  try {
    await fetch('/api/auth/intro-seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.warn('[Nova Intro] Backend intro-seen update error:', e);
  }
}

