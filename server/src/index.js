import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import multer from 'multer';

import { getProvider, DEFAULT_SYSTEM_PROMPT } from './providers/index.js';
import { generateGeminiImage } from './providers/image.js';
import { transcribeAudio } from './providers/transcribe.js';
import { generateTTS } from './providers/tts.js';
import {
  createUser,
  getUserByEmail,
  getUserByUsername,
  isUsernameAvailable,
  getUserById,
  markIntroSeen,
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
  listProjects,
  getProject,
  createProject,
  renameProject,
  deleteProject,
  touchProject,
  listArchivedChats,
  archiveChat,
  unarchiveChat,
  searchArchivedChats,
  listScheduledTasks,
  createScheduledTask,
  toggleScheduledTask,
  deleteScheduledTask,
  saveMessage,
  setMessageFeedback,
  saveAttachment,
  getAttachmentById,
} from './db.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
} from './auth.js';
import {
  saveUserFile,
  deleteDiskFile,
  deleteUserUploadsDirectory,
} from './files.js';

// Load .env using an absolute path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export function reloadEnv() {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}
reloadEnv();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with credentials support for localhost & production
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please wait a few minutes.',
  },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded: Please wait a moment before sending another message to Nova.',
  },
});

const imageLimiter = rateLimit({
  windowMs: 5 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Image generation cooldown: Please wait 5 seconds before generating another image.',
  },
});

const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TTS rate limit exceeded: Please wait a moment before requesting speech again.',
  },
});

