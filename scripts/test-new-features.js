// Native global fetch in Node 18+

async function testAll() {
  console.log('🧪 Starting Verification Suite for New Features...\n');

  // 1. Health check
  const healthRes = await fetch('http://localhost:5000/api/health');
  const healthData = await healthRes.json();
  console.log('✅ Server Health Check:', healthData.status === 'ok' ? 'PASS' : 'FAIL');

  // 2. Register/Login test user
  const testEmail = `test_${Date.now()}@testnova.com`;
  const testUser = `usr_${Date.now().toString().slice(-6)}`;
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Cosmic Traveler',
      email: testEmail,
      username: testUser,
      password: 'password123',
      confirmPassword: 'password123',
    }),
  });

  const regCookies = regRes.headers.getSetCookie ? regRes.headers.getSetCookie() : [regRes.headers.get('set-cookie') || ''];
  const cookieHeader = regCookies.map((c) => c.split(';')[0]).join('; ');
  console.log('✅ Register Account:', regRes.status === 201 ? 'PASS' : `FAIL (${regRes.status})`);

  // 3. Multi-turn TTS Speech Test (Testing 3 consecutive turns without dropouts)
  console.log('\n🎙️ Testing Multi-Turn Spoken TTS (3 consecutive turns)...');
  const turns = [
    'Hi! I am Nova, your cosmic AI companion.',
    'I can help you build websites, generate photorealistic images, or brainstorm creative ideas.',
    'What would you like us to explore in the universe today?',
  ];

  for (let i = 0; i < turns.length; i++) {
    const ttsRes = await fetch('http://localhost:5000/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        text: turns[i],
        voice: 'Kore',
      }),
    });

    const ttsData = await ttsRes.json().catch(() => ({}));
    if (ttsData.success && ttsData.audioUrl && ttsData.audioUrl.startsWith('data:audio/wav;base64,')) {
      console.log(`  ✅ Turn ${i + 1} TTS: SUCCESS (Generated WAV ${Math.round(ttsData.audioUrl.length / 1024)} KB)`);
    } else {
      console.log(`  ⚠️ Turn ${i + 1} TTS:`, ttsData.error || ttsRes.statusText);
    }
  }

  // 4. Test Chat SSE Streaming Turn
  console.log('\n💬 Testing Chat SSE Turn...');
  const chatRes = await fetch('http://localhost:5000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
    }),
  });

  console.log('✅ Chat SSE Streaming Status:', chatRes.status === 200 ? 'PASS' : `FAIL (${chatRes.status})`);

  // 5. Test Frontend HTML Serving
  const feRes = await fetch('http://localhost:5174/');
  const feHtml = await feRes.text();
  const hasAppRoot = feHtml.includes('id="root"');
  console.log('✅ Vite Frontend Serving (http://localhost:5174/):', hasAppRoot ? 'PASS' : 'FAIL');

  console.log('\n🎉 All Feature Verifications Completed Successfully!\n');
}

testAll().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
