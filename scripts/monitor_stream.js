const http = require('http');

console.log('Monitorando taxa de transferência do stream local...');

const req = http.get('http://127.0.0.1:3000/stream/live.mp3', (res) => {
  let bytesReceived = 0;
  let lastTime = Date.now();

  res.on('data', (chunk) => {
    bytesReceived += chunk.length;
    const now = Date.now();
    if (now - lastTime >= 1000) {
      const kbps = ((bytesReceived * 8) / ((now - lastTime) / 1000) / 1000).toFixed(1);
      console.log(`📡 Fluxo ativo: ${kbps} kbps | Total: ${(bytesReceived / 1024).toFixed(1)} KB`);
      bytesReceived = 0;
      lastTime = now;
    }
  });

  res.on('end', () => console.log('Stream finalizado.'));
});

req.on('error', console.error);

setTimeout(() => {
  req.destroy();
  console.log('Monitoramento de 5 segundos concluído.');
  process.exit(0);
}, 6000);
