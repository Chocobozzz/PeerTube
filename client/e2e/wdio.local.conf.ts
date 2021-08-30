import { config as mainConfig } from './wdio.main.conf'

const prefs = {
  'intl.accept_languages': 'en'
}

module.exports = {
  config: {
    ...mainConfig,

    runner: 'local',

    maxInstances: 1,

    capabilities: [
      {
        browserName: 'chrome',
        acceptInsecureCerts: true,
        'goog:chromeOptions': {
          prefs
        }
      },
      {
        browserName: 'firefox',
        'moz:firefoxOptions': {
          // args: [ '-headless' ],
          binary: '/usr/bin/firefox-developer-edition',
          prefs
        }
      },
      {
        browserName: 'firefox',
        'moz:firefoxOptions': {
          // args: [ '-headless' ],
          binary: '/usr/bin/firefox-esr',
          prefs
        }
      }
    ],

    services: [ 'chromedriver', 'geckodriver' ]
  } as WebdriverIO.Config
}
