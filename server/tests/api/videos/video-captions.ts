/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  checkVideoFilesWereRemoved,
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  removeVideo,
  uploadVideo,
  wait
} from '../../../../shared/extra-utils'
import { ServerInfo, setAccessTokensToServers } from '../../../../shared/extra-utils/index'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import {
  createVideoCaption,
  deleteVideoCaption,
  listVideoCaptions,
  testCaptionFile
} from '../../../../shared/extra-utils/videos/video-captions'
import { VideoCaption } from '../../../../shared/models/videos/caption/video-caption.model'

const expect = chai.expect

describe('Test video captions', function () {
  let servers: ServerInfo[]
  let videoUUID: string

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    await waitJobs(servers)

    const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'my video name' })
    videoUUID = res.body.video.uuid

    await waitJobs(servers)
  })

  it('Should list the captions and return an empty list', async function () {
    for (const server of servers) {
      const res = await listVideoCaptions(server.url, videoUUID)
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    }
  })

  it('Should create two new captions', async function () {
    this.timeout(30000)

    await createVideoCaption({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      language: 'ar',
      videoId: videoUUID,
      fixture: 'subtitle-good1.vtt'
    })

    await createVideoCaption({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      language: 'zh',
      videoId: videoUUID,
      fixture: 'subtitle-good2.vtt',
      mimeType: 'application/octet-stream'
    })

    await waitJobs(servers)
  })

  it('Should list these uploaded captions', async function () {
    for (const server of servers) {
      const res = await listVideoCaptions(server.url, videoUUID)
      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(2)

      const caption1: VideoCaption = res.body.data[0]
      expect(caption1.language.id).to.equal('ar')
      expect(caption1.language.label).to.equal('Arabic')
      expect(caption1.captionPath).to.equal('/static/video-captions/' + videoUUID + '-ar.vtt')
      await testCaptionFile(server.url, caption1.captionPath, 'Subtitle good 1.')

      const caption2: VideoCaption = res.body.data[1]
      expect(caption2.language.id).to.equal('zh')
      expect(caption2.language.label).to.equal('Chinese')
      expect(caption2.captionPath).to.equal('/static/video-captions/' + videoUUID + '-zh.vtt')
      await testCaptionFile(server.url, caption2.captionPath, 'Subtitle good 2.')
    }
  })

  it('Should replace an existing caption', async function () {
    this.timeout(30000)

    await createVideoCaption({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      language: 'ar',
      videoId: videoUUID,
      fixture: 'subtitle-good2.vtt'
    })

    await waitJobs(servers)
  })

  it('Should have this caption updated', async function () {
    for (const server of servers) {
      const res = await listVideoCaptions(server.url, videoUUID)
      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(2)

      const caption1: VideoCaption = res.body.data[0]
      expect(caption1.language.id).to.equal('ar')
      expect(caption1.language.label).to.equal('Arabic')
      expect(caption1.captionPath).to.equal('/static/video-captions/' + videoUUID + '-ar.vtt')
      await testCaptionFile(server.url, caption1.captionPath, 'Subtitle good 2.')
    }
  })

  it('Should replace an existing caption with a srt file and convert it', async function () {
    this.timeout(30000)

    await createVideoCaption({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      language: 'ar',
      videoId: videoUUID,
      fixture: 'subtitle-good.srt'
    })

    await waitJobs(servers)

    // Cache invalidation
    await wait(3000)
  })

  it('Should have this caption updated and converted', async function () {
    for (const server of servers) {
      const res = await listVideoCaptions(server.url, videoUUID)
      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(2)

      const caption1: VideoCaption = res.body.data[0]
      expect(caption1.language.id).to.equal('ar')
      expect(caption1.language.label).to.equal('Arabic')
      expect(caption1.captionPath).to.equal('/static/video-captions/' + videoUUID + '-ar.vtt')

      const expected = 'WEBVTT FILE\r\n' +
        '\r\n' +
        '1\r\n' +
        '00:00:01.600 --> 00:00:04.200\r\n' +
        'English (US)\r\n' +
        '\r\n' +
        '2\r\n' +
        '00:00:05.900 --> 00:00:07.999\r\n' +
        'This is a subtitle in American English\r\n' +
        '\r\n' +
        '3\r\n' +
        '00:00:10.000 --> 00:00:14.000\r\n' +
        'Adding subtitles is very easy to do\r\n'
      await testCaptionFile(server.url, caption1.captionPath, expected)
    }
  })

  it('Should remove one caption', async function () {
    this.timeout(30000)

    await deleteVideoCaption(servers[0].url, servers[0].accessToken, videoUUID, 'ar')

    await waitJobs(servers)
  })

  it('Should only list the caption that was not deleted', async function () {
    for (const server of servers) {
      const res = await listVideoCaptions(server.url, videoUUID)
      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.have.lengthOf(1)

      const caption: VideoCaption = res.body.data[0]

      expect(caption.language.id).to.equal('zh')
      expect(caption.language.label).to.equal('Chinese')
      expect(caption.captionPath).to.equal('/static/video-captions/' + videoUUID + '-zh.vtt')
      await testCaptionFile(server.url, caption.captionPath, 'Subtitle good 2.')
    }
  })

  it('Should remove the video, and thus all video captions', async function () {
    await removeVideo(servers[0].url, servers[0].accessToken, videoUUID)

    await checkVideoFilesWereRemoved(videoUUID, 1)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
