const { createAlexaSkill } = require('../src/alexaSkill');

const skill = createAlexaSkill(() => ({
  introUrl: 'https://pc-gamer.tailf82141.ts.net/stream/intro_fixed.mp3',
  liveUrl: 'https://pc-gamer.tailf82141.ts.net/stream/live',
}));

const payload = {
  version: '1.0',
  session: {
    new: true,
    sessionId: 'amzn1.echo-api.session.6484b6d8-c7c1-4a57-9e69-5accf157ddc1',
    application: {
      applicationId: 'amzn1.ask.skill.65d81453-7413-44b1-8cfe-7778cea131ae'
    },
    user: {
      userId: 'test-user'
    }
  },
  context: {
    System: {
      application: {
        applicationId: 'amzn1.ask.skill.65d81453-7413-44b1-8cfe-7778cea131ae'
      },
      device: {
        supportedInterfaces: {
          AudioPlayer: {}
        }
      }
    }
  },
  request: {
    type: 'LaunchRequest',
    requestId: 'amzn1.echo-api.request.615861e9-1bec-4bfb-bde0-0ce16fde5a15',
    locale: 'pt-BR',
    timestamp: '2026-08-22T19:00:20Z',
    shouldLinkResultBeReturned: false
  }
};

async function test() {
  console.log('--- TESTANDO SKILL.INVOKE ---');
  try {
    const response = await skill.invoke(payload);
    console.log('RESULTADO RETORNADO PELO ASK SDK:');
    console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    console.error('ERRO NO SKILL.INVOKE:', e);
  }
}

test();
