/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { wait } from '@peertube/peertube-core-utils'
import {
  ActorImageType,
  HttpStatusCode,
  UserImportState,
  UserImportStateType,
  VideoPlaylistPrivacy,
  VideoPrivacy
} from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled, buildAbsoluteFixturePath, sha1 } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  makeDeleteRequest,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs,
  waitUntilLivePublishedOnAllServers
} from '@peertube/peertube-server-commands'
import { expectStartWith, testImage } from '@tests/shared/checks.js'
import { generateHighBitrateVideo } from '@tests/shared/generate.js'
import { expect } from 'chai'
import { pathExists } from 'fs-extra/esm'
import { chmod, readdir, readFile } from 'fs/promises'
import { join } from 'path'

// Storage directories of the files referenced by the database, that a secondary can share with the primary
const sharedDirectories = {
  avatars: 'avatars',
  web_videos: 'web-videos',
  streaming_playlists: 'streaming-playlists',
  original_video_files: 'original-video-files',
  previews: 'previews',
  thumbnails: 'thumbnails',
  storyboards: 'storyboards',
  torrents: 'torrents',
  captions: 'captions',
  uploads: 'uploads',
  tmp_persistent: 'tmp-persistent'
}

// Secondaries share the storage directories of the primary by default
function buildNotSharedStorageConfig (primary: PeerTubeServer, keys = Object.keys(sharedDirectories)) {
  const storage: Record<string, string> = {}

  for (const key of keys) {
    storage[key] = primary.getDirectoryPath(sharedDirectories[key] + '-not-shared') + '/'
  }

  return { storage }
}

async function expectSecondaryToRefuseToStart (primary: PeerTubeServer, configOverride: object, port: number) {
  let started: PeerTubeServer
  let error: Error

  try {
    started = await createSecondaryServer(primary, { ...configOverride, listen: { port } })
  } catch (err) {
    error = err as Error
  }

  if (started) await started.kill()

  expect(error, 'the secondary process should not have started').to.exist

  return error.message
}

async function waitUntilPathIsRemoved (path: string) {
  for (let i = 0; i < 60; i++) {
    if (!await pathExists(path)) return

    await wait(250)
  }

  expect(await pathExists(path), `${path} should have been removed`).to.be.false
}

// When the job queue of the primary is paused, waitJobs() would also wait for the jobs only the primary consumes
async function waitUntilImportEnds (server: PeerTubeServer, options: { userId: number, token: string }) {
  let state: UserImportStateType

  for (let i = 0; i < 120; i++) {
    state = (await server.userImports.getLatestImport(options)).state.id
    if (state === UserImportState.COMPLETED || state === UserImportState.ERRORED) return state

    await wait(500)
  }

  return state
}

