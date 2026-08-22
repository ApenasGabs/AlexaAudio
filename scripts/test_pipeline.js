const { spawn } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

console.log('Iniciando captura e codificação...');

const ps = spawn('powershell.exe', [
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', path.join(__dirname, 'stream_audio.ps1')
]);

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

ps.stdout.pipe(ffmpeg.stdin);

ps.stderr.on('data', d => console.log('[PS STDERR]:', d.toString().trim()));
ffmpeg.stderr.on('data', d => console.log('[FFMPEG]:', d.toString().trim()));

ffmpeg.stdout.on('data', chunk => {
  console.log('🎉 Recebido chunk MP3 ao vivo! Bytes:', chunk.length);
});

setTimeout(() => {
  console.log('Finalizando teste...');
  ps.kill();
  ffmpeg.kill();
  process.exit(0);
}, 6000);
