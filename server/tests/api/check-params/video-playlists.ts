/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
  addVideoInPlaylist,
  cleanupTests,
  createVideoPlaylist,
  deleteVideoPlaylist,
  flushAndRunServer,
  generateUserAccessToken,
  getAccountPlaylistsListWithToken,
  getVideoPlaylist,
  immutableAssign,
  makeGetRequest,
  removeVideoFromPlaylist,
  reorderVideosPlaylist,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateVideoPlaylist,
  updateVideoPlaylistElement,
  uploadVideoAndGetId
} from '../../../../shared/extra-utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/extra-utils/requests/check-api-params'
import { VideoPlaylistPrivacy } from '../../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { VideoPlaylistType } from '../../../../shared/models/videos/playlist/video-playlist-type.model'

describe('Test video playlists API validator', function () {
  let server: ServerInfo
  let userAccessToken: string
  let playlistUUID: string
  let privatePlaylistUUID: string
  let watchLaterPlaylistId: number
  let videoId: number
  let playlistElementId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    userAccessToken = await generateUserAccessToken(server, 'user1')
    videoId = (await uploadVideoAndGetId({ server, videoName: 'video 1' })).id

    {
      const res = await getAccountPlaylistsListWithToken(server.url, server.accessToken, 'root', 0, 5, VideoPlaylistType.WATCH_LATER)
      watchLaterPlaylistId = res.body.data[0].id
    }

    {
      const res = await createVideoPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'super playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.videoChannel.id
        }
      })
      playlistUUID = res.body.videoPlaylist.uuid
    }

    {
      const res = await createVideoPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'private',
          privacy: VideoPlaylistPrivacy.PRIVATE
        }
      })
      privatePlaylistUUID = res.body.videoPlaylist.uuid
    }
  })

  describe('When listing playlists', function () {
    const globalPath = '/api/v1/video-playlists'
    const accountPath = '/api/v1/accounts/root/video-playlists'
    const videoChannelPath = '/api/v1/video-channels/root_channel/video-playlists'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, globalPath, server.accessToken)
      await checkBadStartPagination(server.url, accountPath, server.accessToken)
      await checkBadStartPagination(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, globalPath, server.accessToken)
      await checkBadCountPagination(server.url, accountPath, server.accessToken)
      await checkBadCountPagination(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, globalPath, server.accessToken)
      await checkBadSortPagination(server.url, accountPath, server.accessToken)
      await checkBadSortPagination(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with a bad playlist type', async function () {
      await makeGetRequest({ url: server.url, path: globalPath, query: { playlistType: 3 } })
      await makeGetRequest({ url: server.url, path: accountPath, query: { playlistType: 3 } })
      await makeGetRequest({ url: server.url, path: videoChannelPath, query: { playlistType: 3 } })
    })

    it('Should fail with a bad account parameter', async function () {
      const accountPath = '/api/v1/accounts/root2/video-playlists'

      await makeGetRequest({ url: server.url, path: accountPath, statusCodeExpected: 404, token: server.accessToken })
    })

    it('Should fail with a bad video channel parameter', async function () {
      const accountPath = '/api/v1/video-channels/bad_channel/video-playlists'

      await makeGetRequest({ url: server.url, path: accountPath, statusCodeExpected: 404, token: server.accessToken })
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path: globalPath, statusCodeExpected: 200, token: server.accessToken })
      await makeGetRequest({ url: server.url, path: accountPath, statusCodeExpected: 200, token: server.accessToken })
      await makeGetRequest({ url: server.url, path: videoChannelPath, statusCodeExpected: 200, token: server.accessToken })
    })
  })

  describe('When listing videos of a playlist', function () {
    const path = '/api/v1/video-playlists/'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path + playlistUUID + '/videos', server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path + playlistUUID + '/videos', server.accessToken)
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path: path + playlistUUID + '/videos', statusCodeExpected: 200 })
    })
  })

  describe('When getting a video playlist', function () {
    it('Should fail with a bad id or uuid', async function () {
      await getVideoPlaylist(server.url, 'toto', 400)
    })

    it('Should fail with an unknown playlist', async function () {
      await getVideoPlaylist(server.url, 42, 404)
    })

    it('Should fail to get an unlisted playlist with the number id', async function () {
      const res = await createVideoPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'super playlist',
          privacy: VideoPlaylistPrivacy.UNLISTED
        }
      })
      const playlist = res.body.videoPlaylist

      await getVideoPlaylist(server.url, playlist.id, 404)
      await getVideoPlaylist(server.url, playlist.uuid, 200)
    })

    it('Should succeed with the correct params', async function () {
      await getVideoPlaylist(server.url, playlistUUID, 200)
    })
  })

  describe('When creating/updating a video playlist', function () {
    const getBase = (playlistAttrs: any = {}, wrapper: any = {}) => {
      return Object.assign({
        expectedStatus: 400,
        url: server.url,
        token: server.accessToken,
        playlistAttrs: Object.assign({
          displayName: 'display name',
          privacy: VideoPlaylistPrivacy.UNLISTED,
          thumbnailfile: 'thumbnail.jpg',
          videoChannelId: server.videoChannel.id
        }, playlistAttrs)
      }, wrapper)
    }
    const getUpdate = (params: any, playlistId: number | string) => {
      return immutableAssign(params, { playlistId: playlistId })
    }

    it('Should fail with an unauthenticated user', async function () {
      const params = getBase({}, { token: null, expectedStatus: 401 })

      await createVideoPlaylist(params)
      await updateVideoPlaylist(getUpdate(params, playlistUUID))
    })

    it('Should fail without displayName', async function () {
      const params = getBase({ displayName: undefined })

      await createVideoPlaylist(params)
    })

    it('Should fail with an incorrect display name', async function () {
      const params = getBase({ displayName: 's'.repeat(300) })

      await createVideoPlaylist(params)
      await updateVideoPlaylist(getUpdate(params, playlistUUID))
    })

    it('Should fail with an incorrect description', async function () {
      const params = getBase({ description: 't' })

      await createVideoPlaylist(params)
      await updateVideoPlaylist(getUpdate(params, playlistUUID))
    })

    it('Should fail with an incorrect privacy', async function () {
      const params = getBase({ privacy: 45 })

      await createVideoPlaylist(params)
      await updateVideoPlaylist(getUpdate(params, playlistUUID))
    })

    it('Should fail with an unknown video channel id', async function () {
      const params = getBase({ videoChannelId: 42 }, { expectedStatus: 404 })

      await createVideoPlaylist(params)
      await updateVideoPlaylist(getUpdate(params, playlistUUID))
    })

    it('Should fail with an incorrect thumbnail file', async function () {
      const params = getBase({ thumbnailfile: 'avatar.png' })

      await createVideoPlaylist(params)
      await updateVideoPlaylist(getUpdate(params, playlistUUID))
    })

    it('Should fail to set "public" a playlist not assigned to a channel', async function () {
      const params = getBase({ privacy: VideoPlaylistPrivacy.PUBLIC, videoChannelId: undefined })
      const params2 = getBase({ privacy: VideoPlaylistPrivacy.PUBLIC, videoChannelId: 'null' })
      const params3 = getBase({ privacy: undefined, videoChannelId: 'null' })

      await createVideoPlaylist(params)
      await createVideoPlaylist(params2)
      await updateVideoPlaylist(getUpdate(params, privatePlaylistUUID))
      await updateVideoPlaylist(getUpdate(params2, playlistUUID))
      await updateVideoPlaylist(getUpdate(params3, playlistUUID))
    })

    it('Should fail with an unknown playlist to update', async function () {
      await updateVideoPlaylist(getUpdate(
        getBase({}, { expectedStatus: 404 }),
        42
      ))
    })

    it('Should fail to update a playlist of another user', async function () {
      await updateVideoPlaylist(getUpdate(
        getBase({}, { token: userAccessToken, expectedStatus: 403 }),
        playlistUUID
      ))
    })

    it('Should fail to update the watch later playlist', async function () {
      await updateVideoPlaylist(getUpdate(
        getBase({}, { expectedStatus: 400 }),
        watchLaterPlaylistId
      ))
    })

    it('Should succeed with the correct params', async function () {
      {
        const params = getBase({}, { expectedStatus: 200 })
        await createVideoPlaylist(params)
      }

      {
        const params = getBase({}, { expectedStatus: 204 })
        await updateVideoPlaylist(getUpdate(params, playlistUUID))
      }
    })
  })

  describe('When adding an element in a playlist', function () {
    const getBase = (elementAttrs: any = {}, wrapper: any = {}) => {
      return Object.assign({
        expectedStatus: 400,
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: Object.assign({
          videoId,
          startTimestamp: 2,
          stopTimestamp: 3
        }, elementAttrs)
      }, wrapper)
    }

    it('Should fail with an unauthenticated user', async function () {
      const params = getBase({}, { token: null, expectedStatus: 401 })
      await addVideoInPlaylist(params)
    })

    it('Should fail with the playlist of another user', async function () {
      const params = getBase({}, { token: userAccessToken, expectedStatus: 403 })
      await addVideoInPlaylist(params)
    })

    it('Should fail with an unknown or incorrect playlist id', async function () {
      {
        const params = getBase({}, { playlistId: 'toto' })
        await addVideoInPlaylist(params)
      }

      {
        const params = getBase({}, { playlistId: 42, expectedStatus: 404 })
        await addVideoInPlaylist(params)
      }
    })

    it('Should fail with an unknown or incorrect video id', async function () {
      const params = getBase({ videoId: 42 }, { expectedStatus: 404 })
      await addVideoInPlaylist(params)
    })

    it('Should fail with a bad start/stop timestamp', async function () {
      {
        const params = getBase({ startTimestamp: -42 })
        await addVideoInPlaylist(params)
      }

      {
        const params = getBase({ stopTimestamp: 'toto' as any })
        await addVideoInPlaylist(params)
      }
    })

    it('Succeed with the correct params', async function () {
      const params = getBase({}, { expectedStatus: 200 })
      const res = await addVideoInPlaylist(params)
      playlistElementId = res.body.videoPlaylistElement.id
    })

    it('Should fail if the video was already added in the playlist', async function () {
      const params = getBase({}, { expectedStatus: 409 })
      await addVideoInPlaylist(params)
    })
  })

  describe('When updating an element in a playlist', function () {
    const getBase = (elementAttrs: any = {}, wrapper: any = {}) => {
      return Object.assign({
        url: server.url,
        token: server.accessToken,
        elementAttrs: Object.assign({
          startTimestamp: 1,
          stopTimestamp: 2
        }, elementAttrs),
        playlistElementId,
        playlistId: playlistUUID,
        expectedStatus: 400
      }, wrapper)
    }

    it('Should fail with an unauthenticated user', async function () {
      const params = getBase({}, { token: null, expectedStatus: 401 })
      await updateVideoPlaylistElement(params)
    })

    it('Should fail with the playlist of another user', async function () {
      const params = getBase({}, { token: userAccessToken, expectedStatus: 403 })
      await updateVideoPlaylistElement(params)
    })

    it('Should fail with an unknown or incorrect playlist id', async function () {
      {
        const params = getBase({}, { playlistId: 'toto' })
        await updateVideoPlaylistElement(params)
      }

      {
        const params = getBase({}, { playlistId: 42, expectedStatus: 404 })
        await updateVideoPlaylistElement(params)
      }
    })

    it('Should fail with an unknown or incorrect playlistElement id', async function () {
      {
        const params = getBase({}, { playlistElementId: 'toto' })
        await updateVideoPlaylistElement(params)
      }

      {
        const params = getBase({}, { playlistElementId: 42, expectedStatus: 404 })
        await updateVideoPlaylistElement(params)
      }
    })

    it('Should fail with a bad start/stop timestamp', async function () {
      {
        const params = getBase({ startTimestamp: 'toto' as any })
        await updateVideoPlaylistElement(params)
      }

      {
        const params = getBase({ stopTimestamp: -42 })
        await updateVideoPlaylistElement(params)
      }
    })

    it('Should fail with an unknown element', async function () {
      const params = getBase({}, { playlistElementId: 888, expectedStatus: 404 })
      await updateVideoPlaylistElement(params)
    })

    it('Succeed with the correct params', async function () {
      const params = getBase({}, { expectedStatus: 204 })
      await updateVideoPlaylistElement(params)
    })
  })

  describe('When reordering elements of a playlist', function () {
    let videoId3: number
    let videoId4: number

    const getBase = (elementAttrs: any = {}, wrapper: any = {}) => {
      return Object.assign({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: Object.assign({
          startPosition: 1,
          insertAfterPosition: 2,
          reorderLength: 3
        }, elementAttrs),
        expectedStatus: 400
      }, wrapper)
    }

    before(async function () {
      videoId3 = (await uploadVideoAndGetId({ server, videoName: 'video 3' })).id
      videoId4 = (await uploadVideoAndGetId({ server, videoName: 'video 4' })).id

      for (const id of [ videoId3, videoId4 ]) {
        await addVideoInPlaylist({
          url: server.url,
          token: server.accessToken,
          playlistId: playlistUUID,
          elementAttrs: { videoId: id }
        })
      }
    })

    it('Should fail with an unauthenticated user', async function () {
      const params = getBase({}, { token: null, expectedStatus: 401 })
      await reorderVideosPlaylist(params)
    })

    it('Should fail with the playlist of another user', async function () {
      const params = getBase({}, { token: userAccessToken, expectedStatus: 403 })
      await reorderVideosPlaylist(params)
    })

    it('Should fail with an invalid playlist', async function () {
      {
        const params = getBase({}, { playlistId: 'toto' })
        await reorderVideosPlaylist(params)
      }

      {
        const params = getBase({}, { playlistId: 42, expectedStatus: 404 })
        await reorderVideosPlaylist(params)
      }
    })

    it('Should fail with an invalid start position', async function () {
      {
        const params = getBase({ startPosition: -1 })
        await reorderVideosPlaylist(params)
      }

      {
        const params = getBase({ startPosition: 'toto' as any })
        await reorderVideosPlaylist(params)
      }

      {
        const params = getBase({ startPosition: 42 })
        await reorderVideosPlaylist(params)
      }
    })

    it('Should fail with an invalid insert after position', async function () {
      {
        const params = getBase({ insertAfterPosition: 'toto' as any })
        await reorderVideosPlaylist(params)
      }

      {
        const params = getBase({ insertAfterPosition: -2 })
        await reorderVideosPlaylist(params)
      }

      {
        const params = getBase({ insertAfterPosition: 42 })
        await reorderVideosPlaylist(params)
      }
    })

    it('Should fail with an invalid reorder length', async function () {
      {
        const params = getBase({ reorderLength: 'toto' as any })
        await reorderVideosPlaylist(params)
      }

      {
        const params = getBase({ reorderLength: -2 })
        await reorderVideosPlaylist(params)
      }

      {
        const params = getBase({ reorderLength: 42 })
        await reorderVideosPlaylist(params)
      }
    })

    it('Succeed with the correct params', async function () {
      const params = getBase({}, { expectedStatus: 204 })
      await reorderVideosPlaylist(params)
    })
  })

  describe('When checking exists in playlist endpoint', function () {
    const path = '/api/v1/users/me/video-playlists/videos-exist'

    it('Should fail with an unauthenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: { videoIds: [ 1, 2 ] },
        statusCodeExpected: 401
      })
    })

    it('Should fail with invalid video ids', async function () {
      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path,
        query: { videoIds: 'toto' }
      })

      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path,
        query: { videoIds: [ 'toto' ] }
      })

      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path,
        query: { videoIds: [ 1, 'toto' ] }
      })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path,
        query: { videoIds: [ 1, 2 ] },
        statusCodeExpected: 200
      })
    })
  })

  describe('When deleting an element in a playlist', function () {
    const getBase = (wrapper: any = {}) => {
      return Object.assign({
        url: server.url,
        token: server.accessToken,
        playlistElementId,
        playlistId: playlistUUID,
        expectedStatus: 400
      }, wrapper)
    }

    it('Should fail with an unauthenticated user', async function () {
      const params = getBase({ token: null, expectedStatus: 401 })
      await removeVideoFromPlaylist(params)
    })

    it('Should fail with the playlist of another user', async function () {
      const params = getBase({ token: userAccessToken, expectedStatus: 403 })
      await removeVideoFromPlaylist(params)
    })

    it('Should fail with an unknown or incorrect playlist id', async function () {
      {
        const params = getBase({ playlistId: 'toto' })
        await removeVideoFromPlaylist(params)
      }

      {
        const params = getBase({ playlistId: 42, expectedStatus: 404 })
        await removeVideoFromPlaylist(params)
      }
    })

    it('Should fail with an unknown or incorrect video id', async function () {
      {
        const params = getBase({ playlistElementId: 'toto' })
        await removeVideoFromPlaylist(params)
      }

      {
        const params = getBase({ playlistElementId: 42, expectedStatus: 404 })
        await removeVideoFromPlaylist(params)
      }
    })

    it('Should fail with an unknown element', async function () {
      const params = getBase({ playlistElementId: 888, expectedStatus: 404 })
      await removeVideoFromPlaylist(params)
    })

    it('Succeed with the correct params', async function () {
      const params = getBase({ expectedStatus: 204 })
      await removeVideoFromPlaylist(params)
    })
  })

  describe('When deleting a playlist', function () {
    it('Should fail with an unknown playlist', async function () {
      await deleteVideoPlaylist(server.url, server.accessToken, 42, 404)
    })

    it('Should fail with a playlist of another user', async function () {
      await deleteVideoPlaylist(server.url, userAccessToken, playlistUUID, 403)
    })

    it('Should fail with the watch later playlist', async function () {
      await deleteVideoPlaylist(server.url, server.accessToken, watchLaterPlaylistId, 400)
    })

    it('Should succeed with the correct params', async function () {
      await deleteVideoPlaylist(server.url, server.accessToken, playlistUUID)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