describe('Test file management by a secondary server process', function () {
  describe('Secondary process sharing the storage directories of the primary', function () {
    let primary: PeerTubeServer
    let secondary: PeerTubeServer

    let userToken: string

    before(async function () {
      this.timeout(240000)

      primary = await createSingleServer(1)

      await setAccessTokensToServers([ primary ])
      await setDefaultVideoChannel([ primary ])

      await primary.config.enableTranscoding({ webVideo: true, hls: true, resolutions: [ 240 ] })

      userToken = await primary.users.generateUserAndToken('user_files')

      secondary = await createSecondaryServer(primary)
    })

    it('Should publish the status of the files in the debug endpoint of the primary', async function () {
      const { sharedFiles } = await primary.debug.getDebug()

      expect(sharedFiles.sections.thumbnails.inObjectStorage).to.be.false
      expect(sharedFiles.sections.thumbnails.reasons.join(' ')).to.contain('object_storage.thumbnails.enabled')
    })

    it('Should update and delete my avatar on the secondary', async function () {
      await secondary.users.updateMyAvatar({ fixture: 'avatar.png', token: userToken })

      const me = await primary.users.getMyInfo({ token: userToken })
      expect(me.account.avatars).to.have.length.above(0)

      for (const avatar of me.account.avatars) {
        await makeRawRequest({ url: avatar.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      await makeDeleteRequest({
        url: secondary.url,
        path: '/api/v1/users/me/avatar',
        token: userToken,
        expectedStatus: HttpStatusCode.OK_200
      })

      const updated = await primary.users.getMyInfo({ token: userToken })
      expect(updated.account.avatars).to.have.lengthOf(0)

      for (const avatar of me.account.avatars) {
        await makeRawRequest({ url: avatar.fileUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      }
    })

    it('Should update the avatar and the banner of a channel on the secondary', async function () {
      const channelName = primary.store.channel.name

      await secondary.channels.updateImage({ channelName, type: 'avatar' })
      await secondary.channels.updateImage({ channelName, type: 'banner' })

      const channel = await primary.channels.get({ channelName })
      expect(channel.avatars).to.have.length.above(0)
      expect(channel.banners).to.have.length.above(0)

      for (const image of [ ...channel.avatars, ...channel.banners ]) {
        await makeRawRequest({ url: image.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should update the instance images on the secondary', async function () {
      await secondary.config.updateInstanceImage({ type: ActorImageType.BANNER, fixture: 'banner.jpg' })
      await secondary.config.updateInstanceLogo({ type: 'favicon', fixture: 'avatar.png' })

      const config = await primary.config.getConfig()

      expect(config.instance.banners).to.have.length.above(0)
      for (const banner of config.instance.banners) {
        await makeRawRequest({ url: banner.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      const logos = config.instance.logo.filter(l => !l.isFallback)
      expect(logos).to.have.length.above(0)
      for (const logo of logos) {
        await makeRawRequest({ url: logo.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should create a playlist with a thumbnail on the secondary', async function () {
      const { uuid } = await secondary.playlists.create({
        attributes: {
          displayName: 'playlist of the secondary',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          thumbnailfile: 'custom-thumbnail.png',
          videoChannelId: primary.store.channel.id
        }
      })

      const playlist = await primary.playlists.get({ playlistId: uuid })
      expect(playlist.thumbnails).to.have.length.above(0)

      for (const thumbnail of playlist.thumbnails) {
        await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      await secondary.playlists.delete({ playlistId: uuid })
      await primary.playlists.get({ playlistId: uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should publish a private video and change its thumbnail on the secondary', async function () {
      this.timeout(120000)

      const { uuid } = await primary.videos.quickUpload({ name: 'private video', privacy: VideoPrivacy.PRIVATE })
      await waitJobs([ primary ])

      const privateHLSDirectory = primary.getDirectoryPath(join('streaming-playlists', 'hls', 'private', uuid))
      const publicHLSDirectory = primary.getDirectoryPath(join('streaming-playlists', 'hls', uuid))

      expect(await pathExists(privateHLSDirectory)).to.be.true

      await secondary.videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC, thumbnailfile: 'custom-thumbnail.png' } })
      await waitJobs([ primary ])

      // The secondary moved the files of the primary
      expect(await pathExists(privateHLSDirectory)).to.be.false
      expect(await pathExists(publicHLSDirectory)).to.be.true

      const video = await primary.videos.get({ id: uuid })
      expect(video.privacy.id).to.equal(VideoPrivacy.PUBLIC)

      for (const thumbnail of video.thumbnails) {
        await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      for (const file of [ ...video.files, ...video.streamingPlaylists[0].files ]) {
        expect(file.fileUrl).to.not.contain('/private/')
        await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      await makeRawRequest({ url: video.streamingPlaylists[0].playlistUrl, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should add and delete a caption on the secondary', async function () {
      this.timeout(120000)

      const { uuid } = await primary.videos.quickUpload({ name: 'video with captions' })
      await waitJobs([ primary ])

      await secondary.captions.add({ videoId: uuid, language: 'ar', fixture: 'subtitle-good2.vtt' })

      {
        const { data } = await primary.captions.list({ videoId: uuid })
        expect(data).to.have.lengthOf(1)

        await makeRawRequest({ url: data[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        await makeRawRequest({ url: data[0].m3u8Url, expectedStatus: HttpStatusCode.OK_200 })

        const video = await primary.videos.get({ id: uuid })
        const { text } = await makeRawRequest({ url: video.streamingPlaylists[0].playlistUrl, expectedStatus: HttpStatusCode.OK_200 })

        expect(text).to.contain('TYPE=SUBTITLES')
        expect(text).to.contain('LANGUAGE="ar"')
      }

      await secondary.captions.delete({ videoId: uuid, language: 'ar' })

      {
        const { data } = await primary.captions.list({ videoId: uuid })
        expect(data).to.have.lengthOf(0)

        const video = await primary.videos.get({ id: uuid })
        const { text } = await makeRawRequest({ url: video.streamingPlaylists[0].playlistUrl, expectedStatus: HttpStatusCode.OK_200 })

        expect(text).to.not.contain('TYPE=SUBTITLES')
      }
    })

    it('Should delete a video on the secondary', async function () {
      this.timeout(120000)

      const { uuid } = await primary.videos.quickUpload({ name: 'video deleted by the secondary' })
      await waitJobs([ primary ])

      const video = await primary.videos.get({ id: uuid })
      const hlsDirectory = primary.getDirectoryPath(join('streaming-playlists', 'hls', uuid))
      const webVideoPath = primary.getDirectoryPath(join('web-videos', video.files[0].fileUrl.split('/').pop()))

      expect(await pathExists(hlsDirectory)).to.be.true
      expect(await pathExists(webVideoPath)).to.be.true

      await secondary.videos.remove({ id: uuid })
      await primary.videos.get({ id: uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      await waitUntilPathIsRemoved(hlsDirectory)
      await waitUntilPathIsRemoved(webVideoPath)
    })

    it('Should delete a user and its videos on the secondary', async function () {
      this.timeout(120000)

      const { userId, token } = await primary.users.generate('user_to_delete')
      const { uuid } = await primary.videos.quickUpload({ name: 'video of a deleted user', token })
      await waitJobs([ primary ])

      const hlsDirectory = primary.getDirectoryPath(join('streaming-playlists', 'hls', uuid))
      expect(await pathExists(hlsDirectory)).to.be.true

      await secondary.users.remove({ userId })

      await primary.videos.get({ id: uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await waitUntilPathIsRemoved(hlsDirectory)
    })

    it('Should remove the export archive of a user deleted on the secondary', async function () {
      this.timeout(120000)

      const { userId } = await primary.users.generate('user_with_export')

      await primary.userExports.request({ userId, withVideoFiles: false })
      await primary.userExports.waitForCreation({ userId })

      const listArchives = async () => {
        const files = await readdir(primary.getDirectoryPath('tmp-persistent'))

        return files.filter(f => f.startsWith(`user-export-${userId}-`))
      }

      const archives = await listArchives()
      expect(archives).to.have.lengthOf(1)

      await secondary.users.remove({ userId })

      await waitUntilPathIsRemoved(primary.getDirectoryPath(join('tmp-persistent', archives[0])))
    })

    it('Should import on the secondary a user archive uploaded to the primary', async function () {
      this.timeout(120000)

      const { userId, token } = await primary.users.generate('user_import_shared')

      // Only the secondary can process the import job
      await primary.jobs.pauseJobQueue({ processRoles: [ 'primary' ] })

      try {
        // Without object storage staging, the archive can only be uploaded to the primary
        // Then the job runs on the secondary, that shares its persistent temporary directory
        await primary.userImports.importArchive({ userId, token, fixture: 'export-without-videos.zip' })

        expect(await waitUntilImportEnds(primary, { userId, token })).to.equal(UserImportState.COMPLETED)
      } finally {
        await primary.jobs.resumeJobQueue()
      }

      await waitJobs([ primary ])

      await primary.channels.get({ channelName: 'noah_super_channel' })
    })

    it('Should pause and resume the job queue of all the processes by default', async function () {
      this.timeout(120000)

      const { userId, token } = await primary.users.generate('user_import_paused')

      await primary.jobs.pauseJobQueue()

      try {
        await primary.userImports.importArchive({ userId, token, fixture: 'export-without-videos.zip' })
        await wait(3000)

        const userImport = await primary.userImports.getLatestImport({ userId, token })
        expect(userImport.state.id).to.equal(UserImportState.PENDING)
      } finally {
        await primary.jobs.resumeJobQueue()
      }

      await waitJobs([ primary ])

      const userImport = await primary.userImports.getLatestImport({ userId, token })
      expect(userImport.state.id).to.equal(UserImportState.COMPLETED)
    })

    it('Should refuse to start a secondary process that does not share a storage directory', async function () {
      this.timeout(60000)

      const message = await expectSecondaryToRefuseToStart(
        primary,
        buildNotSharedStorageConfig(primary, [ 'thumbnails' ]),
        primary.port + 10010
      )

      expect(message).to.contain('cannot reach the files of the primary process')
      expect(message).to.contain('thumbnails and previews')
      expect(message).to.contain('storage.thumbnails')
      expect(message).to.not.contain('storage.previews')
      expect(message).to.not.contain('storage.avatars')
    })

    after(async function () {
      await cleanupTests([ secondary, primary ])
    })
  })

  describe('Secondary process that does not share the storage directories of the primary', function () {
    let primary: PeerTubeServer

    before(async function () {
      this.timeout(120000)

      primary = await createSingleServer(1)
      await setAccessTokensToServers([ primary ])
    })

    it('Should refuse to start a secondary process that cannot reach the files', async function () {
      this.timeout(60000)

      const message = await expectSecondaryToRefuseToStart(primary, buildNotSharedStorageConfig(primary), primary.port + 10020)

      expect(message).to.contain('cannot reach the files of the primary process')

      for (
        const label of [
          'avatars and banners',
          'thumbnails and previews',
          'web video files',
          'HLS video files',
          'captions',
          'user exports'
        ]
      ) {
        expect(message).to.contain(label)
      }
    })

    after(async function () {
      await cleanupTests([ primary ])
    })
  })

  describe('Secondary process with files in object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    let primary: PeerTubeServer
    let secondary: PeerTubeServer

    function buildObjectStorageConfig (options: { storeLiveStreams?: boolean } = {}) {
      return objectStorage.getDefaultMockConfig({
        enabledOptionalTypes: [ 'avatars', 'thumbnails', 'storyboards', 'torrents', 'uploads' ],
        storeLiveStreams: options.storeLiveStreams
      })
    }

    before(async function () {
      this.timeout(240000)

      await objectStorage.prepareDefaultMockBuckets()

      // Live streams kept on the file system of the primary don't prevent secondaries from managing files
      primary = await createSingleServer(1, {
        ...buildObjectStorageConfig({ storeLiveStreams: false }),

        live: { enabled: true },

        // Several resumable upload chunks with a small fixture
        client: { videos: { resumable_upload: { max_chunk_size: '5MB' } } }
      })

      await setAccessTokensToServers([ primary ])
      await setDefaultVideoChannel([ primary ])

      await primary.config.enableTranscoding({ webVideo: true, hls: true, resolutions: [ 240 ] })

      // Its storage directories are not shared: everything is in object storage
      secondary = await createSecondaryServer(primary, buildNotSharedStorageConfig(primary))
    })

    it('Should store new video files in object storage right away', async function () {
      this.timeout(120000)

      const { uuid } = await primary.videos.quickUpload({ name: 'video in object storage', privacy: VideoPrivacy.PRIVATE })
      await waitJobs([ primary ])

      const video = await primary.videos.getWithToken({ id: uuid })

      for (const file of video.files) {
        expectStartWith(file.fileUrl, primary.url + '/object-storage-proxy/web-videos/')
      }

      for (const file of video.streamingPlaylists[0].files) {
        expectStartWith(file.fileUrl, primary.url + '/object-storage-proxy/streaming-playlists/')
      }

      // Nothing on the file system of the primary
      expect(await pathExists(primary.getDirectoryPath(join('streaming-playlists', 'hls', 'private', uuid)))).to.be.false
    })

    it('Should manage the files of a video on the secondary', async function () {
      this.timeout(120000)

      const { uuid } = await primary.videos.quickUpload({ name: 'video managed by the secondary', privacy: VideoPrivacy.PRIVATE })
      await waitJobs([ primary ])

      await secondary.videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC, thumbnailfile: 'custom-thumbnail.png' } })
      await secondary.captions.add({ videoId: uuid, language: 'ar', fixture: 'subtitle-good2.vtt' })
      await waitJobs([ primary ])

      const video = await primary.videos.get({ id: uuid })

      for (const thumbnail of video.thumbnails) {
        expectStartWith(thumbnail.fileUrl, objectStorage.getMockThumbnailsBaseUrl())
        await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      // Public files are served by the object storage, not proxified anymore
      for (const file of video.files) {
        expectStartWith(file.fileUrl, objectStorage.getMockWebVideosBaseUrl())
        await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      const { data: captions } = await primary.captions.list({ videoId: uuid })
      expect(captions).to.have.lengthOf(1)
      expectStartWith(captions[0].fileUrl, objectStorage.getMockCaptionFileBaseUrl())

      const { text } = await makeRawRequest({ url: video.streamingPlaylists[0].playlistUrl, expectedStatus: HttpStatusCode.OK_200 })
      expect(text).to.contain('TYPE=SUBTITLES')

      await secondary.videos.remove({ id: uuid })
      await waitJobs([ primary ])

      await makeRawRequest({ url: video.files[0].fileUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should receive the chunks of a resumable upload on the primary and the secondary', async function () {
      this.timeout(120000)

      const path = '/api/v1/videos/upload-resumable'
      const fixture = await generateHighBitrateVideo() // ~13MB: 3 chunks
      const chunkSize = 5 * 1024 * 1024
      const content = await readFile(fixture)

      await primary.config.keepSourceFile()

      const res = await primary.videos.prepareVideoResumableUpload({
        path,
        fixture,
        fields: { name: 'video uploaded to several processes', channelId: primary.store.channel.id, privacy: VideoPrivacy.PUBLIC },
        size: content.length,
        mimetype: 'video/mp4'
      })
      const uploadId = res.header['location'].split('?')[1]

      // Each process must resume from the chunks received by the other one
      const processes = [ primary, secondary, primary ]
      let lastResponse: Response

      for (let i = 0; i < processes.length; i++) {
        const start = i * chunkSize
        const chunk = Buffer.from(content.subarray(start, Math.min(start + chunkSize, content.length)))
        const isLast = start + chunk.length === content.length

        lastResponse = await fetch(processes[i].url + path + '?' + uploadId, {
          method: 'PUT',
          // 308 is the "resume incomplete" status of resumable uploads, not a redirection
          redirect: 'manual',
          headers: {
            'Authorization': 'Bearer ' + primary.accessToken,
            'Content-Type': 'application/octet-stream',
            'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${content.length}`,
            'Content-Length': chunk.length + ''
          },
          body: chunk
        })

        expect(lastResponse.status, `chunk ${i}`).to.equal(isLast ? HttpStatusCode.OK_200 : HttpStatusCode.PERMANENT_REDIRECT_308)
      }

      const { video } = await lastResponse.json()
      await waitJobs([ primary ])

      // The kept original file is the uploaded one
      const source = await primary.videos.getSource({ id: video.uuid })
      const { body } = await makeRawRequest({
        url: source.fileDownloadUrl,
        token: primary.accessToken,
        redirects: 1,
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(body).to.have.lengthOf(content.length)
      expect(sha1(body)).to.equal(sha1(content))

      await primary.config.updateExistingConfig({ newConfig: { transcoding: { originalFile: { keep: false } } } })
      await primary.videos.remove({ id: video.uuid })
    })

    it('Should use the thumbnail sent to the primary when the secondary receives the last chunk', async function () {
      this.timeout(120000)

      const path = '/api/v1/videos/upload-resumable'
      const fixture = 'video_short.mp4'
      const content = await readFile(buildAbsoluteFixturePath(fixture))

      // The thumbnail is written on the disk of the primary, that receives the upload init request
      const res = await primary.videos.prepareVideoResumableUpload({
        path,
        fixture,
        attaches: { thumbnailfile: buildAbsoluteFixturePath('custom-thumbnail-input.jpg') },
        fields: {
          name: 'video with a thumbnail uploaded to several processes',
          channelId: primary.store.channel.id,
          privacy: VideoPrivacy.PUBLIC
        },
        size: content.length,
        mimetype: 'video/mp4'
      })
      const uploadId = res.header['location'].split('?')[1]

      // The whole file in a single (last) chunk, received by the secondary
      const lastResponse = await fetch(secondary.url + path + '?' + uploadId, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + primary.accessToken,
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes 0-${content.length - 1}/${content.length}`,
          'Content-Length': content.length + ''
        },
        body: Buffer.from(content)
      })
      expect(lastResponse.status).to.equal(HttpStatusCode.OK_200)

      const { video } = await lastResponse.json()
      await waitJobs([ primary ])

      const { thumbnails } = await primary.videos.get({ id: video.uuid })
      const thumbnail = thumbnails.find(t => t.width === 280 && t.height === 157)
      await testImage({ name: 'custom-thumbnail-280x157.jpg', url: thumbnail.fileUrl })

      const bucket = objectStorage.getMockStagingBucketName()
      expect(await objectStorage.listMockObjectKeys(bucket, 'staging/resumable-uploads/images/')).to.have.lengthOf(0)

      await primary.videos.remove({ id: video.uuid })
    })

    it('Should use the thumbnail sent to the secondary when the primary receives the last chunk', async function () {
      this.timeout(120000)

      const path = '/api/v1/videos/upload-resumable'
      const fixture = 'video_short.mp4'
      const content = await readFile(buildAbsoluteFixturePath(fixture))

      // The thumbnail is written in the tmp directory of the secondary, that the primary must not use
      const res = await secondary.videos.prepareVideoResumableUpload({
        path,
        token: primary.accessToken,
        fixture,
        attaches: { thumbnailfile: buildAbsoluteFixturePath('custom-thumbnail-input.jpg') },
        fields: {
          name: 'video with a thumbnail sent to the secondary',
          channelId: primary.store.channel.id,
          privacy: VideoPrivacy.PUBLIC
        },
        size: content.length,
        mimetype: 'video/mp4'
      })
      const uploadId = res.header['location'].split('?')[1]

      // Like a secondary on another host: the primary cannot write in the tmp directory of the secondary
      const secondaryTmpDirectory = primary.getDirectoryPath('tmp-secondary')
      await chmod(secondaryTmpDirectory, 0o555)

      let lastResponse: Response

      try {
        lastResponse = await fetch(primary.url + path + '?' + uploadId, {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + primary.accessToken,
            'Content-Type': 'application/octet-stream',
            'Content-Range': `bytes 0-${content.length - 1}/${content.length}`,
            'Content-Length': content.length + ''
          },
          body: Buffer.from(content)
        })
      } finally {
        await chmod(secondaryTmpDirectory, 0o755)
      }

      expect(lastResponse.status).to.equal(HttpStatusCode.OK_200)

      const { video } = await lastResponse.json()
      await waitJobs([ primary ])

      const { thumbnails } = await primary.videos.get({ id: video.uuid })
      const thumbnail = thumbnails.find(t => t.width === 280 && t.height === 157)
      await testImage({ name: 'custom-thumbnail-280x157.jpg', url: thumbnail.fileUrl })

      const bucket = objectStorage.getMockStagingBucketName()
      expect(await objectStorage.listMockObjectKeys(bucket, 'staging/resumable-uploads/images/')).to.have.lengthOf(0)

      await primary.videos.remove({ id: video.uuid })
    })

    it('Should import on the secondary a user archive staged in object storage', async function () {
      this.timeout(120000)

      const { userId, token } = await primary.users.generate('user_import_staged')

      // Only the secondary can process the import job
      await primary.jobs.pauseJobQueue({ processRoles: [ 'primary' ] })

      try {
        await secondary.userImports.importArchive({
          userId,
          token,
          fixture: 'export-without-videos.zip'
        })

        expect(await waitUntilImportEnds(secondary, { userId, token })).to.equal(UserImportState.COMPLETED)

        await secondary.channels.get({ channelName: 'noah_super_channel' })

        const bucket = objectStorage.getMockStagingBucketName()
        const stagingPrefix = 'staging/user-imports/'

        expect(await objectStorage.listMockObjectKeys(bucket, stagingPrefix)).to.have.lengthOf(0)
        expect(await objectStorage.listMockMultipartUploadKeys(bucket, stagingPrefix)).to.have.lengthOf(0)
      } finally {
        await primary.jobs.resumeJobQueue()
      }

      await waitJobs([ primary ])
    })

    it('Should delete on the secondary a live kept on the file system of the primary', async function () {
      this.timeout(120000)

      const { video: { uuid } } = await primary.live.quickCreate({ saveReplay: false, permanentLive: false })

      const ffmpegCommand = await primary.live.sendRTMPStreamInVideo({ videoId: uuid })
      await waitUntilLivePublishedOnAllServers([ primary ], uuid)

      const liveDirectory = primary.getDirectoryPath(join('streaming-playlists', 'hls', uuid))
      expect(await pathExists(liveDirectory)).to.be.true

      await secondary.videos.remove({ id: uuid })
      await stopFfmpeg(ffmpegCommand)

      // The primary stops the live and removes its files (the video-live-ending job runs after a delay)
      await waitJobs([ primary ])
      await waitUntilPathIsRemoved(liveDirectory)
    })

    it('Should log errors while files are moved to the file system', async function () {
      this.timeout(120000)

      const { uuid } = await primary.videos.quickUpload({ name: 'video moved to the file system' })
      await waitJobs([ primary ])

      await primary.cli.execWithEnv(`npm run create-move-file-storage-job -- --to-file-system -v ${uuid}`, buildObjectStorageConfig())
      await waitJobs([ primary ])

      await secondary.servers.waitUntilLog('cannot reach the files of the primary process anymore', 1, false)
      await secondary.servers.waitUntilLog('web video files: .*still on the file system', 1, false)

      await primary.cli.execWithEnv(`npm run create-move-file-storage-job -- --to-object-storage -v ${uuid}`, buildObjectStorageConfig())
      await waitJobs([ primary ])

      await secondary.servers.waitUntilLog('can reach the files of the primary process again', 1, false)
    })

    it('Should detect local files that are still on the file system', async function () {
      this.timeout(240000)

      await secondary.kill()
      await primary.kill()

      // Upload a video while object storage is disabled
      await primary.run({ export: { users: { enabled: false } } })

      const { uuid } = await primary.videos.quickUpload({ name: 'video on the file system' })
      await waitJobs([ primary ])

      await primary.kill()
      await primary.run(buildObjectStorageConfig())

      {
        const { sharedFiles } = await primary.debug.getDebug()

        for (const section of [ 'web_videos', 'streaming_playlists', 'thumbnails', 'torrents' ]) {
          expect(sharedFiles.sections[section].inObjectStorage, section).to.be.false
          expect(sharedFiles.sections[section].reasons.join(' '), section).to.contain('still on the file system')
        }

        const message = await expectSecondaryToRefuseToStart(primary, buildNotSharedStorageConfig(primary), primary.port + 10030)
        expect(message).to.contain('create-move-file-storage-job')
      }

      await primary.cli.execWithEnv(
        `npm run create-move-file-storage-job -- --to-object-storage -v ${uuid}`,
        buildObjectStorageConfig()
      )
      await waitJobs([ primary ])

      {
        const { sharedFiles } = await primary.debug.getDebug()

        for (const section of Object.keys(sharedFiles.sections)) {
          expect(sharedFiles.sections[section].inObjectStorage, section).to.be.true
        }
      }

      secondary = await createSecondaryServer(primary, buildNotSharedStorageConfig(primary))
      await secondary.videos.remove({ id: uuid })
    })

    after(async function () {
      await objectStorage.cleanupMock()

      await cleanupTests([ secondary, primary ])
    })
  })
})
