/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import WebSocket from 'ws'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

function buildWebSocket (server: PeerTubeServer, path: string) {
  return new WebSocket('ws://' + server.host + path)
}

function expectErrorOrTimeout (server: PeerTubeServer, path: string, expectedTimeout: number) {
  return new Promise<void>((res, rej) => {
    const ws = buildWebSocket(server, path)
    ws.on('error', () => res())

    const timeout = setTimeout(() => res(), expectedTimeout)

    ws.on('open', () => {
      clearTimeout(timeout)

      return rej(new Error('Connect did not timeout'))
    })
  })
}

describe('Test plugin websocket', function () {
  let server: PeerTubeServer
  const basePaths = [
    '/plugins/test-websocket/ws/',
    '/plugins/test-websocket/0.0.1/ws/'
  ]

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-websocket') })
  })

  it('Should not connect to the websocket without the appropriate path', async function () {
    const paths = [
      '/plugins/unknown/ws/',
      '/plugins/unknown/0.0.1/ws/'
    ]

    for (const path of paths) {
      await expectErrorOrTimeout(server, path, 1000)
    }
  })

  it('Should not connect to the websocket without the appropriate sub path', async function () {
    for (const path of basePaths) {
      await expectErrorOrTimeout(server, path + '/unknown', 1000)
    }
  })

  it('Should connect to the websocket and receive pong', function (done) {
    const ws = buildWebSocket(server, basePaths[0])

    ws.on('open', () => ws.send('ping'))
    ws.on('message', data => {
      if (data.toString() === 'pong') return done()
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
