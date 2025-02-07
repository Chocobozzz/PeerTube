/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { readdir } from 'fs/promises'
import { basename } from 'path'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { areHttpImportTestsDisabled } from '@peertube/peertube-node-utils'
import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  makeRawRequest,
  PeerTubeServer,
  sendRTMPStream,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@peertube/peertube-server-commands'

async function checkStoryboard (options: {
  server: PeerTubeServer
  uuid: string
  spriteHeight?: number
  spriteWidth?: number
  tilesCount?: number
  minSize?: number
  spriteDuration?: number
}) {
  const { server, uuid, tilesCount, spriteDuration = 1, spriteHeight = 108, spriteWidth = 192, minSize = 1000 } = options

  const { storyboards } = await server.storyboard.list({ id: uuid })

  expect(storyboards).to.have.lengthOf(1)

  const storyboard = storyboards[0]

  expect(storyboard.spriteDuration).to.equal(spriteDuration)
  expect(storyboard.spriteHeight).to.equal(spriteHeight)
  expect(storyboard.spriteWidth).to.equal(spriteWidth)
  expect(storyboard.storyboardPath).to.exist

  if (tilesCount) {
    expect(storyboard.totalWidth).to.equal(spriteWidth * Math.min(tilesCount, 11))
    expect(storyboard.totalHeight).to.equal(spriteHeight * Math.max((tilesCount / 11), 1))
  }

  {
    const { body } = await makeGetRequest({ url: server.url, path: storyboard.storyboardPath, expectedStatus: HttpStatusCode.OK_200 })
    expect(body.length).to.be.above(minSize)
  }

  {
    const { body } = await makeRawRequest({ url: storyboard.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    expect(body.length).to.be.above(minSize)
  }
}

describe('Test video storyboard', function () {
  let servers: PeerTubeServer[]

  let baseUUID: string

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])
  })

  it('Should generate a storyboard after upload without transcoding', async function () {
    this.timeout(120000)

    // 5s video
    const { uuid } = await servers[0].videos.quickUpload({ name: 'upload', fixture: 'video_short.webm' })
    baseUUID = uuid
    await waitJobs(servers)

    for (const server of servers) {
      await checkStoryboard({ server, uuid, tilesCount: 5 })
    }
  })

  it('Should generate a storyboard after upload without transcoding with a long video', async function () {
    this.timeout(120000)

    // 124s video
    const { uuid } = await servers[0].videos.quickUpload({ name: 'upload', fixture: 'video_very_long_10p.mp4' })
    await waitJobs(servers)

    for (const server of servers) {
      await checkStoryboard({ server, uuid, spriteDuration: 2, spriteHeight: 154, tilesCount: 66 })
    }
  })

  it('Should generate a storyboard after upload with transcoding', async function () {
    this.timeout(120000)

    await servers[0].config.enableMinimumTranscoding()

    // 5s video
    const { uuid } = await servers[0].videos.quickUpload({ name: 'upload', fixture: 'video_short.webm' })
    await waitJobs(servers)

    for (const server of servers) {
      await checkStoryboard({ server, uuid, tilesCount: 5 })
    }
  })

  it('Should generate a storyboard after an audio upload', async function () {
    this.timeout(120000)

    // 6s audio
    const attributes = { name: 'audio', fixture: 'sample.ogg' }
    const { uuid } = await servers[0].videos.upload({ attributes, mode: 'legacy' })
    await waitJobs(servers)

    for (const server of servers) {
      try {
        await checkStoryboard({ server, uuid, tilesCount: 6, minSize: 250 })
      } catch { // FIXME: to remove after ffmpeg CI upgrade, ffmpeg CI version (4.3) generates a 7.6s length video
        await checkStoryboard({ server, uuid, tilesCount: 8, minSize: 250 })
      }
    }
  })

  it('Should generate a storyboard after HTTP import', async function () {
    this.timeout(120000)

    if (areHttpImportTestsDisabled()) return

    // 3s video
    const { video } = await servers[0].videoImports.importVideo({
      attributes: {
        targetUrl: FIXTURE_URLS.goodVideo,
        channelId: servers[0].store.channel.id,
        privacy: VideoPrivacy.PUBLIC
      }
    })
    await waitJobs(servers)

    for (const server of servers) {
      await checkStoryboard({ server, uuid: video.uuid, spriteHeight: 144, tilesCount: 3 })
    }
  })

  it('Should generate a storyboard after torrent import', async function () {
    this.timeout(240000)

    if (areHttpImportTestsDisabled()) return

    // 10s video
    const { video } = await servers[0].videoImports.importVideo({
      attributes: {
        magnetUri: FIXTURE_URLS.magnet,
        channelId: servers[0].store.channel.id,
        privacy: VideoPrivacy.PUBLIC
      }
    })
    await waitJobs(servers)

    for (const server of servers) {
      await checkStoryboard({ server, uuid: video.uuid, tilesCount: 10 })
    }
  })

  it('Should generate a storyboard after a live', async function () {
    this.timeout(240000)

    await servers[0].config.enableLive({ allowReplay: true, transcoding: true, resolutions: 'min' })

    const { live, video } = await servers[0].live.quickCreate({
      saveReplay: true,
      permanentLive: false,
      privacy: VideoPrivacy.PUBLIC
    })

    const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
    await servers[0].live.waitUntilPublished({ videoId: video.id })

    await stopFfmpeg(ffmpegCommand)

    await servers[0].live.waitUntilReplacedByReplay({ videoId: video.id })
    await waitJobs(servers)

    for (const server of servers) {
      await checkStoryboard({ server, uuid: video.uuid })
    }
  })

  it('Should cleanup storyboards on video deletion', async function () {
    this.timeout(60000)

    const { storyboards } = await servers[0].storyboard.list({ id: baseUUID })
    const storyboardName = basename(storyboards[0].storyboardPath)

    const listFiles = () => {
      const storyboardPath = servers[0].getDirectoryPath('storyboards')
      return readdir(storyboardPath)
    }

    {
      const storyboads = await listFiles()
      expect(storyboads).to.include(storyboardName)
    }

    await servers[0].videos.remove({ id: baseUUID })
    await waitJobs(servers)

    {
      const storyboads = await listFiles()
      expect(storyboads).to.not.include(storyboardName)
    }
  })

  it('Should not generate storyboards if disabled by the admin', async function () {
    this.timeout(60000)

    await servers[0].config.updateExistingConfig({
      newConfig: {
        storyboards: {
          enabled: false
        }
      }
    })

    const { uuid } = await servers[0].videos.quickUpload({ name: 'upload', fixture: 'video_short.webm' })
    await waitJobs(servers)

    for (const server of servers) {
      const { storyboards } = await server.storyboard.list({ id: uuid })

      expect(storyboards).to.have.lengthOf(0)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
