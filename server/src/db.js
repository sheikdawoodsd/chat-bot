import pg from 'pg';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Hi Nova! database layer — PostgreSQL (Supabase).
//
// Everything a user creates (account, chats, messages, uploaded / generated
// files) lives in Postgres, so it survives Render restarts, sleeps and redeploys.
// All functions are async.
// ---------------------------------------------------------------------------

// BIGINT (timestamps) -> JS number, so the API keeps returning numbers.
pg.types.setTypeParser(20, (v) => Number(v));

const rawUrl = (process.env.DATABASE_URL || '').trim();
if (!rawUrl) {
  console.error('[Nova DB] DATABASE_URL is not set. Accounts and chats cannot be stored.');
  throw new Error('DATABASE_URL is required');
}

// The Supabase pooler host is either aws-0-<region> or aws-1-<region> depending on
// when the project was created. Try the configured URL first, then its sibling.
function candidateUrls(url) {
  const list = [url];
  if (url.includes('.pooler.supabase.com')) {
    if (/@aws-0-/.test(url)) list.push(url.replace('@aws-0-', '@aws-1-'));
    else if (/@aws-1-/.test(url)) list.push(url.replace('@aws-1-', '@aws-0-'));
  }
  return list;
}

function makePool(connectionString) {
  const p = new pg.Pool({
    connectionString,
    max: 6,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    // Supabase needs TLS; a local test database does not.
    ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString) ? false : { rejectUnauthorized: false },
  });
  p.on('error', (err) => console.warn('[Nova DB] idle client error:', err.message));
  return p;
}

let pool = null;
let lastErr = null;
for (const url of candidateUrls(rawUrl)) {
  const candidate = makePool(url);
  try {
    await candidate.query('SELECT 1');
    pool = candidate;
    break;
  } catch (err) {
    lastErr = err;
    console.warn('[Nova DB] connection attempt failed:', err.message);
    try {
      await candidate.end();
    } catch {}
  }
}
if (!pool) {
  throw new Error(`Could not connect to the database: ${lastErr?.message}`);
}
console.log('[Nova DB] Connected to PostgreSQL (Supabase)');

// ----- query helpers: write SQL with "?" placeholders, they become $1, $2 ... -----
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}
async function all(sql, params = []) {
  const res = await pool.query(toPg(sql), params);
  return res.rows;
}
async function get(sql, params = []) {
  const res = await pool.query(toPg(sql), params);
  return res.rows[0] || null;
}
async function run(sql, params = []) {
  return pool.query(toPg(sql), params);
}

const USER_COLS = `id, email, username, password_hash AS "passwordHash", full_name AS "fullName",
  has_seen_intro AS "hasSeenIntro", avatar_url AS "avatarUrl", created_at AS "createdAt", updated_at AS "updatedAt"`;
const CHAT_COLS = `id, title, workspace_mode AS "workspaceMode", project_id AS "projectId",
  created_at AS "createdAt", updated_at AS "updatedAt"`;
const SCHED_COLS = `id, user_id AS "userId", title, prompt, schedule_type AS "scheduleType", time_spec AS "timeSpec",
  is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt", last_run_at AS "lastRunAt"`;
const PROJECT_COLS = `id, user_id AS "userId", name, created_at AS "createdAt", updated_at AS "updatedAt"`;

// ==================== User Operations ====================

