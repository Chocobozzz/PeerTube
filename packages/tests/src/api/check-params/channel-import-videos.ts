/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { areHttpImportTestsDisabled } from '@peertube/peertube-node-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  ChannelsCommand,
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test videos import in a channel API validator', function () {
  let server: PeerTubeServer
  const userInfo = {
    accessToken: '',
    channelName: 'fake_channel',
    channelId: -1,
    id: -1,
    videoQuota: -1,
    videoQuotaDaily: -1,
    channelSyncId: -1
  }
  let command: ChannelsCommand

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableVideoImports()
    await server.config.enableChannelSync()

    const userCreds = {
      username: 'fake',
      password: 'fake_password'
    }

    {
      const user = await server.users.create({ username: userCreds.username, password: userCreds.password })
      userInfo.id = user.id
      userInfo.accessToken = await server.login.getAccessToken(userCreds)

      const info = await server.users.getMyInfo({ token: userInfo.accessToken })
      userInfo.channelId = info.videoChannels[0].id
    }

    {
      const { videoChannelSync } = await server.channelSyncs.create({
        token: userInfo.accessToken,
        attributes: {
          externalChannelUrl: FIXTURE_URLS.youtubeChannel,
          videoChannelId: userInfo.channelId
        }
      })
      userInfo.channelSyncId = videoChannelSync.id
    }

    command = server.channels
  })

  it('Should fail when HTTP upload is disabled', async function () {
    await server.config.disableChannelSync()
    await server.config.disableVideoImports()

    await command.importVideos({
      channelName: server.store.channel.name,
      externalChannelUrl: FIXTURE_URLS.youtubeChannel,
      token: server.accessToken,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })

    await server.config.enableVideoImports()
  })

  it('Should fail when externalChannelUrl is not provided', async function () {
    await command.importVideos({
      channelName: server.store.channel.name,
      externalChannelUrl: null,
      token: server.accessToken,
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })
  })

  it('Should fail when externalChannelUrl is malformed', async function () {
    await command.importVideos({
      channelName: server.store.channel.name,
      externalChannelUrl: 'not-a-url',
      token: server.accessToken,
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })
  })

  it('Should fail with a bad sync id', async function () {
    await command.importVideos({
      channelName: server.store.channel.name,
      externalChannelUrl: FIXTURE_URLS.youtubeChannel,
      videoChannelSyncId: 'toto' as any,
      token: server.accessToken,
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })
  })

  it('Should fail with a unknown sync id', async function () {
    await command.importVideos({
      channelName: server.store.channel.name,
      externalChannelUrl: FIXTURE_URLS.youtubeChannel,
      videoChannelSyncId: 42,
      token: server.accessToken,
      expectedStatus: HttpStatusCode.NOT_FOUND_404
    })
  })

  it('Should fail with a sync id of another channel', async function () {
    await command.importVideos({
      channelName: server.store.channel.name,
      externalChannelUrl: FIXTURE_URLS.youtubeChannel,
      videoChannelSyncId: userInfo.channelSyncId,
      token: server.accessToken,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should fail with no authentication', async function () {
    await command.importVideos({
      channelName: server.store.channel.name,
      externalChannelUrl: FIXTURE_URLS.youtubeChannel,
      token: null,
      expectedStatus: HttpStatusCode.UNAUTHORIZED_401
    })
  })

  it('Should fail when sync is not owned by the user', async function () {
    await command.importVideos({
      channelName: server.store.channel.name,
      externalChannelUrl: FIXTURE_URLS.youtubeChannel,
      token: userInfo.accessToken,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should fail when the user has no quota', async function () {
    await server.users.update({
      userId: userInfo.id,
      videoQuota: 0
    })

    await command.importVideos({
      channelName: 'fake_channel',
      externalChannelUrl: FIXTURE_URLS.youtubeChannel,
      token: userInfo.accessToken,
      expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413
    })

    await server.users.update({
      userId: userInfo.id,
      videoQuota: userInfo.videoQuota
    })
  })

  it('Should fail when the user has no daily quota', async function () {
    await server.users.update({
      userId: userInfo.id,
      videoQuotaDaily: 0
    })

    await command.importVideos({
      channelName: 'fake_channel',
      externalChannelUrl: FIXTURE_URLS.youtubeChannel,
      token: userInfo.accessToken,
      expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413
    })

    await server.users.update({
      userId: userInfo.id,
      videoQuotaDaily: userInfo.videoQuotaDaily
    })
  })

  it('Should succeed when sync is run by its owner', async function () {
    if (!areHttpImportTestsDisabled()) return

    await command.importVideos({
      channelName: 'fake_channel',
      externalChannelUrl: FIXTURE_URLS.youtubeChannel,
      token: userInfo.accessToken
    })
  })

  it('Should succeed when sync is run with root and for another user\'s channel', async function () {
    if (!areHttpImportTestsDisabled()) return

    await command.importVideos({
      channelName: 'fake_channel',
      externalChannelUrl: FIXTURE_URLS.youtubeChannel
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
