/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { PeerTubeRunnerProcess } from '@server/tests/shared'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers, setDefaultVideoChannel } from '@shared/server-commands'

describe('Test peertube-runner program client CLI', function () {
  let server: PeerTubeServer
  let peertubeRunner: PeerTubeRunnerProcess

  before(async function () {
    this.timeout(120_000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableRemoteTranscoding()

    peertubeRunner = new PeerTubeRunnerProcess()
    await peertubeRunner.runServer()
  })

  it('Should not have PeerTube instance listed', async function () {
    const data = await peertubeRunner.listRegisteredPeerTubeInstances()

    expect(data).to.not.contain(server.url)
  })

  it('Should register a new PeerTube instance', async function () {
    const registrationToken = await server.runnerRegistrationTokens.getFirstRegistrationToken()

    await peertubeRunner.registerPeerTubeInstance({
      server,
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
    await peertubeRunner.unregisterPeerTubeInstance({ server })
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
