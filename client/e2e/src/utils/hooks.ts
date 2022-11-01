import { ChildProcessWithoutNullStreams } from 'child_process'
import { basename } from 'path'
import { runCommand, runServer } from './server'

let appInstance: string
let app: ChildProcessWithoutNullStreams

async function beforeLocalSuite (suite: any) {
  const config = buildConfig(suite.file)

  await runCommand('npm run clean:server:test -- ' + appInstance)
  app = runServer(appInstance, config)
}

function afterLocalSuite () {
  app.kill()
  app = undefined
}

function beforeLocalSession (config: { baseUrl: string }, capabilities: { browserName: string }) {
  appInstance = capabilities['browserName'] === 'chrome' ? '1' : '2'
  config.baseUrl = 'http://localhost:900' + appInstance
}

async function onBrowserStackPrepare () {
  const appInstance = '1'

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
          comments_enabled: false,
          privacy: 4,
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
        enabled: true
      }
    }
  }

  return {}
}
