import { onBrowserStackComplete, onBrowserStackPrepare } from './src/utils'
import { config as mainConfig } from './wdio.main.conf'

const user = process.env.BROWSERSTACK_USER
const key = process.env.BROWSERSTACK_KEY

if (!user) throw new Error('Miss browser stack user')
if (!key) throw new Error('Miss browser stack key')

function buildMainOptions (sessionName: string) {
  return {
    projectName: 'PeerTube',
    buildName: 'Main E2E - ' + new Date().toISOString(),
    sessionName,
    consoleLogs: 'info',
    networkLogs: true
  }
}

function buildBStackDesktopOptions (options: {
  sessionName: string
  resolution: string
  os?: string
  osVersion?: string
}) {
  const { sessionName, resolution, os, osVersion } = options

  return {
    'bstack:options': {
      ...buildMainOptions(sessionName),

      os,
      osVersion,
      resolution
    }
  }
}

function buildBStackMobileOptions (options: {
  sessionName: string
  deviceName: string
  osVersion: string
}) {
  const { sessionName, deviceName, osVersion } = options

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

        ...buildBStackDesktopOptions({ sessionName: 'Latest Chrome Desktop', resolution: '1280x1024', os: 'Windows', osVersion: '8' })
      },
      {
        browserName: 'Firefox',
        browserVersion: '78', // Very old ESR

        ...buildBStackDesktopOptions({ sessionName: 'Firefox ESR Desktop', resolution: '1280x1024', os: 'Windows', osVersion: '8' })
      },
      {
        browserName: 'Safari',
        browserVersion: '13',

        ...buildBStackDesktopOptions({ sessionName: 'Safari Desktop', resolution: '1280x1024' })
      },
      {
        browserName: 'Firefox',

        ...buildBStackDesktopOptions({ sessionName: 'Firefox Latest', resolution: '1280x1024', os: 'Windows', osVersion: '8' })
      },
      {
        browserName: 'Edge',

        ...buildBStackDesktopOptions({ sessionName: 'Edge Latest', resolution: '1280x1024' })
      },

      {
        browserName: 'Chrome',

        ...buildBStackMobileOptions({ sessionName: 'Latest Chrome Android', deviceName: 'Samsung Galaxy S8', osVersion: '7.0' })
      },
      {
        browserName: 'Safari',

        ...buildBStackMobileOptions({ sessionName: 'Safari iPhone', deviceName: 'iPhone 11', osVersion: '13' })
      },

      {
        browserName: 'Safari',

        ...buildBStackMobileOptions({ sessionName: 'Safari iPad', deviceName: 'iPad Pro 11 2020', osVersion: '13' })
      }
    ],

    host: 'hub-cloud.browserstack.com',
    connectionRetryTimeout: 240000,
    waitforTimeout: 20000,

    specs: [
      // We don't want to test "local" tests
      './src/suites-all/*.e2e-spec.ts'
    ],

    services: [
      [
        'browserstack', { browserstackLocal: true }
      ]
    ],

    onWorkerStart: function (_cid, capabilities) {
      if (capabilities['bstack:options'].realMobile === true) {
        capabilities['bstack:options'].local = false
      }
    },

    before: function () {
      require('./src/commands/upload')

      // Force keep alive: https://www.browserstack.com/docs/automate/selenium/error-codes/keep-alive-not-used#Node_JS
      const http = require('http')
      const https = require('https')

      const keepAliveTimeout = 30 * 1000

      // eslint-disable-next-line no-prototype-builtins
      if (http.globalAgent?.hasOwnProperty('keepAlive')) {
        http.globalAgent.keepAlive = true
        https.globalAgent.keepAlive = true
        http.globalAgent.keepAliveMsecs = keepAliveTimeout
        https.globalAgent.keepAliveMsecs = keepAliveTimeout
      } else {
        const agent = new http.Agent({
          keepAlive: true,
          keepAliveMsecs: keepAliveTimeout
        })

        const secureAgent = new https.Agent({
          keepAlive: true,
          keepAliveMsecs: keepAliveTimeout
        })

        const httpRequest = http.request
        const httpsRequest = https.request

        http.request = function (options, callback) {
          if (options.protocol === 'https:') {
            options['agent'] = secureAgent
            return httpsRequest(options, callback)
          } else {
            options['agent'] = agent
            return httpRequest(options, callback)
          }
        }
      }
    },

    onPrepare: onBrowserStackPrepare,
    onComplete: onBrowserStackComplete

  } as WebdriverIO.Config
}
