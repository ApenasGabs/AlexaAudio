# 🚀 Guia de Configuração: Servidor Local & Skill Alexa

Este guia explica como colocar seu servidor **AlexaAudio** rodando no PC e conectado ao seu dispositivo **Amazon Echo**.

---

## 1. Rodar o Servidor Localmente no seu PC

1. No terminal do projeto, inicie o servidor:
   ```bash
   npm start
   ```
2. Abra no navegador: [http://localhost:3000](http://localhost:3000)
3. Na interface web, você pode:
   - Fazer upload de arquivos `.mp3` para a pasta `media/`.
   - Escolher qual áudio está ativo para a Alexa tocar.
   - Ouvir o áudio no player de teste local.

---

## 2. Expor o Servidor com HTTPS (Túnel)

A Alexa exige que os endpoints de áudio e de webhook usem **HTTPS com certificado SSL válido**. Você pode usar qualquer um destes túneis gratuitos:

### Opção A: Cloudflare Tunnel (Recomendado - Gratuito e sem limite)
Se tiver o `cloudflared` instalado:
```bash
cloudflared tunnel --url http://localhost:3000
```
Ele gerará uma URL como: `https://xxxx-xxxx.trycloudflare.com`

### Opção B: Ngrok
Se tiver o `ngrok` instalado:
```bash
ngrok http 3000
```
Ele gerará uma URL como: `https://xxxx.ngrok-free.app`

> 💡 **Cole essa URL HTTPS gerada no campo "URL Pública do Túnel" na interface do seu navegador** (em `http://localhost:3000`) e clique em **Salvar**.

---

## 3. Criar a Skill no Alexa Developer Console

1. Acesse o [Amazon Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) e faça login com a **mesma conta Amazon vinculada ao seu Echo**.
2. Clique em **Create Skill**:
   - **Skill name:** `Áudio Local`
   - **Primary locale:** `Portuguese (BR)`
   - **Model:** `Custom`
   - **Hosting service:** `Provision your own` (pois seu próprio PC será o webhook!).
   - Clique em **Create Skill** (escolha o template "Start from Scratch").

3. **Habilitar o AudioPlayer:**
   - No menu lateral esquerdo, vá em **Interfaces**.
   - Ative a opção **AudioPlayer**.
   - Clique em **Save Interfaces**.

4. **Importar o Modelo de Interação (Interaction Model):**
   - No menu lateral, vá em **Interaction Model** > **JSON Editor**.
   - Cole o conteúdo do arquivo [`skill/interaction_model_pt_br.json`](./skill/interaction_model_pt_br.json).
   - Clique em **Save Model** e depois em **Build Model**.

5. **Configurar o Endpoint Webhook:**
   - No menu lateral, vá em **Endpoint**.
   - Selecione **HTTPS**.
   - No campo **Default Region**, cole o seu endpoint do webhook:
     `https://SUA-URL-DO-TUNEL.com/alexa`
   - No dropdown de certificado SSL (*Select SSL certificate type*), selecione:
     `My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority` (se usar ngrok ou Cloudflare).
   - Clique em **Save Endpoints**.

---

## 4. Testar no Echo ou no Simulador

1. Na aba **Test** do Developer Console, mude o seletor para **Development**.
2. Diga ou digite:
   - *"Alexa, abrir áudio local"*
3. O Echo responderá dizendo o nome do arquivo e iniciará a reprodução imediata do MP3 que está no seu computador!
4. Comandos adicionais suportados:
   - *"Alexa, pausar"*
   - *"Alexa, continuar"*
   - *"Alexa, próxima música"*
