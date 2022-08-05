import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination, FIXTURE_URLS } from '@server/tests/shared'
import { HttpStatusCode, VideoChannelSyncCreate } from '@shared/models'
import {
  ChannelSyncsCommand,
  createSingleServer,
  makePostBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@shared/server-commands'
import 'mocha'

describe('Test video channel sync API validator', () => {
  const path = '/api/v1/video-channel-syncs'
  let server: PeerTubeServer
  let command: ChannelSyncsCommand
  let rootChannelId: number
  let rootChannelSyncId: number
  const userInfo = {
    accessToken: '',
    username: 'user1',
    id: -1,
    channelId: -1,
    syncId: -1,
    defaultQuota: -1,
    defaultDailyQuota: -1
  }

  async function withChannelSyncDisabled<T> (callback: () => T): Promise<T> {
    try {
      await server.config.disableChannelSync()
      return callback()
    } finally {
      await server.config.enableChannelSync()
    }
  }

  before(async function () {
    this.timeout(30_000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    command = server.channelSyncs

    rootChannelId = server.store.channel.id

    {
      userInfo.username = 'user1'
      const password = 'my super password'
      await server.users.create({ username: userInfo.username, password })

      userInfo.accessToken = await server.login.getAccessToken({ username: userInfo.username, password })

      const { videoChannels, ...otherUserInfo } = await server.users.getMyInfo({ token: userInfo.accessToken })
      userInfo.id = otherUserInfo.id
      userInfo.defaultQuota = otherUserInfo.videoQuota
      userInfo.defaultDailyQuota = otherUserInfo.videoQuotaDaily
      userInfo.channelId = videoChannels[0].id
    }
    await server.config.enableChannelSync()
  })

  after(async function () {
    await server?.kill()
  })

  describe('When creating a sync', function () {
    let baseCorrectParams: VideoChannelSyncCreate

    before(function () {
      baseCorrectParams = {
        externalChannelUrl: FIXTURE_URLS.youtubeChannel,
        videoChannelId: rootChannelId
      }
    })

    it('Should fail when sync is disabled', async function () {
      await withChannelSyncDisabled(async () => {
        await command.create({
          token: server.accessToken,
          attributes: baseCorrectParams,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with no authentication', async function () {
      await command.create({
        token: null,
        attributes: baseCorrectParams,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail without a target url', async function () {
      const attributes: VideoChannelSyncCreate = {
        ...baseCorrectParams,
        externalChannelUrl: null
      }
      await command.create({
        token: server.accessToken,
        attributes,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail without a channelId', async function () {
      const attributes: VideoChannelSyncCreate = {
        ...baseCorrectParams,
        videoChannelId: null
      }
      await command.create({
        token: server.accessToken,
        attributes,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a channelId refering nothing', async function () {
      const attributes: VideoChannelSyncCreate = {
        ...baseCorrectParams,
        videoChannelId: 42
      }
      await command.create({
        token: server.accessToken,
        attributes,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail to create a sync when the user does not own the channel', async function () {
      await command.create({
        token: userInfo.accessToken,
        attributes: baseCorrectParams,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed to create a sync with root and for another user\'s channel', async function () {
      const res = await command.create({
        token: server.accessToken,
        attributes: {
          ...baseCorrectParams,
          videoChannelId: userInfo.channelId
        },
        expectedStatus: HttpStatusCode.OK_200
      })
      userInfo.syncId = res.id
    })

    it('Should succeed with the correct parameters', async function () {
      const res = await command.create({
        token: server.accessToken,
        attributes: baseCorrectParams,
        expectedStatus: HttpStatusCode.OK_200
      })
      rootChannelSyncId = res.id
    })
  })

  describe('When listing my video imports', function () {
    const myPath = '/api/v1/accounts/root/video-channel-syncs'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, myPath, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, myPath, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, myPath, server.accessToken)
    })

    it('Should succeed with the correct parameters', async function () {
      await command.listByAccount({
        accountName: 'root',
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    it('Should fail with no authentication', async function () {
      await command.listByAccount({
        accountName: 'root',
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail when a simple user lists another user\'s synchronizations', async function () {
      await command.listByAccount({
        accountName: 'root',
        token: userInfo.accessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed when root lists another user\'s synchronizations', async function () {
      await command.listByAccount({
        accountName: userInfo.username,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    it('Should succeed even with synchronization disabled', async function () {
      await withChannelSyncDisabled(async function () {
        await command.listByAccount({
          accountName: 'root',
          token: server.accessToken,
          expectedStatus: HttpStatusCode.OK_200
        })
      })
    })
  })

  describe('When triggering deletion', function () {
    it('should fail with no authentication', async function () {
      await command.delete({
        channelSyncId: userInfo.syncId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail when channelSyncId does not refer to any sync', async function () {
      await command.delete({
        channelSyncId: 42,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail when sync is not owned by the user', async function () {
      await command.delete({
        channelSyncId: rootChannelSyncId,
        token: userInfo.accessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed when root delete a sync they do not own', async function () {
      await command.delete({
        channelSyncId: userInfo.syncId,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })

    it('should succeed when user delete a sync they own', async function () {
      const { id: syncIdToDelete } = await command.create({
        attributes: {
          externalChannelUrl: FIXTURE_URLS.youtubeChannel,
          videoChannelId: userInfo.channelId
        },
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })

      await command.delete({
        channelSyncId: syncIdToDelete,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })

    it('Should succeed even when synchronization is disabled', async function () {
      await withChannelSyncDisabled(async function () {
        await command.delete({
          channelSyncId: rootChannelSyncId,
          token: server.accessToken,
          expectedStatus: HttpStatusCode.NO_CONTENT_204
        })
      })
    })
  })
})
