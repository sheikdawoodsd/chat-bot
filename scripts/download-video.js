import fs from 'fs';
import path from 'path';

async function downloadVideo() {
  const url = 'https://v1.pinimg.com/videos/iht/expMp4/1d/f0/98/1df098193b37d2aef4e2e25d645c4da6_720w.mp4';
  const dest = path.resolve('client/public/intro-video.mp4');

  console.log('Downloading video to', dest);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch video: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(dest, buffer);
  console.log(`Video saved successfully! Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
}

downloadVideo().catch(err => {
  console.error('Download error:', err.message);
});

