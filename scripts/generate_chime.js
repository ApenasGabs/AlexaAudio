const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// Gera um jingle suave de 1.5s ("Ding/Chime de Conexão") usando sintetizador do FFmpeg
const outputPath = path.join(__dirname, '..', 'media', 'connect_chime.mp3');

console.log('Gerando jingle de conexão...');

const ffmpeg = spawn(ffmpegPath, [
  '-f', 'lavfi',
  '-i', 'sine=frequency=587.33:duration=0.2,aeval=val(0)*exp(-t*4)[a];sine=frequency=880:duration=1.2,aeval=val(0)*exp(-t*2)[b];[a][b]concat=n=2:v=0:a=1[out]',
  '-map', '[out]',
  '-c:a', 'libmp3lame',
  '-b:a', '192k',
  '-ar', '48000',
  '-y',
  outputPath
]);

ffmpeg.on('close', (code) => {
  console.log('Jingle gerado com sucesso em media/connect_chime.mp3 (Código:', code, ')');
});
