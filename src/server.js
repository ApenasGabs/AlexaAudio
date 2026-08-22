const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de diretórios
const MEDIA_DIR = path.join(__dirname, '..', 'media');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Configuração do upload de arquivos de áudio
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    // Sanitiza nome do arquivo
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

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Estado em memória
let currentPublicUrl = process.env.PUBLIC_URL || '';
let currentTrack = null;

// Função auxiliar para listar faixas
function getTracks() {
  const files = fs.readdirSync(MEDIA_DIR);
  return files.filter(file => /\.(mp3|m4a|aac|wav|ogg)$/i.test(file));
}

// Se não houver faixa selecionada, seleciona a primeira disponível
function getActiveTrack() {
  const tracks = getTracks();
  if (!currentTrack || !tracks.includes(currentTrack)) {
    currentTrack = tracks.length > 0 ? tracks[0] : null;
  }
  return currentTrack;
}

// ==========================================
// ROTAS DA API LOCAL (Web UI)
// ==========================================

// Lista todas as faixas e status do servidor
app.get('/api/status', (req, res) => {
  const tracks = getTracks();
  const active = getActiveTrack();
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = currentPublicUrl || `${protocol}://${host}`;

  res.json({
    status: 'online',
    publicUrl: currentPublicUrl,
    activeTrack: active,
    streamUrl: active ? `${baseUrl}/stream/${encodeURIComponent(active)}` : null,
    activeStreamUrl: `${baseUrl}/stream/active`,
    alexaWebhookUrl: `${baseUrl}/alexa`,
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

// Configura a URL pública do túnel (Cloudflare / Ngrok)
app.post('/api/config', (req, res) => {
  const { publicUrl } = req.body;
  if (publicUrl !== undefined) {
    currentPublicUrl = publicUrl.replace(/\/+$/, ''); // remove barra final
  }
  res.json({ success: true, publicUrl: currentPublicUrl });
});

// Seleciona a faixa ativa
app.post('/api/active-track', (req, res) => {
  const { track } = req.body;
  const tracks = getTracks();
  if (track && tracks.includes(track)) {
    currentTrack = track;
    return res.json({ success: true, activeTrack: currentTrack });
  }
  res.status(400).json({ error: 'Faixa não encontrada.' });
});

// Upload de nova faixa de áudio
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

// Deletar faixa
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
// ROTA DE STREAMING DE ÁUDIO (Suporte a Range Requests para Alexa)
// ==========================================
function streamAudioFile(filePath, req, res) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Áudio não encontrado.');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Alexa e players de áudio usam requisições de Range (HTTP 206)
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

// Toca a faixa ativa
app.get('/stream/active', (req, res) => {
  const active = getActiveTrack();
  if (!active) {
    return res.status(404).send('Nenhum áudio disponível na pasta media.');
  }
  streamAudioFile(path.join(MEDIA_DIR, active), req, res);
});

// Toca uma faixa específica por nome
app.get('/stream/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(MEDIA_DIR, filename);
  streamAudioFile(filePath, req, res);
});

// ==========================================
// ENDPOINT ALEXA SKILL (Webhook)
// ==========================================
app.post('/alexa', (req, res) => {
  const alexaRequest = req.body;
  const requestType = alexaRequest?.request?.type;
  const intentName = alexaRequest?.request?.intent?.name;

  console.log(`[Alexa Request] Type: ${requestType}, Intent: ${intentName || 'N/A'}`);

  const active = getActiveTrack();
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = currentPublicUrl || `${protocol}://${host}`;
  const streamUrl = `${baseUrl}/stream/active`;

  // Função auxiliar para gerar resposta com AudioPlayer
  const buildAudioResponse = (speechText, audioUrl, token) => {
    return {
      version: '1.0',
      response: {
        outputSpeech: speechText ? {
          type: 'PlainText',
          text: speechText,
        } : undefined,
        directives: [
          {
            type: 'AudioPlayer.Play',
            playBehavior: 'REPLACE_ALL',
            audioItem: {
              stream: {
                url: audioUrl,
                token: token || 'track-' + Date.now(),
                offsetInMilliseconds: 0,
              },
              metadata: {
                title: active || 'Áudio Local',
                subtitle: 'AlexaAudio Server Local',
              },
            },
          },
        ],
        shouldEndSession: true,
      },
    };
  };

  // Função para parar áudio
  const buildStopResponse = () => {
    return {
      version: '1.0',
      response: {
        directives: [
          {
            type: 'AudioPlayer.Stop',
          },
        ],
        shouldEndSession: true,
      },
    };
  };

  // Trata LaunchRequest ("Alexa, abrir Áudio Local")
  if (requestType === 'LaunchRequest') {
    if (!active) {
      return res.json({
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: 'Nenhum áudio encontrado no servidor local. Por favor, adicione uma música.',
          },
          shouldEndSession: true,
        },
      });
    }
    return res.json(buildAudioResponse(`Tocando ${active.replace(/\.[^/.]+$/, '')}`, streamUrl, active));
  }

  // Trata IntentRequest
  if (requestType === 'IntentRequest') {
    switch (intentName) {
      case 'PlayIntent':
      case 'AMAZON.ResumeIntent':
        if (!active) {
          return res.json({
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: 'Não há áudio ativo no momento.',
              },
              shouldEndSession: true,
            },
          });
        }
        return res.json(buildAudioResponse('Tocando áudio local', streamUrl, active));

      case 'AMAZON.PauseIntent':
      case 'AMAZON.StopIntent':
      case 'AMAZON.CancelIntent':
        return res.json(buildStopResponse());

      case 'AMAZON.NextIntent':
        // Avança para próxima faixa
        const tracks = getTracks();
        if (tracks.length > 1) {
          const currentIndex = tracks.indexOf(active);
          const nextIndex = (currentIndex + 1) % tracks.length;
          currentTrack = tracks[nextIndex];
        }
        return res.json(buildAudioResponse(`Próxima: ${currentTrack}`, `${baseUrl}/stream/active`, currentTrack));

      case 'AMAZON.HelpIntent':
        return res.json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: 'Você pode pedir para tocar, pausar ou avançar o áudio transmitido do seu computador.',
            },
            shouldEndSession: false,
          },
        });

      default:
        return res.json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: 'Comando não reconhecido pelo servidor local.',
            },
            shouldEndSession: true,
          },
        });
    }
  }

  // Trata eventos do AudioPlayer (Telemetry / Lifecyle)
  if (requestType && requestType.startsWith('AudioPlayer.')) {
    // Apenas responde com 200 OK vazio para reconhecer o evento
    return res.json({ version: '1.0', response: {} });
  }

  // Resposta padrão
  res.json({ version: '1.0', response: { shouldEndSession: true } });
});

// Inicializa o servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🎵 AlexaAudio Server rodando em: http://localhost:${PORT}`);
  console.log(`📡 Pasta de mídia: ${MEDIA_DIR}`);
  console.log(`🌐 Web UI: http://localhost:${PORT}`);
  console.log('====================================================');
});
