import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve database path: default to server/data/nova.db
const rawDbPath = process.env.DATABASE_PATH || 'data/nova.db';
const dbPath = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(__dirname, '../../server', rawDbPath);

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log('[Nova DB] Connecting to SQLite at:', dbPath);

const db = new Database(dbPath);

// Enable WAL mode for high concurrent performance and enforce foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    username TEXT COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    feedback TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
`);

// Safe migrations for existing databases
try {
  db.exec(`ALTER TABLE users ADD COLUMN username TEXT COLLATE NOCASE;`);
} catch {}
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
} catch {}
try {
  db.exec(`ALTER TABLE messages ADD COLUMN feedback TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN has_seen_intro INTEGER DEFAULT 0;`);
} catch {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE chats ADD COLUMN workspace_mode TEXT DEFAULT 'general';`);
} catch {}
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
} catch {}
try {
  db.exec(`ALTER TABLE chats ADD COLUMN project_id TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE chats ADD COLUMN is_archived INTEGER DEFAULT 0;`);
} catch {}
try {
  db.exec(`ALTER TABLE chats ADD COLUMN archived_at INTEGER;`);
} catch {}
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_chats_archived ON chats(user_id, is_archived, updated_at DESC);`);
} catch {}
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      schedule_type TEXT DEFAULT 'weekly',
      time_spec TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_run_at INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
} catch {}

// Backfill empty usernames for existing records
try {
  const usersWithoutUsername = db
    .prepare(`SELECT id, email FROM users WHERE username IS NULL OR username = ''`)
    .all();

  for (const u of usersWithoutUsername) {
    let base = (u.email || 'user')
      .split('@')[0]
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .slice(0, 15);
    if (base.length < 3) base = `user_${base}`;
    let candidate = base;
    let counter = 1;
    while (db.prepare(`SELECT id FROM users WHERE username = ? AND id != ?`).get(candidate, u.id)) {
      candidate = `${base}_${counter}`.slice(0, 20);
      counter++;
    }
    db.prepare(`UPDATE users SET username = ? WHERE id = ?`).run(candidate, u.id);
  }
} catch (e) {
  console.warn('[Nova DB] Backfill warning:', e.message);
}

// Prepared statements for maximum performance
const stmts = {
  // Users
  createUser: db.prepare(`
    INSERT INTO users (id, email, username, password_hash, full_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getUserByEmail: db.prepare(`
    SELECT id, email, username, password_hash as passwordHash, full_name as fullName, has_seen_intro as hasSeenIntro, avatar_url as avatarUrl, created_at as createdAt, updated_at as updatedAt
    FROM users WHERE email = ?
  `),
  getUserByUsername: db.prepare(`
    SELECT id, email, username, password_hash as passwordHash, full_name as fullName, has_seen_intro as hasSeenIntro, avatar_url as avatarUrl, created_at as createdAt, updated_at as updatedAt
    FROM users WHERE username = ?
  `),
  getUserById: db.prepare(`
    SELECT id, email, username, password_hash as passwordHash, full_name as fullName, has_seen_intro as hasSeenIntro, avatar_url as avatarUrl, created_at as createdAt, updated_at as updatedAt
    FROM users WHERE id = ?
  `),
  markIntroSeen: db.prepare(`
    UPDATE users SET has_seen_intro = 1, updated_at = ? WHERE id = ?
  `),
  updateUserName: db.prepare(`
    UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?
  `),
  updateUserProfile: db.prepare(`
    UPDATE users SET full_name = ?, username = ?, avatar_url = coalesce(?, avatar_url), updated_at = ? WHERE id = ?
  `),
  updateUserProfileWithPassword: db.prepare(`
    UPDATE users SET full_name = ?, username = ?, avatar_url = coalesce(?, avatar_url), password_hash = ?, updated_at = ? WHERE id = ?
  `),
  deleteUser: db.prepare(`
    DELETE FROM users WHERE id = ?
  `),

  // Chats
  listChats: db.prepare(`
    SELECT id, title, workspace_mode as workspaceMode, project_id as projectId, created_at as createdAt, updated_at as updatedAt
    FROM chats
    WHERE user_id = ? AND (is_archived IS NULL OR is_archived = 0)
    ORDER BY updated_at DESC
  `),
  listArchivedChats: db.prepare(`
    SELECT id, title, workspace_mode as workspaceMode, project_id as projectId, created_at as createdAt, updated_at as updatedAt, archived_at as archivedAt
    FROM chats
    WHERE user_id = ? AND is_archived = 1
    ORDER BY archived_at DESC, updated_at DESC
  `),
  archiveChat: db.prepare(`
    UPDATE chats SET is_archived = 1, archived_at = ? WHERE id = ? AND user_id = ?
  `),
  unarchiveChat: db.prepare(`
    UPDATE chats SET is_archived = 0, archived_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?
  `),
  searchArchivedChats: db.prepare(`
    SELECT DISTINCT c.id, c.title, c.workspace_mode as workspaceMode, c.project_id as projectId, c.created_at as createdAt, c.updated_at as updatedAt, c.archived_at as archivedAt
    FROM chats c
    LEFT JOIN messages m ON m.chat_id = c.id
    WHERE c.user_id = ? AND c.is_archived = 1 AND (c.title LIKE ? OR m.content LIKE ?)
    ORDER BY c.archived_at DESC
    LIMIT 50
  `),
  getChat: db.prepare(`
    SELECT id, user_id as userId, title, workspace_mode as workspaceMode, project_id as projectId, created_at as createdAt, updated_at as updatedAt
    FROM chats
    WHERE id = ? AND user_id = ?
  `),
  createChat: db.prepare(`
    INSERT INTO chats (id, user_id, title, workspace_mode, project_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  renameChat: db.prepare(`
    UPDATE chats SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `),
  touchChat: db.prepare(`
    UPDATE chats SET updated_at = ? WHERE id = ? AND user_id = ?
  `),
  deleteChat: db.prepare(`
    DELETE FROM chats WHERE id = ? AND user_id = ?
  `),
  clearAllChats: db.prepare(`
    DELETE FROM chats WHERE user_id = ?
  `),

  // Scheduled Tasks (ChatGPT-style tasks & automation)
  listScheduledTasks: db.prepare(`
    SELECT id, user_id as userId, title, prompt, schedule_type as scheduleType, time_spec as timeSpec, is_active as isActive, created_at as createdAt, updated_at as updatedAt, last_run_at as lastRunAt
    FROM scheduled_tasks
    WHERE user_id = ?
    ORDER BY created_at DESC
  `),
  getScheduledTask: db.prepare(`
    SELECT id, user_id as userId, title, prompt, schedule_type as scheduleType, time_spec as timeSpec, is_active as isActive, created_at as createdAt, updated_at as updatedAt, last_run_at as lastRunAt
    FROM scheduled_tasks
    WHERE id = ? AND user_id = ?
  `),
  createScheduledTask: db.prepare(`
    INSERT INTO scheduled_tasks (id, user_id, title, prompt, schedule_type, time_spec, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  toggleScheduledTask: db.prepare(`
    UPDATE scheduled_tasks SET is_active = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `),
  deleteScheduledTask: db.prepare(`
    DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?
  `),

  // Projects
  listProjects: db.prepare(`
    SELECT id, user_id as userId, name, created_at as createdAt, updated_at as updatedAt
    FROM projects
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `),
  getProject: db.prepare(`
    SELECT id, user_id as userId, name, created_at as createdAt, updated_at as updatedAt
    FROM projects
    WHERE id = ? AND user_id = ?
  `),
  createProject: db.prepare(`
    INSERT INTO projects (id, user_id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `),
  renameProject: db.prepare(`
    UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `),
  deleteProject: db.prepare(`
    DELETE FROM projects WHERE id = ? AND user_id = ?
  `),
  touchProject: db.prepare(`
    UPDATE projects SET updated_at = ? WHERE id = ? AND user_id = ?
  `),

  // Search chats
  searchChats: db.prepare(`
    SELECT DISTINCT c.id, c.title, c.created_at as createdAt, c.updated_at as updatedAt
    FROM chats c
    LEFT JOIN messages m ON m.chat_id = c.id
    WHERE c.user_id = ? AND (c.is_archived IS NULL OR c.is_archived = 0) AND (c.title LIKE ? OR m.content LIKE ?)
    ORDER BY c.updated_at DESC
    LIMIT 40
  `),
  findMatchingSnippet: db.prepare(`
    SELECT content FROM messages
    WHERE chat_id = ? AND content LIKE ?
    ORDER BY created_at ASC
    LIMIT 1
  `),

  // Messages
  saveMessage: db.prepare(`
    INSERT INTO messages (id, chat_id, role, content, feedback, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getMessages: db.prepare(`
    SELECT id, chat_id as chatId, role, content, feedback, created_at as createdAt
    FROM messages
    WHERE chat_id = ?
    ORDER BY created_at ASC
  `),
  updateMessageFeedback: db.prepare(`
    UPDATE messages
    SET feedback = ?
    WHERE id = ? AND chat_id IN (SELECT id FROM chats WHERE user_id = ?)
  `),

  // Attachments
  saveAttachment: db.prepare(`
    INSERT INTO attachments (id, message_id, filename, mime_type, size, path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getAttachmentsForMessage: db.prepare(`
    SELECT id, message_id as messageId, filename, mime_type as mimeType, size, path, created_at as createdAt
    FROM attachments
    WHERE message_id = ?
  `),
  getAttachmentById: db.prepare(`
    SELECT a.id, a.message_id as messageId, a.filename, a.mime_type as mimeType, a.size, a.path, a.created_at as createdAt,
           m.chat_id as chatId, c.user_id as userId
    FROM attachments a
    JOIN messages m ON a.message_id = m.id
    JOIN chats c ON m.chat_id = c.id
    WHERE a.id = ?
  `),
  getChatFiles: db.prepare(`
    SELECT a.path
    FROM attachments a
    JOIN messages m ON a.message_id = m.id
    JOIN chats c ON m.chat_id = c.id
    WHERE c.id = ? AND c.user_id = ?
  `),
  getUserFiles: db.prepare(`
    SELECT a.path
    FROM attachments a
    JOIN messages m ON a.message_id = m.id
    JOIN chats c ON m.chat_id = c.id
    WHERE c.user_id = ?
  `),
};

// ==================== User Operations ====================

export function createUser({ id, email, username, passwordHash, fullName }) {
  const now = Date.now();
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = fullName.trim();
  const cleanUsername = (username || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_'))
    .trim()
    .slice(0, 20);

  stmts.createUser.run(id, cleanEmail, cleanUsername, passwordHash, cleanName, now, now);
  return { id, email: cleanEmail, username: cleanUsername, fullName: cleanName, hasSeenIntro: false, createdAt: now };
}

export function markIntroSeen(userId) {
  if (!userId) return false;
  stmts.markIntroSeen.run(Date.now(), userId);
  return true;
}

export function getUserByEmail(email) {
  if (!email) return null;
  return stmts.getUserByEmail.get(email.toLowerCase().trim()) || null;
}

export function getUserByUsername(username) {
  if (!username) return null;
  return stmts.getUserByUsername.get(username.toLowerCase().trim()) || null;
}

export function isUsernameAvailable(username, excludeUserId = null) {
  if (!username) return false;
  const clean = username.toLowerCase().trim();
  if (clean.length < 3 || clean.length > 20 || !/^[a-zA-Z0-9_]+$/.test(clean)) {
    return false;
  }
  const existing = stmts.getUserByUsername.get(clean);
  if (!existing) return true;
  if (excludeUserId && existing.id === excludeUserId) return true;
  return false;
}

export function getUserById(id) {
  if (!id) return null;
  return stmts.getUserById.get(id) || null;
}

export function updateUserName(userId, fullName) {
  const now = Date.now();
  stmts.updateUserName.run(fullName.trim(), now, userId);
  return getUserById(userId);
}

export function updateUserProfile(userId, { fullName, username, avatarUrl, newPasswordHash }) {
  const now = Date.now();
  const cleanName = fullName.trim();
  const cleanUsername = username.trim().toLowerCase();
  const avatar = avatarUrl !== undefined ? avatarUrl : null;

  if (newPasswordHash) {
    stmts.updateUserProfileWithPassword.run(cleanName, cleanUsername, avatar, newPasswordHash, now, userId);
  } else {
    stmts.updateUserProfile.run(cleanName, cleanUsername, avatar, now, userId);
  }
  return getUserById(userId);
}

export function deleteUser(userId) {
  // Collect all file paths to delete from disk
  const files = stmts.getUserFiles.all(userId);
  stmts.deleteUser.run(userId);
  return files.map((f) => f.path);
}

// ==================== Chat Operations ====================

export function listChats(userId) {
  return stmts.listChats.all(userId);
}

export function getChat(chatId, userId) {
  const chat = stmts.getChat.get(chatId, userId);
  if (!chat) return null;

  const rawMessages = stmts.getMessages.all(chatId);
  const messages = rawMessages.map((msg) => {
    const rawAtts = stmts.getAttachmentsForMessage.all(msg.id);
    const attachments = rawAtts.map((att) => ({
      id: att.id,
      name: att.filename,
      type: att.mimeType,
      size: att.size,
      url: `/api/files/${att.id}`,
    }));

    return {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      feedback: msg.feedback || null,
      timestamp: msg.createdAt,
      attachments,
    };
  });

  return {
    ...chat,
    messages,
  };
}

export function createChat({ id, userId, title, workspaceMode = 'general', projectId = null }) {
  const now = Date.now();
  const safeTitle = (title || 'New Chat').trim().slice(0, 80);
  const mode = workspaceMode || 'general';
  const projId = projectId || null;
  stmts.createChat.run(id, userId, safeTitle, mode, projId, now, now);
  return { id, userId, title: safeTitle, workspaceMode: mode, projectId: projId, createdAt: now, updatedAt: now };
}

export function renameChat(chatId, userId, title) {
  const now = Date.now();
  const safeTitle = (title || 'Untitled Chat').trim().slice(0, 80);
  stmts.renameChat.run(safeTitle, now, chatId, userId);
  return { id: chatId, title: safeTitle, updatedAt: now };
}

export function touchChat(chatId, userId) {
  const now = Date.now();
  stmts.touchChat.run(now, chatId, userId);
}

export function deleteChat(chatId, userId) {
  const files = stmts.getChatFiles.all(chatId, userId);
  stmts.deleteChat.run(chatId, userId);
  return files.map((f) => f.path);
}

export function clearAllChats(userId) {
  const files = stmts.getUserFiles.all(userId);
  stmts.clearAllChats.run(userId);
  return files.map((f) => f.path);
}

export function listArchivedChats(userId) {
  return stmts.listArchivedChats.all(userId);
}

export function archiveChat(chatId, userId) {
  const now = Date.now();
  stmts.archiveChat.run(now, chatId, userId);
  return { id: chatId, isArchived: 1, archivedAt: now };
}

export function unarchiveChat(chatId, userId) {
  const now = Date.now();
  stmts.unarchiveChat.run(now, chatId, userId);
  return { id: chatId, isArchived: 0, archivedAt: null, updatedAt: now };
}

export function searchArchivedChats(userId, query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return listArchivedChats(userId);
  }
  const clean = query.trim();
  const pattern = `%${clean}%`;
  return stmts.searchArchivedChats.all(userId, pattern, pattern);
}

// ==================== Scheduled Tasks ====================

export function listScheduledTasks(userId) {
  return stmts.listScheduledTasks.all(userId);
}

export function createScheduledTask({ userId, title, prompt, scheduleType = 'weekly', timeSpec = '' }) {
  const now = Date.now();
  const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanTitle = (title || 'Scheduled Task').trim().slice(0, 100);
  const cleanPrompt = (prompt || '').trim();
  stmts.createScheduledTask.run(id, userId, cleanTitle, cleanPrompt, scheduleType, timeSpec, 1, now, now);
  return { id, userId, title: cleanTitle, prompt: cleanPrompt, scheduleType, timeSpec, isActive: 1, createdAt: now, updatedAt: now };
}

export function toggleScheduledTask(taskId, userId, isActive) {
  const now = Date.now();
  stmts.toggleScheduledTask.run(isActive ? 1 : 0, now, taskId, userId);
  return { id: taskId, isActive: isActive ? 1 : 0, updatedAt: now };
}

export function deleteScheduledTask(taskId, userId) {
  stmts.deleteScheduledTask.run(taskId, userId);
  return { success: true };
}

// ==================== Project Operations ====================

export function listProjects(userId) {
  return stmts.listProjects.all(userId);
}

export function getProject(projectId, userId) {
  return stmts.getProject.get(projectId, userId) || null;
}

export function createProject({ id, userId, name }) {
  const now = Date.now();
  const safeName = (name || 'New Project').trim().slice(0, 80);
  const projId = id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  stmts.createProject.run(projId, userId, safeName, now, now);
  return { id: projId, userId, name: safeName, createdAt: now, updatedAt: now };
}

export function renameProject(projectId, userId, name) {
  const now = Date.now();
  const safeName = (name || 'Untitled Project').trim().slice(0, 80);
  stmts.renameProject.run(safeName, now, projectId, userId);
  return { id: projectId, name: safeName, updatedAt: now };
}

export function deleteProject(projectId, userId) {
  stmts.deleteProject.run(projectId, userId);
  return true;
}

export function touchProject(projectId, userId) {
  if (!projectId || !userId) return;
  try {
    stmts.touchProject.run(Date.now(), projectId, userId);
  } catch {}
}

/**
 * Search chats by title and message contents
 */
export function searchChats(userId, query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const cleanQuery = query.trim();
  const likePattern = `%${cleanQuery}%`;
  const matchedChats = stmts.searchChats.all(userId, likePattern, likePattern);

  return matchedChats.map((chat) => {
    let snippet = '';
    const matchRow = stmts.findMatchingSnippet.get(chat.id, likePattern);
    if (matchRow && matchRow.content) {
      const idx = matchRow.content.toLowerCase().indexOf(cleanQuery.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(matchRow.content.length, idx + cleanQuery.length + 50);
        snippet = (start > 0 ? '...' : '') + matchRow.content.slice(start, end).replace(/\s+/g, ' ') + (end < matchRow.content.length ? '...' : '');
      } else {
        snippet = matchRow.content.slice(0, 90).replace(/\s+/g, ' ');
      }
    }

    return {
      id: chat.id,
      title: chat.title,
      snippet,
      updatedAt: chat.updatedAt,
      createdAt: chat.createdAt,
    };
  });
}

// ==================== Message & Attachment Operations ====================

export function saveMessage({ id, chatId, role, content, feedback = null, createdAt }) {
  const now = createdAt || Date.now();
  stmts.saveMessage.run(id, chatId, role, content, feedback, now);
  return { id, chatId, role, content, feedback, createdAt: now };
}

export function setMessageFeedback(messageId, userId, feedback) {
  const cleanFeedback = feedback === 'like' || feedback === 'dislike' ? feedback : null;
  stmts.updateMessageFeedback.run(cleanFeedback, messageId, userId);
  return { success: true, messageId, feedback: cleanFeedback };
}

export function saveAttachment({ id, messageId, filename, mimeType, size, path: filePath, createdAt }) {
  const now = createdAt || Date.now();
  stmts.saveAttachment.run(id, messageId, filename, mimeType, size, filePath, now);
  return { id, messageId, filename, mimeType, size, path: filePath, createdAt: now };
}

export function getAttachmentById(id) {
  return stmts.getAttachmentById.get(id) || null;
}

export default {
  createUser,
  getUserByEmail,
  getUserByUsername,
  isUsernameAvailable,
  getUserById,
  updateUserName,
  updateUserProfile,
  deleteUser,
  listChats,
  getChat,
  createChat,
  renameChat,
  touchChat,
  deleteChat,
  clearAllChats,
  searchChats,
  listArchivedChats,
  archiveChat,
  unarchiveChat,
  searchArchivedChats,
  listScheduledTasks,
  createScheduledTask,
  toggleScheduledTask,
  deleteScheduledTask,
  listProjects,
  getProject,
  createProject,
  renameProject,
  deleteProject,
  touchProject,
  saveMessage,
  setMessageFeedback,
  saveAttachment,
  getAttachmentById,
};
