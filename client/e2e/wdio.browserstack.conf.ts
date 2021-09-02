import { config as mainConfig } from './wdio.main.conf'

const user = process.env.BROWSERSTACK_USER
const key = process.env.BROWSERSTACK_KEY

if (!user) throw new Error('Miss browser stack user')
if (!key) throw new Error('Miss browser stack key')

function buildMainOptions (sessionName: string) {
  return {
    projectName: 'PeerTube',
    buildName: 'Main E2E - ' + new Date().toISOString().split('T')[0],
    sessionName,
    consoleLogs: 'info',
    networkLogs: true
  }
}

function buildBStackDesktopOptions (sessionName: string, resolution?: string) {
  return {
    'bstack:options': {
      ...buildMainOptions(sessionName),

      resolution
    }
  }
}

function buildBStackMobileOptions (sessionName: string, deviceName: string, osVersion: string) {
  return {
    'bstack:options': {
      ...buildMainOptions(sessionName),

      realMobile: true,
      osVersion,
      deviceName
    }
  }
}

module.exports = {
  config: {
    ...mainConfig,

    user,
    key,

    maxInstances: 5,

    capabilities: [
      {
        browserName: 'Chrome',

        ...buildBStackDesktopOptions('Latest Chrome Desktop', '1280x1024')
      },
      {
        browserName: 'Firefox',
        browserVersion: '68', // ESR

        ...buildBStackDesktopOptions('Firefox ESR Desktop', '1280x1024')
      },
      {
        browserName: 'Safari',
        browserVersion: '11.1',

        ...buildBStackDesktopOptions('Safari Desktop', '1280x1024')
      },
      {
        browserName: 'Firefox',

        ...buildBStackDesktopOptions('Firefox Latest', '1280x1024')
      },
      {
        browserName: 'Edge',

        ...buildBStackDesktopOptions('Edge Latest', '1280x1024')
      },

      {
        browserName: 'Chrome',

        ...buildBStackMobileOptions('Latest Chrome Android', 'Samsung Galaxy S6', '5.0')
      },
      {
        browserName: 'Safari',

        ...buildBStackMobileOptions('Safari iPhone', 'iPhone 8 Plus', '11')
      },
      {
        browserName: 'Safari',

        ...buildBStackMobileOptions('Safari iPad', 'iPad 7th', '13')
      }
    ],

    host: 'hub-cloud.browserstack.com',
    connectionRetryTimeout: 240000,
    waitforTimeout: 20000,

    services: [
      [
        'browserstack', { browserstackLocal: true }
      ]
    ],

    after: function (result) {
      if (result === 0) {
        browser.executeScript('browserstack_executor: {"action": "setSessionStatus", "arguments": {"status":"passed","reason": ""}}', [])
      } else {
        browser.executeScript('browserstack_executor: {"action": "setSessionStatus", "arguments": {"status":"failed","reason": ""}}', [])
      }
    }
  } as WebdriverIO.Config
}
