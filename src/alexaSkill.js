const Alexa = require('ask-sdk-core');

function createAlexaSkill(getStreamInfoCallback) {
  const LaunchRequestHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
      const info = getStreamInfoCallback();
      console.log(`[Alexa SDK] LaunchRequest -> 1. Tocando áudio fixo de introdução (${info.introUrl})`);

      // Toca o áudio fixo inicial garantindo 100% de estabilidade de abertura
      return handlerInput.responseBuilder
        .addDirective({
          type: 'AudioPlayer.Play',
          playBehavior: 'REPLACE_ALL',
          audioItem: {
            stream: {
              url: info.introUrl,
              token: 'intro-fixed',
              offsetInMilliseconds: 0,
            },
            metadata: {
              title: 'Iniciando Áudio do PC...',
              subtitle: 'AlexaAudio Local',
            },
          },
        })
        .withShouldEndSession(true)
        .getResponse();
    },
  };

  // Evento disparado pela Alexa quando o áudio fixo está perto do fim
  // É aqui que colocamos o streaming em tempo real do computador na FILA!
  const PlaybackNearlyFinishedHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'AudioPlayer.PlaybackNearlyFinished';
    },
    handle(handlerInput) {
      const currentToken = handlerInput.requestEnvelope.request.token;
      const info = getStreamInfoCallback();
      console.log(`[Alexa SDK] ⚡ PlaybackNearlyFinished para [${currentToken}] -> 2. Enfileirando áudio do PC em tempo real (${info.liveUrl})`);

      return handlerInput.responseBuilder
        .addDirective({
          type: 'AudioPlayer.Play',
          playBehavior: 'ENQUEUE',
          audioItem: {
            stream: {
              url: info.liveUrl,
              token: 'live-stream-continuous',
              expectedPreviousToken: currentToken || 'intro-fixed',
              offsetInMilliseconds: 0,
            },
            metadata: {
              title: 'Áudio do PC (Ao Vivo)',
              subtitle: 'Transmissão em Tempo Real',
            },
          },
        })
        .getResponse(); // Sem shouldEndSession em eventos de background
    },
  };

  const PlayIntentHandler = {
    canHandle(handlerInput) {
      return (
        Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
        (Alexa.getIntentName(handlerInput.requestEnvelope) === 'PlayIntent' ||
          Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.ResumeIntent')
      );
    },
    handle(handlerInput) {
      const info = getStreamInfoCallback();
      console.log(`[Alexa SDK] PlayIntent -> Tocando stream do PC`);

      return handlerInput.responseBuilder
        .addDirective({
          type: 'AudioPlayer.Play',
          playBehavior: 'REPLACE_ALL',
          audioItem: {
            stream: {
              url: info.liveUrl,
              token: 'live-stream-continuous',
              offsetInMilliseconds: 0,
            },
            metadata: {
              title: 'Áudio do PC (Ao Vivo)',
              subtitle: 'Transmissão em Tempo Real',
            },
          },
        })
        .withShouldEndSession(true)
        .getResponse();
    },
  };

  const StopIntentHandler = {
    canHandle(handlerInput) {
      return (
        Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
        (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent' ||
          Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.PauseIntent' ||
          Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent')
      );
    },
    handle(handlerInput) {
      console.log(`[Alexa SDK] Parando áudio.`);
      return handlerInput.responseBuilder
        .addDirective({
          type: 'AudioPlayer.Stop',
        })
        .withShouldEndSession(true)
        .getResponse();
    },
  };

  const PlaybackStartedHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'AudioPlayer.PlaybackStarted';
    },
    handle(handlerInput) {
      const token = handlerInput.requestEnvelope.request.token;
      console.log(`[Alexa SDK] 🎵 AudioPlayer.PlaybackStarted com token: [${token}]`);
      return handlerInput.responseBuilder.getResponse();
    },
  };

  const PlaybackFailedHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'AudioPlayer.PlaybackFailed';
    },
    handle(handlerInput) {
      const req = handlerInput.requestEnvelope.request;
      console.error(`[Alexa SDK] ❌ AudioPlayer.PlaybackFailed:`, JSON.stringify(req.error || req));
      return handlerInput.responseBuilder.getResponse();
    },
  };

  const AudioPlayerEventHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope).startsWith('AudioPlayer.');
    },
    handle(handlerInput) {
      return handlerInput.responseBuilder.getResponse();
    },
  };

  const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
      return handlerInput.responseBuilder.getResponse();
    },
  };

  const ErrorHandler = {
    canHandle() {
      return true;
    },
    handle(handlerInput, error) {
      console.error('[Alexa SDK] Erro Handler:', error);
      return handlerInput.responseBuilder.getResponse();
    },
  };

  return Alexa.SkillBuilders.custom()
    .addRequestHandlers(
      LaunchRequestHandler,
      PlaybackNearlyFinishedHandler,
      PlayIntentHandler,
      StopIntentHandler,
      PlaybackStartedHandler,
      PlaybackFailedHandler,
      AudioPlayerEventHandler,
      SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .create();
}

module.exports = { createAlexaSkill };