export async function createUser({ id, email, username, passwordHash, fullName }) {
  const now = Date.now();
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = fullName.trim();
  const cleanUsername = (username || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_'))
    .trim()
    .slice(0, 20);

  await run(
    `INSERT INTO users (id, email, username, password_hash, full_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, cleanEmail, cleanUsername, passwordHash, cleanName, now, now]
  );
  return { id, email: cleanEmail, username: cleanUsername, fullName: cleanName, hasSeenIntro: false, createdAt: now };
}

export async function markIntroSeen(userId) {
  if (!userId) return false;
  await run(`UPDATE users SET has_seen_intro = 1, updated_at = ? WHERE id = ?`, [Date.now(), userId]);
  return true;
}

export async function getUserByEmail(email) {
  if (!email) return null;
  return get(`SELECT ${USER_COLS} FROM users WHERE lower(email) = ?`, [email.toLowerCase().trim()]);
}

export async function getUserByUsername(username) {
  if (!username) return null;
  return get(`SELECT ${USER_COLS} FROM users WHERE lower(username) = ?`, [username.toLowerCase().trim()]);
}

export async function isUsernameAvailable(username, excludeUserId = null) {
  if (!username) return false;
  const clean = username.toLowerCase().trim();
  if (clean.length < 3 || clean.length > 20 || !/^[a-zA-Z0-9_]+$/.test(clean)) {
    return false;
  }
  const existing = await getUserByUsername(clean);
  if (!existing) return true;
  if (excludeUserId && existing.id === excludeUserId) return true;
  return false;
}

export async function getUserById(id) {
  if (!id) return null;
  return get(`SELECT ${USER_COLS} FROM users WHERE id = ?`, [id]);
}

export async function updateUserName(userId, fullName) {
  await run(`UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?`, [fullName.trim(), Date.now(), userId]);
  return getUserById(userId);
}

export async function updateUserProfile(userId, { fullName, username, avatarUrl, newPasswordHash }) {
  const now = Date.now();
  const cleanName = fullName.trim();
  const cleanUsername = username.trim().toLowerCase();
  const avatar = avatarUrl !== undefined ? avatarUrl : null;

  if (newPasswordHash) {
    await run(
      `UPDATE users SET full_name = ?, username = ?, avatar_url = coalesce(?, avatar_url), password_hash = ?, updated_at = ? WHERE id = ?`,
      [cleanName, cleanUsername, avatar, newPasswordHash, now, userId]
    );
  } else {
    await run(
      `UPDATE users SET full_name = ?, username = ?, avatar_url = coalesce(?, avatar_url), updated_at = ? WHERE id = ?`,
      [cleanName, cleanUsername, avatar, now, userId]
    );
  }
  return getUserById(userId);
}

export async function deleteUser(userId) {
  const files = await all(
    `SELECT a.path FROM attachments a
     JOIN messages m ON a.message_id = m.id
     JOIN chats c ON m.chat_id = c.id
     WHERE c.user_id = ?`,
    [userId]
  );
  await run(`DELETE FROM users WHERE id = ?`, [userId]);
  return files.map((f) => f.path);
}

// ==================== Chat Operations ====================

export async function listChats(userId) {
  return all(
    `SELECT ${CHAT_COLS} FROM chats
     WHERE user_id = ? AND (is_archived IS NULL OR is_archived = 0)
     ORDER BY updated_at DESC`,
    [userId]
  );
}

export async function getChat(chatId, userId) {
  const chat = await get(`SELECT ${CHAT_COLS}, user_id AS "userId" FROM chats WHERE id = ? AND user_id = ?`, [chatId, userId]);
  if (!chat) return null;

  const rawMessages = await all(
    `SELECT id, chat_id AS "chatId", role, content, feedback, created_at AS "createdAt"
     FROM messages WHERE chat_id = ? ORDER BY created_at ASC`,
    [chatId]
  );

  // One query for every attachment in the chat (instead of one per message)
  const rawAtts = await all(
    `SELECT a.id, a.message_id AS "messageId", a.filename, a.mime_type AS "mimeType", a.size
     FROM attachments a
     JOIN messages m ON a.message_id = m.id
     WHERE m.chat_id = ?
     ORDER BY a.created_at ASC`,
    [chatId]
  );
  const attsByMessage = new Map();
  for (const att of rawAtts) {
    if (!attsByMessage.has(att.messageId)) attsByMessage.set(att.messageId, []);
    attsByMessage.get(att.messageId).push({
      id: att.id,
      name: att.filename,
      type: att.mimeType,
      size: att.size,
      url: `/api/files/${att.id}`,
    });
  }

  const messages = rawMessages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    feedback: msg.feedback || null,
    timestamp: msg.createdAt,
    attachments: attsByMessage.get(msg.id) || [],
  }));

  return { ...chat, messages };
}

export async function createChat({ id, userId, title, workspaceMode = 'general', projectId = null }) {
  const now = Date.now();
  const safeTitle = (title || 'New Chat').trim().slice(0, 80);
  const mode = workspaceMode || 'general';
  const projId = projectId || null;
  await run(
    `INSERT INTO chats (id, user_id, title, workspace_mode, project_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, safeTitle, mode, projId, now, now]
  );
  return { id, userId, title: safeTitle, workspaceMode: mode, projectId: projId, createdAt: now, updatedAt: now };
}

export async function renameChat(chatId, userId, title) {
  const now = Date.now();
  const safeTitle = (title || 'Untitled Chat').trim().slice(0, 80);
  await run(`UPDATE chats SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?`, [safeTitle, now, chatId, userId]);
  return { id: chatId, title: safeTitle, updatedAt: now };
}

export async function touchChat(chatId, userId) {
  await run(`UPDATE chats SET updated_at = ? WHERE id = ? AND user_id = ?`, [Date.now(), chatId, userId]);
}

export async function deleteChat(chatId, userId) {
  const files = await all(
    `SELECT a.path FROM attachments a
     JOIN messages m ON a.message_id = m.id
     JOIN chats c ON m.chat_id = c.id
     WHERE c.id = ? AND c.user_id = ?`,
    [chatId, userId]
  );
  await run(`DELETE FROM chats WHERE id = ? AND user_id = ?`, [chatId, userId]);
  return files.map((f) => f.path);
}

export async function clearAllChats(userId) {
  const files = await all(
    `SELECT a.path FROM attachments a
     JOIN messages m ON a.message_id = m.id
     JOIN chats c ON m.chat_id = c.id
     WHERE c.user_id = ?`,
    [userId]
  );
  await run(`DELETE FROM chats WHERE user_id = ?`, [userId]);
  return files.map((f) => f.path);
}

export async function listArchivedChats(userId) {
  return all(
    `SELECT ${CHAT_COLS}, archived_at AS "archivedAt" FROM chats
     WHERE user_id = ? AND is_archived = 1
     ORDER BY archived_at DESC, updated_at DESC`,
    [userId]
  );
}

export async function archiveChat(chatId, userId) {
  const now = Date.now();
  await run(`UPDATE chats SET is_archived = 1, archived_at = ? WHERE id = ? AND user_id = ?`, [now, chatId, userId]);
  return { id: chatId, isArchived: 1, archivedAt: now };
}

export async function unarchiveChat(chatId, userId) {
  const now = Date.now();
  await run(
    `UPDATE chats SET is_archived = 0, archived_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?`,
    [now, chatId, userId]
  );
  return { id: chatId, isArchived: 0, archivedAt: null, updatedAt: now };
}

export async function searchArchivedChats(userId, query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return listArchivedChats(userId);
  }
  const pattern = `%${query.trim()}%`;
  return all(
    `SELECT DISTINCT c.id, c.title, c.workspace_mode AS "workspaceMode", c.project_id AS "projectId",
            c.created_at AS "createdAt", c.updated_at AS "updatedAt", c.archived_at AS "archivedAt"
     FROM chats c
     LEFT JOIN messages m ON m.chat_id = c.id
     WHERE c.user_id = ? AND c.is_archived = 1 AND (c.title ILIKE ? OR m.content ILIKE ?)
     ORDER BY c.archived_at DESC
     LIMIT 50`,
    [userId, pattern, pattern]
  );
}

