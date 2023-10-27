import { afterLocalSuite, beforeLocalSession, beforeLocalSuite } from './src/utils'
import { config as mainConfig } from './wdio.main.conf'

const prefs = { 'intl.accept_languages': 'en' }
process.env.LANG = 'en'

// https://github.com/mozilla/geckodriver/issues/1354#issuecomment-479456411
process.env.MOZ_HEADLESS_WIDTH = '1280'
process.env.MOZ_HEADLESS_HEIGHT = '1024'

const windowSizeArg = `--window-size=${process.env.MOZ_HEADLESS_WIDTH},${process.env.MOZ_HEADLESS_HEIGHT}`

module.exports = {
  config: {
    ...mainConfig,

    runner: 'local',

    maxInstancesPerCapability: 1,

    capabilities: [
      {
        'browserName': 'chrome',
        'goog:chromeOptions': {
          binary: '/usr/bin/google-chrome-stable',
          args: [ '--headless', '--disable-gpu', windowSizeArg ],
          prefs
        }
      },
      {
        'browserName': 'firefox',
        'moz:firefoxOptions': {
          binary: '/usr/bin/firefox-developer-edition',
          args: [ '--headless', windowSizeArg ],

          prefs
        }
      }
    ],

    services: [ 'shared-store' ],

    beforeSession: beforeLocalSession,
    beforeSuite: beforeLocalSuite,
    afterSuite: afterLocalSuite
  } as WebdriverIO.Config
}
