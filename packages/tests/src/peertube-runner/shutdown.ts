/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { RunnerJob, RunnerJobState } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'
import { PeerTubeRunnerProcess } from '@tests/shared/peertube-runner-process.js'
import { expect } from 'chai'

describe('Test peertube-runner shutdown', function () {
  let server: PeerTubeServer
  let peertubeRunner: PeerTubeRunnerProcess

  async function runRunner () {
    const registrationToken = await server.runnerRegistrationTokens.getFirstRegistrationToken()

    peertubeRunner = new PeerTubeRunnerProcess(server)
    await peertubeRunner.runServer()
    await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: buildUUID() })
  }

  before(async function () {
    this.timeout(120_000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableTranscoding()
    await server.config.enableRemoteTranscoding()
    await runRunner()
  })

  it('Should graceful shutdown the runner when it has no processing jobs', async function () {
    await peertubeRunner.gracefulShutdown()

    while (!peertubeRunner.hasCorrectlyExited()) {
      await wait(500)
    }
  })

  it('Should graceful shutdown the runner with many jobs to process', async function () {
    await runRunner()

    await server.videos.quickUpload({ name: 'video 1' })
    await server.videos.quickUpload({ name: 'video 2' })

    let processingJobs: RunnerJob[] = []
    while (processingJobs.length === 0) {
      await wait(500)

      const { data } = await server.runnerJobs.list({ stateOneOf: [ RunnerJobState.PROCESSING ] })
      processingJobs = data
    }

    await peertubeRunner.gracefulShutdown()

    while (!peertubeRunner.hasCorrectlyExited()) {
      await wait(500)
    }

    // Check processed jobs are finished
    const { data } = await server.runnerJobs.list({ count: 50 })
    for (const job of processingJobs) {
      expect(data.find(j => j.uuid === job.uuid).state.id).to.equal(RunnerJobState.COMPLETED)
    }

    // Check there are remaining jobs to process
    const { data: pendingJobs } = await server.runnerJobs.list({ stateOneOf: [ RunnerJobState.PENDING ] })
    expect(pendingJobs).to.not.have.lengthOf(0)
  })

  after(async function () {
    peertubeRunner.kill()

    await cleanupTests([ server ])
  })
})
