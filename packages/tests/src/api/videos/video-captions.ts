/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { testCaptionFile } from '@tests/shared/captions.js'
import { checkVideoFilesWereRemoved } from '@tests/shared/videos.js'

describe('Test video captions', function () {
  const uuidRegex = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

  let servers: PeerTubeServer[]
  let videoUUID: string

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    await waitJobs(servers)

    const { uuid } = await servers[0].videos.upload({ attributes: { name: 'my video name' } })
    videoUUID = uuid

    await waitJobs(servers)
  })

  it('Should list the captions and return an empty list', async function () {
    for (const server of servers) {
      const body = await server.captions.list({ videoId: videoUUID })
      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    }
  })

  it('Should create two new captions', async function () {
    this.timeout(30000)

    await servers[0].captions.add({
      language: 'ar',
      videoId: videoUUID,
      fixture: 'subtitle-good1.vtt'
    })

    await servers[0].captions.add({
      language: 'zh',
      videoId: videoUUID,
      fixture: 'subtitle-good2.vtt',
      mimeType: 'application/octet-stream'
    })

    await waitJobs(servers)
  })

  it('Should list these uploaded captions', async function () {
    for (const server of servers) {
      const body = await server.captions.list({ videoId: videoUUID })
      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(2)

      const caption1 = body.data[0]
      expect(caption1.language.id).to.equal('ar')
      expect(caption1.language.label).to.equal('Arabic')
      expect(caption1.captionPath).to.match(new RegExp('^/lazy-static/video-captions/' + uuidRegex + '-ar.vtt$'))
      expect(caption1.automaticallyGenerated).to.be.false
      await testCaptionFile(server.url, caption1.captionPath, 'Subtitle good 1.')

      const caption2 = body.data[1]
      expect(caption2.language.id).to.equal('zh')
      expect(caption2.language.label).to.equal('Chinese')
      expect(caption2.captionPath).to.match(new RegExp('^/lazy-static/video-captions/' + uuidRegex + '-zh.vtt$'))
      expect(caption1.automaticallyGenerated).to.be.false
      await testCaptionFile(server.url, caption2.captionPath, 'Subtitle good 2.')
    }
  })

  it('Should replace an existing caption', async function () {
    this.timeout(30000)

    await servers[0].captions.add({
      language: 'ar',
      videoId: videoUUID,
      fixture: 'subtitle-good2.vtt'
    })

    await waitJobs(servers)
  })

  it('Should have this caption updated', async function () {
    for (const server of servers) {
      const body = await server.captions.list({ videoId: videoUUID })
      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(2)

      const caption1 = body.data[0]
      expect(caption1.language.id).to.equal('ar')
      expect(caption1.language.label).to.equal('Arabic')
      expect(caption1.captionPath).to.match(new RegExp('^/lazy-static/video-captions/' + uuidRegex + '-ar.vtt$'))
      await testCaptionFile(server.url, caption1.captionPath, 'Subtitle good 2.')
    }
  })

  it('Should replace an existing caption with a srt file and convert it', async function () {
    this.timeout(30000)

    await servers[0].captions.add({
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
      const body = await server.captions.list({ videoId: videoUUID })
      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(2)

      const caption1 = body.data[0]
      expect(caption1.language.id).to.equal('ar')
      expect(caption1.language.label).to.equal('Arabic')
      expect(caption1.captionPath).to.match(new RegExp('^/lazy-static/video-captions/' + uuidRegex + '-ar.vtt$'))

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

    await servers[0].captions.delete({ videoId: videoUUID, language: 'ar' })

    await waitJobs(servers)
  })

  it('Should only list the caption that was not deleted', async function () {
    for (const server of servers) {
      const body = await server.captions.list({ videoId: videoUUID })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)

      const caption = body.data[0]

      expect(caption.language.id).to.equal('zh')
      expect(caption.language.label).to.equal('Chinese')
      expect(caption.captionPath).to.match(new RegExp('^/lazy-static/video-captions/' + uuidRegex + '-zh.vtt$'))
      await testCaptionFile(server.url, caption.captionPath, 'Subtitle good 2.')
    }
  })

  it('Should remove the video, and thus all video captions', async function () {
    const video = await servers[0].videos.get({ id: videoUUID })
    const { data: captions } = await servers[0].captions.list({ videoId: videoUUID })

    await servers[0].videos.remove({ id: videoUUID })

    await checkVideoFilesWereRemoved({ server: servers[0], video, captions })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
