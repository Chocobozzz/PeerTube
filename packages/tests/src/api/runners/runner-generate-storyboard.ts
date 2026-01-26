/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { GenerateStoryboardSuccess, RunnerJobGenerateStoryboardPayload } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { testImage } from '@tests/shared/checks.js'
import { checkPersistentTmpIsEmpty } from '@tests/shared/directories.js'
import { expect } from 'chai'

describe('Test runner generate storyboard', function () {
  let servers: PeerTubeServer[] = []
  let runnerToken: string

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.updateExistingConfig({
      newConfig: {
        storyboards: {
          enabled: true,
          remoteRunners: {
            enabled: true
          }
        }
      }
    })

    runnerToken = await servers[0].runners.autoRegisterRunner()
  })

  async function upload () {
    const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video', language: undefined } })
    await waitJobs(servers)

    const { availableJobs } = await servers[0].runnerJobs.request({ runnerToken })
    expect(availableJobs).to.have.lengthOf(1)

    const jobUUID = availableJobs[0].uuid

    const { job } = await servers[0].runnerJobs.accept<RunnerJobGenerateStoryboardPayload>({ runnerToken, jobUUID })
    return { uuid, job }
  }

  it('Should execute a remote generate storyboard job', async function () {
    this.timeout(240_000)

    const { uuid, job } = await upload()

    expect(job.type === 'generate-video-storyboard')
    expect(job.payload.input.videoFileUrl).to.exist

    // Check video input file
    {
      await servers[0].runnerJobs.getJobFile({ url: job.payload.input.videoFileUrl, jobToken: job.jobToken, runnerToken })
    }

    const payload: GenerateStoryboardSuccess = {
      storyboardFile: 'banner.jpg'
    }

    await servers[0].runnerJobs.success({ runnerToken, jobUUID: job.uuid, jobToken: job.jobToken, payload })

    await waitJobs(servers)

    for (const server of servers) {
      const { storyboards } = await server.storyboard.list({ id: uuid })

      expect(storyboards).to.have.lengthOf(1)

      await testImage({ name: 'banner.jpg', url: storyboards[0].fileUrl })
    }
    await checkPersistentTmpIsEmpty(servers[0])
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
