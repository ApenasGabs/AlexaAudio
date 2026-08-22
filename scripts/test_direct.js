const http = require('http');

const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/alexa',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Headers:', res.headers);
      console.log('Body:', data);
    });
  }
);

req.write(JSON.stringify({
  version: '1.0',
  session: {
    new: true,
    sessionId: 'session-123',
    application: { applicationId: 'amzn1.ask.skill.test' },
    user: { userId: 'user-123' }
  },
  context: {
    System: {
      application: { applicationId: 'amzn1.ask.skill.test' },
      device: { supportedInterfaces: { AudioPlayer: {} } }
    }
  },
  request: {
    type: 'LaunchRequest',
    requestId: 'req-123',
    locale: 'pt-BR'
  }
}));

req.end();
