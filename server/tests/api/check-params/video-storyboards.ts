/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoPrivacy } from '@shared/models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'

describe('Test video storyboards API validator', function () {
  let server: PeerTubeServer

  let publicVideo: { uuid: string }
  let privateVideo: { uuid: string }

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    publicVideo = await server.videos.quickUpload({ name: 'public' })
    privateVideo = await server.videos.quickUpload({ name: 'private', privacy: VideoPrivacy.PRIVATE })
  })

  it('Should fail without a valid uuid', async function () {
    await server.storyboard.list({ id: '4da6fde3-88f7-4d16-b119-108df563d0b0', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should receive 404 when passing a non existing video id', async function () {
    await server.storyboard.list({ id: '4da6fde3-88f7-4d16-b119-108df5630b06', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should not get the private storyboard without the appropriate token', async function () {
    await server.storyboard.list({ id: privateVideo.uuid, expectedStatus: HttpStatusCode.UNAUTHORIZED_401, token: null })
    await server.storyboard.list({ id: publicVideo.uuid, expectedStatus: HttpStatusCode.OK_200, token: null })
  })

  it('Should succeed with the correct parameters', async function () {
    await server.storyboard.list({ id: privateVideo.uuid })
    await server.storyboard.list({ id: publicVideo.uuid })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
