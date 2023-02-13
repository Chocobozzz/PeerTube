/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'
import { VideoDetails } from '@shared/models'

describe('Test video update file', function () {
  let servers: PeerTubeServer[] = []
  let originalVideo: VideoDetails

  before(async function () {
    this.timeout(40000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])
    const { uuid } = await servers[0].videos.quickUpload({ name: 'soon to be updated' })
    originalVideo = await servers[0].videos.get({ id: uuid })
  })

  it('Should upload a new video file', async function () {
    this.timeout(30000)

    await servers[0].videos.upload({
      attributes: { fixture: 'video_short2.webm' },
      mode: 'resumable',
      videoUUID: originalVideo.uuid
    })

    await waitJobs(servers[0])

    const updatedVideo = await servers[0].videos.get({ id: originalVideo.uuid })

    expect(updatedVideo.files[0].id).to.not.equal(originalVideo.files[0].id)
    expect(updatedVideo.files[0].size).to.not.equal(originalVideo.files[0].size)
  })

  it.skip('should transcode update video file', async function () {

  })

  after(async function () {
    await cleanupTests(servers)
  })
})
