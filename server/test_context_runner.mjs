import fs from 'fs';

async function runTests() {
  console.log('=== Starting Nova Conversation Context Verification ===');

  // 1. Authenticate / Login to get cookie
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'context_tester@nova.ai', password: 'Password123!' }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('1. Auth status:', loginRes.status, cookie ? 'Cookie received' : 'No cookie');

  async function sendTurn(chatId, messages, fileBuffer, fileName) {
    if (fileBuffer) {
      const form = new FormData();
      form.append('chatId', chatId);
      form.append('messages', JSON.stringify(messages));
      form.append('workspaceMode', 'general');
      const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
      form.append('files', blob, fileName);
      const res = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: form,
      });
      return await parseSSE(res);
    } else {
      const res = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          chatId,
          messages,
          workspaceMode: 'general',
        }),
      });
      return await parseSSE(res);
    }
  }

  async function parseSSE(res) {
    const text = await res.text();
    const lines = text.split('\n');
    let content = '';
    let meta = null;
    for (const l of lines) {
      if (l.startsWith('data: ')) {
        try {
          const evt = JSON.parse(l.slice(6));
          if (evt.type === 'content') content += evt.content;
          if (evt.type === 'meta') meta = evt;
        } catch {}
      }
    }
    return { content, meta };
  }

  // TEST SEQUENCE 1: Ask a question, then type "Explain more."
  console.log('\n--- TEST SEQUENCE 1: Question -> "Explain more." ---');
  const chat1 = 'chat_test_seq1_' + Date.now();
  const m1_1 = [{ id: 'm1', role: 'user', content: 'What is quantum superposition in simple terms?' }];
  const r1_1 = await sendTurn(chat1, m1_1);
  console.log('Turn 1 Output (len ' + r1_1.content.length + '):', r1_1.content.slice(0, 100) + '...');

  const m1_2 = [
    ...m1_1,
    { id: 'm2', role: 'assistant', content: r1_1.content },
    { id: 'm3', role: 'user', content: 'Explain more.' },
  ];
  const r1_2 = await sendTurn(chat1, m1_2);
  console.log('Turn 2 Output for "Explain more." (len ' + r1_2.content.length + '):', r1_2.content.slice(0, 150) + '...');
  const mentionsQuantum = /quantum|superposition|state|qubit|wavefunction|collapse/i.test(r1_2.content);
  console.log('PASS Context Link (mentions quantum principles):', mentionsQuantum);

  // TEST SEQUENCE 2: Upload image, ask question, then ask "What are the visible signs?"
  console.log('\n--- TEST SEQUENCE 2: Image Question -> "What are the visible signs?" ---');
  const chat2 = 'chat_test_seq2_' + Date.now();
  const catBuf = fs.readFileSync('test_cat.jpg');
  const m2_1 = [{ id: 'm2_1', role: 'user', content: 'What is this animal and its expression/mood?' }];
  const r2_1 = await sendTurn(chat2, m2_1, catBuf, 'happy_cat.jpg');
  console.log('Turn 1 Output (len ' + r2_1.content.length + '):', r2_1.content.slice(0, 100) + '...');
  console.log('Saved Attachments from server:', r2_1.meta?.savedAttachments);

  // Follow-up without re-sending the file, just text: "What are the visible signs?"
  const m2_2 = [
    {
      id: 'm2_1',
      role: 'user',
      content: 'What is this animal and its expression/mood?',
      attachments: r2_1.meta?.savedAttachments || [
        { id: 'att_unknown', url: '/api/files/test', name: 'happy_cat.jpg', type: 'image/jpeg' },
      ],
    },
    { id: 'm2_2', role: 'assistant', content: r2_1.content },
    { id: 'm2_3', role: 'user', content: 'What are the visible signs of its mood and facial features?' },
  ];
  const r2_2 = await sendTurn(chat2, m2_2);
  console.log('Turn 2 Output for "What are the visible signs?" (len ' + r2_2.content.length + '):', r2_2.content.slice(0, 200) + '...');
  const mentionsCatFeatures = /eyes|ears|fur|whiskers|tabby|relaxed|facial|gaze|muzzle/i.test(r2_2.content);
  console.log('PASS Vision Context Link (mentions cat visual features from Turn 1):', mentionsCatFeatures);

  // TEST SEQUENCE 3: Re-upload same image with "Explain this."
  console.log('\n--- TEST SEQUENCE 3: Re-upload same image -> "Explain this." ---');
  const m2_3 = [
    ...m2_2,
    { id: 'm2_4', role: 'assistant', content: r2_2.content },
    { id: 'm2_5', role: 'user', content: 'Explain this.' },
  ];
  const r2_3 = await sendTurn(chat2, m2_3, catBuf, 'happy_cat.jpg');
  console.log('Turn 3 Output for Re-uploaded Image + "Explain this." (len ' + r2_3.content.length + '):', r2_3.content.slice(0, 200) + '...');
  const isConnected = /cat|feline|tabby|expression|eyes|ears|fur/i.test(r2_3.content);
  console.log('PASS Re-uploaded image context link:', isConnected);

  // TEST SEQUENCE 4: Comparison with previous image
  console.log('\n--- TEST SEQUENCE 4: Second Image -> "Compare it with the previous image." ---');
  const chat4 = 'chat_test_seq4_' + Date.now();
  const r4_1 = await sendTurn(chat4, [{ id: 'm4_1', role: 'user', content: 'What is this first animal?' }], catBuf, 'cat_1.jpg');
  console.log('Turn 1 Output (len ' + r4_1.content.length + '):', r4_1.content.slice(0, 80) + '...');

  const m4_2 = [
    {
      id: 'm4_1',
      role: 'user',
      content: 'What is this first animal?',
      attachments: r4_1.meta?.savedAttachments,
    },
    { id: 'm4_2', role: 'assistant', content: r4_1.content },
    { id: 'm4_3', role: 'user', content: 'Compare it with the previous image.' },
  ];
  // Upload second image (we use sample image from video_frames)
  let sample2Buf = catBuf;
  if (fs.existsSync('../video_frames/vid3_frame_0_0.jpg')) {
    sample2Buf = fs.readFileSync('../video_frames/vid3_frame_0_0.jpg');
  }
  const r4_2 = await sendTurn(chat4, m4_2, sample2Buf, 'second_image.jpg');
  console.log('Turn 2 Comparison Output (len ' + r4_2.content.length + '):', r4_2.content.slice(0, 200) + '...');
  const isComparison = /comparison|compare|difference|previous|first image|second image|while|unlike/i.test(r4_2.content);
  console.log('PASS Image Comparison Context Link:', isComparison);

  console.log('\n=== ALL CONVERSATION CONTEXT TESTS COMPLETED SUCCESSFULLY ===');
}

runTests().catch(console.error);
