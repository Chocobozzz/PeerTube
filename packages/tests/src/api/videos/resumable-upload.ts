/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, HttpStatusCodeType, UserImportState, VideoPrivacy } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled, buildAbsoluteFixturePath, sha1 } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSingleServer,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith, testImage } from '@tests/shared/checks.js'
import { generateHighBitrateVideo } from '@tests/shared/generate.js'
import { expect } from 'chai'
import { copy, pathExists, remove } from 'fs-extra/esm'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'

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
    fixture?: string // default defaultFixture
    mimetype?: string // default video/mp4
    fields?: Record<string, any>
    attaches?: Record<string, string>
    expectedStatus?: HttpStatusCodeType
  } = {}) {
    const { token, originalName, lastModified, fixture = defaultFixture, mimetype = 'video/mp4', fields = {}, attaches, expectedStatus } =
      options

    const size = await buildSize(fixture, options.size)

    const res = await server.videos.prepareVideoResumableUpload({
      path,
      token,
      fixture,
      fields: {
        name: 'video',
        channelId: options.channelId ?? server.store.channel.id,
        privacy: VideoPrivacy.PUBLIC,

        ...fields
      },
      size,
      mimetype,
      attaches,
      originalName,
      lastModified,
      expectedStatus
    })

    return res.header['location'].split('?')[1]
  }

  // Init request sent through a reverse proxy/load balancer: the test server trusts loopback proxies
  async function prepareUploadBehindProxy () {
    const res = await fetch(server.url + path, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + server.accessToken,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': await buildSize(defaultFixture) + '',
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'proxy.example.com'
      },
      body: JSON.stringify({ name: 'video', channelId: server.store.channel.id, privacy: VideoPrivacy.PUBLIC, filename: defaultFixture })
    })

    expect(res.status).to.equal(HttpStatusCode.CREATED_201)

    return res.headers.get('location')
  }

  async function checkUploadLocationUsesWebserverUrl () {
    const location = await prepareUploadBehindProxy()

    expectStartWith(location, server.url + path + '?upload_id=')

    await server.videos.endVideoResumableUpload({ path, pathUploadId: location.split('?')[1] })
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
    resumableChunkSize?: number
  }) {
    const { token, pathUploadId, expectedStatus, contentLength, contentRangeBuilder, digestBuilder, resumableChunkSize } = options

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
      resumableChunkSize,
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
      await sendChunks({
        pathUploadId: uploadId,
        size: 8 * 1024,
        resumableChunkSize: 8 * 1024,
        expectedStatus: HttpStatusCode.UNPROCESSABLE_ENTITY_422
      })

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

    it('Should build the upload URL from the configured webserver URL, not from the request headers', async function () {
      await checkUploadLocationUsesWebserverUrl()
    })

    it('Should store the upload with the extension of its mimetype, not the one of the client filename', async function () {
      this.timeout(60000)

      // FFmpeg picks some demuxers from the file extension
      const uploadId = await prepareUpload({ fixture: 'playlist.m3u8', size: await buildSize(defaultFixture) })
      await checkFileSize(uploadId, 0)

      const res = await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.OK_200 })
      await checkFileSize(uploadId, null)

      await waitJobs([ server ])

      const video = await server.videos.get({ id: res.body.video.uuid })
      expect(video.files).to.have.length.above(0)
    })

    it('Should not accept more chunks than expected', async function () {
      const uploadId = await prepareUpload({ size: 100 })

      await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.CONFLICT_409 })
      await checkFileSize(uploadId, 0)
    })

    it('Should not accept more chunks than expected with an invalid content length/content range', async function () {
      // Sometimes the server answers 409, and sometimes 400 :shrug:
      this.retries(3)

      const uploadId = await prepareUpload({ size: 1500 })

      try {
        await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.CONFLICT_409, contentLength: 1000 })
      } catch (err) {
        await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.BAD_REQUEST_400, contentLength: 1000 })
      }

      await checkFileSize(uploadId, 0)
    })

    it('Should not accept more chunks than expected with an invalid content length', async function () {
      // Sometimes the server answers 409, and sometimes 400 :shrug:
      this.retries(3)

      const uploadId = await prepareUpload({ size: 500 })

      const size = 1000

      const contentRangeBuilder = (start: number) => `bytes ${start}-${start + size - 1}/${size}`

      try {
        await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.CONFLICT_409, contentRangeBuilder, contentLength: size })
      } catch (err) {
        await sendChunks({
          pathUploadId: uploadId,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400,
          contentRangeBuilder,
          contentLength: size
        })
      }

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

  describe('Init request metadata', function () {
    // Uploadx saves the init request body as upload metadata, that the server trusts when the upload completes

    async function readUploadMetadata (uploadIdArg: string) {
      const uploadId = uploadIdArg.replace(/^upload_id=/, '')
      const metaPath = server.servers.buildDirectory(join('tmp', 'resumable-uploads', `${uploadId}.META`))

      return JSON.parse(await readFile(metaPath, 'utf-8')).metadata
    }

    it('Should only keep expected fields in the upload metadata', async function () {
      const uploadId = await prepareUpload({
        fields: {
          description: 'my description',
          unknownField: 'a'.repeat(1000),
          stagingKey: 'resumable-uploads/other-user-upload'
        }
      })

      const metadata = await readUploadMetadata(uploadId)

      expect(metadata.name).to.equal('video')
      expect(metadata.description).to.equal('my description')
      expect(metadata.filename).to.equal(defaultFixture)

      expect(metadata).to.not.have.property('unknownField')
      expect(metadata).to.not.have.property('stagingKey')

      await server.videos.endVideoResumableUpload({ path, pathUploadId: uploadId })
    })

    it('Should not use and delete a server file referenced by the client as a thumbnail or preview', async function () {
      this.timeout(60000)

      const victimPath = server.servers.buildDirectory(join('tmp', 'resumable-upload-victim.jpg'))
      await copy(buildAbsoluteFixturePath('custom-thumbnail-1920x1080.jpg'), victimPath)

      const injectedImages = [
        { fieldname: 'thumbnailfile', originalname: 'thumbnail.jpg', mimetype: 'image/jpeg', path: victimPath, size: 1 }
      ]

      const uploadId = await prepareUpload({ fields: { thumbnailfile: injectedImages, previewfile: injectedImages } })

      const metadata = await readUploadMetadata(uploadId)
      expect(metadata).to.not.have.property('thumbnailfile')
      expect(metadata).to.not.have.property('previewfile')

      await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.OK_200 })
      await waitJobs([ server ])

      expect(await pathExists(victimPath)).to.be.true

      await remove(victimPath)
    })

    it('Should not build the upload metadata from the query string of a non JSON init request', async function () {
      await server.config.enableUserImport()

      const importPath = `/api/v1/users/${rootId}/imports/import-resumable`
      const query = new URLSearchParams({ filename: 'export.zip', stagingKey: 'user-imports/other-user-upload', unknownField: 'a' })

      const res = await fetch(server.url + importPath + '?' + query.toString(), {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + server.accessToken,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Upload-Content-Type': 'application/zip',
          'X-Upload-Content-Length': '1000'
        },
        body: new URLSearchParams({ filename: 'export.zip' }).toString()
      })
      expect(res.status).to.equal(HttpStatusCode.CREATED_201)

      // The location keeps the query string of the init request
      const uploadId = 'upload_id=' + new URL(res.headers.get('location')).searchParams.get('upload_id')
      const metadata = await readUploadMetadata(uploadId)

      expect(metadata.filename).to.equal('export.zip')
      expect(metadata).to.not.have.property('stagingKey')
      expect(metadata).to.not.have.property('unknownField')

      await server.videos.endVideoResumableUpload({ path: importPath, pathUploadId: uploadId })
      await server.config.disableUserImport()
    })
  })

  describe('With object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()
    const stagingPrefix = 'staging/resumable-uploads/'

    // The upload is cleaned up after the response is sent
    async function listStagingKeysOf (uploadIdArg: string, waitMs?: number) {
      if (waitMs) await wait(waitMs)

      const uploadId = uploadIdArg.replace(/^upload_id=/, '')
      const bucket = objectStorage.getMockStagingBucketName()

      const keys = [
        ...await objectStorage.listMockObjectKeys(bucket, stagingPrefix),
        ...await objectStorage.listMockMultipartUploadKeys(bucket, stagingPrefix)
      ]

      return keys.filter(k => k.includes(uploadId))
    }

    before(async function () {
      this.timeout(120000)

      await objectStorage.prepareDefaultMockBuckets()

      await server.kill()
      await server.run(objectStorage.getDefaultMockConfig())

      await server.users.update({ userId: rootId, videoQuota: -1 })
    })

    it('Should advertise a min chunk size', async function () {
      const config = await server.config.getConfig()

      expect(config.client.videos.resumableUpload.minChunkSize).to.equal(16 * 1024 * 1024)
      expect(config.import.users.resumableUpload.minChunkSize).to.equal(16 * 1024 * 1024)
    })

    it('Should build the upload URL from the configured webserver URL, not from the request headers', async function () {
      await checkUploadLocationUsesWebserverUrl()
    })

    it('Should refuse a non final chunk smaller than the min chunk size', async function () {
      const size = await buildSize(defaultFixture)
      const uploadId = await prepareUpload()

      const res = await fetch(server.url + path + '?' + uploadId, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + server.accessToken,
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes 0-1023/${size}`,
          'Content-Length': '1024'
        },
        body: Buffer.alloc(1024)
      })

      expect(res.status).to.equal(HttpStatusCode.BAD_REQUEST_400)

      await server.videos.endVideoResumableUpload({ path, pathUploadId: uploadId })
    })

    it('Should upload a video in a single chunk without leaving local files', async function () {
      this.timeout(60000)

      const before = await countResumableUploads()

      const uploadId = await prepareUpload()
      await sendChunks({ pathUploadId: uploadId })

      expect(await countResumableUploads()).to.equal(before)
      expect(await listStagingKeysOf(uploadId, 2000)).to.have.lengthOf(0)
    })

    it('Should upload a video with metadata bigger than the S3 user metadata limit', async function () {
      this.timeout(60000)

      // S3 caps user metadata at 2KB, and URI encoding makes non ASCII characters bigger
      const description = 'é'.repeat(5000)

      const uploadId = await prepareUpload({ fields: { description }, expectedStatus: HttpStatusCode.CREATED_201 })
      const res = await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.OK_200 })

      const video = await server.videos.get({ id: res.body.video.uuid })
      expect(video.description).to.equal(description)

      expect(await listStagingKeysOf(uploadId, 2000)).to.have.lengthOf(0)
    })

    it('Should not leave a local copy of a refused upload', async function () {
      const before = await countResumableUploads()

      const uploadId = await prepareUpload({ size: 8 * 1024 })
      await sendChunks({
        pathUploadId: uploadId,
        size: 8 * 1024,
        resumableChunkSize: 8 * 1024,
        expectedStatus: HttpStatusCode.UNPROCESSABLE_ENTITY_422
      })

      expect(await countResumableUploads(2000)).to.equal(before)
    })

    describe('Staged thumbnail and preview', function () {
      const imagesPrefix = 'staging/resumable-uploads/images/'

      function listStagedImages () {
        return objectStorage.listMockObjectKeys(objectStorage.getMockStagingBucketName(), imagesPrefix)
      }

      // The upload id is built from the last modified date of the file (default to now)
      function prepareUploadWithThumbnail (lastModified?: number) {
        return prepareUpload({
          lastModified,
          fields: { name: 'video with a staged thumbnail' },
          attaches: { thumbnailfile: buildAbsoluteFixturePath('custom-thumbnail-input.jpg') }
        })
      }

      it('Should not keep the local path of the staged images in the upload metadata', async function () {
        const uploadId = await prepareUploadWithThumbnail()

        // The local path is only valid on the host of the process that received the init request
        const metaKey = 'staging/resumable-uploads/' + uploadId.replace(/^upload_id=/, '') + '.META'
        const meta = JSON.parse(await objectStorage.getMockObjectContent(objectStorage.getMockStagingBucketName(), metaKey))

        const thumbnail = meta.metadata.thumbnailfile[0]
        expectStartWith(thumbnail.stagingKey, 'resumable-uploads/images/')
        expect(thumbnail).to.not.have.property('path')

        await server.videos.endVideoResumableUpload({ path, pathUploadId: uploadId })
      })

      it('Should remove the staged images of a cancelled upload', async function () {
        const uploadId = await prepareUploadWithThumbnail()
        expect(await listStagedImages()).to.have.lengthOf(1)

        await server.videos.endVideoResumableUpload({ path, pathUploadId: uploadId })
        expect(await listStagedImages()).to.have.lengthOf(0)
      })

      it('Should remove the images staged by an init request that resumes an existing upload', async function () {
        const lastModified = Date.now()
        const uploadId = await prepareUploadWithThumbnail(lastModified)

        // For example because the client didn't get the first response
        expect(await prepareUploadWithThumbnail(lastModified)).to.equal(uploadId)
        expect(await listStagedImages()).to.have.lengthOf(1)

        await server.videos.endVideoResumableUpload({ path, pathUploadId: uploadId })
        expect(await listStagedImages()).to.have.lengthOf(0)
      })

      it('Should use a staged thumbnail and remove it', async function () {
        this.timeout(60000)

        const before = await countResumableUploads()

        const uploadId = await prepareUploadWithThumbnail()
        const res = await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.OK_200 })

        await waitJobs([ server ])

        const { thumbnails } = await server.videos.get({ id: res.body.video.uuid })
        const thumbnail = thumbnails.find(t => t.width === 280 && t.height === 157)
        await testImage({ name: 'custom-thumbnail-280x157.jpg', url: thumbnail.fileUrl })

        expect(await countResumableUploads(2000)).to.equal(before)
        expect(await listStagedImages()).to.have.lengthOf(0)
      })
    })

    describe('With a plugin that needs the uploaded file locally', function () {
      // The plugin refuses the file if it's not on the local disk
      const pluginName = 'test-upload-file'

      before(async function () {
        this.timeout(60000)

        await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-upload-file') })
        await server.config.enableFileUpdate()
      })

      it('Should give the plugin a local copy of an uploaded file', async function () {
        this.timeout(60000)

        const before = await countResumableUploads()

        await server.videos.upload({
          attributes: { name: 'video checked by a plugin', fixture: defaultFixture },
          mode: 'resumable'
        })

        expect(await countResumableUploads()).to.equal(before)
      })

      it('Should let the plugin refuse an uploaded file and remove its local copy', async function () {
        this.timeout(60000)

        const before = await countResumableUploads()

        const uploadId = await prepareUpload({ originalName: 'rejected-by-plugin.mp4' })
        await sendChunks({ pathUploadId: uploadId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })

        expect(await countResumableUploads(2000)).to.equal(before)
        expect(await listStagingKeysOf(uploadId, 2000)).to.have.lengthOf(0)
      })

      it('Should give the plugin a local copy of a replaced file', async function () {
        this.timeout(120000)

        const { uuid } = await server.videos.quickUpload({ name: 'video with a replaced file' })
        await waitJobs([ server ])

        const before = await countResumableUploads()

        await server.videos.replaceSourceFile({ videoId: uuid, fixture: 'video_short_360p.mp4' })
        await waitJobs([ server ])

        expect(await countResumableUploads(2000)).to.equal(before)
      })

      after(async function () {
        await server.plugins.uninstall({ npmName: 'peertube-plugin-' + pluginName })
        await server.config.disableFileUpdate()
      })
    })

    describe('User import', function () {
      const fixture = 'export-without-videos.zip'

      let content: Buffer
      let userId: number
      let token: string
      let importPath: string

      before(async function () {
        this.timeout(60000)

        content = await readFile(buildAbsoluteFixturePath(fixture))

        await server.config.enableUserImport()

        const user = await server.users.generate('user_import_resent_chunk')
        userId = user.userId
        token = user.token
        importPath = `/api/v1/users/${userId}/imports/import-resumable`
      })

      it('Should refuse the last chunk sent again once the import is created', async function () {
        this.timeout(120000)

        const res = await server.videos.prepareVideoResumableUpload({
          path: importPath,
          token,
          fixture,
          size: content.length,
          mimetype: 'application/zip'
        })
        const uploadId = res.header['location'].split('?')[1]

        // The whole archive in a single (last) chunk
        const putLastChunk = () => {
          return fetch(server.url + importPath + '?' + uploadId, {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/octet-stream',
              'Content-Range': `bytes 0-${content.length - 1}/${content.length}`,
              'Content-Length': content.length + ''
            },
            body: Buffer.from(content)
          })
        }

        const first = await putLastChunk()
        expect(first.status).to.equal(HttpStatusCode.OK_200)
        const { userImport } = await first.json()

        // For example because the client didn't get the first response: it must not create another import
        const second = await putLastChunk()
        expect(second.status).to.equal(HttpStatusCode.NOT_FOUND_404)

        await waitJobs([ server ])

        const latest = await server.userImports.getLatestImport({ userId, token })
        expect(latest.id).to.equal(userImport.id)
        expect(latest.state.id).to.equal(UserImportState.COMPLETED)

        // The staged archive and the upload meta are removed
        const bucket = objectStorage.getMockStagingBucketName()
        expect(await objectStorage.listMockObjectKeys(bucket, 'staging/user-imports/')).to.have.lengthOf(0)
        expect(await objectStorage.listMockMultipartUploadKeys(bucket, 'staging/user-imports/')).to.have.lengthOf(0)
      })

      after(async function () {
        await server.config.disableUserImport()
      })
    })

    describe('With web videos on the file system', function () {
      before(async function () {
        this.timeout(120000)

        // Staging is still enabled for user imports
        await server.kill()
        await server.run(objectStorage.getDefaultMockConfig({ disabledTypes: [ 'web_videos' ] }))
      })

      it('Should only advertise a min chunk size for user imports', async function () {
        const config = await server.config.getConfig()

        expect(config.client.videos.resumableUpload.minChunkSize).to.equal(0)
        expect(config.import.users.resumableUpload.minChunkSize).to.equal(16 * 1024 * 1024)
      })

      it('Should upload a video in small chunks', async function () {
        this.timeout(60000)

        const uploadId = await prepareUpload()
        await sendChunks({ pathUploadId: uploadId, resumableChunkSize: 8 * 1024, expectedStatus: HttpStatusCode.OK_200 })
      })
    })

    describe('With several chunks', function () {
      // ~13MB: 3 chunks
      const chunkSize = 5 * 1024 * 1024

      let fixture: string

      let content: Buffer

      async function putChunk (options: {
        uploadId: string
        start: number
        expectedStatus: HttpStatusCodeType
        expectedRange?: string
      }) {
        const { uploadId, start, expectedStatus, expectedRange } = options

        const chunk = Buffer.from(content.subarray(start, Math.min(start + chunkSize, content.length)))

        const res = await fetch(server.url + path + '?' + uploadId, {
          method: 'PUT',
          // 308 is the "resume incomplete" status of resumable uploads, not a redirection
          redirect: 'manual',
          headers: {
            'Authorization': 'Bearer ' + server.accessToken,
            'Content-Type': 'application/octet-stream',
            'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${content.length}`,
            'Content-Length': chunk.length + ''
          },
          body: chunk
        })

        expect(res.status).to.equal(expectedStatus)
        if (expectedRange) expect(res.headers.get('range')).to.equal(expectedRange)

        return res
      }

      // Object storage last modified dates have a 1 second precision
      function waitMoreThanOneSecond () {
        return wait(1500)
      }

      async function checkSourceIsFixture (videoUUID: string) {
        const source = await server.videos.getSource({ id: videoUUID })
        const { body } = await makeRawRequest({
          url: source.fileDownloadUrl,
          token: server.accessToken,
          redirects: 1,
          expectedStatus: HttpStatusCode.OK_200
        })

        expect(body).to.have.lengthOf(content.length)
        expect(sha1(body)).to.equal(sha1(content))
      }

      function removeDanglingUploads () {
        return server.debug.sendCommand({ body: { command: 'remove-dandling-resumable-uploads' } })
      }

      before(async function () {
        this.timeout(120000)

        fixture = await generateHighBitrateVideo()
        content = await readFile(fixture)

        await server.kill()
        await server.run({
          ...objectStorage.getDefaultMockConfig(),

          client: {
            videos: {
              resumable_upload: {
                max_chunk_size: '5MB'
              }
            }
          }
        })

        await server.config.enableMinimumTranscoding({ hls: false, keepOriginal: true })
      })

      it('Should advertise the configured chunk size', async function () {
        const config = await server.config.getConfig()

        expect(config.client.videos.resumableUpload.minChunkSize).to.equal(chunkSize)
      })

      it('Should upload a video in several chunks, ignoring already received and out of order chunks', async function () {
        this.timeout(120000)

        const uploadId = await prepareUpload({ fixture })

        await putChunk({ uploadId, start: 0, expectedStatus: HttpStatusCode.PERMANENT_REDIRECT_308 })

        // Sent again, for example because the response was lost: it's not appended to the file
        await putChunk({
          uploadId,
          start: 0,
          expectedStatus: HttpStatusCode.PERMANENT_REDIRECT_308,
          expectedRange: `bytes=0-${chunkSize - 1}`
        })

        // A gap: it's not written either
        await putChunk({
          uploadId,
          start: 2 * chunkSize,
          expectedStatus: HttpStatusCode.PERMANENT_REDIRECT_308,
          expectedRange: `bytes=0-${chunkSize - 1}`
        })

        await putChunk({
          uploadId,
          start: chunkSize,
          expectedStatus: HttpStatusCode.PERMANENT_REDIRECT_308,
          expectedRange: `bytes=0-${2 * chunkSize - 1}`
        })

        const res = await putChunk({ uploadId, start: 2 * chunkSize, expectedStatus: HttpStatusCode.OK_200 })
        const { video } = await res.json()

        await waitJobs([ server ])
        await checkSourceIsFixture(video.uuid)

        expect(await listStagingKeysOf(uploadId, 2000)).to.have.lengthOf(0)
      })

      it('Should upload a video when a chunk is still being received while the next ones arrive', async function () {
        this.timeout(120000)

        const uploadId = await prepareUpload({ fixture })

        // A slow request of the first chunk, for example on a bad connection: the client gives up and sends the chunk again
        const firstChunk = content.subarray(0, chunkSize)
        let sendEndOfSlowChunk: () => void
        const endOfSlowChunkSent = new Promise<void>(res => {
          sendEndOfSlowChunk = res
        })

        const slowChunkRes = fetch(server.url + path + '?' + uploadId, {
          method: 'PUT',
          redirect: 'manual',
          headers: {
            'Authorization': 'Bearer ' + server.accessToken,
            'Content-Type': 'application/octet-stream',
            'Content-Range': `bytes 0-${chunkSize - 1}/${content.length}`,
            'Content-Length': chunkSize + ''
          },
          body: new ReadableStream({
            async start (controller) {
              controller.enqueue(firstChunk.subarray(0, chunkSize / 2))
              await endOfSlowChunkSent
              controller.enqueue(firstChunk.subarray(chunkSize / 2))
              controller.close()
            }
          }),
          duplex: 'half'
        } as RequestInit)

        await wait(1000)

        // Sent again, then the next chunk, while the slow request is still uploading its part
        const otherChunksRes = Promise.all([
          putChunk({ uploadId, start: 0, expectedStatus: HttpStatusCode.PERMANENT_REDIRECT_308 }),
          wait(3000).then(() => putChunk({ uploadId, start: chunkSize, expectedStatus: HttpStatusCode.PERMANENT_REDIRECT_308 }))
        ])

        await wait(5000)
        sendEndOfSlowChunk()

        expect((await slowChunkRes).status).to.equal(HttpStatusCode.PERMANENT_REDIRECT_308)
        await otherChunksRes

        // The slow request must not have overwritten the upload state with its outdated one
        const res = await putChunk({ uploadId, start: 2 * chunkSize, expectedStatus: HttpStatusCode.OK_200 })
        const { video } = await res.json()

        await waitJobs([ server ])
        await checkSourceIsFixture(video.uuid)
      })

      it('Should not purge an upload that is still receiving chunks', async function () {
        this.timeout(120000)

        await removeDanglingUploads()
        await waitMoreThanOneSecond()

        const uploadId = await prepareUpload({ fixture })
        await waitMoreThanOneSecond()

        // Purges uploads not updated since the previous run: this one was created after it
        await removeDanglingUploads()
        await waitMoreThanOneSecond()

        await putChunk({ uploadId, start: 0, expectedStatus: HttpStatusCode.PERMANENT_REDIRECT_308 })
        await waitMoreThanOneSecond()

        // This upload was created before the previous run, but it received a chunk since
        await removeDanglingUploads()

        await putChunk({ uploadId, start: chunkSize, expectedStatus: HttpStatusCode.PERMANENT_REDIRECT_308 })
        await putChunk({ uploadId, start: 2 * chunkSize, expectedStatus: HttpStatusCode.OK_200 })

        await waitJobs([ server ])
      })

      it('Should purge the staging files of an inactive upload', async function () {
        this.timeout(120000)

        const uploadId = await prepareUpload({ fixture })
        await putChunk({ uploadId, start: 0, expectedStatus: HttpStatusCode.PERMANENT_REDIRECT_308 })

        expect(await listStagingKeysOf(uploadId)).to.have.length.above(0)

        await waitMoreThanOneSecond()
        await removeDanglingUploads()
        await waitMoreThanOneSecond()

        // No chunk received since the previous run
        await removeDanglingUploads()

        expect(await listStagingKeysOf(uploadId)).to.have.lengthOf(0)

        await putChunk({ uploadId, start: chunkSize, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })

      it('Should require the configured chunk size, even above the default one', async function () {
        this.timeout(120000)

        await server.kill()
        await server.run({
          ...objectStorage.getDefaultMockConfig(),

          client: {
            videos: {
              resumable_upload: {
                max_chunk_size: '90MB'
              }
            }
          }
        })

        const config = await server.config.getConfig()
        expect(config.client.videos.resumableUpload.minChunkSize).to.equal(90 * 1024 * 1024)
      })
    })

    after(async function () {
      await objectStorage.cleanupMock()
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
