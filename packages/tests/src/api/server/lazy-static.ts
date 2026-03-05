/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await,@typescript-eslint/no-floating-promises */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { join } from 'path'

describe('Test lazy static endpoints', function () {
  let servers: PeerTubeServer[]
  let videoId: string

  async function fetchRemoteData () {
    {
      const video = await servers[1].videos.get({ id: videoId })

      for (const thumbnail of video.thumbnails) {
        await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      const { storyboards } = await servers[1].storyboard.list({ id: video.uuid })

      for (const storyboard of storyboards) {
        await makeRawRequest({ url: storyboard.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      const { data: captions } = await servers[1].captions.list({ videoId: video.uuid })

      for (const caption of captions) {
        await makeRawRequest({ url: caption.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }
    }

    {
      const { data: accounts } = await servers[1].accounts.list()
      const { data: channels } = await servers[1].channels.list()

      for (const { avatars } of [ ...accounts, ...channels ]) {
        for (const avatar of avatars) {
          await makeRawRequest({ url: avatar.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        }
      }
    }
  }

  async function checkCachedFiles (options: { populated: boolean }) {
    if (options.populated) {
      expect(await servers[1].servers.countFiles(join('cache', 'thumbnails'))).to.equal(5)
      expect(await servers[1].servers.countFiles(join('cache', 'avatars'))).to.equal(2 * 4)
      expect(await servers[1].servers.countFiles(join('cache', 'storyboards'))).to.equal(1)
      expect(await servers[1].servers.countFiles(join('cache', 'video-captions'))).to.equal(1)
    } else {
      expect(await servers[1].servers.countFiles(join('cache', 'thumbnails'))).to.equal(0)
      expect(await servers[1].servers.countFiles(join('cache', 'avatars'))).to.equal(0)
      expect(await servers[1].servers.countFiles(join('cache', 'storyboards'))).to.equal(0)
      expect(await servers[1].servers.countFiles(join('cache', 'video-captions'))).to.equal(0)
    }
  }

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultAccountAvatar(servers)
    await setDefaultChannelAvatar(servers)

    await servers[0].config.enableFileUpdate()

    await doubleFollow(servers[0], servers[1])

    const { uuid } = await servers[0].videos.upload({
      attributes: {
        name: 'video',
        thumbnailfile: 'custom-thumbnail-big.jpg'
      }
    })
    videoId = uuid

    await servers[0].captions.add({
      language: 'ar',
      videoId: uuid,
      fixture: 'subtitle-good1.vtt'
    })

    await waitJobs(servers)
  })

  it('Should remove previous data after an update', async function () {
    this.timeout(60000)

    await checkCachedFiles({ populated: false })

    await fetchRemoteData()

    await checkCachedFiles({ populated: true })

    // Will re-generate thumbnails and storyboard
    await servers[0].videos.replaceSourceFile({ videoId, fixture: 'video_short_360p.mp4' })

    await servers[0].captions.add({
      language: 'ar',
      videoId,
      fixture: 'subtitle-good2.vtt'
    })
    await waitJobs(servers)

    await fetchRemoteData()
    await checkCachedFiles({ populated: true })
  })

  it('Should still have files after a server restart', async function () {
    this.timeout(60000)

    await servers[0].kill()
    await servers[0].run()

    await checkCachedFiles({ populated: true })
  })

  it('Should remove the video and remove cached files', async function () {
    this.timeout(60000)

    await servers[0].videos.remove({ id: videoId })
    await waitJobs(servers)

    expect(await servers[1].servers.countFiles(join('cache', 'thumbnails'))).to.equal(0)
    expect(await servers[1].servers.countFiles(join('cache', 'avatars'))).to.equal(2 * 4)
    expect(await servers[1].servers.countFiles(join('cache', 'storyboards'))).to.equal(0)
    expect(await servers[1].servers.countFiles(join('cache', 'video-captions'))).to.equal(0)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
