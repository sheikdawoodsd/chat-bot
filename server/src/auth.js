import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getUserById } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_nova_jwt_key_change_in_production_32chars';
const COOKIE_NAME = 'nova_session';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

export async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: THIRTY_DAYS_MS,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Authentication middleware: protects routes and attaches req.user
 * Renews the 30-day cookie if user is active
 */
export function requireAuth(req, res, next) {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please log in.',
      code: 'AUTH_REQUIRED',
    });
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) {
    clearAuthCookie(res);
    return res.status(401).json({
      error: 'Invalid or expired session. Please log in again.',
      code: 'AUTH_EXPIRED',
    });
  }

  const user = getUserById(decoded.id);
  if (!user) {
    clearAuthCookie(res);
    return res.status(401).json({
      error: 'User account not found.',
      code: 'USER_NOT_FOUND',
    });
  }

  req.user = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
  };

  // Re-issue cookie on active request if cookie was used
  if (cookieToken) {
    setAuthCookie(res, token);
  }

  next();
}

