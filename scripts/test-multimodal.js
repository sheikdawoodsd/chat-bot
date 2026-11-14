async function testMultimodal() {
  console.log('Testing multimodal attachment upload and question answering...');

  // 1. Register temporary user
  const email = `multimodal_${Date.now()}@example.com`;
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Multimodal Tester',
      email,
      password: 'password123',
      confirmPassword: 'password123',
    }),
  });
  const cookie = regRes.headers.get('set-cookie').split(';')[0];

  // 2. Create 1x1 lime-green PNG buffer
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pngBuffer = Buffer.from(pngBase64, 'base64');

  // 3. Create multipart request
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const partHeader = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="green_pixel.png"\r\nContent-Type: image/png\r\n\r\n`
  );
  const partMessages = Buffer.from(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="messages"\r\n\r\n` +
      JSON.stringify([{ role: 'user', content: 'What specific color is in this image?' }])
  );
  const partFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([partHeader, pngBuffer, partMessages, partFooter]);

  const chatRes = await fetch('http://localhost:5000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Cookie: cookie,
    },
    body,
  });

  console.log('Chat response status:', chatRes.status);
  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();
  let reply = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const txt = decoder.decode(value);
    for (const line of txt.split('\n')) {
      if (line.startsWith('data:')) {
        try {
          const ev = JSON.parse(line.slice(5).trim());
          if (ev.type === 'content') reply += ev.content;
        } catch {}
      }
    }
  }

  console.log('Gemini reply for image:', reply.trim());
}

testMultimodal().catch(console.error);

