/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { pathExists, readdir, stat } from 'fs-extra'
import { join } from 'path'
import { HttpStatusCode } from '@shared/core-utils'
import {
  buildAbsoluteFixturePath,
  buildServerDirectory,
  cleanupTests,
  flushAndRunServer,
  getMyUserInformation,
  prepareResumableUpload,
  sendDebugCommand,
  sendResumableChunks,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateUser
} from '@shared/extra-utils'
import { MyUser, VideoPrivacy } from '@shared/models'

const expect = chai.expect

// Most classic resumable upload tests are done in other test suites

describe('Test resumable upload', function () {
  const defaultFixture = 'video_short.mp4'
  let server: ServerInfo
  let rootId: number

  async function buildSize (fixture: string, size?: number) {
    if (size !== undefined) return size

    const baseFixture = buildAbsoluteFixturePath(fixture)
    return (await stat(baseFixture)).size
  }

  async function prepareUpload (sizeArg?: number) {
    const size = await buildSize(defaultFixture, sizeArg)

    const attributes = {
      name: 'video',
      channelId: server.videoChannel.id,
      privacy: VideoPrivacy.PUBLIC,
      fixture: defaultFixture
    }

    const mimetype = 'video/mp4'

    const res = await prepareResumableUpload({ url: server.url, token: server.accessToken, attributes, size, mimetype })

    return res.header['location'].split('?')[1]
  }

  async function sendChunks (options: {
    pathUploadId: string
    size?: number
    expectedStatus?: HttpStatusCode
    contentLength?: number
    contentRange?: string
    contentRangeBuilder?: (start: number, chunk: any) => string
  }) {
    const { pathUploadId, expectedStatus, contentLength, contentRangeBuilder } = options

    const size = await buildSize(defaultFixture, options.size)
    const absoluteFilePath = buildAbsoluteFixturePath(defaultFixture)

    return sendResumableChunks({
      url: server.url,
      token: server.accessToken,
      pathUploadId,
      videoFilePath: absoluteFilePath,
      size,
      contentLength,
      contentRangeBuilder,
      specialStatus: expectedStatus
    })
  }

  async function checkFileSize (uploadIdArg: string, expectedSize: number | null) {
    const uploadId = uploadIdArg.replace(/^upload_id=/, '')

    const subPath = join('tmp', 'resumable-uploads', uploadId)
    const filePath = buildServerDirectory(server, subPath)
    const exists = await pathExists(filePath)

    if (expectedSize === null) {
      expect(exists).to.be.false
      return
    }

    expect(exists).to.be.true

    expect((await stat(filePath)).size).to.equal(expectedSize)
  }

  async function countResumableUploads () {
    const subPath = join('tmp', 'resumable-uploads')
    const filePath = buildServerDirectory(server, subPath)

    const files = await readdir(filePath)
    return files.length
  }

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    const res = await getMyUserInformation(server.url, server.accessToken)
    rootId = (res.body as MyUser).id

    await updateUser({
      url: server.url,
      userId: rootId,
      accessToken: server.accessToken,
      videoQuota: 10_000_000
    })
  })

  describe('Directory cleaning', function () {

    it('Should correctly delete files after an upload', async function () {
      const uploadId = await prepareUpload()
      await sendChunks({ pathUploadId: uploadId })

      expect(await countResumableUploads()).to.equal(0)
    })

    it('Should not delete files after an unfinished upload', async function () {
      await prepareUpload()

      expect(await countResumableUploads()).to.equal(2)
    })

    it('Should not delete recent uploads', async function () {
      await sendDebugCommand(server.url, server.accessToken, { command: 'remove-dandling-resumable-uploads' })

      expect(await countResumableUploads()).to.equal(2)
    })

    it('Should delete old uploads', async function () {
      await sendDebugCommand(server.url, server.accessToken, { command: 'remove-dandling-resumable-uploads' })

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
      const size = 100
      const uploadId = await prepareUpload(size)

      await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.CONFLICT_409 })
      await checkFileSize(uploadId, 0)
    })

    it('Should not accept more chunks than expected with an invalid content length/content range', async function () {
      const uploadId = await prepareUpload(1500)

      await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.BAD_REQUEST_400, contentLength: 1000 })
      await checkFileSize(uploadId, 0)
    })

    it('Should not accept more chunks than expected with an invalid content length', async function () {
      const uploadId = await prepareUpload(500)

      const size = 1000

      const contentRangeBuilder = start => `bytes ${start}-${start + size - 1}/${size}`
      await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.BAD_REQUEST_400, contentRangeBuilder, contentLength: size })
      await checkFileSize(uploadId, 0)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
