const Alexa = require('ask-sdk-core');

function createAlexaSkill(getStreamInfoCallback) {
  const LaunchRequestHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
      const info = getStreamInfoCallback();
      console.log(`[Alexa SDK] LaunchRequest -> Tocando ${info.url}`);

      return handlerInput.responseBuilder
        .speak('Conectando ao áudio do seu computador.')
        .addDirective({
          type: 'AudioPlayer.Play',
          playBehavior: 'REPLACE_ALL',
          audioItem: {
            stream: {
              url: info.url,
              token: info.token,
              offsetInMilliseconds: 0,
            },
            metadata: {
              title: info.title,
              subtitle: 'AlexaAudio Live',
            },
          },
        })
        .withShouldEndSession(true)
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
              token: info.token,
              offsetInMilliseconds: 0,
            },
            metadata: {
              title: info.title,
              subtitle: 'AlexaAudio Live',
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
      // Reconhece eventos de telemetria do player do Echo
      return handlerInput.responseBuilder.getResponse();
    },
  };

  const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
      console.log('[Alexa SDK] SessionEndedRequest recebido.');
      return handlerInput.responseBuilder.getResponse();
    },
  };

  const ErrorHandler = {
    canHandle() {
      return true;
    },
    handle(handlerInput, error) {
      console.error('[Alexa SDK] Erro no processamento:', error);
      return handlerInput.responseBuilder
        .speak('Desculpe, ocorreu um erro ao processar o áudio local.')
        .getResponse();
    },
  };

  return Alexa.SkillBuilders.custom()
    .addRequestHandlers(
      LaunchRequestHandler,
      PlayIntentHandler,
      StopIntentHandler,
      AudioPlayerEventHandler,
      SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .create();
}

module.exports = { createAlexaSkill };