// Multer memory storage configuration (attachments & audio)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB per file
    files: 5, // Up to 5 files per message
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(png|jpe?g|webp|pdf|txt|md|csv|json|js|jsx|ts|tsx|py|html|css|c|cpp|h|hpp|java|go|rs|sql|sh|yaml|yml|webm|wav|mp3|m4a|ogg)$/i;
    const isMimeAllowed =
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('text/') ||
      file.mimetype === 'application/json' ||
      file.mimetype === 'application/javascript';

    if (allowedExtensions.test(file.originalname) || isMimeAllowed) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type for "${file.originalname}". Nova supports Images, PDF, Audio, TXT, MD, CSV, JSON, and common code files.`
        )
      );
    }
  },
});

function handleFileUpload(req, res, next) {
  upload.array('files', 5)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large: Each file must be under 15 MB.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files: You can attach at most 5 files per message.' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}

// ========================================================
// In-Memory Multi-turn Attachment Cache & Hydration Engine
// Guarantees vision model has access to all active images across turns and sections
// ========================================================
const sessionAttachmentRegistry = new Map();
const sessionChatAttachments = new Map();

function hydrateMessageAttachments(contextMessages, chatId, userId) {
  for (const msg of contextMessages) {
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        const mime = att.mimeType || att.type || '';
        const isVisualOrDoc = mime.startsWith('image/') || mime === 'application/pdf';
        if (!isVisualOrDoc) continue;

        // 1. If att.data is already valid base64 (not a URL), keep it
        if (att.data && typeof att.data === 'string' && !att.data.startsWith('/api/') && !att.data.startsWith('http')) {
          continue;
        }

        // 2. Check att.dataUrl
        if (att.dataUrl && typeof att.dataUrl === 'string' && att.dataUrl.startsWith('data:')) {
          att.data = att.dataUrl.replace(/^data:[^;]+;base64,/, '');
          att.mimeType = att.mimeType || mime;
          continue;
        }

        let hydratedBuffer = null;
        let hydratedMime = mime;

        // 3. Extract attachment ID
        const attId =
          att.id ||
          (typeof att.url === 'string' && att.url.includes('/api/files/')
            ? att.url.split('/api/files/').pop().split('?')[0]
            : null);

        // 4. Check sessionAttachmentRegistry
        if (attId && sessionAttachmentRegistry.has(attId)) {
          const cached = sessionAttachmentRegistry.get(attId);
          if (cached.base64) {
            att.data = cached.base64;
            att.mimeType = att.mimeType || cached.type;
            continue;
          } else if (cached.filePath && fs.existsSync(cached.filePath)) {
            try {
              hydratedBuffer = fs.readFileSync(cached.filePath);
              hydratedMime = cached.type || mime;
            } catch {}
          }
        }

        // 5. Check SQLite DB by attId
        if (!hydratedBuffer && attId) {
          const fileRecord = getAttachmentById(attId);
          if (fileRecord && fileRecord.path && fs.existsSync(fileRecord.path)) {
            try {
              hydratedBuffer = fs.readFileSync(fileRecord.path);
              hydratedMime = fileRecord.mimeType || mime;
            } catch {}
          }
        }

        // 6. Check SQLite DB by msg.id
        if (!hydratedBuffer && msg.id) {
          try {
            const dbAtts = stmts.getAttachmentsForMessage.all(msg.id);
            if (Array.isArray(dbAtts) && dbAtts.length > 0) {
              const matched = dbAtts.find((d) => d.filename === att.name || d.mimeType === mime) || dbAtts[0];
              if (matched && matched.path && fs.existsSync(matched.path)) {
                hydratedBuffer = fs.readFileSync(matched.path);
                hydratedMime = matched.mimeType || mime;
              }
            }
          } catch {}
        }

        // 7. Check sessionChatAttachments for this chatId
        if (!hydratedBuffer && chatId && sessionChatAttachments.has(chatId)) {
          const chatCached = sessionChatAttachments.get(chatId);
          if (Array.isArray(chatCached) && chatCached.length > 0) {
            const matched = chatCached.find((c) => c.name === att.name || c.id === att.id) || chatCached[chatCached.length - 1];
            if (matched?.base64) {
              att.data = matched.base64;
              att.mimeType = att.mimeType || matched.type;
              continue;
            } else if (matched?.filePath && fs.existsSync(matched.filePath)) {
              try {
                hydratedBuffer = fs.readFileSync(matched.filePath);
                hydratedMime = matched.type || mime;
              } catch {}
            }
          }
        }

        if (hydratedBuffer) {
          att.data = hydratedBuffer.toString('base64');
          att.mimeType = hydratedMime;
        }
      }
    }
  }
}

function handleAudioUpload(req, res, next) {
  upload.single('audio')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Audio upload error' });
    }
    next();
  });
}

function isGeminiKeyConfigured() {
  reloadEnv();
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return Boolean(
    key &&
    key !== 'paste_your_key_here' &&
    key !== 'your_gemini_api_key_here' &&
    key.length > 5
  );
}

// ========================================================
// Health & Provider Information
// ========================================================

app.get('/api/health', (req, res) => {
  reloadEnv();
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const hasKey = isGeminiKeyConfigured();
  const activeModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const voiceModel = process.env.GEMINI_VOICE_MODEL || 'gemini-3.5-flash-lite';
  const ttsModel = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
  const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

  res.json({
    status: 'ok',
    appName: 'Hi Nova!',
    provider,
    hasApiKey: hasKey,
    model: activeModel,
    voiceModel,
    ttsModel,
    imageModel,
    port: PORT,
    envFileExists: fs.existsSync(envPath),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/providers', (req, res) => {
  res.json({
    activeProvider: process.env.AI_PROVIDER || 'gemini',
    available: [
      { id: 'gemini', name: 'Google Gemini', defaultModel: 'gemini-3.5-flash' },
      { id: 'openai', name: 'OpenAI GPT', defaultModel: 'gpt-4o-mini' },
      { id: 'claude', name: 'Anthropic Claude', defaultModel: 'claude-3-5-sonnet-20241022' },
    ],
  });
});

// ========================================================
// Authentication Routes (PART 1 & PART 3)
// ========================================================

// Check username availability
app.get('/api/auth/check-username', (req, res) => {
  const queryUser = (req.query.u || req.query.username || '').trim();
  const available = isUsernameAvailable(queryUser);
  res.json({
    success: true,
    username: queryUser,
    available,
  });
});

// Sign Up / Create Account
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { fullName, email, username, password, confirmPassword } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'This email is already registered. Please log in instead.' });
    }

    let cleanUsername = (username || '').toLowerCase().trim();
    if (!cleanUsername) {
      const base = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 12);
      const prefix = base.length >= 3 ? base : `user_${base}`;
      let candidate = prefix;
      while (!isUsernameAvailable(candidate)) {
        candidate = `${prefix.slice(0, 14)}_${Math.random().toString(36).slice(2, 6)}`;
      }
      cleanUsername = candidate;
    } else {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
        return res.status(400).json({
          error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores (_).',
        });
      }

      if (!isUsernameAvailable(cleanUsername)) {
        return res.status(400).json({ error: 'This username is already taken. Please choose another.' });
      }
    }

    const passwordHash = await hashPassword(password);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const user = createUser({
      id: userId,
      email: cleanEmail,
      username: cleanUsername,
      passwordHash,
      fullName: fullName.trim(),
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
    });
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl || null,
        hasSeenIntro: false,
      },
    });
  } catch (err) {
    console.error('[Nova Auth] Register error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide both email and password.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = getUserByEmail(cleanEmail) || getUserByUsername(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password. Please check your credentials.' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password. Please check your credentials.' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
    });
    setAuthCookie(res, token);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl || null,
        hasSeenIntro: Boolean(user.hasSeenIntro),
      },
    });
  } catch (err) {
    console.error('[Nova Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Get Current User (Stay Logged In)
app.get('/api/auth/me', requireAuth, (req, res) => {
  const current = getUserById(req.user.id);
  res.json({
    success: true,
    user: current
      ? {
          id: current.id,
          email: current.email,
          username: current.username,
          fullName: current.fullName,
          avatarUrl: current.avatarUrl || null,
          hasSeenIntro: Boolean(current.hasSeenIntro),
        }
      : req.user,
  });
});

// Mark Cosmic Intro as Seen
app.post('/api/auth/intro-seen', requireAuth, (req, res) => {
  try {
    markIntroSeen(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Nova Auth] Mark intro seen error:', err);
    res.status(500).json({ error: 'Failed to record intro status' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out successfully' });
});

// Update Profile (Full Name, Unique Username, Avatar, Optional Password Change)
app.patch('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { fullName, username, avatarUrl, currentPassword, newPassword } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    }

    let cleanUsername = (username || '').toLowerCase().trim();
    if (!cleanUsername) {
      cleanUsername = req.user.username || req.user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20);
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return res.status(400).json({
        error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores (_).',
      });
    }

    if (!isUsernameAvailable(cleanUsername, req.user.id)) {
      return res.status(400).json({ error: 'This username is already taken. Please choose another.' });
    }

    let newPasswordHash = null;
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Please enter your current password to set a new password.' });
      }
      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const existingUser = getUserByEmail(req.user.email);
      const isMatch = await comparePassword(currentPassword, existingUser.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password does not match.' });
      }
      newPasswordHash = await hashPassword(newPassword);
    }

    const updated = updateUserProfile(req.user.id, {
      fullName: fullName.trim(),
      username: cleanUsername,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
      newPasswordHash,
    });

    const token = generateToken({
      id: updated.id,
      email: updated.email,
      username: updated.username,
      fullName: updated.fullName,
    });
    setAuthCookie(res, token);

    res.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        fullName: updated.fullName,
        avatarUrl: updated.avatarUrl || null,
      },
    });
  } catch (err) {
    console.error('[Nova Auth] Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile. Please try again.' });
  }
});

// Delete Account (Cascades and deletes user, chats, and disk files)
app.delete('/api/auth/account', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const filePaths = deleteUser(userId);
    for (const f of filePaths) {
      deleteDiskFile(f);
    }
    deleteUserUploadsDirectory(userId);
    clearAuthCookie(res);

    res.json({ success: true, message: 'Account and all associated chats have been deleted.' });
  } catch (err) {
    console.error('[Nova Auth] Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account. Please try again.' });
  }
});

// ========================================================
// Chat Management Routes (PART 2: Server-side Chats & Search)
// ========================================================

// Search chats and message contents
app.get('/api/chats/search', requireAuth, (req, res) => {
  try {
    const q = req.query.q || '';
    const results = searchChats(req.user.id, q);
    res.json({ success: true, results });
  } catch (err) {
    console.error('[Nova Chats] Search error:', err);
    res.status(500).json({ error: 'Failed to search chats.' });
  }
});

// List user's chats
app.get('/api/chats', requireAuth, (req, res) => {
  try {
    const chats = listChats(req.user.id);
    res.json({ success: true, chats });
  } catch (err) {
    console.error('[Nova Chats] List error:', err);
    res.status(500).json({ error: 'Failed to retrieve chats.' });
  }
});

// Clear all chats for user (PART 3)
app.delete('/api/chats', requireAuth, (req, res) => {
  try {
    const filePaths = clearAllChats(req.user.id);
    for (const f of filePaths) {
      deleteDiskFile(f);
    }
    res.json({ success: true, message: 'All conversations cleared successfully.' });
  } catch (err) {
    console.error('[Nova Chats] Clear all error:', err);
    res.status(500).json({ error: 'Failed to clear chats.' });
  }
});

// Get specific chat with messages and attachments
app.get('/api/chats/:id', requireAuth, (req, res) => {
  try {
    const chat = getChat(req.params.id, req.user.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }
    res.json({ success: true, chat });
  } catch (err) {
    console.error('[Nova Chats] Get error:', err);
    res.status(500).json({ error: 'Failed to load chat.' });
  }
});

// Create new chat
app.post('/api/chats', requireAuth, (req, res) => {
  try {
    const { id, title, workspaceMode, projectId } = req.body || {};
    const chatId = id || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const created = createChat({
      id: chatId,
      userId: req.user.id,
      title: title || 'New Chat',
      workspaceMode: workspaceMode || 'general',
      projectId: projectId || null,
    });
    res.status(201).json({ success: true, chat: created });
  } catch (err) {
    console.error('[Nova Chats] Create error:', err);
    res.status(500).json({ error: 'Failed to create chat.' });
  }
});

// Rename chat
app.patch('/api/chats/:id', requireAuth, (req, res) => {
  try {
    const { title } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Please provide a valid chat title.' });
    }

    const updated = renameChat(req.params.id, req.user.id, title.trim());
    res.json({ success: true, chat: updated });
  } catch (err) {
    console.error('[Nova Chats] Rename error:', err);
    res.status(500).json({ error: 'Failed to rename chat.' });
  }
});

// Delete chat
app.delete('/api/chats/:id', requireAuth, (req, res) => {
  try {
    const filePaths = deleteChat(req.params.id, req.user.id);
    for (const f of filePaths) {
      deleteDiskFile(f);
    }
    res.json({ success: true, message: 'Chat deleted.' });
  } catch (err) {
    console.error('[Nova Chats] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete chat.' });
  }
});

// ==================== Archive Routes ====================

// List archived chats
app.get('/api/chats/archived', requireAuth, (req, res) => {
  try {
    const q = req.query.q || '';
    const archived = q ? searchArchivedChats(req.user.id, q) : listArchivedChats(req.user.id);
    res.json({ success: true, archived });
  } catch (err) {
    console.error('[Nova Archive] List error:', err);
    res.status(500).json({ error: 'Failed to retrieve archived chats.' });
  }
});

// Archive a chat
app.post('/api/chats/:id/archive', requireAuth, (req, res) => {
  try {
    const result = archiveChat(req.params.id, req.user.id);
    res.json({ success: true, ...result, message: 'Chat archived successfully.' });
  } catch (err) {
    console.error('[Nova Archive] Archive error:', err);
    res.status(500).json({ error: 'Failed to archive chat.' });
  }
});

// Restore / Unarchive a chat
app.post('/api/chats/:id/unarchive', requireAuth, (req, res) => {
  try {
    const result = unarchiveChat(req.params.id, req.user.id);
    res.json({ success: true, ...result, message: 'Chat restored to active sidebar.' });
  } catch (err) {
    console.error('[Nova Archive] Unarchive error:', err);
    res.status(500).json({ error: 'Failed to restore chat.' });
  }
});

// ==================== Scheduled Tasks Routes ====================

// List scheduled tasks
app.get('/api/scheduled-tasks', requireAuth, (req, res) => {
  try {
    const tasks = listScheduledTasks(req.user.id);
    res.json({ success: true, tasks });
  } catch (err) {
    console.error('[Nova Scheduled] List error:', err);
    res.status(500).json({ error: 'Failed to retrieve scheduled tasks.' });
  }
});

// Create scheduled task
app.post('/api/scheduled-tasks', requireAuth, (req, res) => {
  try {
    const { title, prompt, scheduleType, timeSpec } = req.body || {};
    if (!title || !prompt) {
      return res.status(400).json({ error: 'Title and prompt are required.' });
    }
    const created = createScheduledTask({
      userId: req.user.id,
      title,
      prompt,
      scheduleType,
      timeSpec,
    });
    res.status(201).json({ success: true, task: created });
  } catch (err) {
    console.error('[Nova Scheduled] Create error:', err);
    res.status(500).json({ error: 'Failed to create scheduled task.' });
  }
});

// Toggle scheduled task status
app.patch('/api/scheduled-tasks/:id/toggle', requireAuth, (req, res) => {
  try {
    const { isActive } = req.body || {};
    const updated = toggleScheduledTask(req.params.id, req.user.id, !!isActive);
    res.json({ success: true, task: updated });
  } catch (err) {
    console.error('[Nova Scheduled] Toggle error:', err);
    res.status(500).json({ error: 'Failed to toggle task.' });
  }
});

// Delete scheduled task
app.delete('/api/scheduled-tasks/:id', requireAuth, (req, res) => {
  try {
    deleteScheduledTask(req.params.id, req.user.id);
    res.json({ success: true, message: 'Scheduled task deleted.' });
  } catch (err) {
    console.error('[Nova Scheduled] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// ========================================================
// Projects Management Routes (Persistent Projects List)
// ========================================================

// List user's projects
app.get('/api/projects', requireAuth, (req, res) => {
  try {
    const projects = listProjects(req.user.id);
    res.json({ success: true, projects });
  } catch (err) {
    console.error('[Nova Projects] List error:', err);
    res.status(500).json({ error: 'Failed to retrieve projects.' });
  }
});

// Create new project
app.post('/api/projects', requireAuth, (req, res) => {
  try {
    const { name, id } = req.body || {};
    const safeName = (name || 'New Project').trim();
    const project = createProject({
      id: id || undefined,
      userId: req.user.id,
      name: safeName,
    });
    res.status(201).json({ success: true, project });
  } catch (err) {
    console.error('[Nova Projects] Create error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// Rename project
app.patch('/api/projects/:id', requireAuth, (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Please provide a valid project name.' });
    }
    const updated = renameProject(req.params.id, req.user.id, name.trim());
    res.json({ success: true, project: updated });
  } catch (err) {
    console.error('[Nova Projects] Rename error:', err);
    res.status(500).json({ error: 'Failed to rename project.' });
  }
});

// Delete project
app.delete('/api/projects/:id', requireAuth, (req, res) => {
  try {
    deleteProject(req.params.id, req.user.id);
    res.json({ success: true, message: 'Project deleted.' });
  } catch (err) {
    console.error('[Nova Projects] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// Message feedback (PART 4: Thumbs Up / Down)
app.post('/api/messages/:id/feedback', requireAuth, (req, res) => {
  try {
    const { feedback } = req.body || {};
    const result = setMessageFeedback(req.params.id, req.user.id, feedback);
    res.json(result);
  } catch (err) {
    console.error('[Nova Messages] Feedback error:', err);
    res.status(500).json({ error: 'Failed to save message feedback.' });
  }
});

// One-time import of chats from IndexedDB/localStorage
app.post('/api/chats/import', requireAuth, (req, res) => {
  try {
    const { chats } = req.body || {};
    if (!Array.isArray(chats) || chats.length === 0) {
      return res.status(400).json({ error: 'No chats provided to import.' });
    }

    let importedCount = 0;
    for (const c of chats) {
      if (!c.id || !c.messages || c.messages.length === 0) continue;
      const existing = getChat(c.id, req.user.id);
      if (existing) continue;

      createChat({
        id: c.id,
        userId: req.user.id,
        title: c.title || 'Imported Chat',
        workspaceMode: c.workspaceMode || 'general',
      });

      for (const m of c.messages) {
        if (!m.content && (!m.attachments || m.attachments.length === 0)) continue;
        const msgId = m.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        saveMessage({
          id: msgId,
          chatId: c.id,
          role: m.role || 'user',
          content: m.content || '',
          createdAt: m.timestamp || Date.now(),
        });
      }
      importedCount++;
    }

    res.json({ success: true, importedCount });
  } catch (err) {
    console.error('[Nova Chats] Import error:', err);
    res.status(500).json({ error: 'Failed to import chats.' });
  }
});

// ========================================================
// Authenticated File Serving
// ========================================================

app.get('/api/files/:id', requireAuth, (req, res) => {
  try {
    let attachment = getAttachmentById(req.params.id);
    let filePath = attachment?.path;
    let mimeType = attachment?.mimeType;
    let filename = attachment?.filename;

    if (!attachment && sessionAttachmentRegistry.has(req.params.id)) {
      const cached = sessionAttachmentRegistry.get(req.params.id);
      filePath = cached.filePath;
      mimeType = cached.type;
      filename = cached.name;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File data is no longer available on server.' });
    }

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename || 'file')}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('[Nova Files] Serve error:', err);
    res.status(500).json({ error: 'Failed to send file.' });
  }
});

// ========================================================
// Text-to-Speech (PART 1: Spoken Voice with Gemini TTS)
// ========================================================

app.post('/api/tts', requireAuth, ttsLimiter, async (req, res) => {
  const { text, voice, model, lang } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Please provide text to convert to speech.' });
  }

  try {
    const result = await generateTTS({
      text: text.trim(),
      voice: voice || 'Kore',
      model,
      lang: lang || 'auto',
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.warn('[Nova TTS] Speech error:', err.message);
    res.status(500).json({
      error: err.message || 'TTS generation unavailable',
      fallbackToBrowser: true,
    });
  }
});

// ========================================================
// Audio Transcription (PART 3: Microphone Speech-to-Text)
// ========================================================

app.post('/api/transcribe', requireAuth, handleAudioUpload, async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No audio recorded. Please speak into your microphone and try again.' });
  }

  try {
    console.log(`[Nova Transcribe] Received ${req.file.buffer.length} bytes of audio (${req.file.mimetype})`);
    const result = await transcribeAudio({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    res.json({
      success: true,
      text: result.text || '',
    });
  } catch (err) {
    console.error('[Nova Transcribe] Transcription error:', err.message);
    res.status(500).json({
      error: err.message || 'Failed to transcribe audio. Please try speaking again.',
    });
  }
});

// ========================================================
// Image Generation Endpoint (PART 5 & Dual Engine)
// ========================================================

app.post('/api/image', requireAuth, imageLimiter, async (req, res) => {
  reloadEnv();
  const { prompt, model, chatId, aspectRatio, style, previousImageBase64, isTemporary } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      error: 'Please describe the image you want Nova to create.',
    });
  }

  const isTemp = isTemporary === true || isTemporary === 'true';

  try {
    const result = await generateGeminiImage({
      prompt: prompt.trim(),
      aspectRatio: aspectRatio || '1:1',
      style: style || 'Realistic',
      previousImageBase64: previousImageBase64 || null,
      model: model || process.env.GEMINI_IMAGE_MODEL,
    });

    let savedFileId = null;
    let savedFileUrl = null;

    // Ensure chat, user request message, and assistant visual result are saved in SQLite
    if (!isTemp && chatId) {
      const existingChat = getChat(chatId, req.user.id);
      if (!existingChat) {
        createChat({
          id: chatId,
          userId: req.user.id,
          title: `${prompt.trim().slice(0, 30)} (image)`,
          workspaceMode: 'image',
        });
      }

      // Persist user prompt message so chat history is preserved across reloads
      const userMsgId = req.body.userMessageId || `msg_user_${Date.now()}`;
      saveMessage({
        id: userMsgId,
        chatId,
        role: 'user',
        content: prompt.trim(),
      });

      const assistantMsgContent = result.geminiPrompt || result.promptUsed || '';

      if (result.imageUrl && result.imageUrl.startsWith('data:')) {
        const match = result.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const saved = saveUserFile({
            userId: req.user.id,
            originalName: `nova_${Date.now()}.${mimeType.includes('png') ? 'png' : 'jpg'}`,
            buffer,
            mimeType,
          });

          const assistantMsgId = `msg_ai_img_${Date.now()}`;
          saveMessage({
            id: assistantMsgId,
            chatId,
            role: 'assistant',
            content: assistantMsgContent,
          });

          const attId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          saveAttachment({
            id: attId,
            messageId: assistantMsgId,
            filename: saved.fileName,
            mimeType,
            size: saved.size,
            path: saved.filePath,
          });

          savedFileId = attId;
          savedFileUrl = `/api/files/${attId}`;
          touchChat(chatId, req.user.id);
    if (chatRecord?.projectId) {
      touchProject(chatRecord.projectId, req.user.id);
    }
        }
      } else {
        const assistantMsgId = `msg_ai_img_${Date.now()}`;
        saveMessage({
          id: assistantMsgId,
          chatId,
          role: 'assistant',
          content: assistantMsgContent || `![${prompt.trim()}](${result.imageUrl})`,
        });
        touchChat(chatId, req.user.id);
    if (chatRecord?.projectId) {
      touchProject(chatRecord.projectId, req.user.id);
    }
      }
    }

    res.json({
      success: true,
      ...result,
      geminiPrompt: result.geminiPrompt,
      geminiUrl: 'https://gemini.google.com/app',
      fileId: savedFileId,
      fileUrl: savedFileUrl,
    });
  } catch (error) {
    console.error('[Nova Image] Error:', error.message);
    res.status(400).json({
      error: error.message || 'Unable to generate image.',
    });
  }
});

// ========================================================
// Streaming Chat Endpoint (Server Persistence + Temporary Mode)
// ========================================================

app.post('/api/chat', requireAuth, chatLimiter, handleFileUpload, async (req, res) => {
  reloadEnv();

  let rawMessages = req.body.messages;
  if (typeof rawMessages === 'string') {
    try {
      rawMessages = JSON.parse(rawMessages);
    } catch {
      return res.status(400).json({
        error: 'Invalid request: "messages" field must be valid JSON array.',
      });
    }
  }

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return res.status(400).json({
      error: 'Invalid request: "messages" must be a non-empty array.',
    });
  }

  const chatId = req.body.chatId || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const isVoiceMode =
    req.body.isVoiceMode === true ||
    req.body.isVoiceMode === 'true' ||
    req.body.voiceMode === true;

  const isTemporary =
    req.body.isTemporary === true ||
    req.body.isTemporary === 'true' ||
    req.body.isPrivate === true;

  const userTimezone = req.body.userTimezone || 'UTC';

  let chatRecord = null;
  const latestUserMsg = rawMessages[rawMessages.length - 1];
  const userText = latestUserMsg.content || '';

  // Only create or query DB if NOT temporary/personalized
  if (!isTemporary) {
    chatRecord = getChat(chatId, req.user.id);
    if (!chatRecord) {
      let autoTitle = (userText || 'Conversation').trim().slice(0, 36) || 'New Chat';
      // Strip any emojis from autoTitle
      autoTitle = autoTitle.replace(/^[\p{Emoji}\uFE0F\s]+/u, '').trim() || 'Chat';
      const mode = req.body.workspaceMode || 'general';
      let projectId = req.body.projectId || null;
      if (mode === 'project' && !projectId) {
        const newProjId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const projName = (userText || 'Project').trim().slice(0, 36) || 'New Project';
        try {
          createProject({ id: newProjId, userId: req.user.id, name: projName });
          projectId = newProjId;
        } catch {}
      }
      if (mode === 'code' && !autoTitle.toLowerCase().includes('(code)')) {
        autoTitle = `${autoTitle} (code)`;
      } else if (mode === 'presentation' && !autoTitle.toLowerCase().includes('(presentation)')) {
        autoTitle = `${autoTitle} (presentation)`;
      } else if (mode === 'image' && !autoTitle.toLowerCase().includes('(image)')) {
        autoTitle = `${autoTitle} (image)`;
      } else if (mode === 'project' && !autoTitle.toLowerCase().includes('(project)')) {
        autoTitle = `${autoTitle} (project)`;
      }
      chatRecord = createChat({
        id: chatId,
        userId: req.user.id,
        title: autoTitle,
        workspaceMode: mode,
        projectId,
      });
      if (projectId) {
        touchProject(projectId, req.user.id);
      }
    }
  }

  // Process attachments
  const savedAttachments = [];
  const processedGeminiAttachments = [];

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      // Always save uploaded files to disk so they can be referenced in follow-up turns
      let savedPath = null;
      try {
        const saved = saveUserFile({
          userId: req.user.id || 'anonymous',
          originalName: file.originalname,
          buffer: file.buffer,
          mimeType: file.mimetype,
        });
        savedPath = saved.filePath;
      } catch (err) {
        console.warn('[Nova Upload] Could not save to disk, will keep in memory:', err.message);
      }

      const attId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      savedAttachments.push({
        id: attId,
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        filePath: savedPath,
      });

      // Register in server-side session cache for subsequent turns
      sessionAttachmentRegistry.set(attId, {
        id: attId,
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        filePath: savedPath,
        base64: file.buffer.toString('base64'),
        userId: req.user.id,
        chatId,
      });

      if (!sessionChatAttachments.has(chatId)) {
        sessionChatAttachments.set(chatId, []);
      }
      sessionChatAttachments.get(chatId).push({
        id: attId,
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        filePath: savedPath,
        base64: file.buffer.toString('base64'),
      });

      const isImageOrPdf =
        file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';

      if (isImageOrPdf) {
        processedGeminiAttachments.push({
          id: attId,
          name: file.originalname,
          mimeType: file.mimetype,
          data: file.buffer.toString('base64'),
          url: `/api/files/${attId}`,
          size: file.size,
        });
      } else {
        processedGeminiAttachments.push({
          id: attId,
          name: file.originalname,
          mimeType: file.mimetype || 'text/plain',
          textContent: file.buffer.toString('utf-8'),
          url: `/api/files/${attId}`,
          size: file.size,
          isText: true,
        });
      }
    }

    const lastIdx = rawMessages.length - 1;
    const existing = rawMessages[lastIdx].attachments || [];
    rawMessages[lastIdx] = {
      ...rawMessages[lastIdx],
      attachments: [...existing, ...processedGeminiAttachments],
    };
  }

  // Save the user's message and attachments to DB immediately (if NOT temporary)
  const userMessageId = latestUserMsg.id || `msg_${Date.now()}`;
  if (!isTemporary) {
    saveMessage({
      id: userMessageId,
      chatId,
      role: 'user',
      content: userText,
    });

    for (const att of savedAttachments) {
      if (att.filePath) {
        saveAttachment({
          id: att.id,
          messageId: userMessageId,
          filename: att.name,
          mimeType: att.type,
          size: att.size,
          path: att.filePath,
        });
      }
    }

    touchChat(chatId, req.user.id);
    if (chatRecord?.projectId) {
      touchProject(chatRecord.projectId, req.user.id);
    }
  }

  // Keep last ~20 messages for context memory
  const contextMessages = rawMessages.slice(-20);

  // Hydrate image attachments across all tiers (memory, disk, DB) so Gemini Vision has full visual context for follow-ups
  hydrateMessageAttachments(contextMessages, chatId, req.user?.id);

  const { systemPrompt, model, provider: requestedProvider, workspaceMode = 'general' } = req.body;
  let providerInstance;
  try {
    providerInstance = getProvider(requestedProvider);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send metadata event with chatId, title, and saved attachments
  res.write(
    `data: ${JSON.stringify({
      type: 'meta',
      chatId,
      title: chatRecord?.title || (isTemporary ? 'Personalized Chat' : 'New Chat'),
      isTemporary,
      workspaceMode,
      savedAttachments: savedAttachments.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
        url: `/api/files/${a.id}`,
      })),
    })}\n\n`
  );

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  let fullAiResponse = '';
  const assistantMessageId = `msg_ai_${Date.now()}`;

  try {
    await providerInstance.stream({
      messages: contextMessages,
      systemPrompt,
      isVoiceMode,
      workspaceMode,
      userTimezone,
      model,
      signal: abortController.signal,
      onSources: (sources) => {
        if (!abortController.signal.aborted && Array.isArray(sources) && sources.length > 0) {
          res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);
        }
      },
      onChunk: (chunkText) => {
        if (!abortController.signal.aborted) {
          fullAiResponse += chunkText;
          res.write(`data: ${JSON.stringify({ type: 'content', content: chunkText })}\n\n`);
          res.flush?.();
        }
      },
    });

    // Save assistant message to SQLite immediately upon completion (if NOT temporary)
    if (!isTemporary && fullAiResponse.trim()) {
      saveMessage({
        id: assistantMessageId,
        chatId,
        role: 'assistant',
        content: fullAiResponse,
      });
      touchChat(chatId, req.user.id);
    if (chatRecord?.projectId) {
      touchProject(chatRecord.projectId, req.user.id);
    }
    }

    if (!abortController.signal.aborted) {
      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          messageId: assistantMessageId,
          isTemporary,
        })}\n\n`
      );
    }
  } catch (error) {
    console.error('[Nova Chat] Stream error:', error.message);
    if (!abortController.signal.aborted) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error.message || 'An error occurred while generating response.',
        })}\n\n`
      );
    }
  } finally {
    res.end();
  }
});

// ========================================================
// Professional AI Presentation Endpoint (Gamma API Integration)
// ========================================================
app.post('/api/presentation/gamma', async (req, res) => {
  try {
    const { topic, prompt, numSlides = 7 } = req.body;
    const userTopic = (topic || prompt || 'Strategic AI Overview').trim();

    // Exact prompt engineering wrapper mandated by directive
    const wrappedPrompt = `Generate a highly professional, modern presentation deck about ${userTopic}. Structurally divide content into executive summary, key drivers, visual data points, and actionable conclusions. Ensure clean visual hierarchy, bulleted key points, minimalistic layouts, and professional typography.`;

    const gammaApiKey = (process.env.GAMMA_API_KEY || '').trim();
    let gammaResult = null;

    if (gammaApiKey) {
      try {
        const gammaRes = await fetch('https://api.gamma.app/v1/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gammaApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: wrappedPrompt,
            format: 'presentation',
            numCards: numSlides || 8,
          }),
        });

        if (gammaRes.ok) {
          const gammaData = await gammaRes.json();
          gammaResult = {
            id: gammaData.id,
            webUrl: gammaData.webUrl || gammaData.url,
            embedUrl: gammaData.embedUrl || gammaData.webUrl,
            exportUrl: gammaData.exportUrl || null,
          };
        }
      } catch (gErr) {
        console.warn('[Gamma API] Generation call notice:', gErr.message);
      }
    }

    // Direct universal Gamma creation link
    const gammaDirectUrl = `https://gamma.app/new?prompt=${encodeURIComponent(wrappedPrompt)}`;

    return res.json({
      success: true,
      topic: userTopic,
      prompt: wrappedPrompt,
      gammaUrl: gammaResult?.webUrl || gammaDirectUrl,
      embedUrl: gammaResult?.embedUrl || null,
      exportUrl: gammaResult?.exportUrl || null,
      isGammaConnected: Boolean(gammaResult?.webUrl),
    });
  } catch (err) {
    console.error('[Presentation Gamma Error]', err);
    return res.status(500).json({ error: 'Failed to process presentation generation.' });
  }
});

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('[Nova Server] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🪐 Hi Nova! AI Chatbot Backend is running`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📁 Loaded .env from: ${envPath}`);
  console.log(`🗄️ Database: SQLite at ${process.env.DATABASE_PATH || 'data/nova.db'}`);
  console.log(`🔐 Authentication: JWT httpOnly 30-day session cookies`);
  console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`🎯 Model: ${process.env.GEMINI_MODEL || 'gemini-3.5-flash'}`);
  console.log(`🔊 TTS Model: ${process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'}`);
  console.log(`🎨 Image Model: ${process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'}`);

  if (isGeminiKeyConfigured()) {
    const rawKey = (process.env.GEMINI_API_KEY || '').trim();
    console.log(`✅ [Gemini] API Key: LOADED successfully (...${rawKey.slice(-4)})`);
  } else {
    console.log(`⚠️  [Gemini] API Key: MISSING or default placeholder!`);
  }
  console.log(`==================================================\n`);
});
