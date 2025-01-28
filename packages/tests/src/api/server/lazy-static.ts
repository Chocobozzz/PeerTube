/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await,@typescript-eslint/no-floating-promises */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkDirectoryIsEmpty } from '@tests/shared/directories.js'

describe('Test lazy static endpoinds', function () {
  let servers: PeerTubeServer[]
  let videoId: string

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
    videoId = uuid

    await waitJobs(servers)
  })

  it('Should remove previous thumbnails/previews after an update', async function () {
    this.timeout(60000)

    const fetchRemoteImages = async () => {
      const video = await servers[1].videos.get({ id: videoId })
      await makeGetRequest({ url: servers[1].url, path: video.thumbnailPath, expectedStatus: HttpStatusCode.OK_200 })
      await makeGetRequest({ url: servers[1].url, path: video.previewPath, expectedStatus: HttpStatusCode.OK_200 })
    }

    await fetchRemoteImages()

    // Update video
    await servers[0].videos.update({
      id: videoId,
      attributes: { thumbnailfile: 'custom-thumbnail.jpg', previewfile: 'custom-preview.jpg' }
    })
    await waitJobs(servers)

    await fetchRemoteImages()

    // Remove video
    await servers[0].videos.remove({ id: videoId })
    await waitJobs(servers)

    await checkDirectoryIsEmpty(servers[1], 'thumbnails')
    await checkDirectoryIsEmpty(servers[1], 'previews')
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
