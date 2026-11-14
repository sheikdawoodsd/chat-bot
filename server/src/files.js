import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../../server/uploads');

if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

export function getUserUploadsDir(userId) {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const userDir = path.join(UPLOADS_ROOT, safeUserId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

export function saveUserFile({ userId, originalName, buffer, mimeType }) {
  const userDir = getUserUploadsDir(userId);
  const ext = path.extname(originalName) || (mimeType?.includes('png') ? '.png' : mimeType?.includes('jpeg') ? '.jpg' : '.bin');
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const safeBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  const fileName = `${Date.now()}_${uniqueId}_${safeBase}${ext}`;
  const targetPath = path.join(userDir, fileName);

  fs.writeFileSync(targetPath, buffer);

  return {
    fileName: originalName,
    diskFileName: fileName,
    filePath: targetPath,
    size: buffer.length,
    mimeType,
  };
}

export function deleteDiskFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('[Nova Files] Failed to delete file:', filePath, err.message);
  }
}

export function deleteUserUploadsDirectory(userId) {
  try {
    const userDir = getUserUploadsDir(userId);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[Nova Files] Failed to delete user directory for:', userId, err.message);
  }
}

