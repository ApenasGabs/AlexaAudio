const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const liveAudio = require('./liveAudio');
const { createAlexaSkill } = require('./alexaSkill');

const app = express();
const PORT = process.env.PORT || 3000;

const MEDIA_DIR = path.join(__dirname, '..', 'media');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.endsWith('.mp3') || file.originalname.endsWith('.m4a') || file.originalname.endsWith('.aac')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de áudio (.mp3, .m4a, .aac) são permitidos.'));
    }
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

let currentPublicUrl = process.env.PUBLIC_URL || 'https://pc-gamer.tailf82141.ts.net';
let currentTrack = null;
let playbackMode = 'live';

function getTracks() {
  const files = fs.readdirSync(MEDIA_DIR);
  return files.filter(file => /\.(mp3|m4a|aac|wav|ogg)$/i.test(file));
}

function getActiveTrack() {
  const tracks = getTracks();
  if (!currentTrack || !tracks.includes(currentTrack)) {
    currentTrack = tracks.length > 0 ? tracks[0] : null;
  }
  return currentTrack;
}

// Inicia captura WASAPI nativa contínua
liveAudio.start();

// Configura a Skill oficial apontando para URLs com extensão .mp3 obrigatória pela Amazon
const skill = createAlexaSkill(() => {
  const active = getActiveTrack();
  const baseUrl = currentPublicUrl;
  const isLive = playbackMode === 'live';

  return {
    url: isLive 
      ? `${baseUrl}/stream/live.mp3` 
      : `${baseUrl}/stream/${encodeURIComponent(active || 'sample_song.mp3')}`,
    title: isLive ? 'Áudio do PC ao Vivo' : (active || 'Áudio Local'),
    token: isLive ? `live-stream-${Date.now()}` : (active || `file-${Date.now()}`),
  };
});

// ==========================================
// ROTAS DA API LOCAL (Web UI)
// ==========================================

app.get('/api/status', (req, res) => {
  const tracks = getTracks();
  const active = getActiveTrack();
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = currentPublicUrl || `${protocol}://${host}`;

  const currentStreamUrl = playbackMode === 'live' 
    ? `${baseUrl}/stream/live.mp3` 
    : (active ? `${baseUrl}/stream/${encodeURIComponent(active)}` : `${baseUrl}/stream/live.mp3`);

  res.json({
    status: 'online',
    playbackMode,
    publicUrl: currentPublicUrl,
    activeTrack: active,
    liveStreamUrl: `${baseUrl}/stream/live.mp3`,
    activeStreamUrl: currentStreamUrl,
    alexaWebhookUrl: `${baseUrl}/alexa`,
    listenersCount: liveAudio.clients.size,
    tracks: tracks.map(name => {
      const stats = fs.statSync(path.join(MEDIA_DIR, name));
      return {
        name,
        sizeBytes: stats.size,
        sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
        url: `${baseUrl}/stream/${encodeURIComponent(name)}`,
      };
    }),
  });
});

app.post('/api/mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'live' || mode === 'file') {
    playbackMode = mode;
    return res.json({ success: true, playbackMode });
  }
  res.status(400).json({ error: 'Modo inválido. Use "live" ou "file".' });
});

app.post('/api/config', (req, res) => {
  const { publicUrl } = req.body;
  if (publicUrl !== undefined) {
    currentPublicUrl = publicUrl.replace(/\/+$/, '');
  }
  res.json({ success: true, publicUrl: currentPublicUrl });
});

app.post('/api/active-track', (req, res) => {
  const { track } = req.body;
  const tracks = getTracks();
  if (track && tracks.includes(track)) {
    currentTrack = track;
    playbackMode = 'file';
    return res.json({ success: true, activeTrack: currentTrack, playbackMode });
  }
  res.status(400).json({ error: 'Faixa não encontrada.' });
});

app.post('/api/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  if (!currentTrack) {
    currentTrack = req.file.filename;
  }
  res.json({
    success: true,
    filename: req.file.filename,
    message: 'Arquivo enviado com sucesso!',
  });
});

app.delete('/api/tracks/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(MEDIA_DIR, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    if (currentTrack === filename) {
      currentTrack = null;
    }
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Arquivo não encontrado.' });
});

// ==========================================
// ROTAS DE STREAMING (Live & Arquivos)
// ==========================================

function handleLiveStream(req, res) {
  console.log(`[HTTP /stream/live.mp3] Conexão recebida de ${req.ip}`);

  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Accept-Ranges': 'none',
    'Access-Control-Allow-Origin': '*',
    'icy-notice1': 'AlexaAudio Live PC Stream',
    'icy-name': 'PC Audio Live',
    'icy-genre': 'Live',
    'icy-br': '192',
  });

  liveAudio.addClient(res);
}

// Aceita tanto /stream/live quanto /stream/live.mp3 (exigido pelo AudioPlayer)
app.get('/stream/live.mp3', handleLiveStream);
app.get('/stream/live', handleLiveStream);

function streamAudioFile(filePath, req, res) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Áudio não encontrado.');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
}

app.get('/stream/active.mp3', (req, res) => {
  if (playbackMode === 'live') {
    return handleLiveStream(req, res);
  }
  const active = getActiveTrack();
  if (!active) {
    return handleLiveStream(req, res);
  }
  streamAudioFile(path.join(MEDIA_DIR, active), req, res);
});

app.get('/stream/active', (req, res) => {
  res.redirect(302, '/stream/active.mp3');
});

app.get('/stream/:filename', (req, res) => {
  const filename = req.params.filename;
  if (filename === 'live' || filename === 'live.mp3') {
    return handleLiveStream(req, res);
  }
  const filePath = path.join(MEDIA_DIR, filename);
  streamAudioFile(filePath, req, res);
});

// ==========================================
// ENDPOINT ALEXA SKILL (Oficial ASK Core)
// ==========================================
app.post('/alexa', async (req, res) => {
  try {
    const response = await skill.invoke(req.body);
    console.log(`[Alexa Webhook] Resposta enviada com sucesso para type: ${req.body?.request?.type}`);
    res.setHeader('Content-Type', 'application/json;charset=UTF-8');
    res.json(response);
  } catch (err) {
    console.error('[Alexa Webhook Error]:', err);
    res.status(500).json({ error: 'Erro no webhook' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🎵 AlexaAudio Server rodando em: http://localhost:${PORT}`);
  console.log(`📡 Modo de transmissão ativo: ${playbackMode.toUpperCase()}`);
  console.log(`🌐 Web UI: http://localhost:${PORT}`);
  console.log(`🔗 Public URL: ${currentPublicUrl}`);
  console.log('====================================================');
});
