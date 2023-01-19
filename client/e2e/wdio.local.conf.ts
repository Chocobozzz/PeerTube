import { afterLocalSuite, beforeLocalSession, beforeLocalSuite } from './src/utils'
import { config as mainConfig } from './wdio.main.conf'

const prefs = {
  'intl.accept_languages': 'en'
}
process.env.LANG = 'en'

module.exports = {
  config: {
    ...mainConfig,

    runner: 'local',

    maxInstancesPerCapability: 1,

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

    services: [ 'chromedriver', 'geckodriver', 'shared-store' ],

    beforeSession: beforeLocalSession,
    beforeSuite: beforeLocalSuite,
    afterSuite: afterLocalSuite
  } as WebdriverIO.Config
}
