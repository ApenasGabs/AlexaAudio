const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

// 1. Cria servidor TCP local para receber áudio bruto PCM
const server = net.createServer((socket) => {
  console.log('🔗 Conexão de áudio estabelecida do capturador WASAPI!');

  // 2. Inicia FFmpeg para converter PCM em stream MP3 em tempo real
  const ffmpeg = spawn(ffmpegPath, [
    '-f', 'f32le',
    '-ar', '48000',
    '-ac', '2',
    '-i', 'pipe:0',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-flush_packets', '1',
    '-f', 'mp3',
    'pipe:1'
  ]);

  socket.pipe(ffmpeg.stdin);

  ffmpeg.stdout.on('data', (chunk) => {
    console.log('🎉 [Live MP3 Stream]: Recebido chunk de áudio em tempo real! Tamanho:', chunk.length, 'bytes');
  });

  ffmpeg.stderr.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('size=')) {
      console.log('Encoding status:', msg.trim());
    }
  });

  socket.on('close', () => ffmpeg.kill());
});

server.listen(3001, '127.0.0.1', () => {
  console.log('Servidor TCP de áudio escutando na porta 3001...');

  // 3. Inicia capturador PowerShell conectando via TCP
  const ps = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', path.join(__dirname, 'stream_audio_tcp.ps1')
  ]);

  ps.stderr.on('data', d => console.log('[PS STDERR]:', d.toString().trim()));

  setTimeout(() => {
    console.log('Encerrando teste...');
    ps.kill();
    server.close();
    process.exit(0);
  }, 6000);
});
