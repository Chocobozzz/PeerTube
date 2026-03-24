/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { join } from 'path'

describe('House keeping CLI', function () {
  let servers: PeerTubeServer[]

  function runHouseKeeping (option: string) {
    const env = servers[0].cli.getEnv()
    const command = `echo y | ${env} npm run house-keeping -- ${option}`

    return servers[0].cli.execWithEnv(command)
  }

  async function fetchRemoteData () {
    {
      const { data } = await servers[0].videos.list()

      for (const video of data) {
        for (const thumbnail of video.thumbnails) {
          await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        }

        const { storyboards } = await servers[0].storyboard.list({ id: video.uuid })

        for (const storyboard of storyboards) {
          await makeRawRequest({ url: storyboard.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        }

        const { data: captions } = await servers[0].captions.list({ videoId: video.uuid })

        for (const caption of captions) {
          await makeRawRequest({ url: caption.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        }
      }
    }

    {
      const { data: accounts } = await servers[0].accounts.list()
      const { data: channels } = await servers[0].channels.list()

      for (const { avatars } of [ ...accounts, ...channels ]) {
        for (const avatar of avatars) {
          await makeRawRequest({ url: avatar.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        }
      }
    }
  }

  async function checkLocalFiles () {
    expect(await servers[0].servers.countFiles('thumbnails')).to.equal(5) // 5 images sizes per video
    expect(await servers[0].servers.countFiles('avatars')).to.equal(2 * 4) // 4 versions of 1 account and 1 channel
    expect(await servers[0].servers.countFiles('storyboards')).to.equal(1)
    expect(await servers[0].servers.countFiles('captions')).to.equal(1)
  }

  async function checkCachedFiles (options: { populated: boolean }) {
    if (options.populated) {
      expect(await servers[0].servers.countFiles(join('cache', 'thumbnails'))).to.equal(5)
      expect(await servers[0].servers.countFiles(join('cache', 'avatars'))).to.equal(2 * 4)
      expect(await servers[0].servers.countFiles(join('cache', 'storyboards'))).to.equal(1)
      expect(await servers[0].servers.countFiles(join('cache', 'video-captions'))).to.equal(1)
    } else {
      expect(await servers[0].servers.countFiles(join('cache', 'thumbnails'))).to.equal(0)
      expect(await servers[0].servers.countFiles(join('cache', 'avatars'))).to.equal(0)
      expect(await servers[0].servers.countFiles(join('cache', 'storyboards'))).to.equal(0)
      expect(await servers[0].servers.countFiles(join('cache', 'video-captions'))).to.equal(0)
    }
  }

  before(async function () {
    this.timeout(360000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await setDefaultAccountAvatar(servers)
    await setDefaultChannelAvatar(servers)

    await servers[1].config.enableMinimumTranscoding()

    for (const server of servers) {
      const { uuid } = await server.videos.quickUpload({ name: 'video' })

      await server.captions.add({
        language: 'ar',
        videoId: uuid,
        fixture: 'subtitle-good1.vtt'
      })
    }

    await waitJobs(servers)

    await doubleFollow(servers[0], servers[1])
  })

  it('Should have remote files locally', async function () {
    this.timeout(120000)

    await checkLocalFiles()
    await checkCachedFiles({ populated: false })

    await fetchRemoteData()
    await checkCachedFiles({ populated: true })
  })

  it('Should remove remote files', async function () {
    this.timeout(60000)

    await servers[0].kill()
    await runHouseKeeping('--delete-remote-files')
    await servers[0].run()

    await checkLocalFiles()
    await checkCachedFiles({ populated: false })

    await fetchRemoteData()
    await checkCachedFiles({ populated: true })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
