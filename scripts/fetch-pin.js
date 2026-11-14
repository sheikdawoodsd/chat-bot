async function checkPin() {
  try {
    const res = await fetch('https://in.pinterest.com/pin/1102256077580224155/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    console.log('Status:', res.status, 'URL:', res.url);
    const html = await res.text();
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    console.log('Title:', titleMatch ? titleMatch[1] : 'No title');

    // Look for video URL
    const videoMatches = html.match(/https:\/\/[^"'<>\s]+\.(?:mp4|m3u8|webm)/gi) || [];
    console.log('Videos found:', Array.from(new Set(videoMatches)).slice(0, 5));

    // Look for og:video or json-ld
    const ogVideo = html.match(/<meta\s+property=["']og:video(?::url)?["']\s+content=["']([^"']+)["']/i);
    console.log('og:video:', ogVideo ? ogVideo[1] : 'none');
  } catch (err) {
    console.error('Error fetching pin:', err.message);
  }
}

checkPin();

