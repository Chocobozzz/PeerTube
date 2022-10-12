/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoPrivacy } from '@shared/models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'

describe('Test video tokens', function () {
  let server: PeerTubeServer
  let videoId: string
  let userToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(300_000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PRIVATE })
    videoId = uuid

    userToken = await server.users.generateUserAndToken('user1')
  })

  it('Should not generate tokens for unauthenticated user', async function () {
    await server.videoToken.create({ videoId, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should not generate tokens of unknown video', async function () {
    await server.videoToken.create({ videoId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should not generate tokens of a non owned video', async function () {
    await server.videoToken.create({ videoId, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should generate token', async function () {
    await server.videoToken.create({ videoId })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
