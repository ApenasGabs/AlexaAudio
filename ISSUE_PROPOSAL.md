# [RFC / Issue] Transmissão de Áudio Local para Dispositivos Alexa (Echo)

## 📌 Contexto e Objetivo

O objetivo deste projeto é criar uma solução local (executando em um PC, servidor doméstico ou dispositivo na rede local) capaz de transmitir fluxos de áudio diretamente para dispositivos Amazon Echo (Alexa).

Inspirado na arquitetura do projeto [ndg63276/alexa-youtube](https://github.com/ndg63276/alexa-youtube), que utilizava a interface `AudioPlayer` da Alexa para reproduzir fluxos remotos, este projeto propõe **substituir fontes externas de áudio por um servidor local de streaming e controle**, permitindo:

1. Transmitir o áudio do computador em tempo real (loopback/espelhamento de áudio do sistema).
2. Reproduzir arquivos de música ou áudios gerados localmente via comando de voz ou acionamento local.
3. Permitir que outros dispositivos da rede local enviem áudio para os alto-falantes Alexa.

---

## 🔍 Análise de Viabilidade Técnica

A reprodução de áudio em dispositivos Echo é viável utilizando a diretiva **`AudioPlayer.Play`** do Alexa Skills Kit (ASK), mas requer atenção a requisitos e restrições arquiteturais específicas da Amazon:

```
+------------------+         +------------------+         +----------------------+
|   Dispositivo    |         |   Túnel Seguro   |         |     Amazon Echo      |
|  Local (PC/Node) | ------> | (Cloudflare/SSL) | <------ |    (AudioPlayer)     |
| [Stream Server]  |         |   https://...    |         |  Baixa stream direto |
+------------------+         +------------------+         +----------------------+
        ^                                                            |
        |                      Dispara comando de voz                |
        +------------------------------------------------------------+
                           (AWS Lambda / Webhook Skill)
```

---

## ⚠️ Desafios Técnicos e Mitigações

### 1. Exigência Estrita de HTTPS com Certificado SSL Válido
* **Desafio:** Os dispositivos Echo não reproduzem URLs em texto claro (`http://192.168.x.x`) nem aceitam certificados SSL autoassinados.
* **Mitigação:** 
  - Utilização de túneis seguros leves como **Cloudflare Tunnel (cloudflared)**, **Tailscale Funnel** ou **ngrok**, que fornecem endpoints HTTPS com certificados válidos e sem necessidade de abrir portas no roteador.

### 2. Multi-Room Music (Tocar em múltiplos dispositivos Alexa simultaneamente)
* **Desafio:** A API pública `AudioPlayer` para desenvolvedores terceiros não oferece suporte nativo para disparar sincronização multi-room em grupos de alto-falantes (como "A Casa Toda"). O áudio normalmente toca apenas no dispositivo que recebeu a instrução.
* **Mitigações investigadas:**
  - **Workaround de Preferred Speaker:** Configurar nas propriedades do cômodo no aplicativo Alexa que o alto-falante padrão é o grupo de som ("A casa toda").
  - **Abordagem via Home Assistant / Alexa Media Player:** Disparo via API não-oficial de automação se houver um ecossistema Home Assistant na rede.

### 3. Latência de Streaming
* **Desafio:** A interface `AudioPlayer` realiza um pré-buffer de segurança de 2 a 5 segundos.
* **Impacto:**
  - *Músicas, podcasts e arquivos de áudio:* Experiência fluida e sem impacto.
  - *Espelhamento em tempo real (ex: jogos ou vídeos do PC):* Haverá um atraso de alguns segundos em relação à tela.

---

## 🛠️ Arquitetura Proposta (Fase 1: Prova de Conceito)

1. **Local Audio Streamer (Backend Local):**
   - Servidor leve em Python (`FastAPI` / `Flask`) ou Node.js (`Express`).
   - Módulo de captura de áudio do sistema (ex: `sounddevice` em modo WASAPI loopback no Windows) ou reprodutor de arquivos estáticos MP3/AAC.
   - Endpoint HTTP gerando fluxo contínuo `audio/mpeg` (estilo rádio Icecast).

2. **Exposição Segura (Túnel):**
   - Cloudflare Tunnel configurado para expor a porta local com hostname seguro (ex: `https://alexa-stream.meudominio.com/stream.mp3`).

3. **Backend da Skill Alexa:**
   - Função AWS Lambda básica (ou Webhook HTTPS) que responde a comandos como:
     - *"Alexa, abrir Áudio Local"*
     - *"Alexa, tocar áudio do PC"*
   - O backend responde com a diretiva:
     ```json
     {
       "response": {
         "directives": [
           {
             "type": "AudioPlayer.Play",
             "playBehavior": "REPLACE_ALL",
             "audioItem": {
               "stream": {
                 "url": "https://seu-tunel.com/stream.mp3",
                 "token": "local-stream-token",
                 "offsetInMilliseconds": 0
               }
             }
           }
         ],
         "shouldEndSession": true
       }
     }
     ```

---

## 📋 Próximos Passos e Itens de Trabalho (Roadmap)

- [ ] **Spike de Streaming Local:** Criar um script básico de captura/stream de áudio local em formato MP3/AAC.
- [ ] **Configuração do Túnel HTTPS:** Validar a conexão da Alexa com o túnel HTTPS (Cloudflare Tunnel).
- [ ] **Modelo de Interação da Skill (Interaction Model):** Definir intents de voz básicas (`PlayIntent`, `StopIntent`, `PauseIntent`).
- [ ] **Validação de Reprodução:** Testar reprodução em um dispositivo físico Echo.
- [ ] **Investigação de Multi-Room:** Avaliar comportamento com grupos de som configurados como Preferred Speaker.
