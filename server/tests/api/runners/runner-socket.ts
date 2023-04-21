/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@shared/core-utils'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'

describe('Test runner socket', function () {
  let server: PeerTubeServer
  let runnerToken: string

  before(async function () {
    this.timeout(120_000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableTranscoding(true, true)
    await server.config.enableRemoteTranscoding()
    runnerToken = await server.runners.autoRegisterRunner()
  })

  it('Should throw an error without runner token', function (done) {
    const localSocket = server.socketIO.getRunnersSocket({ runnerToken: null })
    localSocket.on('connect_error', err => {
      expect(err.message).to.contain('No runner token provided')
      done()
    })
  })

  it('Should throw an error with a bad runner token', function (done) {
    const localSocket = server.socketIO.getRunnersSocket({ runnerToken: 'ergag' })
    localSocket.on('connect_error', err => {
      expect(err.message).to.contain('Invalid runner token')
      done()
    })
  })

  it('Should not send ping if there is no available jobs', async function () {
    let pings = 0
    const localSocket = server.socketIO.getRunnersSocket({ runnerToken })
    localSocket.on('available-jobs', () => pings++)

    expect(pings).to.equal(0)
  })

  it('Should send a ping on available job', async function () {
    let pings = 0
    const localSocket = server.socketIO.getRunnersSocket({ runnerToken })
    localSocket.on('available-jobs', () => pings++)

    await server.videos.quickUpload({ name: 'video1' })

    // Wait for debounce
    await wait(1000)
    await waitJobs([ server ])
    expect(pings).to.equal(1)

    await server.videos.quickUpload({ name: 'video2' })

    // Wait for debounce
    await wait(1000)
    await waitJobs([ server ])
    expect(pings).to.equal(2)

    await server.runnerJobs.cancelAllJobs()
  })

  it('Should send a ping when a child is ready', async function () {
    let pings = 0
    const localSocket = server.socketIO.getRunnersSocket({ runnerToken })
    localSocket.on('available-jobs', () => pings++)

    await server.videos.quickUpload({ name: 'video3' })
    // Wait for debounce
    await wait(1000)
    await waitJobs([ server ])

    expect(pings).to.equal(1)

    await server.runnerJobs.autoProcessWebVideoJob(runnerToken)
    // Wait for debounce
    await wait(1000)
    await waitJobs([ server ])

    expect(pings).to.equal(2)
  })

  it('Should not send a ping if the ended job does not have a child', async function () {
    let pings = 0
    const localSocket = server.socketIO.getRunnersSocket({ runnerToken })
    localSocket.on('available-jobs', () => pings++)

    const { availableJobs } = await server.runnerJobs.request({ runnerToken })
    const job = availableJobs.find(j => j.type === 'vod-web-video-transcoding')
    await server.runnerJobs.autoProcessWebVideoJob(runnerToken, job.uuid)

    // Wait for debounce
    await wait(1000)
    await waitJobs([ server ])

    expect(pings).to.equal(0)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
