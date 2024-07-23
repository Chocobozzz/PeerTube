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
    let videoFileToken: string
    let videoId: string
    let videoFileIds: number[]

    let user3: string
    let user4: string

    before(async function () {
      this.timeout(60000)

      user3 = await server.users.generateUserAndToken('user3')
      user4 = await server.users.generateUserAndToken('user4')

      const { uuid } = await server.videos.quickUpload({ name: 'video', token: user3, privacy: VideoPrivacy.PRIVATE })
      videoId = uuid

      videoFileToken = await server.videoToken.getVideoFileToken({ videoId: uuid, token: user3 })

      const video = await server.videos.getWithToken({ id: uuid })
      videoFileIds = [ video.files[0].id ]

      await waitJobs([ server ])
    })

    it('Should fail without header token or video file token', async function () {
      await server.videos.generateDownload({ videoId, videoFileIds, token: null, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an invalid header token', async function () {
      await server.videos.generateDownload({ videoId, videoFileIds, token: 'toto', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an invalid video file token', async function () {
      const query = { videoFileToken: 'toto' }

      await server.videos.generateDownload({ videoId, videoFileIds, token: null, query, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with header token of another user', async function () {
      await server.videos.generateDownload({ videoId, videoFileIds, token: user4, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with video file token of another user', async function () {
      const { uuid: otherVideo } = await server.videos.quickUpload({ name: 'other video' })
      const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: otherVideo, token: user4 })
      const query = { videoFileToken }

      await server.videos.generateDownload({ videoId, videoFileIds, token: null, query, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with a valid header token', async function () {
      await server.videos.generateDownload({ videoId, videoFileIds, token: user3 })
    })

    it('Should succeed with a valid query token', async function () {
      await server.videos.generateDownload({ videoId, videoFileIds, token: null, query: { videoFileToken } })
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

    it('Should suceed with the correct params', async function () {
      const videoFileIds = [ audioStreamId, videoStreamIds[0] ]

      await server.videos.generateDownload({ videoId, videoFileIds })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
