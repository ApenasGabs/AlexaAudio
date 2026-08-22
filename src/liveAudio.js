const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const EventEmitter = require('events');

class LiveAudioCapture extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.psProcess = null;
    this.ffmpegProcess = null;
    this.isRunning = false;
    this.clients = new Set();
    this.port = 3001;
  }

  start() {
    if (this.isRunning) return;

    this.server = net.createServer((socket) => {
      console.log('[LiveAudio] 🎧 Conexão WASAPI de áudio estabelecida.');

      this.ffmpegProcess = spawn(ffmpegPath, [
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

      socket.pipe(this.ffmpegProcess.stdin);

      this.ffmpegProcess.stdout.on('data', (chunk) => {
        // Transmite o chunk de MP3 para todos os clientes conectados (Alexas/Navegadores)
        for (const client of this.clients) {
          try {
            client.write(chunk);
          } catch (e) {
            this.removeClient(client);
          }
        }
      });

      this.ffmpegProcess.on('error', (err) => {
        console.error('[LiveAudio] Erro no FFmpeg:', err);
      });

      socket.on('close', () => {
        console.log('[LiveAudio] Conexão do capturador encerrada.');
        if (this.ffmpegProcess) {
          this.ffmpegProcess.kill();
          this.ffmpegProcess = null;
        }
      });
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[LiveAudio] Servidor TCP de áudio escutando em 127.0.0.1:${this.port}`);

      // Inicia o processo PowerShell de captura de loopback
      const scriptPath = path.join(__dirname, '..', 'scripts', 'stream_audio_tcp.ps1');
      this.psProcess = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath
      ]);

      this.psProcess.stderr.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg) console.log(`[WASAPI Capture] ${msg}`);
      });

      this.psProcess.on('exit', (code) => {
        console.log(`[LiveAudio] Processo PowerShell encerrado com código ${code}`);
        this.isRunning = false;
      });

      this.isRunning = true;
    });
  }

  addClient(res) {
    this.clients.add(res);
    res.on('close', () => this.removeClient(res));
    console.log(`[LiveAudio] Novo ouvinte conectado. Total de ouvintes: ${this.clients.size}`);
  }

  removeClient(res) {
    this.clients.delete(res);
    console.log(`[LiveAudio] Ouvinte desconectado. Total de ouvintes: ${this.clients.size}`);
  }

  stop() {
    if (this.psProcess) {
      this.psProcess.kill();
      this.psProcess = null;
    }
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill();
      this.ffmpegProcess = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.isRunning = false;
  }
}

module.exports = new LiveAudioCapture();
