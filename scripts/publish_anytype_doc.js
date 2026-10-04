const http = require('http');
const https = require('https');
const zlib = require('zlib');

const SPACE_ID = 'bafyreiesudr3yvac65l3vtyfyu7oesc6cpkr2p5cluqhnhjgvch5shuugy.n5psirv676ui';
const CONTEXT_ID = 'bafyreicwlrg4hk75l65qmydrylmqvtllrnm66or36coo7a4upof6qza32i';
const API_TOKEN = 'addaCb9D4imLnqfbESgmSOahREVy1w4Uo1FHX5MYQMc=';

// Diagrama Mermaid
const mermaidCode = `graph TD
    A[Sons do Windows / YouTube / Spotify] -->|WASAPI Loopback Capture| B[WasapiStreamer C# In-Memory]
    B -->|Thread Lock + Silence Injection| C[TCP Socket 127.0.0.1:3001]
    C -->|PCM Float32 48kHz Stereo| D[FFmpeg MP3 Encoder 128kbps]
    D -->|MP3 Stream Contínuo| E[Ring Buffer 64KB]
    E -->|HTTP Chunked Stream /stream/live.mp3| F[Express Server :3000]
    G[Tailscale Funnel] -->|Proxy Seguro HTTPS| F
    H[Amazon Alexa Cloud / ASK API] -->|Webhook /alexa| F
    I[Amazon Echo Devices / Multi-Room] -->|HTTPS AudioPlayer Stream| G
    J[Web Dashboard UI] -->|Gerenciamento & Modos| F`;

// Gerar URL da imagem do diagrama via Kroki
const krokiEncoded = zlib.deflateSync(Buffer.from(mermaidCode)).toString('base64url');
const krokiImageUrl = `https://kroki.io/mermaid/svg/${krokiEncoded}`;

