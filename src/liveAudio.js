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

    // Buffer circular de pré-carregamento para o Echo (~64KB)
    this.bufferCache = [];
    this.bufferCacheSize = 0;
    this.maxCacheSize = 64 * 1024;
  }

  start() {
    if (this.isRunning) return;

    this.server = net.createServer((socket) => {
      console.log('[LiveAudio] 🎧 Conexão WASAPI nativa C# de alta performance estabelecida.');

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
        // Atualiza ring buffer
        this.bufferCache.push(chunk);
        this.bufferCacheSize += chunk.length;

        while (this.bufferCacheSize > this.maxCacheSize && this.bufferCache.length > 0) {
          const removed = this.bufferCache.shift();
          this.bufferCacheSize -= removed.length;
        }

        // Transmite o chunk de MP3 sem atraso para todos os ouvintes
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

      // Executa o capturador C# em memória de latência zero
      const scriptPath = path.join(__dirname, '..', 'scripts', 'run_wasapi_in_memory.ps1');
      this.psProcess = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-Port', `${this.port}`
      ]);

      this.psProcess.stderr.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg) console.log(`[WASAPI Core] ${msg}`);
      });

      this.psProcess.on('exit', (code) => {
        console.log(`[LiveAudio] Processo de captura encerrado com código ${code}`);
        this.isRunning = false;
      });

      this.isRunning = true;
    });
  }

  addClient(res) {
    // Envia o pré-buffer para sincronização imediata
    if (this.bufferCache.length > 0) {
      for (const chunk of this.bufferCache) {
        try {
          res.write(chunk);
        } catch (e) {
          return;
        }
      }
    }

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
