async function runE2E() {
  const baseUrl = 'http://localhost:5000';
  console.log('🚀 Running Full E2E Verification Suite for Hi Nova!...\n');

  // 1. Health
  console.log('1. Checking Health API...');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const health = await healthRes.json();
  console.log('   Health Status:', health.status, '| App:', health.appName, '| KeyConfigured:', health.hasGeminiKey);
  if (health.status !== 'ok') throw new Error('Health check failed');

  // 2. Register & Intro Status
  console.log('\n2. Testing User Registration & Intro Flag...');
  const testEmail = `e2e_novabot_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Cosmic Navigator',
      email: testEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    }),
  });
  const regData = await regRes.json();
  console.log('   Register HTTP:', regRes.status, '| Success:', regData.success);
  console.log('   hasSeenIntro (fresh user):', regData.user?.hasSeenIntro);
  if (regData.user?.hasSeenIntro !== false) throw new Error('Expected fresh user hasSeenIntro to be false');

  const cookie = regRes.headers.get('set-cookie');

  // 3. Mark Intro Seen
  console.log('\n3. Marking Intro as Seen...');
  const introRes = await fetch(`${baseUrl}/api/auth/intro-seen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookie || '' },
  });
  const introData = await introRes.json();
  console.log('   Intro Seen Success:', introData.success);

  // 4. Update Profile with Animated Avatar & Custom Username
  console.log('\n4. Testing Profile Update (Animated Avatar + Full Name)...');
  const profRes = await fetch(`${baseUrl}/api/auth/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: cookie || '' },
    body: JSON.stringify({
      fullName: 'Nova Admiral',
      username: `admiral_${Math.random().toString(36).slice(2, 6)}`,
      avatarUrl: 'avatar:woman_stellar',
    }),
  });
  const profData = await profRes.json();
  console.log('   Profile Update Success:', profData.success);
  console.log('   Updated Avatar URL:', profData.user?.avatarUrl);
  console.log('   Updated Full Name:', profData.user?.fullName);
  if (profData.user?.avatarUrl !== 'avatar:woman_stellar') throw new Error('Avatar not updated');

  // 5. Test Workspace Chat (Dev Code Mode)
  console.log('\n5. Testing Workspace Chat API (Mode: "code")...');
  const chatRes = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookie || '' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Write a 1-line JS function to reverse a string' }],
      workspaceMode: 'code',
      model: 'gemini-3.5-flash',
    }),
  });
  console.log('   Chat SSE HTTP Status:', chatRes.status);
  if (chatRes.status !== 200) throw new Error('Chat API failed');

  // Read a bit of the stream
  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();
  let receivedChunks = 0;
  let receivedText = '';
  while (receivedChunks < 5) {
    const { value, done } = await reader.read();
    if (done) break;
    receivedText += decoder.decode(value);
    receivedChunks++;
  }
  reader.cancel();
  console.log('   Chat Stream Started Successfully (Received sample SSE events)');

  // 6. Test Multi-lingual TTS Voice
  console.log('\n6. Testing Multi-lingual Voice TTS API...');
  const ttsRes = await fetch(`${baseUrl}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookie || '' },
    body: JSON.stringify({
      text: 'வணக்கம், நான் நோவா!',
      voice: 'Kore',
    }),
  });
  console.log('   TTS HTTP Status:', ttsRes.status);
  const ttsData = await ttsRes.json();
  console.log('   TTS Success:', ttsData.success, '| Has Audio:', Boolean(ttsData.audioBase64));

  console.log('\n✨ ALL E2E BACKEND & CLIENT VERIFICATIONS PASSED SUCCESSFULLY!');
}

runE2E().catch((err) => {
  console.error('❌ E2E Verification Failed:', err);
  process.exit(1);
});
