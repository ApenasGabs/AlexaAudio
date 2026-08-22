const http = require('http');

const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/config',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => console.log('Config salva:', data));
  }
);

req.write(JSON.stringify({ publicUrl: 'https://pc-gamer.tailf82141.ts.net' }));
req.end();
