import { config as mainConfig } from './wdio.main.conf'

const prefs = {
  'intl.accept_languages': 'en'
}

module.exports = {
  config: {
    ...mainConfig,

    runner: 'local',

    maxInstances: 1,
    specFileRetries: 0,

    capabilities: [
      {
        browserName: 'chrome',
        acceptInsecureCerts: true,
        'goog:chromeOptions': {
          prefs
        }
      }
    ],

    services: [ 'chromedriver' ]
  } as WebdriverIO.Config
}
