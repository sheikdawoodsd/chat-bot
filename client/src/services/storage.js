import { openDB } from 'idb';

const DB_NAME = 'hi_nova_db';
const DB_VERSION = 1;
const STORE_CHATS = 'chats';
const STORE_META = 'meta';

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_CHATS)) {
          const chatStore = db.createObjectStore(STORE_CHATS, { keyPath: 'id' });
          chatStore.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Migrate existing chats from localStorage into IndexedDB on first run
 */
async function migrateFromLocalStorage(db) {
  try {
    const rawSessions = localStorage.getItem('nova_chat_sessions');
    if (rawSessions) {
      const parsed = JSON.parse(rawSessions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const tx = db.transaction(STORE_CHATS, 'readwrite');
        for (const chat of parsed) {
          if (chat && chat.id) {
            await tx.store.put(chat);
          }
        }
        await tx.done;
      }
      // Keep a backup or mark migrated
      localStorage.setItem('nova_migrated_to_idb', 'true');
    }

    const activeId = localStorage.getItem('nova_active_chat_id');
    if (activeId) {
      const cleanId = activeId.replace(/^"(.*)"$/, '$1');
      await db.put(STORE_META, { key: 'active_chat_id', value: cleanId });
    }
  } catch (err) {
    console.warn('Migration from localStorage skipped or failed:', err);
  }
}

let isMigrated = false;

/**
 * Fetch all chats sorted by most recently updated
 */
export async function getAllChats() {
  const db = await getDB();
  if (!isMigrated) {
    await migrateFromLocalStorage(db);
    isMigrated = true;
  }
  const allChats = await db.getAll(STORE_CHATS);
  return allChats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Get a single chat by ID
 */
export async function getChat(id) {
  if (!id) return null;
  const db = await getDB();
  return (await db.get(STORE_CHATS, id)) || null;
}

/**
 * Save or update a single chat
 */
export async function saveChat(chat) {
  if (!chat || !chat.id) return;
  const db = await getDB();
  await db.put(STORE_CHATS, chat);
}

/**
 * Save an entire list of chats
 */
export async function saveAllChats(chats) {
  if (!Array.isArray(chats)) return;
  const db = await getDB();
  const tx = db.transaction(STORE_CHATS, 'readwrite');
  for (const chat of chats) {
    if (chat && chat.id) {
      await tx.store.put(chat);
    }
  }
  await tx.done;
}

/**
 * Delete a chat by ID
 */
export async function deleteChat(id) {
  if (!id) return;
  const db = await getDB();
  await db.delete(STORE_CHATS, id);
}

/**
 * Get active chat ID
 */
export async function getActiveChatId() {
  const db = await getDB();
  const entry = await db.get(STORE_META, 'active_chat_id');
  return entry ? entry.value : null;
}

/**
 * Set active chat ID
 */
export async function setActiveChatId(id) {
  const db = await getDB();
  await db.put(STORE_META, { key: 'active_chat_id', value: id });
}

/**
 * Voice settings (voice URI, rate, pitch)
 */
export async function getVoiceSettings() {
  const db = await getDB();
  const entry = await db.get(STORE_META, 'voice_settings');
  return entry ? entry.value : { voiceURI: '', rate: 1.0, pitch: 1.0 };
}

export async function saveVoiceSettings(settings) {
  const db = await getDB();
  await db.put(STORE_META, { key: 'voice_settings', value: settings });
}

/**
 * Clear all local chats from IndexedDB and localStorage after server import
 */
export async function clearAllLocalChats() {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_CHATS, 'readwrite');
    await tx.store.clear();
    await tx.done;
    localStorage.removeItem('nova_chat_sessions');
    localStorage.removeItem('nova_active_chat_id');
  } catch (err) {
    console.warn('Failed to clear local chats:', err);
  }
}


