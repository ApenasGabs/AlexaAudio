const Alexa = require('ask-sdk-core');

function createAlexaSkill(getStreamInfoCallback) {
  const LaunchRequestHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
      const info = getStreamInfoCallback();
      console.log(`[Alexa SDK] LaunchRequest -> Iniciando com som de abertura e enfileirando live stream.`);

      // 1. Toca o chime de conexão (estático, 100% confiável e instantâneo)
      return handlerInput.responseBuilder
        .addDirective({
          type: 'AudioPlayer.Play',
          playBehavior: 'REPLACE_ALL',
          audioItem: {
            stream: {
              url: info.chimeUrl,
              token: 'chime-intro',
              offsetInMilliseconds: 0,
            },
            metadata: {
              title: 'Conectando ao PC...',
              subtitle: 'AlexaAudio',
            },
          },
        })
        .withShouldEndSession(true)
        .getResponse();
    },
  };

  const PlaybackNearlyFinishedHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'AudioPlayer.PlaybackNearlyFinished';
    },
    handle(handlerInput) {
      const currentToken = handlerInput.requestEnvelope.request.token;
      const info = getStreamInfoCallback();
      console.log(`[Alexa SDK] PlaybackNearlyFinished para token ${currentToken} -> Enfileirando Live Stream PC.`);

      // 2. Enfileira o áudio do computador em tempo real para tocar logo em seguida
      return handlerInput.responseBuilder
        .addDirective({
          type: 'AudioPlayer.Play',
          playBehavior: 'ENQUEUE',
          audioItem: {
            stream: {
              url: info.url,
              token: 'live-stream-continuous',
              expectedPreviousToken: currentToken || 'chime-intro',
              offsetInMilliseconds: 0,
            },
            metadata: {
              title: info.title,
              subtitle: 'Transmissão em Tempo Real',
            },
          },
        })
        .getResponse();
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
      return handlerInput.responseBuilder
        .addDirective({
          type: 'AudioPlayer.Play',
          playBehavior: 'REPLACE_ALL',
          audioItem: {
            stream: {
              url: info.url,
              token: 'live-stream-continuous',
              offsetInMilliseconds: 0,
            },
            metadata: {
              title: info.title,
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
      return handlerInput.responseBuilder
        .addDirective({
          type: 'AudioPlayer.Stop',
        })
        .withShouldEndSession(true)
        .getResponse();
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
      console.error('[Alexa SDK] Erro no processamento:', error);
      return handlerInput.responseBuilder.getResponse();
    },
  };

  return Alexa.SkillBuilders.custom()
    .addRequestHandlers(
      LaunchRequestHandler,
      PlaybackNearlyFinishedHandler,
      PlayIntentHandler,
      StopIntentHandler,
      AudioPlayerEventHandler,
      SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .create();
}

module.exports = { createAlexaSkill };
