/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, RunnerJobState, RunnerJobVODPayload } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { MockUpload } from '@tests/shared/mock-servers/mock-upload.js'
import { PeerTubeRunnerProcess } from '@tests/shared/peertube-runner-process.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { wait } from '../../../core-utils/src/common/time.js'

describe('Test peertube-runner custom upload', function () {
  let server: PeerTubeServer
  let peertubeRunner: PeerTubeRunnerProcess

  let sqlCommand: SQLCommand
  let mockUploadServerUrl: string
  let transcoded: string

  const mockUpload = new MockUpload()

  async function registerRunner () {
    const registrationToken = await server.runnerRegistrationTokens.getFirstRegistrationToken()
    await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: 'runner' })
  }

  async function unregisterRunner () {
    await peertubeRunner.unregisterPeerTubeInstance({ runnerName: 'runner' })
  }

  async function updatePayload (method?: 'PUT' | 'POST') {
    const { data } = await server.runnerJobs.list({ stateOneOf: [ RunnerJobState.PENDING ] })

    for (const job of data) {
      const payload = job.payload as RunnerJobVODPayload

      payload.output.videoFileCustomUpload = {
        method,
        url: mockUploadServerUrl + '/upload-file'
      }

      await sqlCommand.setRunnerJobPayload(job.uuid, payload)
    }
  }

  before(async function () {
    this.timeout(120_000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableTranscoding()
    const { uuid } = await server.videos.quickUpload({ name: 'transcoded' })
    transcoded = uuid
    await waitJobs([ server ])

    await server.config.enableRemoteTranscoding()

    peertubeRunner = new PeerTubeRunnerProcess(server)
    await peertubeRunner.runServer()

    const uploadPort = await mockUpload.initialize()
    mockUploadServerUrl = 'http://127.0.0.1:' + uploadPort

    sqlCommand = new SQLCommand(server)
  })

  it('Should upload the file on another endpoint for web video', async function () {
    await server.videos.quickUpload({ name: 'video 1' })
    await server.videos.quickUpload({ name: 'video 2' })
    await waitJobs([ server ])

    await updatePayload('POST')
    await registerRunner()

    do {
      const { body } = await makeGetRequest({ url: mockUploadServerUrl, path: '/uploaded-files', expectedStatus: HttpStatusCode.OK_200 })

      // 2 x 5 retries because the server doesn't accept non existing files
      if (body.length === 10 && body.every(f => f.method === 'POST')) break
      await wait(500)
    } while (true)

    await unregisterRunner()
    mockUpload.cleanUpload()
  })

  it('Should upload the file on another endpoint for HLS', async function () {
    await server.videos.runTranscoding({ transcodingType: 'hls', videoId: transcoded })
    await waitJobs([ server ])

    await updatePayload()
    await registerRunner()

    do {
      const { body } = await makeGetRequest({ url: mockUploadServerUrl, path: '/uploaded-files', expectedStatus: HttpStatusCode.OK_200 })

      // 5 retries because the server doesn't accept non existing files
      if (body.length === 5 && body.every(f => f.method === 'PUT')) break
      await wait(500)
    } while (true)

    await unregisterRunner()
    mockUpload.cleanUpload()
  })

  after(async function () {
    peertubeRunner.kill()

    await mockUpload.terminate()
    await sqlCommand.cleanup()
    await cleanupTests([ server ])
  })
})
