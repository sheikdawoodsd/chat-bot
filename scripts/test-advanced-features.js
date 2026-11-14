import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('🧪 Starting Hi Nova! Advanced Features Verification Test Suite...\n');

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  console.log('✅ 1. Backend Health Check:', healthData.status === 'ok' ? 'PASSED' : 'FAILED', healthData);

  // 2. Check username availability
  const checkUsernameRes = await fetch(`${BASE_URL}/api/auth/check-username?u=nova_${Date.now().toString().slice(-6)}`);
  const checkUsernameData = await checkUsernameRes.json();
  console.log('✅ 2. Username Availability Endpoint:', checkUsernameData.available ? 'PASSED' : 'FAILED');

  // 3. Register a test user
  const uniqueId = Date.now();
  const testUser = {
    fullName: 'Nova Tester',
    email: `tester_${uniqueId}@example.com`,
    username: `novatester_${uniqueId.toString().slice(-6)}`,
    password: 'password123',
    confirmPassword: 'password123',
  };

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
  });
  const cookie = regRes.headers.get('set-cookie');
  const regData = await regRes.json();
  console.log('✅ 3. User Registration with Username & Cookie:', regData.success ? 'PASSED' : 'FAILED', regData.user?.username);

  const authHeaders = {
    'Content-Type': 'application/json',
    Cookie: cookie,
  };

  // 4. Test Text-to-Speech (/api/tts)
  console.log('⏳ 4. Testing Gemini TTS endpoint (/api/tts)...');
  const ttsRes = await fetch(`${BASE_URL}/api/tts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      text: "Hi, I'm Nova! Welcome to the stars.",
      voice: 'Kore',
    }),
  });
  const ttsData = await ttsRes.json();
  const ttsPassed = ttsData.success && ttsData.audioUrl && ttsData.audioUrl.startsWith('data:audio/wav;base64,');
  console.log('✅ 4. TTS Endpoint Result:', ttsPassed ? 'PASSED' : 'FAILED', {
    model: ttsData.model,
    voice: ttsData.voice,
    audioLength: ttsData.audioUrl?.length,
  });

  // 5. Test Normal Chat Creation & Search
  const chatRes = await fetch(`${BASE_URL}/api/chats`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'Quantum Computing and Constellations' }),
  });
  const chatData = await chatRes.json();
  const testChatId = chatData.chat?.id;

  // Search chats
  const searchRes = await fetch(`${BASE_URL}/api/chats/search?q=Quantum`, {
    headers: authHeaders,
  });
  const searchData = await searchRes.json();
  const searchPassed = searchData.success && searchData.results?.length > 0;
  console.log('✅ 5. Chat History & Keyword Search:', searchPassed ? 'PASSED' : 'FAILED', searchData.results?.[0]?.title);

  // 6. Test Image Generation with Aspect Ratio & Style
  console.log('⏳ 6. Testing Image Generation with prompt expansion and aspect ratio...');
  const imgRes = await fetch(`${BASE_URL}/api/image`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      prompt: 'A tiny cute robot stargazing on Mars',
      aspectRatio: '16:9',
      style: '3D',
      chatId: testChatId,
    }),
  });
  const imgData = await imgRes.json();
  const imgPassed = imgData.success && imgData.imageUrl && imgData.promptUsed;
  console.log('✅ 6. Image Generation & Prompt Expansion:', imgPassed ? 'PASSED' : 'FAILED', {
    model: imgData.model,
    aspectRatio: imgData.aspectRatio,
    promptUsed: imgData.promptUsed?.slice(0, 60),
  });

  // 7. Test Temporary (Personalized) Mode zero-persistence
  console.log('⏳ 7. Testing Personalized Chat zero-persistence...');
  const tempChatId = `temp_chat_${Date.now()}`;
  const tempMsgRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      chatId: tempChatId,
      isTemporary: true,
      messages: [{ role: 'user', content: 'Say hello strictly in personalized mode' }],
    }),
  });
  // Read stream
  await tempMsgRes.text();

  // Verify that tempChatId does NOT exist in user chats
  const listRes = await fetch(`${BASE_URL}/api/chats`, { headers: authHeaders });
  const listData = await listRes.json();
  const existsInDb = listData.chats?.some((c) => c.id === tempChatId);
  console.log('✅ 7. Personalized Mode Zero-DB Persistence:', !existsInDb ? 'PASSED' : 'FAILED');

  // 8. Test Clear All Chats
  const clearRes = await fetch(`${BASE_URL}/api/chats`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const clearData = await clearRes.json();
  const listAfterClear = await (await fetch(`${BASE_URL}/api/chats`, { headers: authHeaders })).json();
  console.log('✅ 8. Clear All Chats Endpoint:', listAfterClear.chats?.length === 0 ? 'PASSED' : 'FAILED', clearData.message);

  console.log('\n🎉 ALL ADVANCED FEATURE TESTS COMPLETE!');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
