const http = require('http');

function sendPost(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testando LaunchRequest (Alexa, abrir áudio local)...');
  const launchRes = await sendPost('/alexa', {
    version: '1.0',
    request: {
      type: 'LaunchRequest',
    },
  });

  console.log('Status:', launchRes.status);
  console.log('Resposta enviada para a Alexa:');
  console.log(JSON.stringify(launchRes.data, null, 2));
}

runTests().catch(console.error);
