const http = require('http');

function sendPost(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/alexa',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve(JSON.parse(body)));
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function testQueueFlow() {
  console.log('1. Testando LaunchRequest (Tocar intro fixa)...');
  const r1 = await sendPost({ version: '1.0', request: { type: 'LaunchRequest' } });
  console.log('Resposta 1 (Intro Fixa):', JSON.stringify(r1.response.directives, null, 2));

  console.log('\n2. Testando PlaybackNearlyFinished (Enfileirar Live Stream do PC)...');
  const r2 = await sendPost({
    version: '1.0',
    request: {
      type: 'AudioPlayer.PlaybackNearlyFinished',
      token: 'intro-fixed',
      offsetInMilliseconds: 2500,
    },
  });
  console.log('Resposta 2 (Fila Live Stream):', JSON.stringify(r2.response.directives, null, 2));
}

testQueueFlow().catch(console.error);
