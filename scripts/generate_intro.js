const path = require('path');
const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const outputPath = path.join(__dirname, '..', 'media', 'intro_fixed.mp3');

console.log('Gerando áudio fixo de abertura de 4 segundos com acordes suaves...');

// Gera uma vinheta musical suave de 4 segundos com transição fade-out
const command = `"${ffmpegPath}" -f lavfi -i "sine=frequency=440:duration=1,aeval=val(0)*exp(-t*3)[a];sine=frequency=554.37:duration=1.5,aeval=val(0)*exp(-t*2)[b];sine=frequency=659.25:duration=2.5,aeval=val(0)*exp(-t*1.5)[c];sine=frequency=880:duration=4,aeval=val(0)*exp(-t*1)[d];[a][b][c][d]amix=inputs=4:duration=longest,volume=0.8" -c:a libmp3lame -b:a 192k -ar 48000 -y "${outputPath}"`;

try {
  execSync(command, { stdio: 'inherit' });
  console.log('✅ intro_fixed.mp3 gerado com sucesso!');
} catch (err) {
  console.error('Erro ao gerar intro_fixed.mp3:', err);
}
