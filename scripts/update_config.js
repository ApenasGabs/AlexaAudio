require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

const req = http.request(
  {
    hostname: '127.0.0.1',
    port: PORT,
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

req.write(JSON.stringify({ publicUrl: PUBLIC_URL }));
req.end();

