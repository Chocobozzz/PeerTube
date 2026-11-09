/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { ChangeOwnershipState, HttpStatusCode, UserRole, VideoCreateResult } from '@peertube/peertube-models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'
import { expect } from 'chai'

describe('Test video change ownership API validator', function () {
  let server: PeerTubeServer
  let userToken: string
  let anotherUserToken: string
  let rootEditorToken: string
  let userEditorToken: string
  let moderatorToken: string
  let moderator2Token: string
  let ownershipChangeId: number

  let userVideo: VideoCreateResult
  let rootVideo: VideoCreateResult
  let rootVideo2: VideoCreateResult

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    userToken = await server.users.generateUserAndToken('user')
    anotherUserToken = await server.users.generateUserAndToken('another_user')
    rootEditorToken = await server.channelCollaborators.createEditor('root_editor', 'root_channel')
    userEditorToken = await server.channelCollaborators.createEditor('user_editor', 'user_channel')
    moderatorToken = await server.users.generateUserAndToken('moderator', UserRole.MODERATOR)
    moderator2Token = await server.users.generateUserAndToken('moderator2', UserRole.MODERATOR)

    rootVideo = await server.videos.quickUpload({ name: 'root video' })
    rootVideo2 = await server.videos.quickUpload({ name: 'root video 2' })
    userVideo = await server.videos.quickUpload({ name: 'user video', token: userToken })
  })

  describe('Create video ownership change request', function () {
    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.createVideo({
        videoId: userVideo.id,
        username: 'another_user',
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a video of another user', async function () {
      for (const token of [ userToken, userEditorToken ]) {
        await server.changeOwnership.createVideo({
          videoId: rootVideo.id,
          username: 'another_user',
          token,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail with a non existing target', async function () {
      await server.changeOwnership.createVideo({
        videoId: userVideo.id,
        username: 'unexisting',
        token: userToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a non existing video', async function () {
      await server.changeOwnership.createVideo({
        videoId: 42,
        username: 'another_user',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail if the target is already the owner of the video', async function () {
      await server.changeOwnership.createVideo({
        videoId: userVideo.id,
        username: 'user',
        token: userToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail to create a request for a video of an administrator with a moderator', async function () {
      for (const username of [ 'moderator', 'user' ]) {
        await server.changeOwnership.createVideo({
          videoId: rootVideo.id,
          username,
          token: moderatorToken,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail to create a request for a video of another moderator with a moderator', async function () {
      const { id: videoId } = await server.videos.quickUpload({ name: 'moderator2 video', token: moderator2Token })

      await server.changeOwnership.createVideo({
        videoId,
        username: 'moderator',
        token: moderatorToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed to create a request for a video of a regular user or their own video with a moderator', async function () {
      const { id: regularUserVideoId } = await server.videos.quickUpload({ name: 'regular user video', token: userToken })
      await server.changeOwnership.createVideo({ videoId: regularUserVideoId, username: 'moderator', token: moderatorToken })

      const { id: moderatorVideoId } = await server.videos.quickUpload({ name: 'moderator video', token: moderatorToken })
      await server.changeOwnership.createVideo({ videoId: moderatorVideoId, username: 'user', token: moderatorToken })
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.createVideo({ videoId: rootVideo2.id, username: 'user', token: rootEditorToken })
      await server.changeOwnership.createVideo({ videoId: rootVideo.id, username: 'user' })
    })

    it('Should fail to create a request for a video with a pending ownership change request', async function () {
      await server.changeOwnership.createVideo({
        videoId: rootVideo2.id,
        username: 'user',
        token: rootEditorToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('Move a video to a channel of another account', function () {
    let moderatorChannelId: number
    let rootEditorChannelId: number

    before(async function () {
      moderatorChannelId = (await server.users.getMyInfo({ token: moderatorToken })).videoChannels[0].id
      rootEditorChannelId = (await server.users.getMyInfo({ token: rootEditorToken })).videoChannels[0].id
    })

    it('Should fail to move a video of an administrator or another moderator with a moderator', async function () {
      const { id: moderator2VideoId } = await server.videos.quickUpload({ name: 'moderator2 video to move', token: moderator2Token })
      const { id: rootVideoId } = await server.videos.quickUpload({ name: 'root video to move' })

      for (const id of [ rootVideoId, moderator2VideoId ]) {
        await server.videos.update({
          id,
          token: moderatorToken,
          attributes: { channelId: moderatorChannelId },
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should succeed to move a video of a regular user with a moderator', async function () {
      const { id } = await server.videos.quickUpload({ name: 'regular user video to move', token: userToken })

      await server.videos.update({ id, token: moderatorToken, attributes: { channelId: moderatorChannelId } })
    })

    it('Should succeed to move a video of an administrator with a collaborator of the channel', async function () {
      const { id } = await server.videos.quickUpload({ name: 'root video to move by editor' })

      await server.videos.update({ id, token: rootEditorToken, attributes: { channelId: rootEditorChannelId } })
    })
  })

  describe('List ownership change requests', function () {
    it('Should fail with bad pagination/sort params', async function () {
      await checkBadStartPagination(server.url, '/api/v1/videos/ownership', server.accessToken)
      await checkBadCountPagination(server.url, '/api/v1/videos/ownership', server.accessToken)
      await checkBadSort(server.url, '/api/v1/videos/ownership', server.accessToken)
    })

    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.listVideos({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should succeed with valid params', async function () {
      const { data } = await server.changeOwnership.listVideos({ token: userToken })
      ownershipChangeId = data.find(d => d.video.id === rootVideo2.id).id
    })
  })

  describe('List video ownership changes', function () {
    it('Should fail with bad pagination/sort params', async function () {
      const path = '/api/v1/videos/' + rootVideo.uuid + '/ownership'

      await checkBadStartPagination(server.url, path, server.accessToken)
      await checkBadCountPagination(server.url, path, server.accessToken)
      await checkBadSort(server.url, path, server.accessToken)
    })

    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.listOfVideo({
        videoId: rootVideo.id,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing video', async function () {
      await server.changeOwnership.listOfVideo({
        videoId: 42,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a video of another user', async function () {
      for (const token of [ userToken, userEditorToken ]) {
        await server.changeOwnership.listOfVideo({
          videoId: rootVideo.id,
          token,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail with an invalid state parameter', async function () {
      await server.changeOwnership.listOfVideo({
        videoId: rootVideo.id,
        state: 'INVALID_STATE' as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with valid params', async function () {
      for (const token of [ rootEditorToken, server.accessToken ]) {
        const { data, total } = await server.changeOwnership.listOfVideo({ token, videoId: rootVideo.id })
        expect(total).to.be.a('number')
        expect(data).to.be.an('array')
      }
    })

    it('Should succeed with a state filter', async function () {
      const { data } = await server.changeOwnership.listOfVideo({
        videoId: rootVideo.id,
        state: ChangeOwnershipState.PENDING
      })
      expect(data).to.be.an('array')
    })
  })

  describe('Reject ownership change request', function () {
    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.refuseVideo({
        ownershipId: ownershipChangeId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing ownership id', async function () {
      await server.changeOwnership.refuseVideo({ ownershipId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a ownership of another user', async function () {
      for (const token of [ userEditorToken, anotherUserToken, rootEditorToken ]) {
        await server.changeOwnership.refuseVideo({
          ownershipId: ownershipChangeId,
          token,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.refuseVideo({ ownershipId: ownershipChangeId, token: userToken })
    })

    it('Should fail to reject a non pending request', async function () {
      await server.changeOwnership.refuseVideo({
        ownershipId: ownershipChangeId,
        token: userToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('Accept ownership change request', function () {
    let targetChannelId: number

    before(async function () {
      await server.changeOwnership.createVideo({ videoId: rootVideo2.id, username: 'user' })

      const { data } = await server.changeOwnership.listVideos({ token: userToken })
      ownershipChangeId = data[0].id

      const me = await server.users.getMyInfo({ token: userToken })
      targetChannelId = me.videoChannels[0].id
    })

    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.acceptVideo({
        ownershipId: ownershipChangeId,
        token: null,
        channelId: targetChannelId,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing ownership id', async function () {
      await server.changeOwnership.acceptVideo({
        ownershipId: 42,
        token: userToken,
        channelId: targetChannelId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a ownership of another user', async function () {
      for (const token of [ userEditorToken, anotherUserToken ]) {
        await server.changeOwnership.acceptVideo({
          ownershipId: ownershipChangeId,
          token,
          channelId: targetChannelId,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail with a non existing target', async function () {
      await server.changeOwnership.acceptVideo({
        ownershipId: 42,
        token: userToken,
        channelId: targetChannelId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a target channel not owned by the user', async function () {
      const me = await server.users.getMyInfo({ token: anotherUserToken })
      const anotherUserChannelId = me.videoChannels[0].id

      await server.changeOwnership.acceptVideo({
        ownershipId: ownershipChangeId,
        token: userToken,
        channelId: anotherUserChannelId,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a target channel that does not belong to the next owner, even if accepted by a moderator', async function () {
      const me = await server.users.getMyInfo({ token: moderatorToken })
      const moderatorChannelId = me.videoChannels[0].id

      await server.changeOwnership.acceptVideo({
        ownershipId: ownershipChangeId,
        token: moderatorToken,
        channelId: moderatorChannelId,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.acceptVideo({
        ownershipId: ownershipChangeId,
        token: userToken,
        channelId: targetChannelId
      })
    })

    it('Should fail to accept a non pending request', async function () {
      await server.changeOwnership.acceptVideo({
        ownershipId: ownershipChangeId,
        token: userToken,
        channelId: targetChannelId,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('Accept ownership change request on behalf of the next owner', function () {
    let quotaLimitedToken: string

    let videoForRegularUser: VideoCreateResult
    let videoForQuotaLimitedUser: VideoCreateResult
    let videoForModerator2: VideoCreateResult

    before(async function () {
      this.timeout(120000)

      await server.users.create({ username: 'quota_limited_video_target', videoQuota: 0 })
      quotaLimitedToken = await server.login.getAccessToken({ username: 'quota_limited_video_target', password: 'password' })

      videoForRegularUser = await server.videos.quickUpload({ name: 'root video for moderator accept' })
      await server.changeOwnership.createVideo({ videoId: videoForRegularUser.id, username: 'user' })

      videoForQuotaLimitedUser = await server.videos.quickUpload({ name: 'root video for quota limited target' })
      await server.changeOwnership.createVideo({ videoId: videoForQuotaLimitedUser.id, username: 'quota_limited_video_target' })

      videoForModerator2 = await server.videos.quickUpload({ name: 'root video for moderator2 target' })
      await server.changeOwnership.createVideo({ videoId: videoForModerator2.id, username: 'moderator2' })
    })

    it('Should fail to accept, on behalf of another moderator, a pending video ownership change, with a moderator', async function () {
      const { data } = await server.changeOwnership.listOfVideo({ videoId: videoForModerator2.id })
      const ownershipId = data[0].id

      const me = await server.users.getMyInfo({ token: moderator2Token })

      await server.changeOwnership.acceptVideo({
        ownershipId,
        token: moderatorToken,
        channelId: me.videoChannels[0].id,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail to accept, on behalf of a user whose quota is exceeded, a pending video ownership change, with a moderator', async function () {
      const { data } = await server.changeOwnership.listOfVideo({ videoId: videoForQuotaLimitedUser.id })
      const ownershipId = data[0].id

      const me = await server.users.getMyInfo({ token: quotaLimitedToken })

      await server.changeOwnership.acceptVideo({
        ownershipId,
        token: moderatorToken,
        channelId: me.videoChannels[0].id,
        expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413
      })
    })

    it('Should succeed to accept, on behalf of a regular user, a pending video ownership change, with a moderator', async function () {
      const { data } = await server.changeOwnership.listOfVideo({ videoId: videoForRegularUser.id })
      const ownershipId = data[0].id

      const me = await server.users.getMyInfo({ token: userToken })

      await server.changeOwnership.acceptVideo({
        ownershipId,
        token: moderatorToken,
        channelId: me.videoChannels[0].id
      })

      const video = await server.videos.get({ id: videoForRegularUser.id })
      expect(video.account.name).to.equal('user')
    })
  })

  describe('Delete ownership change request', function () {
    let deleteOwnershipChangeId: number
    let videoId: string

    before(async function () {
      const { uuid } = await server.videos.quickUpload({ name: 'video', token: userToken })
      videoId = uuid

      await server.changeOwnership.createVideo({ videoId, username: 'another_user', token: userToken })

      const { data } = await server.changeOwnership.listOfVideo({ videoId })
      deleteOwnershipChangeId = data[0].id
    })

    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.deleteVideo({
        ownershipId: deleteOwnershipChangeId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing ownership id', async function () {
      await server.changeOwnership.deleteVideo({ ownershipId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a video from another user', async function () {
      await server.changeOwnership.deleteVideo({
        ownershipId: deleteOwnershipChangeId,
        token: anotherUserToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail to delete a request for a video of an administrator with a moderator', async function () {
      const { uuid } = await server.videos.quickUpload({ name: 'root video for moderator delete' })
      await server.changeOwnership.createVideo({ videoId: uuid, username: 'user' })

      const { data } = await server.changeOwnership.listOfVideo({ videoId: uuid })

      await server.changeOwnership.deleteVideo({
        ownershipId: data[0].id,
        token: moderatorToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail to delete a request for a video of another moderator with a moderator', async function () {
      const { uuid } = await server.videos.quickUpload({ name: 'moderator2 video for moderator delete', token: moderator2Token })
      await server.changeOwnership.createVideo({ videoId: uuid, username: 'user', token: moderator2Token })

      const { data } = await server.changeOwnership.listOfVideo({ videoId: uuid, token: moderator2Token })

      await server.changeOwnership.deleteVideo({
        ownershipId: data[0].id,
        token: moderatorToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed to delete a request for a video of a regular user with a moderator', async function () {
      const { uuid } = await server.videos.quickUpload({ name: 'regular user video for moderator delete', token: userToken })
      await server.changeOwnership.createVideo({ videoId: uuid, username: 'another_user', token: userToken })

      const { data } = await server.changeOwnership.listOfVideo({ videoId: uuid, token: userToken })

      await server.changeOwnership.deleteVideo({ ownershipId: data[0].id, token: moderatorToken })
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.deleteVideo({
        token: userEditorToken,
        ownershipId: deleteOwnershipChangeId
      })
    })

    it('Should fail to delete a non existing request', async function () {
      await server.changeOwnership.deleteVideo({
        ownershipId: deleteOwnershipChangeId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a non pending request', async function () {
      await server.changeOwnership.createVideo({ videoId, username: 'another_user', token: userToken })

      const { data } = await server.changeOwnership.listOfVideo({ videoId })
      const newOwnershipChangeId = data[0].id

      await server.changeOwnership.acceptVideo({
        ownershipId: newOwnershipChangeId,
        token: anotherUserToken,
        channelId: await server.channels.getDefaultId({ token: anotherUserToken })
      })

      await server.changeOwnership.deleteVideo({
        ownershipId: newOwnershipChangeId,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
