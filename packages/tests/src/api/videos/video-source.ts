/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { expect } from 'chai'
import { getAllFiles } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { expectStartWith } from '@tests/shared/checks.js'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test a video file replacement', function () {
  let servers: PeerTubeServer[] = []

  let replaceDate: Date
  let userToken: string
  let uuid: string

  before(async function () {
    this.timeout(50000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await setDefaultAccountAvatar(servers)

    await servers[0].config.enableFileUpdate()

    userToken = await servers[0].users.generateUserAndToken('user1')

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  describe('Getting latest video source', () => {
    const fixture = 'video_short.webm'
    const uuids: string[] = []

    it('Should get the source filename with legacy upload', async function () {
      this.timeout(30000)

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'my video', fixture }, mode: 'legacy' })
      uuids.push(uuid)

      const source = await servers[0].videos.getSource({ id: uuid })
      expect(source.filename).to.equal(fixture)
    })

    it('Should get the source filename with resumable upload', async function () {
      this.timeout(30000)

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'my video', fixture }, mode: 'resumable' })
      uuids.push(uuid)

      const source = await servers[0].videos.getSource({ id: uuid })
      expect(source.filename).to.equal(fixture)
    })

    after(async function () {
      this.timeout(60000)

      for (const uuid of uuids) {
        await servers[0].videos.remove({ id: uuid })
      }

      await waitJobs(servers)
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

      it('Should replace a video file with transcoding enabled', async function () {
        this.timeout(120000)

        const previousPaths: string[] = []

        await servers[0].config.enableTranscoding({ hls: true, webVideo: true, with0p: true })

        const { uuid: videoUUID } = await servers[0].videos.quickUpload({ name: 'fs with transcoding', fixture: 'video_short_720p.mp4' })
        uuid = videoUUID

        await waitJobs(servers)

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

        await servers[0].videos.replaceSourceFile({ videoId: uuid, fixture: 'video_short_360p.mp4' })
        await waitJobs(servers)

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

        await servers[0].config.enableMinimumTranscoding()
      })

      it('Should have cleaned up old files', async function () {
        {
          const count = await servers[0].servers.countFiles('storyboards')
          expect(count).to.equal(2)
        }

        {
          const count = await servers[0].servers.countFiles('web-videos')
          expect(count).to.equal(5 + 1) // +1 for private directory
        }

        {
          const count = await servers[0].servers.countFiles('streaming-playlists/hls')
          expect(count).to.equal(1 + 1) // +1 for private directory
        }

        {
          const count = await servers[0].servers.countFiles('torrents')
          expect(count).to.equal(9)
        }
      })

      it('Should have the correct source input', async function () {
        const source = await servers[0].videos.getSource({ id: uuid })

        expect(source.filename).to.equal('video_short_360p.mp4')
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
    })

    describe('Autoblacklist', function () {

      function updateAutoBlacklist (enabled: boolean) {
        return servers[0].config.updateExistingSubConfig({
          newConfig: {
            autoBlacklist: {
              videos: {
                ofUsers: {
                  enabled
                }
              }
            }
          }
        })
      }

      async function expectBlacklist (uuid: string, value: boolean) {
        const video = await servers[0].videos.getWithToken({ id: uuid })

        expect(video.blacklisted).to.equal(value)
      }

      before(async function () {
        await updateAutoBlacklist(true)
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

        await updateAutoBlacklist(false)

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
      })

      it('Should replace a video file with transcoding enabled', async function () {
        this.timeout(120000)

        const previousPaths: string[] = []

        await servers[0].config.enableTranscoding({ hls: true, webVideo: true, with0p: true })

        const { uuid: videoUUID } = await servers[0].videos.quickUpload({
          name: 'object storage with transcoding',
          fixture: 'video_short_360p.mp4'
        })
        uuid = videoUUID

        await waitJobs(servers)

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

        await servers[0].videos.replaceSourceFile({ videoId: uuid, fixture: 'video_short_240p.mp4' })
        await waitJobs(servers)

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
