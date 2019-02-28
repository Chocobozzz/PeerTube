/* tslint:disable:no-unused-expression */

import 'mocha'
import {
  createUser,
  createVideoPlaylist,
  deleteVideoPlaylist,
  flushTests,
  getVideoPlaylist,
  immutableAssign,
  killallServers,
  makeGetRequest,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  updateVideoPlaylist,
  userLogin,
  addVideoInPlaylist, uploadVideo, updateVideoPlaylistElement, removeVideoFromPlaylist, reorderVideosPlaylist
} from '../../../../shared/utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/utils/requests/check-api-params'
import { VideoPlaylistPrivacy } from '../../../../shared/models/videos/playlist/video-playlist-privacy.model'

describe('Test video playlists API validator', function () {
  let server: ServerInfo
  let userAccessToken = ''
  let playlistUUID: string
  let videoId: number
  let videoId2: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const username = 'user1'
    const password = 'my super password'
    await createUser(server.url, server.accessToken, username, password)
    userAccessToken = await userLogin(server, { username, password })

    {
      const res = await uploadVideo(server.url, server.accessToken, { name: 'video 1' })
      videoId = res.body.video.id
    }

    {
      const res = await uploadVideo(server.url, server.accessToken, { name: 'video 2' })
      videoId2 = res.body.video.id
    }

    {
      const res = await createVideoPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'super playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC
        }
      })
      playlistUUID = res.body.videoPlaylist.uuid
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
    const path = '/api/v1/video-playlists'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad filter', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
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

    it('Should fail with an unauthenticated user', async function () {
      const baseParams = {
        url: server.url,
        token: null,
        playlistAttrs: {
          displayName: 'super playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC
        },
        expectedStatus: 401
      }

      await createVideoPlaylist(baseParams)
      await updateVideoPlaylist(immutableAssign(baseParams, { playlistId: playlistUUID }))
    })

    it('Should fail without displayName', async function () {
      const baseParams = {
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          privacy: VideoPlaylistPrivacy.PUBLIC
        } as any,
        expectedStatus: 400
      }

      await createVideoPlaylist(baseParams)
      await updateVideoPlaylist(immutableAssign(baseParams, { playlistId: playlistUUID }))
    })

    it('Should fail with an incorrect display name', async function () {
      const baseParams = {
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 's'.repeat(300),
          privacy: VideoPlaylistPrivacy.PUBLIC
        },
        expectedStatus: 400
      }

      await createVideoPlaylist(baseParams)
      await updateVideoPlaylist(immutableAssign(baseParams, { playlistId: playlistUUID }))
    })

    it('Should fail with an incorrect description', async function () {
      const baseParams = {
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'display name',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          description: 't'
        },
        expectedStatus: 400
      }

      await createVideoPlaylist(baseParams)
      await updateVideoPlaylist(immutableAssign(baseParams, { playlistId: playlistUUID }))
    })

    it('Should fail with an incorrect privacy', async function () {
      const baseParams = {
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'display name',
          privacy: 45
        } as any,
        expectedStatus: 400
      }

      await createVideoPlaylist(baseParams)
      await updateVideoPlaylist(immutableAssign(baseParams, { playlistId: playlistUUID }))
    })

    it('Should fail with an unknown video channel id', async function () {
      const baseParams = {
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'display name',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: 42
        },
        expectedStatus: 404
      }

      await createVideoPlaylist(baseParams)
      await updateVideoPlaylist(immutableAssign(baseParams, { playlistId: playlistUUID }))
    })

    it('Should fail with an incorrect thumbnail file', async function () {
      const baseParams = {
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'display name',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          thumbnailfile: 'avatar.png'
        },
        expectedStatus: 400
      }

      await createVideoPlaylist(baseParams)
      await updateVideoPlaylist(immutableAssign(baseParams, { playlistId: playlistUUID }))
    })

    it('Should fail with an unknown playlist to update', async function () {
      await updateVideoPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: 42,
        playlistAttrs: {
          displayName: 'display name',
          privacy: VideoPlaylistPrivacy.PUBLIC
        },
        expectedStatus: 404
      })
    })

    it('Should fail to update a playlist of another user', async function () {
      await updateVideoPlaylist({
        url: server.url,
        token: userAccessToken,
        playlistId: playlistUUID,
        playlistAttrs: {
          displayName: 'display name',
          privacy: VideoPlaylistPrivacy.PUBLIC
        },
        expectedStatus: 403
      })
    })

    it('Should fail to update to private a public/unlisted playlist', async function () {
      const res = await createVideoPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'super playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC
        }
      })
      const playlist = res.body.videoPlaylist

      await updateVideoPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlist.id,
        playlistAttrs: {
          displayName: 'display name',
          privacy: VideoPlaylistPrivacy.PRIVATE
        },
        expectedStatus: 409
      })
    })

    it('Should succeed with the correct params', async function () {
      const baseParams = {
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'display name',
          privacy: VideoPlaylistPrivacy.UNLISTED,
          thumbnailfile: 'thumbnail.jpg'
        }
      }

      await createVideoPlaylist(baseParams)
      await updateVideoPlaylist(immutableAssign(baseParams, { playlistId: playlistUUID }))
    })
  })

  describe('When adding an element in a playlist', function () {
    it('Should fail with an unauthenticated user', async function () {
      await addVideoInPlaylist({
        url: server.url,
        token: null,
        elementAttrs: {
          videoId: videoId
        },
        playlistId: playlistUUID,
        expectedStatus: 401
      })
    })

    it('Should fail with the playlist of another user', async function () {
      await addVideoInPlaylist({
        url: server.url,
        token: userAccessToken,
        elementAttrs: {
          videoId: videoId
        },
        playlistId: playlistUUID,
        expectedStatus: 403
      })
    })

    it('Should fail with an unknown or incorrect playlist id', async function () {
      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          videoId: videoId
        },
        playlistId: 'toto',
        expectedStatus: 400
      })

      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          videoId: videoId
        },
        playlistId: 42,
        expectedStatus: 404
      })
    })

    it('Should fail with an unknown or incorrect video id', async function () {
      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          videoId: 'toto' as any
        },
        playlistId: playlistUUID,
        expectedStatus: 400
      })

      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          videoId: 42
        },
        playlistId: playlistUUID,
        expectedStatus: 404
      })
    })

    it('Should fail with a bad start/stop timestamp', async function () {
      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          videoId: videoId,
          startTimestamp: -42
        },
        playlistId: playlistUUID,
        expectedStatus: 400
      })

      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          videoId: videoId,
          stopTimestamp: 'toto' as any
        },
        playlistId: playlistUUID,
        expectedStatus: 400
      })
    })

    it('Succeed with the correct params', async function () {
      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          videoId: videoId,
          stopTimestamp: 3
        },
        playlistId: playlistUUID,
        expectedStatus: 200
      })
    })

    it('Should fail if the video was already added in the playlist', async function () {
      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          videoId: videoId,
          stopTimestamp: 3
        },
        playlistId: playlistUUID,
        expectedStatus: 409
      })
    })
  })

  describe('When updating an element in a playlist', function () {
    it('Should fail with an unauthenticated user', async function () {
      await updateVideoPlaylistElement({
        url: server.url,
        token: null,
        elementAttrs: { },
        videoId: videoId,
        playlistId: playlistUUID,
        expectedStatus: 401
      })
    })

    it('Should fail with the playlist of another user', async function () {
      await updateVideoPlaylistElement({
        url: server.url,
        token: userAccessToken,
        elementAttrs: { },
        videoId: videoId,
        playlistId: playlistUUID,
        expectedStatus: 403
      })
    })

    it('Should fail with an unknown or incorrect playlist id', async function () {
      await updateVideoPlaylistElement({
        url: server.url,
        token: server.accessToken,
        elementAttrs: { },
        videoId: videoId,
        playlistId: 'toto',
        expectedStatus: 400
      })

      await updateVideoPlaylistElement({
        url: server.url,
        token: server.accessToken,
        elementAttrs: { },
        videoId: videoId,
        playlistId: 42,
        expectedStatus: 404
      })
    })

    it('Should fail with an unknown or incorrect video id', async function () {
      await updateVideoPlaylistElement({
        url: server.url,
        token: server.accessToken,
        elementAttrs: { },
        videoId: 'toto',
        playlistId: playlistUUID,
        expectedStatus: 400
      })

      await updateVideoPlaylistElement({
        url: server.url,
        token: server.accessToken,
        elementAttrs: { },
        videoId: 42,
        playlistId: playlistUUID,
        expectedStatus: 404
      })
    })

    it('Should fail with a bad start/stop timestamp', async function () {
      await updateVideoPlaylistElement({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          startTimestamp: 'toto' as any
        },
        videoId: videoId,
        playlistId: playlistUUID,
        expectedStatus: 400
      })

      await updateVideoPlaylistElement({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          stopTimestamp: -42
        },
        videoId: videoId,
        playlistId: playlistUUID,
        expectedStatus: 400
      })
    })

    it('Should fail with an unknown element', async function () {
      await updateVideoPlaylistElement({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          stopTimestamp: 2
        },
        videoId: videoId2,
        playlistId: playlistUUID,
        expectedStatus: 404
      })
    })

    it('Succeed with the correct params', async function () {
      await updateVideoPlaylistElement({
        url: server.url,
        token: server.accessToken,
        elementAttrs: {
          stopTimestamp: 2
        },
        videoId: videoId,
        playlistId: playlistUUID,
        expectedStatus: 204
      })
    })
  })

  describe('When reordering elements of a playlist', function () {
    let videoId3: number
    let videoId4: number

    before(async function () {
      {
        const res = await uploadVideo(server.url, server.accessToken, { name: 'video 3' })
        videoId3 = res.body.video.id
      }

      {
        const res = await uploadVideo(server.url, server.accessToken, { name: 'video 4' })
        videoId4 = res.body.video.id
      }

      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: { videoId: videoId3 }
      })

      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: { videoId: videoId4 }
      })
    })

    it('Should fail with an unauthenticated user', async function () {
      await reorderVideosPlaylist({
        url: server.url,
        token: null,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: 2
        },
        expectedStatus: 401
      })
    })

    it('Should fail with the playlist of another user', async function () {
      await reorderVideosPlaylist({
        url: server.url,
        token: userAccessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: 2
        },
        expectedStatus: 403
      })
    })

    it('Should fail with an invalid playlist', async function () {
      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: 'toto',
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: 2
        },
        expectedStatus: 400
      })

      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: 42,
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: 2
        },
        expectedStatus: 404
      })
    })

    it('Should fail with an invalid start position', async function () {
      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: -1,
          insertAfterPosition: 2
        },
        expectedStatus: 400
      })

      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 'toto' as any,
          insertAfterPosition: 2
        },
        expectedStatus: 400
      })

      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 42,
          insertAfterPosition: 2
        },
        expectedStatus: 400
      })
    })

    it('Should fail with an invalid insert after position', async function () {
      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: 'toto' as any
        },
        expectedStatus: 400
      })

      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: -2
        },
        expectedStatus: 400
      })

      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: 42
        },
        expectedStatus: 400
      })
    })

    it('Should fail with an invalid reorder length', async function () {
      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: 2,
          reorderLength: 'toto' as any
        },
        expectedStatus: 400
      })

      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: 2,
          reorderLength: -1
        },
        expectedStatus: 400
      })

      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: 2,
          reorderLength: 4
        },
        expectedStatus: 400
      })
    })

    it('Succeed with the correct params', async function () {
      await reorderVideosPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: playlistUUID,
        elementAttrs: {
          startPosition: 1,
          insertAfterPosition: 2,
          reorderLength: 3
        },
        expectedStatus: 204
      })
    })
  })

  describe('When deleting an element in a playlist', function () {
    it('Should fail with an unauthenticated user', async function () {
      await removeVideoFromPlaylist({
        url: server.url,
        token: null,
        videoId,
        playlistId: playlistUUID,
        expectedStatus: 401
      })
    })

    it('Should fail with the playlist of another user', async function () {
      await removeVideoFromPlaylist({
        url: server.url,
        token: userAccessToken,
        videoId,
        playlistId: playlistUUID,
        expectedStatus: 403
      })
    })

    it('Should fail with an unknown or incorrect playlist id', async function () {
      await removeVideoFromPlaylist({
        url: server.url,
        token: server.accessToken,
        videoId,
        playlistId: 'toto',
        expectedStatus: 400
      })

      await removeVideoFromPlaylist({
        url: server.url,
        token: server.accessToken,
        videoId,
        playlistId: 42,
        expectedStatus: 404
      })
    })

    it('Should fail with an unknown or incorrect video id', async function () {
      await removeVideoFromPlaylist({
        url: server.url,
        token: server.accessToken,
        videoId: 'toto',
        playlistId: playlistUUID,
        expectedStatus: 400
      })

      await removeVideoFromPlaylist({
        url: server.url,
        token: server.accessToken,
        videoId: 42,
        playlistId: playlistUUID,
        expectedStatus: 404
      })
    })

    it('Should fail with an unknown element', async function () {
      await removeVideoFromPlaylist({
        url: server.url,
        token: server.accessToken,
        videoId: videoId2,
        playlistId: playlistUUID,
        expectedStatus: 404
      })
    })

    it('Succeed with the correct params', async function () {
      await removeVideoFromPlaylist({
        url: server.url,
        token: server.accessToken,
        videoId: videoId,
        playlistId: playlistUUID,
        expectedStatus: 204
      })
    })
  })

  describe('When deleting a playlist', function () {
    it('Should fail with an unknown playlist', async function () {
      await deleteVideoPlaylist(server.url, server.accessToken, 42, 404)
    })

    it('Should fail with a playlist of another user', async function () {
      await deleteVideoPlaylist(server.url, userAccessToken, playlistUUID, 403)
    })

    it('Should succeed with the correct params', async function () {
      await deleteVideoPlaylist(server.url, server.accessToken, playlistUUID)
    })
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
