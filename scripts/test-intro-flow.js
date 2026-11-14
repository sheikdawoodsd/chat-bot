async function runTest() {
  const baseUrl = 'http://localhost:5000';

  console.log('--- 1. Testing Health Endpoint ---');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthData = await healthRes.json();
  console.log('Health status:', healthData.status, 'AppName:', healthData.appName);

  const testEmail1 = `intro_user_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  console.log('\n--- 2. Register New User (Account 1) ---');
  const reg1Res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Cosmic Traveler',
      email: testEmail1,
      password: testPassword,
      confirmPassword: testPassword,
    }),
  });

  const reg1Data = await reg1Res.json();
  console.log('Register 1 HTTP Status:', reg1Res.status, 'Response:', reg1Data);
  console.log('Register 1 Success:', reg1Data.success);
  console.log('User 1 hasSeenIntro:', reg1Data.user?.hasSeenIntro);
  if (reg1Data.user?.hasSeenIntro !== false) {
    throw new Error('Expected hasSeenIntro to be false for freshly created user');
  }

  // Extract auth cookie
  const cookie1 = reg1Res.headers.get('set-cookie');
  console.log('Cookie received:', Boolean(cookie1));

  console.log('\n--- 3. Mark Intro as Seen for User 1 ---');
  const seenRes = await fetch(`${baseUrl}/api/auth/intro-seen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookie1 || '',
    },
  });
  const seenData = await seenRes.json();
  console.log('Mark Seen Success:', seenData.success);

  console.log('\n--- 4. Verify /api/auth/me for User 1 ---');
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: cookie1 || '' },
  });
  const meData = await meRes.json();
  console.log('User 1 hasSeenIntro after recording:', meData.user?.hasSeenIntro);
  if (meData.user?.hasSeenIntro !== true) {
    throw new Error('Expected hasSeenIntro to be true after marking seen');
  }

  console.log('\n--- 5. Login again with User 1 ---');
  const login1Res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail1,
      password: testPassword,
    }),
  });
  const login1Data = await login1Res.json();
  console.log('Login 1 Success:', login1Data.success);
  console.log('Login 1 hasSeenIntro:', login1Data.user?.hasSeenIntro);
  if (login1Data.user?.hasSeenIntro !== true) {
    throw new Error('Expected login hasSeenIntro to remain true (NO intro replay on login)');
  }

  console.log('\n--- 6. Register Another New User (Account 2) ---');
  const testEmail2 = `intro_user2_${Date.now()}@example.com`;
  const reg2Res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Starlight Explorer',
      email: testEmail2,
      password: testPassword,
      confirmPassword: testPassword,
    }),
  });
  const reg2Data = await reg2Res.json();
  console.log('Register 2 Success:', reg2Data.success);
  console.log('User 2 hasSeenIntro:', reg2Data.user?.hasSeenIntro);
  if (reg2Data.user?.hasSeenIntro !== false) {
    throw new Error('Expected Account 2 hasSeenIntro to be false');
  }

  console.log('\n🎉 ALL ACCEPTANCE CRITERIA FOR INTRO STATE & PERSISTENCE PASSED!');
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