// ==================== Scheduled Tasks ====================

export async function listScheduledTasks(userId) {
  return all(`SELECT ${SCHED_COLS} FROM scheduled_tasks WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
}

export async function createScheduledTask({ userId, title, prompt, scheduleType = 'weekly', timeSpec = '' }) {
  const now = Date.now();
  const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanTitle = (title || 'Scheduled Task').trim().slice(0, 100);
  const cleanPrompt = (prompt || '').trim();
  await run(
    `INSERT INTO scheduled_tasks (id, user_id, title, prompt, schedule_type, time_spec, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, cleanTitle, cleanPrompt, scheduleType, timeSpec, 1, now, now]
  );
  return { id, userId, title: cleanTitle, prompt: cleanPrompt, scheduleType, timeSpec, isActive: 1, createdAt: now, updatedAt: now };
}

export async function toggleScheduledTask(taskId, userId, isActive) {
  const now = Date.now();
  await run(`UPDATE scheduled_tasks SET is_active = ?, updated_at = ? WHERE id = ? AND user_id = ?`, [
    isActive ? 1 : 0,
    now,
    taskId,
    userId,
  ]);
  return { id: taskId, isActive: isActive ? 1 : 0, updatedAt: now };
}

export async function deleteScheduledTask(taskId, userId) {
  await run(`DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?`, [taskId, userId]);
  return { success: true };
}

// ==================== Project Operations ====================

export async function listProjects(userId) {
  return all(`SELECT ${PROJECT_COLS} FROM projects WHERE user_id = ? ORDER BY updated_at DESC`, [userId]);
}

export async function getProject(projectId, userId) {
  return get(`SELECT ${PROJECT_COLS} FROM projects WHERE id = ? AND user_id = ?`, [projectId, userId]);
}

