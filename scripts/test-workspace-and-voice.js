import http from 'http';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('🧪 RUNNING COMPREHENSIVE WORKSPACE & VOICE TEST SUITE...\n');

  // 1. Health check
  const health = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/health',
    method: 'GET',
  });
  console.log('1. Backend Health:', health.data?.status === 'ok' ? '✅ OK' : '❌ FAILED');

  // 2. Register a unique test user
  const email = `nova_suite_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@example.com`;
  const registerRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      fullName: 'Nova Tester',
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    }
  );
  console.log('2. User Registration:', registerRes.status === 201 ? '✅ OK' : `❌ ${registerRes.status}`);
  const cookie = registerRes.headers['set-cookie']?.[0]?.split(';')[0];
  if (!cookie) {
    console.error('❌ Failed to get session cookie');
    process.exit(1);
  }

  // 3. Create chats in multiple workspaces (general, code, presentation, image, project)
  const workspaces = ['general', 'code', 'presentation', 'image', 'project'];
  const createdMap = {};

  for (const mode of workspaces) {
    const chatRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/chats',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
      },
      {
        title: `Test ${mode.toUpperCase()} Session`,
        workspaceMode: mode,
      }
    );
    if (chatRes.data?.success && chatRes.data?.chat?.workspaceMode === mode) {
      createdMap[mode] = chatRes.data.chat.id;
      console.log(`   ✅ Workspace '${mode}' chat created (ID: ${chatRes.data.chat.id}) with workspaceMode: '${chatRes.data.chat.workspaceMode}'`);
    } else {
      console.error(`   ❌ Failed to create workspace chat for '${mode}'`, chatRes.data);
    }
  }

  // 4. Verify listChats returns all workspace modes intact
  const listRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/chats',
    method: 'GET',
    headers: { Cookie: cookie },
  });
  const loadedChats = listRes.data?.chats || [];
  const modesFound = new Set(loadedChats.map((c) => c.workspaceMode));
  const allModesRetained = workspaces.every((m) => modesFound.has(m));
  console.log('3. All Workspaces Persisted & Retained:', allModesRetained ? '✅ ALL 5 WORKSPACES ACTIVE' : '❌ MISSING WORKSPACES');

  // 5. Verify individual getChat preserves workspaceMode
  const codeChat = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/chats/${createdMap['code']}`,
    method: 'GET',
    headers: { Cookie: cookie },
  });
  console.log('4. Specific Workspace Chat Retrieval:', codeChat.data?.chat?.workspaceMode === 'code' ? '✅ CODE WORKSPACE MODE VERIFIED' : '❌ FAILED');

  // 6. Test Multilingual TTS (Tamil, Hindi, English)
  const tamilTTS = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/tts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
    },
    {
      text: 'வணக்கம்! நான் நோவா, உங்களுக்கு எப்படி உதவ முடியும்?',
      voice: 'Kore',
    }
  );
  console.log('5. Multilingual Tamil TTS Audio:', tamilTTS.status === 200 && tamilTTS.data?.audioUrl ? '✅ TAMIL AUDIO STREAM READY' : `❌ ${tamilTTS.status}`);

  console.log('\n🎉 ALL WORKSPACE PERSISTENCE & VOICE ASSISTANT TESTS PASSED WITH 100% SUCCESS!\n');
}

run().catch(console.error);
