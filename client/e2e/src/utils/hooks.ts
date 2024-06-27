import { ChildProcessWithoutNullStreams } from 'child_process'
import { basename } from 'path'
import { setValue } from '@wdio/shared-store-service'
import { createScreenshotsDirectory } from './files'
import { runCommand, runServer } from './server'

let appInstance: number
let app: ChildProcessWithoutNullStreams

let emailPort: number

async function beforeLocalSuite (suite: any) {
  const config = buildConfig(suite.file)

  await runCommand('npm run clean:server:test -- ' + appInstance)
  app = runServer(appInstance, config)
}

function afterLocalSuite () {
  app.kill()
  app = undefined
}

async function beforeLocalSession (config: { baseUrl: string }, capabilities: { browserName: string }) {
  createScreenshotsDirectory()

  appInstance = capabilities['browserName'] === 'chrome'
    ? 1
    : 2

  emailPort = 1025 + appInstance

  config.baseUrl = 'http://localhost:900' + appInstance

  await setValue(config.baseUrl + '-emailPort', emailPort)
}

async function onBrowserStackPrepare () {
  const appInstance = 1

  await runCommand('npm run clean:server:test -- ' + appInstance)
  app = runServer(appInstance)
}

function onBrowserStackComplete () {
  app.kill()
  app = undefined
}

export {
  beforeLocalSession,
  afterLocalSuite,
  beforeLocalSuite,
  onBrowserStackPrepare,
  onBrowserStackComplete
}

// ---------------------------------------------------------------------------

function buildConfig (suiteFile: string = undefined) {
  const filename = basename(suiteFile)

  if (filename === 'custom-server-defaults.e2e-spec.ts') {
    return {
      defaults: {
        publish: {
          download_enabled: false,
          comments_policy: 2,
          privacy: 2,
          licence: 4
        },
        p2p: {
          webapp: {
            enabled: false
          },
          embed: {
            enabled: false
          }
        }
      }
    }
  }

  if (filename === 'signup.e2e-spec.ts') {
    return {
      signup: {
        limit: -1
      },
      smtp: {
        hostname: '127.0.0.1',
        port: emailPort
      }
    }
  }

  if (filename === 'video-password.e2e-spec.ts') {
    return {
      signup: {
        enabled: true,
        limit: -1
      }
    }
  }

  return {}
}
