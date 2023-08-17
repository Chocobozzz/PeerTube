/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { PeerTubeRunnerProcess } from '@tests/shared/peertube-runner-process.js'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test peertube-runner program client CLI', function () {
  let server: PeerTubeServer
  let peertubeRunner: PeerTubeRunnerProcess

  before(async function () {
    this.timeout(120_000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableRemoteTranscoding()

    peertubeRunner = new PeerTubeRunnerProcess(server)
    await peertubeRunner.runServer()
  })

  it('Should not have PeerTube instance listed', async function () {
    const data = await peertubeRunner.listRegisteredPeerTubeInstances()

    expect(data).to.not.contain(server.url)
  })

  it('Should register a new PeerTube instance', async function () {
    const registrationToken = await server.runnerRegistrationTokens.getFirstRegistrationToken()

    await peertubeRunner.registerPeerTubeInstance({
      registrationToken,
      runnerName: 'my super runner',
      runnerDescription: 'super description'
    })
  })

  it('Should list this new PeerTube instance', async function () {
    const data = await peertubeRunner.listRegisteredPeerTubeInstances()

    expect(data).to.contain(server.url)
    expect(data).to.contain('my super runner')
    expect(data).to.contain('super description')
  })

  it('Should still have the configuration after a restart', async function () {
    peertubeRunner.kill()

    await peertubeRunner.runServer()
  })

  it('Should unregister the PeerTube instance', async function () {
    await peertubeRunner.unregisterPeerTubeInstance({ runnerName: 'my super runner' })
  })

  it('Should not have PeerTube instance listed', async function () {
    const data = await peertubeRunner.listRegisteredPeerTubeInstances()

    expect(data).to.not.contain(server.url)
  })

  after(async function () {
    peertubeRunner.kill()

    await cleanupTests([ server ])
  })
})