export async function createProject({ id, userId, name }) {
  const now = Date.now();
  const safeName = (name || 'New Project').trim().slice(0, 80);
  const projId = id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await run(`INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [
    projId,
    userId,
    safeName,
    now,
    now,
  ]);
  return { id: projId, userId, name: safeName, createdAt: now, updatedAt: now };
}

export async function renameProject(projectId, userId, name) {
  const now = Date.now();
  const safeName = (name || 'Untitled Project').trim().slice(0, 80);
  await run(`UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?`, [safeName, now, projectId, userId]);
  return { id: projectId, name: safeName, updatedAt: now };
}

export async function deleteProject(projectId, userId) {
  await run(`DELETE FROM projects WHERE id = ? AND user_id = ?`, [projectId, userId]);
  return true;
}

export async function touchProject(projectId, userId) {
  if (!projectId || !userId) return;
  try {
    await run(`UPDATE projects SET updated_at = ? WHERE id = ? AND user_id = ?`, [Date.now(), projectId, userId]);
  } catch {}
}

/**
 * Search chats by title and message contents
 */
export async function searchChats(userId, query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }
  const cleanQuery = query.trim();
  const likePattern = `%${cleanQuery}%`;

  const matchedChats = await all(
    `SELECT DISTINCT c.id, c.title, c.created_at AS "createdAt", c.updated_at AS "updatedAt"
     FROM chats c
     LEFT JOIN messages m ON m.chat_id = c.id
     WHERE c.user_id = ? AND (c.is_archived IS NULL OR c.is_archived = 0) AND (c.title ILIKE ? OR m.content ILIKE ?)
     ORDER BY c.updated_at DESC
     LIMIT 40`,
    [userId, likePattern, likePattern]
  );

  const results = [];
  for (const chat of matchedChats) {
    let snippet = '';
    const matchRow = await get(
      `SELECT content FROM messages WHERE chat_id = ? AND content ILIKE ? ORDER BY created_at ASC LIMIT 1`,
      [chat.id, likePattern]
    );
    if (matchRow && matchRow.content) {
      const idx = matchRow.content.toLowerCase().indexOf(cleanQuery.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(matchRow.content.length, idx + cleanQuery.length + 50);
        snippet =
          (start > 0 ? '...' : '') +
          matchRow.content.slice(start, end).replace(/\s+/g, ' ') +
          (end < matchRow.content.length ? '...' : '');
      } else {
        snippet = matchRow.content.slice(0, 90).replace(/\s+/g, ' ');
      }
    }
    results.push({
      id: chat.id,
      title: chat.title,
      snippet,
      updatedAt: chat.updatedAt,
      createdAt: chat.createdAt,
    });
  }
  return results;
}

// ==================== Message & Attachment Operations ====================

export async function saveMessage({ id, chatId, role, content, feedback = null, createdAt }) {
  const now = createdAt || Date.now();
  await run(
    `INSERT INTO messages (id, chat_id, role, content, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, chatId, role, content, feedback, now]
  );
  return { id, chatId, role, content, feedback, createdAt: now };
}

export async function setMessageFeedback(messageId, userId, feedback) {
  const cleanFeedback = feedback === 'like' || feedback === 'dislike' ? feedback : null;
  await run(
    `UPDATE messages SET feedback = ? WHERE id = ? AND chat_id IN (SELECT id FROM chats WHERE user_id = ?)`,
    [cleanFeedback, messageId, userId]
  );
  return { success: true, messageId, feedback: cleanFeedback };
}

/**
 * Saves the attachment row AND the file bytes. Render's disk is wiped on every
 * restart, so the database copy is the permanent one; the disk file is a cache.
 */
export async function saveAttachment({ id, messageId, filename, mimeType, size, path: filePath, createdAt }) {
  const now = createdAt || Date.now();
  let data = null;
  try {
    if (filePath && fs.existsSync(filePath)) data = fs.readFileSync(filePath);
  } catch (err) {
    console.warn('[Nova DB] Could not read file for permanent storage:', err.message);
  }
  await run(
    `INSERT INTO attachments (id, message_id, filename, mime_type, size, path, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, messageId, filename, mimeType, size, filePath, data, now]
  );
  return { id, messageId, filename, mimeType, size, path: filePath, createdAt: now };
}

/**
 * Returns the attachment record. If the cached disk file is gone (restart /
 * redeploy), it is written back from the database first.
 */
export async function getAttachmentById(id) {
  const row = await get(
    `SELECT a.id, a.message_id AS "messageId", a.filename, a.mime_type AS "mimeType", a.size, a.path,
            a.created_at AS "createdAt", m.chat_id AS "chatId", c.user_id AS "userId"
     FROM attachments a
     JOIN messages m ON a.message_id = m.id
     JOIN chats c ON m.chat_id = c.id
     WHERE a.id = ?`,
    [id]
  );
  if (!row) return null;

  if (row.path && !fs.existsSync(row.path)) {
    try {
      const blob = await get(`SELECT data FROM attachments WHERE id = ?`, [id]);
      if (blob && blob.data) {
        fs.mkdirSync(path.dirname(row.path), { recursive: true });
        fs.writeFileSync(row.path, blob.data);
      }
    } catch (err) {
      console.warn('[Nova DB] Could not restore file from database:', err.message);
    }
  }
  return row;
}

export default {
  createUser,
  markIntroSeen,
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
