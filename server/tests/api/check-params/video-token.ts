/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoPrivacy } from '@shared/models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'

describe('Test video tokens', function () {
  let server: PeerTubeServer
  let privateVideoId: string
  let passwordProtectedVideoId: string
  let userToken: string

  const videoPassword = 'password'

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(300_000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    {
      const { uuid } = await server.videos.quickUpload({ name: 'private video', privacy: VideoPrivacy.PRIVATE })
      privateVideoId = uuid
    }
    {
      const { uuid } = await server.videos.quickUpload({
        name: 'password protected video',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ videoPassword ]
      })
      passwordProtectedVideoId = uuid
    }
    userToken = await server.users.generateUserAndToken('user1')
  })

  it('Should not generate tokens on private video for unauthenticated user', async function () {
    await server.videoToken.create({ videoId: privateVideoId, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should not generate tokens of unknown video', async function () {
    await server.videoToken.create({ videoId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should not generate tokens with incorrect password', async function () {
    await server.videoToken.create({
      videoId: passwordProtectedVideoId,
      token: null,
      expectedStatus: HttpStatusCode.FORBIDDEN_403,
      videoPassword: 'incorrectPassword'
    })
  })

  it('Should not generate tokens of a non owned video', async function () {
    await server.videoToken.create({ videoId: privateVideoId, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should generate token', async function () {
    await server.videoToken.create({ videoId: privateVideoId })
  })

  it('Should generate token on password protected video', async function () {
    await server.videoToken.create({ videoId: passwordProtectedVideoId, videoPassword, token: null })
    await server.videoToken.create({ videoId: passwordProtectedVideoId, videoPassword, token: userToken })
    await server.videoToken.create({ videoId: passwordProtectedVideoId, videoPassword })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
