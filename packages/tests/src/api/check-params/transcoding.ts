/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test transcoding API validators', function () {
  let servers: PeerTubeServer[]

  let userToken: string
  let moderatorToken: string

  let remoteId: string
  let validId: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    userToken = await servers[0].users.generateUserAndToken('user', UserRole.USER)
    moderatorToken = await servers[0].users.generateUserAndToken('moderator', UserRole.MODERATOR)

    {
      const { uuid } = await servers[1].videos.quickUpload({ name: 'remote video' })
      remoteId = uuid
    }

    {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'both 1' })
      validId = uuid
    }

    await waitJobs(servers)

    await servers[0].config.enableTranscoding()
  })

  it('Should not run transcoding of a unknown video', async function () {
    await servers[0].videos.runTranscoding({ videoId: 404, transcodingType: 'hls', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    await servers[0].videos.runTranscoding({ videoId: 404, transcodingType: 'web-video', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should not run transcoding of a remote video', async function () {
    const expectedStatus = HttpStatusCode.BAD_REQUEST_400

    await servers[0].videos.runTranscoding({ videoId: remoteId, transcodingType: 'hls', expectedStatus })
    await servers[0].videos.runTranscoding({ videoId: remoteId, transcodingType: 'web-video', expectedStatus })
  })

  it('Should not run transcoding by a non admin user', async function () {
    const expectedStatus = HttpStatusCode.FORBIDDEN_403

    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: 'hls', token: userToken, expectedStatus })
    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: 'web-video', token: moderatorToken, expectedStatus })
  })

  it('Should not run transcoding without transcoding type', async function () {
    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: undefined, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not run transcoding with an incorrect transcoding type', async function () {
    const expectedStatus = HttpStatusCode.BAD_REQUEST_400

    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: 'toto' as any, expectedStatus })
  })

  it('Should not run transcoding if the instance disabled it', async function () {
    const expectedStatus = HttpStatusCode.BAD_REQUEST_400

    await servers[0].config.disableTranscoding()

    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: 'hls', expectedStatus })
    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: 'web-video', expectedStatus })
  })

  it('Should run transcoding', async function () {
    this.timeout(120_000)

    await servers[0].config.enableTranscoding()

    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: 'hls' })
    await waitJobs(servers)

    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: 'web-video', forceTranscoding: true })
    await waitJobs(servers)
  })

  it('Should not run transcoding on a video that is already being transcoded if forceTranscoding is not set', async function () {
    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: 'web-video' })

    const expectedStatus = HttpStatusCode.CONFLICT_409
    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: 'web-video', expectedStatus })

    await servers[0].videos.runTranscoding({ videoId: validId, transcodingType: 'web-video', forceTranscoding: true })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
