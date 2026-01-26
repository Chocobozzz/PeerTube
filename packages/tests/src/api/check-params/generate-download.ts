import { getHLS } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test generate download API validator', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])
  })

  describe('Download rights', function () {
    let userFileToken: string
    let editorFileToken: string

    let videoId: string
    let videoFileIds: number[]

    let userToken: string
    let anotherUserToken: string
    let editorToken: string

    before(async function () {
      this.timeout(60000)

      userToken = await server.users.generateUserAndToken('user')
      anotherUserToken = await server.users.generateUserAndToken('another_user')
      editorToken = await server.channelCollaborators.createEditor('editor', 'user_channel')

      const { uuid } = await server.videos.quickUpload({ name: 'video', token: userToken, privacy: VideoPrivacy.PRIVATE })
      videoId = uuid

      userFileToken = await server.videoToken.getVideoFileToken({ videoId: uuid, token: userToken })
      editorFileToken = await server.videoToken.getVideoFileToken({ videoId: uuid, token: editorToken })

      const video = await server.videos.getWithToken({ id: uuid })
      videoFileIds = [ video.files[0].id ]

      await waitJobs([ server ])
    })

    it('Should fail without user token or video file token', async function () {
      await server.videos.generateDownload({ videoId, videoFileIds, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an invalid user token', async function () {
      await server.videos.generateDownload({ videoId, videoFileIds, token: 'toto', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an invalid video file token', async function () {
      const query = { videoFileToken: 'toto' }

      await server.videos.generateDownload({ videoId, videoFileIds, token: null, query, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with user token of another user', async function () {
      await server.videos.generateDownload({ videoId, videoFileIds, token: anotherUserToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with video file token of another video', async function () {
      const { uuid: otherVideo } = await server.videos.quickUpload({ name: 'other video', token: userToken })
      const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: otherVideo, token: userToken })
      const query = { videoFileToken }

      await server.videos.generateDownload({ videoId, videoFileIds, token: null, query, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with a valid user token', async function () {
      for (const token of [ server.accessToken, userToken, editorToken ]) {
        await server.videos.generateDownload({ videoId, videoFileIds, token })
      }
    })

    it('Should succeed with a valid query token', async function () {
      await server.videos.generateDownload({ videoId, videoFileIds, token: null, query: { videoFileToken: userFileToken } })
      await server.videos.generateDownload({ videoId, videoFileIds, token: null, query: { videoFileToken: editorFileToken } })
    })
  })

  describe('Download params', function () {
    let videoId: string
    let videoStreamIds: number[]
    let audioStreamId: number

    before(async function () {
      this.timeout(60000)

      await server.config.enableMinimumTranscoding({ hls: true, splitAudioAndVideo: true })

      const { uuid } = await server.videos.quickUpload({ name: 'video' })
      videoId = uuid

      await waitJobs([ server ])

      const video = await server.videos.get({ id: uuid })

      videoStreamIds = getHLS(video).files.filter(f => !f.hasAudio).map(f => f.id)
      audioStreamId = getHLS(video).files.find(f => !!f.hasAudio).id
    })

    it('Should fail with invalid video id', async function () {
      await server.videos.generateDownload({ videoId: 42, videoFileIds: [ 41 ], expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with invalid videoFileIds query', async function () {
      const tests = [
        undefined,
        [],
        [ 40, 41, 42 ]
      ]

      for (const videoFileIds of tests) {
        await server.videos.generateDownload({ videoId, videoFileIds, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      }
    })

    it('Should fail with multiple video files', async function () {
      const videoFileIds = videoStreamIds

      await server.videos.generateDownload({ videoId, videoFileIds, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed with the correct params', async function () {
      const videoFileIds = [ audioStreamId, videoStreamIds[0] ]

      await server.videos.generateDownload({ videoId, videoFileIds })
    })
  })

  describe('Download rate limit', function () {
    let videoId: string
    let fileId: number

    before(async function () {
      this.timeout(60000)

      await server.kill()

      await server.run({
        download_generate_video: {
          max_parallel_downloads: 2
        }
      })

      const { uuid } = await server.videos.quickUpload({ name: 'video' })
      videoId = uuid
      await waitJobs([ server ])

      const video = await server.videos.get({ id: uuid })
      fileId = video.files[0].id
    })

    it('Should succeed with a single download', async function () {
      const videoFileIds = [ fileId ]

      for (let i = 0; i < 3; i++) {
        await server.videos.generateDownload({ videoId, videoFileIds })
      }
    })

    it('Should fail with too many parallel downloads', async function () {
      const videoFileIds = [ fileId ]

      const promises: Promise<any>[] = []

      for (let i = 0; i < 10; i++) {
        promises.push(
          server.videos.generateDownload({ videoId, videoFileIds })
            .catch(err => {
              if (err.message.includes('429')) return

              throw err
            })
        )
      }

      await Promise.all(promises)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