const markdownBody = `# 🎵 AlexaAudio

> **Transmissor de áudio local em tempo real para dispositivos Amazon Echo (Alexa) e grupos de som Multi-Room com baixa latência.**

---

## 📋 Ficha Técnica

| Atributo | Detalhes |
| :--- | :--- |
| **Repositório** | [github.com/ApenasGabs/AlexaAudio](https://github.com/ApenasGabs/AlexaAudio) |
| **Visibilidade** | Público |
| **Stack Principal** | Node.js (v24.14), Express, ASK SDK Core (\`ask-node/2.14.0\`), C# (.NET / NAudio WASAPI), FFmpeg, Tailscale Funnel |
| **Onde Roda** | Windows 11 (\`PC-Gamer\`) / Localhost porta \`3000\` (Socket WASAPI TCP \`3001\`) |
| **Status** | 🟢 Operacional / Ativo |

---

## 1. 🎯 Objetivo & Problema Resolvido

A Amazon Alexa não possui suporte nativo para receber transmissões de áudio de sistema do PC via Wi-Fi ou rede local sem fio (exceto conexões Bluetooth individuais com alcance limitado a um único cômodo e sem suporte a grupos Multi-Room).

### Desafios Superados:
1. **Transmissão Multi-Room Sincronizada:** Reprodução simultânea de qualquer áudio do Windows (jogos, vídeos, chamadas, músicas) em todas as caixas Echo da residência (grupo *"A Casa Toda"* / *"Todo Lugar"*).
2. **Bypass de Restrições de Execução do Windows (AppControl):** O Windows Defender / AppControl bloqueia binários \`.exe\` não assinados compilados localmente. O pipeline utiliza compilação em memória (AppDomain via PowerShell \`Add-Type\`) com NAudio nativo.
3. **Estabilidade de Live Stream Contínuo 24/7:** Dispositivos Echo rejeitam streams que congelam quando o computador fica em silêncio. Um mecanismo de **Heartbeat com Injeção de Silêncio Contínuo** mantém o encoder MP3 alimentado ininterruptamente.
4. **Conformidade Estrita com o Protocolo Amazon ASK:** Uso do SDK oficial da Amazon (\`ask-sdk-core\`) para tratamento de intents (\`LaunchRequest\`, \`PlayIntent\`, \`AMAZON.StopIntent\`), tokens dinâmicos e validação estrita de URLs com extensão \`.mp3\`.

---

## 2. 🏛️ Arquitetura & Decisões Técnicas

![Arquitetura AlexaAudio](${krokiImageUrl})

<details>
<summary><b>📐 Ver Código do Diagrama Mermaid</b></summary>

\`\`\`mermaid
${mermaidCode}
\`\`\`

</details>

### Decisões Arquiteturais Fundamentais:
- **WASAPI Loopback Nativo em C#:** Captura direta na saída do endpoint mixer do Windows a 48.000 Hz, 2 canais, 32-bit float (\`f32le\`) sem latência de conversão ou overhead de event loop do PowerShell.
- **Lock Thread-Safe de Áudio:** Proteção de concorrência com mutex atômico (\`lock(streamLock)\`) entre a thread de amostragem ativa e a thread de silêncio, eliminando corrupção de bytes.
- **FFmpeg MP3 com Bit Reservoir Desabilitado (\`-reservoir 0\`):** Garante que cada frame MP3 seja 100% autônomo, permitindo que decodificadores de hardware embarcados do Echo sincronizem imediatamente ao conectar sem ruídos ou engasgos.
- **Tailscale Funnel com Wildcard SSL:** Roteamento público criptografado com terminação TLS válida reconhecida pela Amazon Alexa (\`*.ts.net\`).
- **Pré-buffer Dinâmico de 64KB:** Fornece ~4 segundos de dados imediatos no handshake inicial para evitar *buffer underruns* durante a negociação de grupos Multi-Room.

---

## 3. 🚀 Setup Rápido & Comandos

### Pré-requisitos:
- Windows 10/11 com Node.js >= 20.
- Tailscale autenticado e com permissão de Funnel ativa.
- Conta no [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask).

### Instalação & Execução:

\`\`\`bash
# 1. Clonar repositório
git clone https://github.com/ApenasGabs/AlexaAudio.git
cd AlexaAudio

# 2. Instalar dependências
npm install

# 3. Iniciar servidor em modo desenvolvimento (com auto-reload)
npm run dev
# ou
node --watch src/server.js
\`\`\`

### Ativação do Tailscale Funnel:
\`\`\`powershell
tailscale funnel --bg 3000
tailscale funnel status
\`\`\`

### Configuração no Alexa Developer Console:
1. Em **Build > Endpoint > HTTPS**, configure: \`https://pc-gamer.tailf82141.ts.net/alexa\`
2. Selecione o tipo de certificado: *My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority*.
3. Salve os endpoints e execute **Build Model**.
4. Peça na caixa Echo: *"Alexa, abrir áudio local"*.

---

<details>
<summary><b>📂 4. Estrutura de Arquivos & Diretórios</b></summary>

\`\`\`
AlexaAudio/
├── bin/                              # DLLs gerenciadas do NAudio para WASAPI
│   ├── NAudio.dll
│   ├── NAudio.Core.dll
│   └── NAudio.Wasapi.dll
├── media/                            # Arquivos de áudio locais e vinhetas
│   └── sample_song.mp3
├── public/                           # Web UI / Painel de Controle
│   ├── app.js
│   ├── index.html
│   └── style.css
├── scripts/                          # Utilitários de captura e testes
│   ├── monitor_stream.js             # Medidor de kbps em tempo real do stream
│   ├── run_wasapi_in_memory.ps1      # Compilador C# in-memory e capturador WASAPI
│   ├── test_direct.js                # Teste local de endpoint ASK
│   └── test_request.js               # Teste de payload LaunchRequest
├── skill/                            # Modelos de interação ASK
│   └── interaction_model_pt_br.json  # Modelo pt-BR (áudio local)
├── src/                              # Código fonte do servidor
│   ├── alexaSkill.js                 # Handlers ASK SDK (AudioPlayer.Play/Stop)
│   ├── liveAudio.js                  # Orquestrador WASAPI, FFmpeg e Buffer Cache
│   └── server.js                     # Servidor Express, Webhooks e Streaming HTTP
├── package.json                      # Manifesto de dependências e scripts
└── README.md                         # Documentação do projeto
\`\`\`

</details>

---

<details>
<summary><b>⚙️ 5. Principais Funções & Módulos</b></summary>

| Arquivo / Módulo | Função / Componente | Responsabilidade & Fluxo de Dados |
| :--- | :--- | :--- |
| \`src/server.js\` | \`handleLiveStream\` | Endpoint HTTP \`/stream/live.mp3\`. Entrega chunks de áudio MP3 com headers compatíveis com o Echo. |
| \`src/server.js\` | \`app.post('/alexa')\` | Webhook HTTPS receptor de eventos da Amazon Alexa. Invoca o \`skill.invoke(req.body)\`. |
| \`src/alexaSkill.js\` | \`createAlexaSkill\` | Constrói a Custom Skill via \`Alexa.SkillBuilders.custom()\`. Configura diretivas \`AudioPlayer.Play\` e \`AudioPlayer.Stop\`. |
| \`src/liveAudio.js\` | \`LiveAudioCapture.start()\` | Inicia o servidor TCP na porta \`3001\`, executa o PowerShell WASAPI e gerencia o processo \`ffmpeg\`. |
| \`src/liveAudio.js\` | \`addClient(res)\` | Registra novos ouvintes Echo/navegador e envia o pré-buffer inicial de 64KB de forma não-bloqueante. |
| \`scripts/run_wasapi_in_memory.ps1\` | \`WasapiStreamer.Start()\` | Captura áudio via WASAPI Loopback, gerencia injeção de silêncio e escreve no socket TCP com mutex thread-safe. |

</details>

---

<details>
<summary><b>🌐 6. Variáveis de Ambiente & Configurações</b></summary>

| Variável / Parâmetro | Padrão | Descrição |
| :--- | :--- | :--- |
| \`PORT\` | \`3000\` | Porta HTTP local do servidor Express e painel Web. |
| \`PUBLIC_URL\` | \`https://pc-gamer.tailf82141.ts.net\` | URL pública HTTPS gerada pelo Tailscale Funnel. |
| \`WASAPI TCP Port\` | \`3001\` | Porta TCP interna para comunicação entre o C# WASAPI e o Node.js. |
| \`Audio Format\` | \`128 kbps CBR / 48 kHz\` | Taxa de bits e amostragem padrão de alta compatibilidade para o cluster Echo. |
| \`Buffer Cache Size\` | \`64 KB\` (~4s) | Tamanho do ring-buffer em memória para absorção de handshake multi-room. |

</details>

---

<details>
<summary><b>🛠️ 7. Troubleshooting & Histórico de Soluções de Engenharia</b></summary>

| Sintoma / Erro Observado | Causa Técnica | Solução Aplicada |
| :--- | :--- | :--- |
| *AppControl Bloqueando Executáveis* | Windows Defender bloqueava \`loopback.exe\` gerado em disco. | Adotada compilação em memória no AppDomain via \`Add-Type\` em PowerShell. |
| *Áudio Riscado / Picotado* | Concorrência sem lock entre thread de áudio e thread de silêncio no C#. | Implementado \`lock(streamLock)\` atômico na escrita do \`NetworkStream\`. |
| *URL Inválida no AudioPlayer* | Firmware do Echo exige extensão de mídia explícita na URL. | Rota ajustada para \`/stream/live.mp3\` em conformidade estrita com o player. |
| *Timeout de Inicialização no Multi-Room* | Caixas secundárias conectavam após esgotamento do buffer inicial. | Pré-buffer ajustado para 64KB com distribuição isolada e não-bloqueante por cliente. |
| *Echo Ignorava Comando "Alexa, Parar"* | Resposta do \`StopIntent\` continha \`shouldEndSession: true\`, proibido na especificação ASK. | Removido \`shouldEndSession\` na diretiva \`AudioPlayer.Stop\`. |
| *Stream Congelado no Navegador* | Processos residuais órfãos do PowerShell competindo pela porta WASAPI. | Implementada rotina de limpeza preventiva de processos órfãos no ciclo de vida do servidor. |

</details>
`;

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '192.168.31.60',
        port: 31009,
        path: `/v1/spaces/${SPACE_ID}${path}`,
        method: method,
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({ status: res.statusCode, data: json });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('1. Criando objeto da documentação no Anytype...');
  
  const createRes = await apiRequest('POST', '/objects', {
    type_key: 'page',
    name: '🎵 AlexaAudio',
    body: markdownBody,
  });

  console.log('Create Response Status:', createRes.status);
  
  const objectId = createRes.data?.object?.id || createRes.data?.id;
  if (!objectId) {
    console.error('Falha ao criar objeto:', JSON.stringify(createRes, null, 2));
    process.exit(1);
  }

  console.log(`✅ Página criada com ID: ${objectId}`);

  console.log('2. Vinculando ao Catálogo de Projetos (Contexto)...');
  const patchRes = await apiRequest('PATCH', `/objects/${objectId}`, {
    properties: [
      {
        key: 'created_in_context',
        objects: [CONTEXT_ID],
      },
    ],
  });

  console.log('Patch Response Status:', patchRes.status);

  const anytypeUrl = `anytype://object?space=${SPACE_ID}&id=${objectId}`;
  console.log('\n=========================================');
  console.log('🎉 DOCUMENTAÇÃO PUBLICADA COM SUCESSO NO ANYTYPE!');
  console.log(`ID da Nota: ${objectId}`);
  console.log(`Link Anytype: ${anytypeUrl}`);
  console.log('=========================================');
}

main().catch(console.error);
