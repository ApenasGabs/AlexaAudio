let currentMode = 'live';

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    currentMode = data.playbackMode;

    // Atualiza botões de modo
    const btnLive = document.getElementById('btnModeLive');
    const btnFile = document.getElementById('btnModeFile');
    if (currentMode === 'live') {
      btnLive.classList.add('active');
      btnFile.classList.remove('active');
    } else {
      btnFile.classList.add('active');
      btnLive.classList.remove('active');
    }

    // Atualiza Faixa Ativa / Display
    const titleEl = document.getElementById('activeTrackTitle');
    const audioPlayer = document.getElementById('audioPlayer');
    const streamUrlInput = document.getElementById('streamUrlInput');
    const publicUrlInput = document.getElementById('publicUrlInput');
    const alexaWebhookInput = document.getElementById('alexaWebhookInput');

    if (currentMode === 'live') {
      titleEl.innerHTML = `🎙️ <strong>Áudio do PC ao Vivo</strong> (Transmitindo em tempo real)`;
      if (audioPlayer.src !== data.liveStreamUrl) {
        audioPlayer.src = data.liveStreamUrl;
      }
    } else {
      if (data.activeTrack) {
        titleEl.textContent = `📁 Arquivo: ${data.activeTrack}`;
        if (!audioPlayer.src.includes(encodeURIComponent(data.activeTrack))) {
          audioPlayer.src = data.activeStreamUrl;
        }
      } else {
        titleEl.textContent = 'Nenhum arquivo MP3 na pasta media/';
        audioPlayer.src = '';
      }
    }

    streamUrlInput.value = data.activeStreamUrl || '';
    alexaWebhookInput.value = data.alexaWebhookUrl || '';

    if (!publicUrlInput.value && data.publicUrl) {
      publicUrlInput.value = data.publicUrl;
    }

    renderTrackList(data.tracks, data.activeTrack);
  } catch (err) {
    console.error('Erro ao buscar status:', err);
  }
}

async function setMode(mode) {
  try {
    const res = await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      showToast(mode === 'live' ? 'Modo Ao Vivo do PC ativado!' : 'Modo Arquivo MP3 ativado!');
      fetchStatus();
    }
  } catch (err) {
    showToast('Erro ao alternar modo', true);
  }
}

function renderTrackList(tracks, activeTrack) {
  const trackListEl = document.getElementById('trackList');
  if (!tracks || tracks.length === 0) {
    trackListEl.innerHTML = '<p class="desc" style="text-align: center; padding: 1rem;">Nenhum arquivo MP3 adicionado ainda.</p>';
    return;
  }

  trackListEl.innerHTML = tracks.map(t => `
    <div class="track-item ${currentMode === 'file' && t.name === activeTrack ? 'active' : ''}">
      <div>
        <div class="track-name">${t.name}</div>
        <div class="track-meta">${t.sizeMb} MB</div>
      </div>
      <div class="track-actions">
        <button onclick="setActiveTrack('${encodeURIComponent(t.name)}')" class="btn-primary btn-sm">
          ${currentMode === 'file' && t.name === activeTrack ? '⭐ Tocando' : 'Tocar este'}
        </button>
        <button onclick="deleteTrack('${encodeURIComponent(t.name)}')" class="btn-danger btn-sm">
          Excluir
        </button>
      </div>
    </div>
  `).join('');
}

async function setActiveTrack(name) {
  const decoded = decodeURIComponent(name);
  try {
    const res = await fetch('/api/active-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track: decoded }),
    });
    if (res.ok) {
      showToast(`Modo arquivo ativado com: ${decoded}`);
      fetchStatus();
    }
  } catch (err) {
    showToast('Erro ao trocar faixa ativa', true);
  }
}

async function deleteTrack(name) {
  const decoded = decodeURIComponent(name);
  if (!confirm(`Deseja remover o arquivo ${decoded}?`)) return;

  try {
    const res = await fetch(`/api/tracks/${encodeURIComponent(decoded)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      showToast('Arquivo excluído com sucesso');
      fetchStatus();
    }
  } catch (err) {
    showToast('Erro ao excluir arquivo', true);
  }
}

async function savePublicUrl() {
  const input = document.getElementById('publicUrlInput');
  const url = input.value.trim();

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicUrl: url }),
    });
    if (res.ok) {
      showToast('URL pública salva!');
      fetchStatus();
    }
  } catch (err) {
    showToast('Erro ao salvar URL', true);
  }
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  uploadFile(file);
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('audio', file);

  showToast(`Enviando ${file.name}...`);
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Upload concluído com sucesso!');
      fetchStatus();
    } else {
      showToast(data.error || 'Erro no upload', true);
    }
  } catch (err) {
    showToast('Erro no envio do arquivo', true);
  }
}

function copyToClipboard(elementId) {
  const input = document.getElementById(elementId);
  input.select();
  navigator.clipboard.writeText(input.value);
  showToast('Copiado para a área de transferência!');
}

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.backgroundColor = isError ? 'var(--danger)' : 'var(--accent)';
  toast.style.color = isError ? '#fff' : '#0f172a';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Drag and drop
const dropzone = document.getElementById('dropzone');
['dragenter', 'dragover'].forEach(name => {
  dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(name => {
  dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length > 0) {
    uploadFile(files[0]);
  }
});

// Inicialização
fetchStatus();
setInterval(fetchStatus, 5000);
