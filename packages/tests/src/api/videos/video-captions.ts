/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { testCaptionFile } from '@tests/shared/captions.js'
import { expectStartWith } from '@tests/shared/checks.js'
import { checkDirectoryIsEmpty } from '@tests/shared/directories.js'
import { checkVideoFilesWereRemoved } from '@tests/shared/videos.js'
import { expect } from 'chai'

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

  describe('Common on filesystem', function () {

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
        expect(caption1.captionPath).to.match(new RegExp(`^/lazy-static/video-captions/${uuidRegex}-ar.vtt$`))
        expect(caption1.fileUrl).to.match(new RegExp(`^${server.url}/lazy-static/video-captions/${uuidRegex}-ar.vtt$`))
        expect(caption1.automaticallyGenerated).to.be.false
        await testCaptionFile(caption1.fileUrl, 'Subtitle good 1.')

        const caption2 = body.data[1]
        expect(caption2.language.id).to.equal('zh')
        expect(caption2.language.label).to.equal('Chinese')
        expect(caption2.captionPath).to.match(new RegExp(`^/lazy-static/video-captions/${uuidRegex}-zh.vtt$`))
        expect(caption2.fileUrl).to.match(new RegExp(`^${server.url}/lazy-static/video-captions/${uuidRegex}-zh.vtt$`))
        expect(caption1.automaticallyGenerated).to.be.false
        await testCaptionFile(caption2.fileUrl, 'Subtitle good 2.')
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
        expect(caption1.captionPath).to.match(new RegExp(`^/lazy-static/video-captions/${uuidRegex}-ar.vtt$`))
        expect(caption1.fileUrl).to.match(new RegExp(`^${server.url}/lazy-static/video-captions/${uuidRegex}-ar.vtt$`))
        await testCaptionFile(caption1.fileUrl, 'Subtitle good 2.')
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
        expect(caption1.fileUrl).to.match(new RegExp(`${server.url}/lazy-static/video-captions/${uuidRegex}-ar.vtt$`))

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
        await testCaptionFile(caption1.fileUrl, expected)
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
        expect(caption.fileUrl).to.match(new RegExp(`^${server.url}/lazy-static/video-captions/${uuidRegex}-zh.vtt$`))
        await testCaptionFile(caption.fileUrl, 'Subtitle good 2.')
      }
    })

    it('Should remove the video, and thus all video captions', async function () {
      const video = await servers[0].videos.get({ id: videoUUID })
      const { data: captions } = await servers[0].captions.list({ videoId: videoUUID })

      await servers[0].videos.remove({ id: videoUUID })

      await checkVideoFilesWereRemoved({ server: servers[0], video, captions })
    })
  })

  describe('On object storage', function () {
    let videoUUID: string
    let oldFileUrlsAr: string[] = []
    const oldFileUrlsZh: string[] = []

    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    before(async function () {
      this.timeout(120000)

      const configOverride = objectStorage.getDefaultMockConfig()
      await objectStorage.prepareDefaultMockBuckets()

      await servers[0].kill()
      await servers[0].run(configOverride)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'object storage' })
      videoUUID = uuid

      await waitJobs(servers)
    })

    it('Should create captions', async function () {
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

    it('Should have these captions in object storage', async function () {
      for (const server of servers) {
        const body = await server.captions.list({ videoId: videoUUID })
        expect(body.total).to.equal(2)
        expect(body.data).to.have.lengthOf(2)

        {
          const caption1 = body.data[0]
          expect(caption1.language.id).to.equal('ar')

          if (server === servers[0]) {
            expectStartWith(caption1.fileUrl, objectStorage.getMockCaptionFileBaseUrl())
            expect(caption1.captionPath).to.be.null

            oldFileUrlsAr.push(caption1.fileUrl)
          } else {
            expect(caption1.captionPath).to.match(new RegExp(`^/lazy-static/video-captions/${uuidRegex}-ar.vtt$`))
            expect(caption1.fileUrl).to.match(new RegExp(`^${server.url}/lazy-static/video-captions/${uuidRegex}-ar.vtt$`))
          }

          await testCaptionFile(caption1.fileUrl, 'Subtitle good 1.')
        }

        {
          const caption2 = body.data[1]
          expect(caption2.language.id).to.equal('zh')

          if (server === servers[0]) {
            expectStartWith(caption2.fileUrl, objectStorage.getMockCaptionFileBaseUrl())
            expect(caption2.captionPath).to.be.null

            oldFileUrlsZh.push(caption2.fileUrl)
          }

          await testCaptionFile(caption2.fileUrl, 'Subtitle good 2.')
        }
      }

      await checkDirectoryIsEmpty(servers[0], 'captions')
    })

    it('Should replace an existing caption', async function () {
      this.timeout(30000)

      await servers[0].captions.add({
        language: 'ar',
        videoId: videoUUID,
        fixture: 'subtitle-good.srt'
      })

      await waitJobs(servers)
      // Cache invalidation
      await wait(3000)

      for (const url of oldFileUrlsAr) {
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      }

      await checkDirectoryIsEmpty(servers[0], 'captions')

      oldFileUrlsAr = []

      for (const server of servers) {
        const body = await server.captions.list({ videoId: videoUUID })
        expect(body.total).to.equal(2)
        expect(body.data).to.have.lengthOf(2)

        const caption = body.data.find(c => c.language.id === 'ar')

        if (server === servers[0]) {
          expectStartWith(caption.fileUrl, objectStorage.getMockCaptionFileBaseUrl())
          expect(caption.captionPath).to.be.null

          oldFileUrlsAr.push(caption.fileUrl)
        }

        await testCaptionFile(caption.fileUrl, 'This is a subtitle in American English')
      }
    })

    it('Should remove a caption', async function () {
      this.timeout(30000)

      await servers[0].captions.delete({ videoId: videoUUID, language: 'ar' })
      await waitJobs(servers)

      await checkDirectoryIsEmpty(servers[0], 'captions')

      for (const url of oldFileUrlsAr) {
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      }

      for (const url of oldFileUrlsZh) {
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should remove the video, and thus all video captions', async function () {
      await servers[0].videos.remove({ id: videoUUID })

      await waitJobs(servers)

      for (const url of oldFileUrlsZh) {
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      }
    })

    after(async function () {
      await objectStorage.cleanupMock()
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
