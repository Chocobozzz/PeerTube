/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists } from 'fs-extra/esm'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { HttpStatusCode, HttpStatusCodeType, VideoPrivacy } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath, sha1 } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

// Most classic resumable upload tests are done in other test suites

describe('Test resumable upload', function () {
  const path = '/api/v1/videos/upload-resumable'
  const defaultFixture = 'video_short.mp4'
  let server: PeerTubeServer
  let rootId: number
  let userAccessToken: string
  let userChannelId: number

  async function buildSize (fixture: string, size?: number) {
    if (size !== undefined) return size

    const baseFixture = buildAbsoluteFixturePath(fixture)
    return (await stat(baseFixture)).size
  }

  async function prepareUpload (options: {
    channelId?: number
    token?: string
    size?: number
    originalName?: string
    lastModified?: number
  } = {}) {
    const { token, originalName, lastModified } = options

    const size = await buildSize(defaultFixture, options.size)

    const mimetype = 'video/mp4'

    const res = await server.videos.prepareVideoResumableUpload({
      path,
      token,
      fixture: defaultFixture,
      fields: {
        name: 'video',
        channelId: options.channelId ?? server.store.channel.id,
        privacy: VideoPrivacy.PUBLIC
      },
      size,
      mimetype,
      originalName,
      lastModified
    })

    return res.header['location'].split('?')[1]
  }

  async function sendChunks (options: {
    token?: string
    pathUploadId: string
    size?: number
    expectedStatus?: HttpStatusCodeType
    contentLength?: number
    contentRange?: string
    contentRangeBuilder?: (start: number, chunk: any) => string
    digestBuilder?: (chunk: any) => string
  }) {
    const { token, pathUploadId, expectedStatus, contentLength, contentRangeBuilder, digestBuilder } = options

    const size = await buildSize(defaultFixture, options.size)
    const absoluteFilePath = buildAbsoluteFixturePath(defaultFixture)

    return server.videos.sendResumableVideoChunks({
      token,
      path,
      pathUploadId,
      videoFilePath: absoluteFilePath,
      size,
      contentLength,
      contentRangeBuilder,
      digestBuilder,
      expectedStatus
    })
  }

  async function checkFileSize (uploadIdArg: string, expectedSize: number | null) {
    const uploadId = uploadIdArg.replace(/^upload_id=/, '')

    const subPath = join('tmp', 'resumable-uploads', `${rootId}-${uploadId}.mp4`)
    const filePath = server.servers.buildDirectory(subPath)
    const exists = await pathExists(filePath)

    if (expectedSize === null) {
      expect(exists).to.be.false
      return
    }

    expect(exists).to.be.true

    expect((await stat(filePath)).size).to.equal(expectedSize)
  }

  async function countResumableUploads (wait?: number) {
    const subPath = join('tmp', 'resumable-uploads')
    const filePath = server.servers.buildDirectory(subPath)
    await new Promise(resolve => setTimeout(resolve, wait))
    const files = await readdir(filePath)
    return files.length
  }

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    const body = await server.users.getMyInfo()
    rootId = body.id

    {
      userAccessToken = await server.users.generateUserAndToken('user1')
      const { videoChannels } = await server.users.getMyInfo({ token: userAccessToken })
      userChannelId = videoChannels[0].id
    }

    await server.users.update({ userId: rootId, videoQuota: 10_000_000 })
  })

  describe('Directory cleaning', function () {

    it('Should correctly delete files after an upload', async function () {
      const uploadId = await prepareUpload()
      await sendChunks({ pathUploadId: uploadId })
      await server.videos.endVideoResumableUpload({ path, pathUploadId: uploadId })

      expect(await countResumableUploads()).to.equal(0)
    })

    it('Should correctly delete corrupt files', async function () {
      const uploadId = await prepareUpload({ size: 8 * 1024 })
      await sendChunks({ pathUploadId: uploadId, size: 8 * 1024, expectedStatus: HttpStatusCode.UNPROCESSABLE_ENTITY_422 })

      expect(await countResumableUploads(2000)).to.equal(0)
    })

    it('Should not delete files after an unfinished upload', async function () {
      await prepareUpload()

      expect(await countResumableUploads()).to.equal(2)
    })

    it('Should not delete recent uploads', async function () {
      await server.debug.sendCommand({ body: { command: 'remove-dandling-resumable-uploads' } })

      expect(await countResumableUploads()).to.equal(2)
    })

    it('Should delete old uploads', async function () {
      await server.debug.sendCommand({ body: { command: 'remove-dandling-resumable-uploads' } })

      expect(await countResumableUploads()).to.equal(0)
    })
  })

  describe('Resumable upload and chunks', function () {

    it('Should accept the same amount of chunks', async function () {
      const uploadId = await prepareUpload()
      await sendChunks({ pathUploadId: uploadId })

      await checkFileSize(uploadId, null)
    })

    it('Should not accept more chunks than expected', async function () {
      const uploadId = await prepareUpload({ size: 100 })

      await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.CONFLICT_409 })
      await checkFileSize(uploadId, 0)
    })

    it('Should not accept more chunks than expected with an invalid content length/content range', async function () {
      const uploadId = await prepareUpload({ size: 1500 })

      try {
        await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.CONFLICT_409, contentLength: 1000 })
      } catch (err) {
        await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.BAD_REQUEST_400, contentLength: 1000 })
      }

      await checkFileSize(uploadId, 0)
    })

    it('Should not accept more chunks than expected with an invalid content length', async function () {
      const uploadId = await prepareUpload({ size: 500 })

      const size = 1000

      const contentRangeBuilder = (start: number) => `bytes ${start}-${start + size - 1}/${size}`
      await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.CONFLICT_409, contentRangeBuilder, contentLength: size })
      await checkFileSize(uploadId, 0)
    })

    it('Should not have the same upload id with 2 different users', async function () {
      const originalName = 'toto.mp4'
      const lastModified = new Date().getTime()

      const uploadId1 = await prepareUpload({ originalName, lastModified, token: server.accessToken })
      const uploadId2 = await prepareUpload({ originalName, lastModified, channelId: userChannelId, token: userAccessToken })

      expect(uploadId1).to.not.equal(uploadId2)
    })

    it('Should have the same upload id with the same user', async function () {
      const originalName = 'toto.mp4'
      const lastModified = new Date().getTime()

      const uploadId1 = await prepareUpload({ originalName, lastModified })
      const uploadId2 = await prepareUpload({ originalName, lastModified })

      expect(uploadId1).to.equal(uploadId2)
    })

    it('Should not cache a request with 2 different users', async function () {
      const originalName = 'toto.mp4'
      const lastModified = new Date().getTime()

      const uploadId = await prepareUpload({ originalName, lastModified, token: server.accessToken })

      await sendChunks({ pathUploadId: uploadId, token: server.accessToken })
      await sendChunks({ pathUploadId: uploadId, token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should refuse an invalid digest', async function () {
      const uploadId = await prepareUpload({ token: server.accessToken })

      await sendChunks({
        pathUploadId: uploadId,
        token: server.accessToken,
        digestBuilder: () => 'sha=' + 'a'.repeat(40),
        expectedStatus: 460 as any
      })
    })

    it('Should accept an appropriate digest', async function () {
      const uploadId = await prepareUpload({ token: server.accessToken })

      await sendChunks({
        pathUploadId: uploadId,
        token: server.accessToken,
        digestBuilder: (chunk: Buffer) => {
          return 'sha1=' + sha1(chunk, 'base64')
        }
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
