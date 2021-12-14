import { afterLocalSuite, beforeLocalSuite, beforeLocalSession } from './src/utils'
import { config as mainConfig } from './wdio.main.conf'

const prefs = {
  'intl.accept_languages': 'en'
}

// Chrome headless does not support prefs
process.env.LANG = 'en'

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
          args: [ '--disable-gpu', '--window-size=1280,1024' ],
          prefs
        }
      }
    ],

    services: [ 'chromedriver' ],

    beforeSession: beforeLocalSession,
    beforeSuite: beforeLocalSuite,
    afterSuite: afterLocalSuite
  } as WebdriverIO.Config
}
