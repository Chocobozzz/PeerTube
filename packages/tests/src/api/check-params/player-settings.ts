/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, PlayerChannelSettings, PlayerVideoSettings, VideoCreateResult, VideoPrivacy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test player settings API validator', function () {
  let server: PeerTubeServer

  let ownerAccessToken: string
  let userAccessToken: string
  let editorAccessToken: string
  let invitedEditorAccessToken: string

  let video: VideoCreateResult
  let privateVideo: VideoCreateResult

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    ownerAccessToken = await server.users.generateUserAndToken('owner')
    userAccessToken = await server.users.generateUserAndToken('user1')
    editorAccessToken = await server.channelCollaborators.createEditor('accepted_editor', 'owner_channel')
    invitedEditorAccessToken = await server.channelCollaborators.createInvited('invited_editor', 'owner_channel')

    video = await server.videos.upload({ token: ownerAccessToken })
    privateVideo = await server.videos.upload({ token: ownerAccessToken, attributes: { privacy: VideoPrivacy.PRIVATE } })
  })

  it('Should fail to get video player settings if the video does not exist', async function () {
    await server.playerSettings.getForVideo({ videoId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should check video privacy before getting player settings of a video', async function () {
    const videoId = privateVideo.uuid

    await server.playerSettings.getForVideo({ token: server.accessToken, videoId })
    await server.playerSettings.getForVideo({ token: ownerAccessToken, videoId })
    await server.playerSettings.getForVideo({ token: editorAccessToken, videoId })
    await server.playerSettings.getForVideo({ token: invitedEditorAccessToken, videoId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    await server.playerSettings.getForVideo({ token: userAccessToken, videoId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    await server.playerSettings.getForVideo({ token: null, videoId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should fail to get channel player settings if the channel does not exist', async function () {
    await server.playerSettings.getForChannel({
      token: ownerAccessToken,
      channelHandle: 'unknown',
      expectedStatus: HttpStatusCode.NOT_FOUND_404
    })
  })

  it('Should only allow to get raw player settings of a channel by owner/editors/moderators', async function () {
    const channelHandle = 'owner_channel'
    const videoId = video.uuid

    await server.playerSettings.getForChannel({ token: server.accessToken, channelHandle, raw: true })
    await server.playerSettings.getForChannel({ token: ownerAccessToken, channelHandle, raw: true })
    await server.playerSettings.getForChannel({ token: editorAccessToken, channelHandle, raw: true })

    await server.playerSettings.getForChannel({
      token: invitedEditorAccessToken,
      channelHandle,
      expectedStatus: HttpStatusCode.FORBIDDEN_403,
      raw: true
    })
    await server.playerSettings.getForChannel({
      token: userAccessToken,
      channelHandle,
      expectedStatus: HttpStatusCode.FORBIDDEN_403,
      raw: true
    })
    await server.playerSettings.getForChannel({ token: null, channelHandle, expectedStatus: HttpStatusCode.UNAUTHORIZED_401, raw: true })

    await server.playerSettings.getForVideo({ token: server.accessToken, videoId, raw: true })
    await server.playerSettings.getForVideo({ token: ownerAccessToken, videoId, raw: true })
    await server.playerSettings.getForVideo({ token: userAccessToken, videoId, expectedStatus: HttpStatusCode.FORBIDDEN_403, raw: true })
    await server.playerSettings.getForVideo({ token: null, videoId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401, raw: true })
  })

  it('Should only allow to update player settings of a video by owner/moderators', async function () {
    const videoId = video.uuid
    const playerSettings: PlayerVideoSettings = { theme: 'lucide' }

    await server.playerSettings.updateForVideo({ token: server.accessToken, videoId, ...playerSettings })
    await server.playerSettings.updateForVideo({ token: editorAccessToken, videoId, ...playerSettings })
    await server.playerSettings.updateForVideo({ token: ownerAccessToken, videoId, ...playerSettings })

    await server.playerSettings.updateForVideo({
      token: invitedEditorAccessToken,
      videoId,
      ...playerSettings,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })

    await server.playerSettings.updateForVideo({
      token: userAccessToken,
      videoId,
      ...playerSettings,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })

    await server.playerSettings.updateForVideo({ token: null, videoId, ...playerSettings, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should only allow to update player settings of a channel by owner/moderators', async function () {
    const channelHandle = 'owner_channel'
    const playerSettings: PlayerChannelSettings = { theme: 'lucide' }

    await server.playerSettings.updateForChannel({ token: server.accessToken, channelHandle, ...playerSettings })
    await server.playerSettings.updateForChannel({ token: ownerAccessToken, channelHandle, ...playerSettings })
    await server.playerSettings.updateForChannel({ token: editorAccessToken, channelHandle, ...playerSettings })

    await server.playerSettings.updateForChannel({
      token: invitedEditorAccessToken,
      channelHandle,
      ...playerSettings,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })

    await server.playerSettings.updateForChannel({
      token: userAccessToken,
      channelHandle,
      ...playerSettings,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })

    await server.playerSettings.updateForChannel({
      token: null,
      channelHandle,
      ...playerSettings,
      expectedStatus: HttpStatusCode.UNAUTHORIZED_401
    })
  })

  it('Should fail to update player settings with invalid settings', async function () {
    const videoId = video.uuid
    const channelHandle = 'owner_channel'

    {
      const playerSettings = { theme: 'invalid' } as any

      await server.playerSettings.updateForVideo({ videoId, ...playerSettings, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await server.playerSettings.updateForChannel({ channelHandle, ...playerSettings, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    }

    {
      const playerSettings = { theme: 'channel-default' } as any

      await server.playerSettings.updateForVideo({ videoId, ...playerSettings })
      await server.playerSettings.updateForChannel({ channelHandle, ...playerSettings, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
