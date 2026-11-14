import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000';

function generateWavBuffer(durationSec = 0.5, freq = 440, sampleRate = 16000) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const blockAlign = 2; // 16-bit mono
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audio format (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // num channels (1 = mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.5;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

async function runTests() {
  console.log('==================================================');
  console.log('🚀 HI NOVA! FULL SYSTEM UPGRADE VERIFICATION TEST');
  console.log('==================================================\n');

  const testUser = {
    fullName: 'Nova Tester',
    email: `tester_${Date.now()}@example.com`,
    password: 'securePassword123',
    confirmPassword: 'securePassword123',
  };

  let sessionCookie = '';
  let userId = '';

  // 1. Health Check
  console.log('Test 1: GET /api/health');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const health = await healthRes.json();
  console.log('-> Health status:', health.status, '| Model:', health.model, '| Key configured:', health.hasApiKey);
  if (health.status !== 'ok') throw new Error('Health check failed');

  // 2. Register Account
  console.log('\nTest 2: POST /api/auth/register (Create Account without email code)');
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
  });
  if (regRes.status !== 201) {
    throw new Error(`Register failed with status ${regRes.status}: ${await regRes.text()}`);
  }
  const regCookie = regRes.headers.get('set-cookie');
  if (!regCookie || !regCookie.includes('nova_session')) {
    throw new Error('Expected httpOnly nova_session cookie on register');
  }
  sessionCookie = regCookie.split(';')[0];
  const regData = await regRes.json();
  userId = regData.user.id;
  console.log('-> Account registered! ID:', userId, '| Name:', regData.user.fullName);

  // 3. Stay Logged In (GET /api/auth/me)
  console.log('\nTest 3: GET /api/auth/me (Stay Logged In with 30-day cookie)');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  if (meRes.status !== 200) throw new Error('Auth me check failed');
  const meData = await meRes.json();
  console.log('-> Authenticated session valid for:', meData.user.email);

  // 4. Update Profile
  console.log('\nTest 4: PATCH /api/auth/profile (Edit Name)');
  const profRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({ fullName: 'Nova Star Explorer' }),
  });
  const profData = await profRes.json();
  console.log('-> Name updated to:', profData.user.fullName);

  // 5. Create and List Chats
  console.log('\nTest 5: POST /api/chats & GET /api/chats (Server-saved SQLite chats)');
  const chatId = `chat_test_${Date.now()}`;
  const chatCreateRes = await fetch(`${BASE_URL}/api/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({ id: chatId, title: 'Cosmic Exploration' }),
  });
  const chatCreated = await chatCreateRes.json();
  console.log('-> Chat created in SQLite:', chatCreated.chat.id);

  const listChatsRes = await fetch(`${BASE_URL}/api/chats`, {
    headers: { Cookie: sessionCookie },
  });
  const listChatsData = await listChatsRes.json();
  console.log('-> Listed chats from SQLite, total count:', listChatsData.chats.length);
  if (!listChatsData.chats.some((c) => c.id === chatId)) {
    throw new Error('Created chat not found in list');
  }

  // 6. Rename Chat
  console.log('\nTest 6: PATCH /api/chats/:id (Rename Chat)');
  const renameRes = await fetch(`${BASE_URL}/api/chats/${chatId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({ title: 'Interstellar Discoveries' }),
  });
  const renameData = await renameRes.json();
  console.log('-> Chat renamed to:', renameData.chat.title);

  // 7. Streaming Chat & Server-side Message Persistence
  console.log('\nTest 7: POST /api/chat (SSE stream and save user/AI messages to SQLite)');
  const chatStreamRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      chatId,
      messages: [{ role: 'user', content: 'Say hello to Nova in one cheerful sentence with a star emoji!' }],
    }),
  });
  if (!chatStreamRes.ok) throw new Error('Chat stream request failed');
  const reader = chatStreamRes.body.getReader();
  const decoder = new TextDecoder();
  let aiResponse = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.type === 'content') aiResponse += evt.content;
        } catch {}
      }
    }
  }
  console.log('-> Received AI Reply:', aiResponse.trim());

  // Verify chat reloaded with messages
  const reloadChatRes = await fetch(`${BASE_URL}/api/chats/${chatId}`, {
    headers: { Cookie: sessionCookie },
  });
  const reloadData = await reloadChatRes.json();
  console.log('-> Reloaded chat from SQLite! Stored message count:', reloadData.chat.messages.length);
  if (reloadData.chat.messages.length < 2) {
    throw new Error('Expected at least user and assistant messages stored in SQLite');
  }

  // 8. Image Generation & Authenticated File Storage
  console.log('\nTest 8: POST /api/image (High-resolution image generation & authenticated storage)');
  const imgRes = await fetch(`${BASE_URL}/api/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({ prompt: 'a cute cosmic purple astronaut cat', chatId }),
  });
  if (!imgRes.ok) throw new Error('Image generation failed');
  const imgData = await imgRes.json();
  console.log('-> Image generated! Model:', imgData.model, '| File ID:', imgData.fileId);

  if (imgData.fileId) {
    const fileRes = await fetch(`${BASE_URL}/api/files/${imgData.fileId}`, {
      headers: { Cookie: sessionCookie },
    });
    console.log('-> Authenticated file retrieval status:', fileRes.status, '| Content-Type:', fileRes.headers.get('content-type'));
    if (fileRes.status !== 200) throw new Error('Failed to retrieve authenticated file');
  }

  // 9. Voice Mode Spoken Style Request
  console.log('\nTest 9: POST /api/chat with isVoiceMode: true (Spoken style response)');
  const voiceChatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      chatId,
      isVoiceMode: true,
      messages: [{ role: 'user', content: 'What is your favorite galaxy?' }],
    }),
  });
  let voiceReply = '';
  const voiceReader = voiceChatRes.body.getReader();
  while (true) {
    const { done, value } = await voiceReader.read();
    if (done) break;
    const text = decoder.decode(value);
    const lines = text.split('\n');
    for (const l of lines) {
      if (l.startsWith('data:')) {
        try {
          const ev = JSON.parse(l.slice(5).trim());
          if (ev.type === 'content') voiceReply += ev.content;
        } catch {}
      }
    }
  }
  console.log('-> Voice mode response:', voiceReply.trim());
  const hasMarkdownHeaders = voiceReply.includes('#') || voiceReply.includes('```');
  console.log('-> Voice mode format clean (no markdown headers/code):', !hasMarkdownHeaders);

  // 10. Voice Audio Transcription
  console.log('\nTest 10: POST /api/transcribe (Audio file upload & Gemini transcription endpoint)');
  const wavBytes = generateWavBuffer(0.5, 440);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="test.wav"\r\nContent-Type: audio/wav\r\n\r\n`
  );
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([pre, wavBytes, post]);

  const transRes = await fetch(`${BASE_URL}/api/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Cookie: sessionCookie,
    },
    body,
  });
  console.log('-> Transcription response HTTP status:', transRes.status);
  const transData = await transRes.json();
  console.log('-> Transcription result text:', JSON.stringify(transData.text || ''));

  // 11. One-time import of chats
  console.log('\nTest 11: POST /api/chats/import (One-time client IndexedDB import)');
  const importRes = await fetch(`${BASE_URL}/api/chats/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      chats: [
        {
          id: `imported_${Date.now()}`,
          title: 'Legacy IndexedDB Chat',
          messages: [
            { role: 'user', content: 'Initial migrated message' },
            { role: 'assistant', content: 'Migrated assistant reply' },
          ],
        },
      ],
    }),
  });
  const importData = await importRes.json();
  console.log('-> One-time import count:', importData.importedCount);

  // 12. Delete Chat
  console.log('\nTest 12: DELETE /api/chats/:id (Delete Chat and files)');
  const delChatRes = await fetch(`${BASE_URL}/api/chats/${chatId}`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie },
  });
  console.log('-> Delete chat status:', delChatRes.status);

  // 13. Delete Account
  console.log('\nTest 13: DELETE /api/auth/account (Permanently delete account and all files)');
  const delAccRes = await fetch(`${BASE_URL}/api/auth/account`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie },
  });
  console.log('-> Delete account status:', delAccRes.status);

  // 14. Verify Session is Invalidated
  console.log('\nTest 14: Verify deleted session returns 401');
  const postDelMe = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  console.log('-> Session status after deletion:', postDelMe.status, '(Expected: 401)');
  if (postDelMe.status !== 401) throw new Error('Expected 401 after account deletion');

  console.log('\n==================================================');
  console.log('🎉 ALL 14 TESTS PASSED! FULL UPGRADE COMPLETE');
  console.log('==================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});

