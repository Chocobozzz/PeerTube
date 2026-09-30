/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { wait } from '@peertube/peertube-core-utils'
import {
  ActorImageType,
  HttpStatusCode,
  RunnerJobState,
  RunnerJobStudioTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPayload,
  UserImportState,
  UserImportStateType,
  VideoImportState,
  VideoPlaylistPrivacy,
  VideoPrivacy,
  VideoStudioTask,
  VideoStudioTaskIntro,
  VideoStudioTranscodingSuccess
} from '@peertube/peertube-models'
import {
  areHttpImportTestsDisabled,
  areMockObjectStorageTestsDisabled,
  buildAbsoluteFixturePath,
  sha1
} from '@peertube/peertube-node-utils'
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
import { checkVideoDuration, expectStartWith, testImage } from '@tests/shared/checks.js'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { generateHighBitrateVideo } from '@tests/shared/generate.js'
import { expect } from 'chai'
import { pathExists, remove } from 'fs-extra/esm'
import { chmod, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

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

async function waitUntilUrlIsRemoved (url: string) {
  for (let i = 0; i < 60; i++) {
    const { status } = await makeRawRequest({ url, expectedStatus: null })
    if (status === HttpStatusCode.NOT_FOUND_404) return

    await wait(250)
  }

  await makeRawRequest({ url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
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

// Process through the secondary, like a remote runner, the first web video transcoding job of a video uploaded to the primary
async function processRunnerJobOnSecondary (options: {
  primary: PeerTubeServer
  secondary: PeerTubeServer
  runnerToken: string
  videoUUID: string
}) {
  const { primary, secondary, runnerToken, videoUUID } = options

  const { availableJobs } = await secondary.runnerJobs.requestVOD({ runnerToken })
  const available = availableJobs.find(j => j.type === 'vod-web-video-transcoding' && JSON.stringify(j.payload).includes(videoUUID))
  expect(available, 'the primary should have created a web video transcoding job').to.exist

  const { job } = await secondary.runnerJobs.accept<RunnerJobVODWebVideoTranscodingPayload>({ runnerToken, jobUUID: available.uuid })
  const { jobToken } = job

  // The primary builds the URLs of the input files with its own host
  const videoFileUrl = job.payload.input.videoFileUrl.replace(primary.url, secondary.url)

  const { body: videoFile } = await secondary.runnerJobs.getJobFile({ url: videoFileUrl, jobToken, runnerToken })
  expect(videoFile).to.deep.equal(await readFile(buildAbsoluteFixturePath('video_short.webm')))

  const previewUrl = videoFileUrl.replace(/\/max-quality$/, '/previews/max-quality')
  const { body: preview } = await secondary.runnerJobs.getJobFile({ url: previewUrl, jobToken, runnerToken })
  expect(preview.length).to.be.above(0)

  await secondary.runnerJobs.success({ runnerToken, jobUUID: job.uuid, jobToken, payload: { videoFile: 'video_short.mp4' } })

  const completed = await primary.runnerJobs.getJob({ uuid: job.uuid })
  expect(completed.state.id).to.equal(RunnerJobState.COMPLETED)

  // The file sent by the runner replaced the input file
  const video = await primary.videos.get({ id: videoUUID })
  const file = video.files.find(f => f.resolution.id === job.payload.output.resolution)

  const { body } = await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  expect(body).to.deep.equal(await readFile(buildAbsoluteFixturePath('video_short.mp4')))
}

const studioTasks: VideoStudioTask[] = [
  { name: 'add-intro', options: { file: 'video_very_short_240p.mp4' } },
  { name: 'add-watermark', options: { file: 'custom-thumbnail.png' } }
]

// Edit a video on `editServer`, then process the studio job through the secondary like a remote runner
async function processStudioRunnerJobOnSecondary (options: {
  primary: PeerTubeServer
  secondary: PeerTubeServer
  editServer: PeerTubeServer
  runnerToken: string
}) {
  const { primary, secondary, editServer, runnerToken } = options

  const { uuid } = await primary.videos.quickUpload({ name: 'video edited through the secondary' })
  await waitJobs([ primary ])

  await editServer.videoStudio.createEditionTasks({ videoId: uuid, tasks: studioTasks })

  const { availableJobs } = await secondary.runnerJobs.request({ runnerToken })
  const available = availableJobs.find(j => j.type === 'video-studio-transcoding')
  expect(available, 'a studio transcoding job should have been created').to.exist

  const { job } = await secondary.runnerJobs.accept<RunnerJobStudioTranscodingPayload>({ runnerToken, jobUUID: available.uuid })
  const { jobToken } = job

  for (let i = 0; i < studioTasks.length; i++) {
    const url = ((job.payload.tasks[i] as VideoStudioTaskIntro).options.file as string).replace(primary.url, editServer.url)

    const { body } = await editServer.runnerJobs.getJobFile({ url, jobToken, runnerToken })
    expect(body).to.deep.equal(await readFile(buildAbsoluteFixturePath((studioTasks[i] as VideoStudioTaskIntro).options.file as string)))
  }

  const payload: VideoStudioTranscodingSuccess = { videoFile: 'video_very_short_240p.mp4' }
  await secondary.runnerJobs.success({ runnerToken, jobUUID: job.uuid, jobToken, payload })

  expect((await primary.runnerJobs.getJob({ uuid: job.uuid })).state.id).to.equal(RunnerJobState.COMPLETED)

  await waitJobs([ primary ])
  await checkVideoDuration(primary, uuid, 2)
}

async function disableRemoteTranscoding (primary: PeerTubeServer) {
  await primary.runnerJobs.cancelAllJobs()

  await primary.config.updateExistingConfig({
    newConfig: {
      transcoding: { remoteRunners: { enabled: false } },
      live: { transcoding: { remoteRunners: { enabled: false } } },
      videoStudio: { remoteRunners: { enabled: false } }
    }
  })
}

describe('Test file management by a secondary server process', function () {
  describe('Secondary process without object storage', function () {
    let primary: PeerTubeServer

    before(async function () {
      this.timeout(120000)

      primary = await createSingleServer(1)
      await setAccessTokensToServers([ primary ])
    })

    it('Should refuse to start a secondary process that cannot reach the files', async function () {
      this.timeout(60000)

      const message = await expectSecondaryToRefuseToStart(primary, {}, primary.port + 10020)

      expect(message).to.contain('cannot reach the files of the primary process')

      expect(message).to.contain('object storage is not enabled (object_storage.enabled)')

      expect(message).to.not.contain('avatars and banners')
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

    let userToken: string

    function listStagedKeys (subPrefix: string) {
      return objectStorage.listMockObjectKeys(objectStorage.getMockStagingBucketName(), 'staging/' + subPrefix)
    }

    function buildObjectStorageConfig (options: { storeLiveStreams?: boolean } = {}) {
      return objectStorage.getDefaultMockConfig({ storeLiveStreams: options.storeLiveStreams })
    }

    before(async function () {
      this.timeout(240000)

      await objectStorage.prepareDefaultMockBuckets()

      // Live streams kept on the file system of the primary don't prevent secondaries from managing files
      primary = await createSingleServer(1, {
        ...buildObjectStorageConfig({ storeLiveStreams: false }),

        live: { enabled: true },

        // Several resumable upload chunks with a small fixture
        client: { videos: { resumable_upload: { max_chunk_size: '5MB' } } },

        import: { videos: { http: { cookies: { enabled: true } } } }
      })

      await setAccessTokensToServers([ primary ])
      await setDefaultVideoChannel([ primary ])

      await primary.config.enableTranscoding({ webVideo: true, hls: true, resolutions: [ 240 ] })

      userToken = await primary.users.generateUserAndToken('user_files')

      secondary = await createSecondaryServer(primary)
    })

    it('Should store new video files in object storage', async function () {
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

    it('Should update and delete my avatar on the secondary', async function () {
      await secondary.users.updateMyAvatar({ fixture: 'avatar.png', token: userToken })

      const me = await primary.users.getMyInfo({ token: userToken })
      expect(me.account.avatars).to.have.length.above(0)

      for (const avatar of me.account.avatars) {
        expectStartWith(avatar.fileUrl, objectStorage.getMockActorImagesBaseUrl())
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
        expectStartWith(image.fileUrl, objectStorage.getMockActorImagesBaseUrl())
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
        expectStartWith(logo.fileUrl, objectStorage.getMockUploadsBaseUrl())
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
        expectStartWith(thumbnail.fileUrl, objectStorage.getMockThumbnailsBaseUrl())
        await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      await secondary.playlists.delete({ playlistId: uuid })
      await primary.playlists.get({ playlistId: uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      for (const thumbnail of playlist.thumbnails) {
        await waitUntilUrlIsRemoved(thumbnail.fileUrl)
      }
    })

    it('Should delete the source file of a video on the secondary', async function () {
      this.timeout(120000)

      await primary.config.keepSourceFile()

      try {
        const { uuid } = await primary.videos.quickUpload({ name: 'video with a source file deleted by the secondary' })
        await waitJobs([ primary ])

        const bucket = objectStorage.getMockOriginalFileBucketName()
        const keysBefore = await objectStorage.listMockObjectKeys(bucket)

        expect((await primary.videos.getSource({ id: uuid })).fileDownloadUrl).to.exist

        await secondary.videos.deleteSource({ id: uuid })

        expect((await primary.videos.getSource({ id: uuid })).fileDownloadUrl).to.not.exist
        expect(await objectStorage.listMockObjectKeys(bucket)).to.have.lengthOf(keysBefore.length - 1)
      } finally {
        await primary.config.updateExistingConfig({ newConfig: { transcoding: { originalFile: { keep: false } } } })
      }
    })

    it('Should delete a user and its videos on the secondary', async function () {
      this.timeout(120000)

      const { userId, token } = await primary.users.generate('user_to_delete')
      const { uuid } = await primary.videos.quickUpload({ name: 'video of a deleted user', token })
      await waitJobs([ primary ])

      const video = await primary.videos.get({ id: uuid })

      await secondary.users.remove({ userId })

      await primary.videos.get({ id: uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await waitUntilUrlIsRemoved(video.streamingPlaylists[0].playlistUrl)
      await waitUntilUrlIsRemoved(video.files[0].fileUrl)
    })

    it('Should remove the export archive of a user deleted on the secondary', async function () {
      this.timeout(120000)

      const { userId } = await primary.users.generate('user_with_export')

      await primary.userExports.request({ userId, withVideoFiles: false })
      await primary.userExports.waitForCreation({ userId })

      const listArchives = () => objectStorage.listMockObjectKeys(objectStorage.getMockUserExportBucketName(), `user-export-${userId}-`)

      expect(await listArchives()).to.have.lengthOf(1)

      await secondary.users.remove({ userId })

      for (let i = 0; i < 60 && (await listArchives()).length !== 0; i++) {
        await wait(250)
      }

      expect(await listArchives()).to.have.lengthOf(0)
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

    it('Should upload a video with the legacy endpoint on the secondary', async function () {
      this.timeout(120000)

      const { uuid } = await secondary.videos.quickUpload({ name: 'legacy upload in object storage' })
      await waitJobs([ primary ])

      const video = await primary.videos.get({ id: uuid })

      for (const file of video.files) {
        expectStartWith(file.fileUrl, objectStorage.getMockWebVideosBaseUrl())
        await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      for (const file of video.streamingPlaylists[0].files) {
        expectStartWith(file.fileUrl, objectStorage.getMockPlaylistBaseUrl())
        await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should delete the files of a video in object storage on the secondary', async function () {
      this.timeout(120000)

      const { uuid } = await primary.videos.quickUpload({ name: 'video files in object storage deleted by the secondary' })
      await waitJobs([ primary ])

      const video = await primary.videos.get({ id: uuid })

      const metadata = await secondary.videos.getFileMetadata({ url: video.files[0].metadataUrl.replace(primary.url, secondary.url) })
      expect(metadata.streams).to.not.have.lengthOf(0)

      await secondary.videos.removeHLSPlaylist({ videoId: uuid })
      await makeRawRequest({ url: video.streamingPlaylists[0].playlistUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      const lowest = video.files.find(f => f.resolution.id === 240)

      await secondary.videos.removeWebVideoFile({ videoId: uuid, fileId: lowest.id })
      await makeRawRequest({ url: lowest.fileUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should process on the secondary a remote runner job of the primary', async function () {
      this.timeout(120000)

      await primary.config.enableRemoteTranscoding()
      const runnerToken = await primary.runners.autoRegisterRunner()

      try {
        const { uuid } = await primary.videos.quickUpload({ name: 'video in object storage transcoded through the secondary' })
        await waitJobs([ primary ])

        await processRunnerJobOnSecondary({ primary, secondary, runnerToken, videoUUID: uuid })
      } finally {
        await disableRemoteTranscoding(primary)
      }
    })

    it('Should download the files of a video in object storage on the secondary', async function () {
      this.timeout(60000)

      const { uuid } = await primary.videos.quickUpload({ name: 'video in object storage downloaded on the secondary' })
      await waitJobs([ primary ])

      const video = await primary.videos.get({ id: uuid })
      const file = video.files[0]

      const download = (url: string) =>
        makeRawRequest({ url, responseType: 'arraybuffer', redirects: 1, expectedStatus: HttpStatusCode.OK_200 })

      const { body } = await download(file.fileDownloadUrl.replace(primary.url, secondary.url))
      expect(body).to.deep.equal((await download(file.fileDownloadUrl)).body)

      await download(file.torrentDownloadUrl.replace(primary.url, secondary.url))

      const generated = await secondary.videos.generateDownload({ videoId: uuid, videoFileIds: [ file.id ] })
      expect(generated.length).to.be.above(0)
    })

    it('Should edit a video with studio task files staged by the secondary', async function () {
      this.timeout(120000)

      await primary.config.enableStudio()

      const { uuid } = await primary.videos.quickUpload({ name: 'video edited with staged task files' })
      await waitJobs([ primary ])

      // Only the primary runs the edition job: check the task files wait for it in staging
      await primary.jobs.pauseJobQueue({ processRoles: [ 'primary' ] })

      try {
        await secondary.videoStudio.createEditionTasks({ videoId: uuid, tasks: studioTasks })

        expect(await listStagedKeys('video-studio/')).to.have.lengthOf(studioTasks.length)
      } finally {
        await primary.jobs.resumeJobQueue()
      }

      await waitJobs([ primary ])

      await checkVideoDuration(primary, uuid, 7)
      expect(await listStagedKeys('video-studio/')).to.have.lengthOf(0)
    })

    it('Should process on the secondary a remote studio runner job with staged task files', async function () {
      this.timeout(120000)

      await primary.config.enableStudio()
      await primary.config.enableRemoteStudio()
      const runnerToken = await primary.runners.autoRegisterRunner()

      try {
        await processStudioRunnerJobOnSecondary({ primary, secondary, editServer: secondary, runnerToken })

        expect(await listStagedKeys('video-studio/')).to.have.lengthOf(0)
      } finally {
        await disableRemoteTranscoding(primary)
      }
    })

    it('Should import on the primary a torrent file staged by the secondary', async function () {
      if (areHttpImportTestsDisabled()) return

      this.timeout(120000)

      // Only the primary runs the import job: check the torrent file waits for it in staging
      await primary.jobs.pauseJobQueue({ processRoles: [ 'primary' ] })

      let videoId: number

      try {
        const { video } = await secondary.videoImports.importVideo({
          attributes: { privacy: VideoPrivacy.PUBLIC, torrentfile: 'video-720p.torrent' }
        })
        videoId = video.id

        expect(await listStagedKeys('video-imports/')).to.have.lengthOf(1)
      } finally {
        await primary.jobs.resumeJobQueue()
      }

      await waitJobs([ primary ])

      const { data } = await primary.videoImports.listMyVideoImports({ videoId })
      expect(data[0].state.id).to.equal(VideoImportState.SUCCESS)

      expect(await listStagedKeys('video-imports/')).to.have.lengthOf(0)
    })

    it('Should use on the secondary the yt-dlp cookies file of the primary', async function () {
      if (areHttpImportTestsDisabled()) return

      this.timeout(120000)

      const cookies = '# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t4102444800\tpeertube_test_cookie\tvalue\n'
      await writeFile(primary.getDirectoryPath(join('tmp-persistent', 'youtube-cookies.txt')), cookies)

      try {
        // The primary polls the cookies file
        await wait(4000)

        await secondary.videoImports.importVideo({ attributes: { privacy: VideoPrivacy.PUBLIC, targetUrl: FIXTURE_URLS.goodVideo } })
        await waitJobs([ primary ])

        // The secondary has its own persistent temporary directory: it uses its own copy
        const secondaryCookies = await readFile(primary.getDirectoryPath(join('tmp-secondary', 'youtube-cookies.txt')), 'utf8')
        expect(secondaryCookies).to.contain('peertube_test_cookie')
      } finally {
        await remove(primary.getDirectoryPath(join('tmp-persistent', 'youtube-cookies.txt')))
      }
    })

    it('Should stop using on the secondary a cookies file removed while the primary was stopped', async function () {
      if (areHttpImportTestsDisabled()) return

      this.timeout(120000)

      const cookiesPath = primary.getDirectoryPath(join('tmp-persistent', 'youtube-cookies.txt'))
      const missingCookiesLog = /yt-dlp cookies are enabled but the cookies file .* does not exist/g

      const countMissingCookiesLogs = async () => {
        const logs = await readFile(primary.getDirectoryPath(join('logs-secondary', 'peertube.log')), 'utf8')

        return logs.match(missingCookiesLog)?.length ?? 0
      }

      await writeFile(cookiesPath, '# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t4102444800\tpeertube_test_cookie\tvalue\n')

      // The primary polls the cookies file
      await wait(4000)

      const primaryConfig = primary.configOverride

      await primary.kill()
      await remove(cookiesPath)
      await primary.run(primaryConfig)

      const logsBefore = await countMissingCookiesLogs()

      await secondary.videoImports.importVideo({ attributes: { privacy: VideoPrivacy.PUBLIC, targetUrl: FIXTURE_URLS.goodVideo } })
      await waitJobs([ primary ])

      expect(await countMissingCookiesLogs()).to.be.above(logsBefore)
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
        const message = await expectSecondaryToRefuseToStart(primary, {}, primary.port + 10030)
        expect(message).to.not.contain('object_storage.enabled')

        for (const label of [ 'web video files', 'HLS video files', 'thumbnails and previews', 'torrents' ]) {
          expect(message).to.contain(`${label}: some of them are still on the file system`)
        }

        expect(message).to.contain('create-move-file-storage-job')
      }

      await primary.cli.execWithEnv(
        `npm run create-move-file-storage-job -- --to-object-storage -v ${uuid}`,
        buildObjectStorageConfig()
      )
      await waitJobs([ primary ])

      secondary = await createSecondaryServer(primary)
      await secondary.videos.remove({ id: uuid })
    })

    after(async function () {
      await objectStorage.cleanupMock()

      await cleanupTests([ secondary, primary ])
    })
  })
})
