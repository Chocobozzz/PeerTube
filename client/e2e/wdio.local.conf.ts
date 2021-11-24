import { config as mainConfig } from './wdio.main.conf'

const prefs = {
  'intl.accept_languages': 'en'
}
process.env.LANG = 'en'

module.exports = {
  config: {
    ...mainConfig,

    runner: 'local',

    maxInstances: 2,

    capabilities: [
      {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [ '--headless', '--disable-gpu', '--window-size=1280,1024' ],
          prefs
        }
      },
      {
        browserName: 'firefox',
        'moz:firefoxOptions': {
          binary: '/usr/bin/firefox-developer-edition',
          args: [ '--headless', '--window-size=1280,1024' ],

          prefs
        }
      }
    ],

    services: [ 'chromedriver', 'geckodriver' ],

    beforeSession: function (config, capabilities) {
      if (capabilities['browserName'] === 'chrome') {
        config.baseUrl = 'http://localhost:9001'
      } else {
        config.baseUrl = 'http://localhost:9002'
      }
    }
  } as WebdriverIO.Config
}
