/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { getAllFiles } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoInclude, VideoPrivacy } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  ObjectStorageCommand,
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow, makeGetRequest,
  makeRawRequest,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { checkDirectoryIsEmpty } from '@tests/shared/directories.js'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { checkSourceFile } from '@tests/shared/videos.js'
import { expect } from 'chai'

describe('Test video source management', function () {
  let servers: PeerTubeServer[] = []

  let replaceDate: Date
  let userToken: string
  let uuid: string

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await setDefaultAccountAvatar(servers)

    await servers[0].config.enableFileUpdate()
    await servers[0].config.enableMinimumTranscoding()

    userToken = await servers[0].users.generateUserAndToken('user1')

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  describe('Getting latest video source', () => {
    const fixture1 = 'video_short.webm'
    const fixture2 = 'video_short1.webm'

    const uuids: string[] = []

    it('Should get the source filename with legacy upload with disabled keep original file', async function () {
      this.timeout(30000)

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'my video', fixture: fixture1 }, mode: 'legacy' })
      uuids.push(uuid)

      await waitJobs(servers)

      const source = await servers[0].videos.getSource({ id: uuid })
      expect(source.filename).to.equal(fixture1)
      expect(source.inputFilename).to.equal(fixture1)
      expect(source.fileDownloadUrl).to.be.null

      expect(source.createdAt).to.exist
      expect(source.fps).to.equal(25)
      expect(source.height).to.equal(720)
      expect(source.width).to.equal(1280)
      expect(source.resolution.id).to.equal(720)
      expect(source.size).to.equal(218910)

      expect(source.metadata?.format).to.exist
      expect(source.metadata?.streams).to.be.an('array')

      await checkDirectoryIsEmpty(servers[0], 'original-video-files')
    })

    it('Should get the source filename with resumable upload and enabled keep original file', async function () {
      this.timeout(30000)

      await servers[0].config.keepSourceFile()

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'my video', fixture: fixture2 }, mode: 'resumable' })
      uuids.push(uuid)

      await waitJobs(servers)

      const source = await servers[0].videos.getSource({ id: uuid })
      expect(source.filename).to.equal(fixture2)
      expect(source.inputFilename).to.equal(fixture2)
      expect(source.fileDownloadUrl).to.exist

      expect(source.createdAt).to.exist
      expect(source.fps).to.equal(25)
      expect(source.height).to.equal(720)
      expect(source.width).to.equal(1280)
      expect(source.resolution.id).to.equal(720)
      expect(source.size).to.equal(572456)

      expect(source.metadata?.format).to.exist
      expect(source.metadata?.streams).to.be.an('array')
    })

    it('Should include video source file when listing videos in admin', async function () {
      const { total, data } = await servers[0].videos.listAllForAdmin({ include: VideoInclude.SOURCE, sort: 'publishedAt' })
      expect(total).to.equal(2)
      expect(data).to.have.lengthOf(2)

      expect(data[0].videoSource).to.exist
      expect(data[0].videoSource.inputFilename).to.equal(fixture1)
      expect(data[0].videoSource.fileDownloadUrl).to.be.null

      expect(data[1].videoSource).to.exist
      expect(data[1].videoSource.inputFilename).to.equal(fixture2)
      expect(data[1].videoSource.fileDownloadUrl).to.exist
    })

    it('Should have kept original video file', async function () {
      await checkSourceFile({ server: servers[0], fsCount: 1, fixture: fixture2, uuid: uuids[uuids.length - 1] })
    })

    it('Should transcode a file but do not replace original file', async function () {
      await servers[0].videos.runTranscoding({ transcodingType: 'web-video', videoId: uuids[0] })
      await servers[0].videos.runTranscoding({ transcodingType: 'web-video', videoId: uuids[1] })

      await checkSourceFile({ server: servers[0], fsCount: 1, fixture: fixture2, uuid: uuids[uuids.length - 1] })
    })

    it('Should also keep audio files', async function () {
      const fixture = 'sample.ogg'
      const { uuid } = await servers[0].videos.quickUpload({ name: 'audio', fixture })
      uuids.push(uuid)

      await waitJobs(servers)
      const source = await checkSourceFile({ server: servers[0], fsCount: 2, fixture, uuid })

      expect(source.createdAt).to.exist
      expect(source.fps).to.equal(0)
      expect(source.height).to.equal(0)
      expect(source.width).to.equal(0)
      expect(source.resolution.id).to.equal(0)
      expect(source.resolution.label).to.equal('Audio only')
      expect(source.size).to.equal(105243)

      expect(source.metadata?.format).to.exist
      expect(source.metadata?.streams).to.be.an('array')
    })

    it('Should delete video source file', async function () {
      await servers[0].videos.deleteSource({ id: uuids[uuids.length - 1] })

      const { total, data } = await servers[0].videos.listAllForAdmin({ include: VideoInclude.SOURCE, sort: 'publishedAt' })
      expect(total).to.equal(3)
      expect(data).to.have.lengthOf(3)

      expect(data[0].videoSource).to.exist
      expect(data[0].videoSource.inputFilename).to.equal(fixture1)
      expect(data[0].videoSource.fileDownloadUrl).to.be.null

      expect(data[1].videoSource).to.exist
      expect(data[1].videoSource.inputFilename).to.equal(fixture2)
      expect(data[1].videoSource.fileDownloadUrl).to.exist

      expect(data[2].videoSource).to.exist

      expect(data[2].videoSource.fileDownloadUrl).to.not.exist

      expect(data[2].videoSource.createdAt).to.exist
      expect(data[2].videoSource.fps).to.to.exist
      expect(data[2].videoSource.height).to.to.exist
      expect(data[2].videoSource.width).to.to.exist
      expect(data[2].videoSource.resolution.id).to.to.exist
      expect(data[2].videoSource.resolution.label).to.to.exist
      expect(data[2].videoSource.size).to.to.exist
      expect(data[2].videoSource.metadata).to.to.exist
    })

    it('Should delete all videos and do not have original files anymore', async function () {
      this.timeout(60000)

      for (const uuid of uuids) {
        await servers[0].videos.remove({ id: uuid })
      }

      await waitJobs(servers)

      await checkDirectoryIsEmpty(servers[0], 'original-video-files')
    })

    it('Should not have source on import', async function () {
      const { video: { uuid } } = await servers[0].videoImports.importVideo({
        attributes: {
          channelId: servers[0].store.channel.id,
          targetUrl: FIXTURE_URLS.goodVideo,
          privacy: VideoPrivacy.PUBLIC
        }
      })

      await waitJobs(servers)

      await servers[0].videos.getSource({ id: uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await checkDirectoryIsEmpty(servers[0], 'original-video-files')
    })
  })

  describe('Updating video source', function () {

    describe('Filesystem', function () {

      it('Should replace a video file with transcoding disabled', async function () {
        this.timeout(120000)

        await servers[0].config.disableTranscoding()

        const { uuid } = await servers[0].videos.quickUpload({ name: 'fs without transcoding', fixture: 'video_short_720p.mp4' })
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })

          const files = getAllFiles(video)
          expect(files).to.have.lengthOf(1)
          expect(files[0].resolution.id).to.equal(720)
        }

        await servers[0].videos.replaceSourceFile({ videoId: uuid, fixture: 'video_short_360p.mp4' })
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })

          const files = getAllFiles(video)
          expect(files).to.have.lengthOf(1)
          expect(files[0].resolution.id).to.equal(360)
        }
      })

      it('Should not have kept original video file', async function () {
        await checkDirectoryIsEmpty(servers[0], 'original-video-files')
      })

      it('Should replace a video file with transcoding enabled', async function () {
        this.timeout(240000)

        const previousPaths: string[] = []

        await servers[0].config.enableTranscoding({ hls: true, webVideo: true, with0p: true, keepOriginal: true, resolutions: 'max' })

        const uploadFixture = 'video_short_720p.mp4'
        const { uuid: videoUUID } = await servers[0].videos.quickUpload({ name: 'fs with transcoding', fixture: uploadFixture })
        uuid = videoUUID

        await waitJobs(servers)

        await checkSourceFile({ server: servers[0], fsCount: 1, uuid, fixture: uploadFixture })

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })
          expect(video.inputFileUpdatedAt).to.be.null

          const files = getAllFiles(video)
          expect(files).to.have.lengthOf(6 * 2)

          // Grab old paths to ensure we'll regenerate

          previousPaths.push(video.previewPath)
          previousPaths.push(video.thumbnailPath)

          for (const file of files) {
            previousPaths.push(file.fileUrl)
            previousPaths.push(file.torrentUrl)
            previousPaths.push(file.metadataUrl)

            const metadata = await server.videos.getFileMetadata({ url: file.metadataUrl })
            previousPaths.push(JSON.stringify(metadata))
          }

          const { storyboards } = await server.storyboard.list({ id: uuid })
          for (const s of storyboards) {
            previousPaths.push(s.storyboardPath)
          }
        }

        replaceDate = new Date()

        const replaceFixture = 'video_short_360p.mp4'
        await servers[0].videos.replaceSourceFile({ videoId: uuid, fixture: replaceFixture })
        await waitJobs(servers)

        const source = await checkSourceFile({ server: servers[0], fsCount: 1, uuid, fixture: replaceFixture })

        expect(source.createdAt).to.exist
        expect(source.fps).to.equal(25)
        expect(source.height).to.equal(360)
        expect(source.width).to.equal(640)
        expect(source.resolution.id).to.equal(360)
        expect(source.resolution.label).to.equal('360p')
        expect(source.size).to.equal(30620)

        expect(source.metadata?.format).to.exist
        expect(source.metadata?.streams).to.be.an('array')

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })

          expect(video.inputFileUpdatedAt).to.not.be.null
          expect(new Date(video.inputFileUpdatedAt)).to.be.above(replaceDate)

          const files = getAllFiles(video)
          expect(files).to.have.lengthOf(4 * 2)

          expect(previousPaths).to.not.include(video.previewPath)
          expect(previousPaths).to.not.include(video.thumbnailPath)

          await makeGetRequest({ url: server.url, path: video.previewPath, expectedStatus: HttpStatusCode.OK_200 })
          await makeGetRequest({ url: server.url, path: video.thumbnailPath, expectedStatus: HttpStatusCode.OK_200 })

          for (const file of files) {
            expect(previousPaths).to.not.include(file.fileUrl)
            expect(previousPaths).to.not.include(file.torrentUrl)
            expect(previousPaths).to.not.include(file.metadataUrl)

            await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
            await makeRawRequest({ url: file.torrentUrl, expectedStatus: HttpStatusCode.OK_200 })

            const metadata = await server.videos.getFileMetadata({ url: file.metadataUrl })
            expect(previousPaths).to.not.include(JSON.stringify(metadata))
          }

          const { storyboards } = await server.storyboard.list({ id: uuid })
          for (const s of storyboards) {
            expect(previousPaths).to.not.include(s.storyboardPath)

            await makeGetRequest({ url: server.url, path: s.storyboardPath, expectedStatus: HttpStatusCode.OK_200 })
          }
        }

        await servers[0].config.enableMinimumTranscoding({ keepOriginal: true })
      })

      it('Should have cleaned up old files', async function () {
        {
          const count = await servers[0].servers.countFiles('storyboards')
          expect(count).to.equal(3)
        }

        {
          const count = await servers[0].servers.countFiles('web-videos')
          expect(count).to.equal(6 + 1) // +1 for private directory
        }

        {
          const count = await servers[0].servers.countFiles('streaming-playlists/hls')
          expect(count).to.equal(2 + 1) // +1 for private directory
        }

        {
          const count = await servers[0].servers.countFiles('torrents')
          expect(count).to.equal(11)
        }
      })

      it('Should have the correct source input filename', async function () {
        const source = await servers[0].videos.getSource({ id: uuid })

        expect(source.filename).to.equal('video_short_360p.mp4')
        expect(source.inputFilename).to.equal('video_short_360p.mp4')
        expect(new Date(source.createdAt)).to.be.above(replaceDate)
      })

      it('Should not have regenerated miniatures that were previously uploaded', async function () {
        this.timeout(120000)

        const { uuid } = await servers[0].videos.upload({
          attributes: {
            name: 'custom miniatures',
            thumbnailfile: 'custom-thumbnail.jpg',
            previewfile: 'custom-preview.jpg'
          }
        })

        await waitJobs(servers)

        const previousPaths: string[] = []

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })

          previousPaths.push(video.previewPath)
          previousPaths.push(video.thumbnailPath)

          await makeGetRequest({ url: server.url, path: video.previewPath, expectedStatus: HttpStatusCode.OK_200 })
          await makeGetRequest({ url: server.url, path: video.thumbnailPath, expectedStatus: HttpStatusCode.OK_200 })
        }

        await servers[0].videos.replaceSourceFile({ videoId: uuid, fixture: 'video_short_360p.mp4' })
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })

          expect(previousPaths).to.include(video.previewPath)
          expect(previousPaths).to.include(video.thumbnailPath)

          await makeGetRequest({ url: server.url, path: video.previewPath, expectedStatus: HttpStatusCode.OK_200 })
          await makeGetRequest({ url: server.url, path: video.thumbnailPath, expectedStatus: HttpStatusCode.OK_200 })
        }
      })

      it('Should replace the video with an audio only file', async function () {
        await servers[0].config.save()

        await servers[0].config.enableTranscoding({ webVideo: true, hls: true, resolutions: [ 480, 360, 240, 144 ] })
        const { uuid } = await servers[0].videos.quickUpload({ name: 'future audio', fixture: 'video_short_360p.mp4' })
        await waitJobs(servers)

        {
          const video = await servers[0].videos.get({ id: uuid })
          expect(getAllFiles(video)).to.have.lengthOf(6)
        }

        const fixture = 'sample.ogg'
        await servers[0].videos.replaceSourceFile({ videoId: uuid, fixture })
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })

          const files = getAllFiles(video)
          expect(files).to.have.lengthOf(8)
        }

        await servers[0].config.rollback()
      })
    })

    describe('Autoblacklist', function () {

      async function expectBlacklist (uuid: string, value: boolean) {
        const video = await servers[0].videos.getWithToken({ id: uuid })

        expect(video.blacklisted).to.equal(value)
      }

      before(async function () {
        await servers[0].config.enableAutoBlacklist()
      })

      it('Should auto blacklist an unblacklisted video after file replacement', async function () {
        this.timeout(120000)

        const { uuid } = await servers[0].videos.quickUpload({ token: userToken, name: 'user video' })
        await waitJobs(servers)
        await expectBlacklist(uuid, true)

        await servers[0].blacklist.remove({ videoId: uuid })
        await expectBlacklist(uuid, false)

        await servers[0].videos.replaceSourceFile({ videoId: uuid, token: userToken, fixture: 'video_short_360p.mp4' })
        await waitJobs(servers)

        await expectBlacklist(uuid, true)
      })

      it('Should auto blacklist an already blacklisted video after file replacement', async function () {
        this.timeout(120000)

        const { uuid } = await servers[0].videos.quickUpload({ token: userToken, name: 'user video' })
        await waitJobs(servers)
        await expectBlacklist(uuid, true)

        await servers[0].videos.replaceSourceFile({ videoId: uuid, token: userToken, fixture: 'video_short_360p.mp4' })
        await waitJobs(servers)

        await expectBlacklist(uuid, true)
      })

      it('Should not auto blacklist if auto blacklist has been disabled between the upload and the replacement', async function () {
        this.timeout(240000)

        const { uuid } = await servers[0].videos.quickUpload({ token: userToken, name: 'user video' })
        await waitJobs(servers)
        await expectBlacklist(uuid, true)

        await servers[0].blacklist.remove({ videoId: uuid })
        await expectBlacklist(uuid, false)

        await servers[0].config.disableAutoBlacklist()

        await servers[0].videos.replaceSourceFile({ videoId: uuid, token: userToken, fixture: 'video_short1.webm' })
        await waitJobs(servers)

        await expectBlacklist(uuid, false)
      })
    })

    describe('With object storage enabled', function () {
      if (areMockObjectStorageTestsDisabled()) return

      const objectStorage = new ObjectStorageCommand()

      before(async function () {
        this.timeout(120000)

        const configOverride = objectStorage.getDefaultMockConfig()
        await objectStorage.prepareDefaultMockBuckets()

        await servers[0].kill()
        await servers[0].run(configOverride)
      })

      it('Should replace a video file with transcoding disabled', async function () {
        this.timeout(120000)

        await servers[0].config.disableTranscoding()

        const { uuid } = await servers[0].videos.quickUpload({
          name: 'object storage without transcoding',
          fixture: 'video_short_720p.mp4'
        })
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })

          const files = getAllFiles(video)
          expect(files).to.have.lengthOf(1)
          expect(files[0].resolution.id).to.equal(720)
          expectStartWith(files[0].fileUrl, objectStorage.getMockWebVideosBaseUrl())
        }

        await servers[0].videos.replaceSourceFile({ videoId: uuid, fixture: 'video_short_360p.mp4' })
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })

          const files = getAllFiles(video)
          expect(files).to.have.lengthOf(1)
          expect(files[0].resolution.id).to.equal(360)
          expectStartWith(files[0].fileUrl, objectStorage.getMockWebVideosBaseUrl())
        }

        const source = await servers[0].videos.getSource({ id: uuid })
        expect(source.fileDownloadUrl).to.not.exist
      })

      it('Should replace a video file with transcoding enabled', async function () {
        this.timeout(240000)

        const previousPaths: string[] = []

        await servers[0].config.enableTranscoding({ hls: true, webVideo: true, with0p: true, keepOriginal: true, resolutions: 'max' })

        const fixture1 = 'video_short_360p.mp4'
        const { uuid: videoUUID } = await servers[0].videos.quickUpload({
          name: 'object storage with transcoding',
          fixture: fixture1
        })
        uuid = videoUUID

        await waitJobs(servers)

        await checkSourceFile({
          server: servers[0],
          fixture: fixture1,
          fsCount: 0,
          uuid,
          objectStorageBaseUrl: objectStorage?.getMockOriginalFileBaseUrl()
        })

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })

          const files = getAllFiles(video)
          expect(files).to.have.lengthOf(4 * 2)

          for (const file of files) {
            previousPaths.push(file.fileUrl)
          }

          for (const file of video.files) {
            expectStartWith(file.fileUrl, objectStorage.getMockWebVideosBaseUrl())
          }

          for (const file of video.streamingPlaylists[0].files) {
            expectStartWith(file.fileUrl, objectStorage.getMockPlaylistBaseUrl())
          }
        }

        const fixture2 = 'video_short_240p.mp4'
        await servers[0].videos.replaceSourceFile({ videoId: uuid, fixture: fixture2 })
        await waitJobs(servers)

        await checkSourceFile({
          server: servers[0],
          fixture: fixture2,
          fsCount: 0,
          uuid,
          objectStorageBaseUrl: objectStorage?.getMockOriginalFileBaseUrl()
        })

        for (const server of servers) {
          const video = await server.videos.get({ id: uuid })

          const files = getAllFiles(video)
          expect(files).to.have.lengthOf(3 * 2)

          for (const file of files) {
            expect(previousPaths).to.not.include(file.fileUrl)
          }

          for (const file of video.files) {
            expectStartWith(file.fileUrl, objectStorage.getMockWebVideosBaseUrl())
          }

          for (const file of video.streamingPlaylists[0].files) {
            expectStartWith(file.fileUrl, objectStorage.getMockPlaylistBaseUrl())
          }
        }
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
