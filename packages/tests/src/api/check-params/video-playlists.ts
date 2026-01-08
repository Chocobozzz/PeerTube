/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  HttpStatusCode,
  VideoChannelCreateResult,
  VideoPlaylistCreate,
  VideoPlaylistCreateResult,
  VideoPlaylistElementCreate,
  VideoPlaylistElementUpdate,
  VideoPlaylistPrivacy,
  VideoPlaylistReorder,
  VideoPlaylistType
} from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  PlaylistsCommand,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'
import { expect } from 'chai'

describe('Test video playlists API validator', function () {
  let server: PeerTubeServer
  let userAccessToken: string
  let editorToken: string

  let playlist: VideoPlaylistCreateResult
  let userPlaylist: VideoPlaylistCreateResult
  let privatePlaylistUUID: string
  let anotherChannelPlaylistUUID: string
  let privateForEditorPlaylistUUID: string

  let watchLaterPlaylistId: number
  let videoId: number
  let elementId: number

  let command: PlaylistsCommand

  let anotherRootChannel: VideoChannelCreateResult

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    anotherRootChannel = await server.channels.create({ attributes: { name: 'another_root_channel' } })

    userAccessToken = await server.users.generateUserAndToken('user1')
    const user = await server.users.getMyInfo({ token: userAccessToken })

    editorToken = await server.channelCollaborators.createEditor('editor', 'root_channel')

    videoId = (await server.videos.quickUpload({ name: 'video 1' })).id

    command = server.playlists

    {
      const { data } = await command.listByAccount({
        token: server.accessToken,
        handle: 'root',
        start: 0,
        count: 5,
        playlistType: VideoPlaylistType.WATCH_LATER
      })
      watchLaterPlaylistId = data[0].id
    }

    {
      playlist = await command.create({
        attributes: {
          displayName: 'super playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.store.channel.id
        }
      })
    }

    {
      const created = await command.create({
        attributes: {
          displayName: 'another channel playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: anotherRootChannel.id
        }
      })
      anotherChannelPlaylistUUID = created.uuid
    }

    {
      const created = await command.create({
        attributes: {
          displayName: 'private',
          privacy: VideoPlaylistPrivacy.PRIVATE
        }
      })
      privatePlaylistUUID = created.uuid
    }

    {
      const created = await command.create({
        attributes: {
          displayName: 'private for editor',
          videoChannelId: server.store.channel.id,
          privacy: VideoPlaylistPrivacy.PRIVATE
        }
      })
      privateForEditorPlaylistUUID = created.uuid
    }

    {
      userPlaylist = await command.create({
        token: userAccessToken,
        attributes: {
          displayName: 'user playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: user.videoChannels[0].id
        }
      })
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
      await checkBadSort(server.url, globalPath, server.accessToken)
      await checkBadSort(server.url, accountPath, server.accessToken)
      await checkBadSort(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with a bad playlist type', async function () {
      await makeGetRequest({ url: server.url, path: globalPath, query: { playlistType: 3 } })
      await makeGetRequest({ url: server.url, path: accountPath, query: { playlistType: 3 } })
      await makeGetRequest({ url: server.url, path: videoChannelPath, query: { playlistType: 3 } })
    })

    it('Should fail with a bad account parameter', async function () {
      const accountPath = '/api/v1/accounts/root2/video-playlists'

      await makeGetRequest({
        url: server.url,
        path: accountPath,
        expectedStatus: HttpStatusCode.NOT_FOUND_404,
        token: server.accessToken
      })
    })

    it('Should fail with a bad video channel parameter', async function () {
      const accountPath = '/api/v1/video-channels/bad_channel/video-playlists'

      await makeGetRequest({
        url: server.url,
        path: accountPath,
        expectedStatus: HttpStatusCode.NOT_FOUND_404,
        token: server.accessToken
      })
    })

    it('Should not list playlists of a channel of another user', async function () {
      const { total, data } = await server.playlists.listByAccount({
        handle: 'user1',
        token: userAccessToken,
        channelNameOneOf: [ 'root_channel' ]
      })

      expect(total).to.equal(0)
      expect(data).to.have.lengthOf(0)
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path: globalPath, expectedStatus: HttpStatusCode.OK_200, token: server.accessToken })
      await makeGetRequest({ url: server.url, path: accountPath, expectedStatus: HttpStatusCode.OK_200, token: server.accessToken })
      await makeGetRequest({
        url: server.url,
        path: videoChannelPath,
        expectedStatus: HttpStatusCode.OK_200,
        token: server.accessToken
      })
    })
  })

  describe('When listing videos of a playlist', function () {
    const path = '/api/v1/video-playlists/'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path + playlist.shortUUID + '/videos', server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path + playlist.shortUUID + '/videos', server.accessToken)
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path: path + playlist.shortUUID + '/videos', expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When getting a video playlist', function () {
    it('Should fail with a bad id or uuid', async function () {
      await command.get({ playlistId: 'toto', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an unknown playlist', async function () {
      await command.get({ playlistId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail to get an unlisted playlist with the number id', async function () {
      const playlist = await command.create({
        attributes: {
          displayName: 'super playlist',
          videoChannelId: server.store.channel.id,
          privacy: VideoPlaylistPrivacy.UNLISTED
        }
      })

      await command.get({ playlistId: playlist.id, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await command.get({ playlistId: playlist.uuid, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should succeed with the correct params', async function () {
      for (const playlistId of [ playlist.uuid, privateForEditorPlaylistUUID ]) {
        for (const token of [ server.accessToken, editorToken ]) {
          await command.get({ playlistId, token, expectedStatus: HttpStatusCode.OK_200 })
        }
      }
    })
  })

  describe('When creating/updating a video playlist', function () {
    const getBase = (
      attributes?: Partial<VideoPlaylistCreate>,
      wrapper?: Partial<Parameters<PlaylistsCommand['create']>[0]>
    ) => {
      return {
        attributes: {
          displayName: 'display name',
          privacy: VideoPlaylistPrivacy.UNLISTED,
          thumbnailfile: 'custom-thumbnail.jpg',
          videoChannelId: server.store.channel.id,

          ...attributes
        },

        expectedStatus: HttpStatusCode.BAD_REQUEST_400,

        ...wrapper
      }
    }
    const getUpdate = (params: any, playlistId: number | string) => {
      return { ...params, playlistId }
    }

    it('Should fail with an unauthenticated user', async function () {
      const params = getBase({}, { token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })

      await command.create(params)
      await command.update(getUpdate(params, playlist.shortUUID))
    })

    it('Should fail without displayName', async function () {
      const params = getBase({ displayName: undefined })

      await command.create(params)
    })

    it('Should fail with an incorrect display name', async function () {
      const params = getBase({ displayName: 's'.repeat(300) })

      await command.create(params)
      await command.update(getUpdate(params, playlist.shortUUID))
    })

    it('Should fail with an incorrect description', async function () {
      const params = getBase({ description: 't' })

      await command.create(params)
      await command.update(getUpdate(params, playlist.shortUUID))
    })

    it('Should fail with an incorrect privacy', async function () {
      const params = getBase({ privacy: 45 as any })

      await command.create(params)
      await command.update(getUpdate(params, playlist.shortUUID))
    })

    it('Should fail with an unknown video channel id', async function () {
      const params = getBase({ videoChannelId: 42 }, { expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      await command.create(params)
      await command.update(getUpdate(params, playlist.shortUUID))
    })

    it('Should fail with an incorrect thumbnail file', async function () {
      const params = getBase({ thumbnailfile: 'video_short.mp4' })

      await command.create(params)
      await command.update(getUpdate(params, playlist.shortUUID))
    })

    it('Should fail with a thumbnail file too big', async function () {
      const params = getBase({ thumbnailfile: 'custom-preview-big.png' })

      await command.create(params)
      await command.update(getUpdate(params, playlist.shortUUID))
    })

    it('Should fail to set "public" a playlist not assigned to a channel', async function () {
      const params = getBase({ privacy: VideoPlaylistPrivacy.PUBLIC, videoChannelId: undefined })
      const params2 = getBase({ privacy: VideoPlaylistPrivacy.PUBLIC, videoChannelId: 'null' as any })
      const params3 = getBase({ privacy: undefined, videoChannelId: 'null' as any })

      await command.create(params)
      await command.create(params2)
      await command.update(getUpdate(params, privatePlaylistUUID))
      await command.update(getUpdate(params2, playlist.shortUUID))
      await command.update(getUpdate(params3, playlist.shortUUID))
    })

    it('Should fail with an unknown playlist to update', async function () {
      await command.update(getUpdate(
        getBase({}, { expectedStatus: HttpStatusCode.NOT_FOUND_404 }),
        42
      ))
    })

    it('Should fail to update a playlist of another user', async function () {
      await command.update(getUpdate(
        getBase({}, { token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 }),
        playlist.shortUUID
      ))
    })

    it('Should fail for an editor to update a playlist of another channel', async function () {
      await command.update(getUpdate(
        getBase({}, { token: editorToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 }),
        privatePlaylistUUID
      ))

      await command.update(getUpdate(
        getBase({}, { token: editorToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 }),
        anotherChannelPlaylistUUID
      ))
    })

    it('Should fail to set a playlist to a channel owned by another user', async function () {
      // User doesn't have the right on the root channel
      {
        const params = getBase({}, { token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })

        await command.create(params)
        await command.update(getUpdate(params, userPlaylist.shortUUID))
      }

      // User has the right on the channel, but this new channel is not owned by the playlist owner
      {
        const playlists: VideoPlaylistCreateResult[] = []

        playlists.push(
          await server.playlists.create({
            attributes: {
              displayName: 'playlist editor',
              videoChannelId: server.store.channel.id,
              privacy: VideoPlaylistPrivacy.PUBLIC
            },
            token: editorToken
          })
        )

        playlists.push(
          await server.playlists.create({
            attributes: {
              displayName: 'playlist editor',
              privacy: VideoPlaylistPrivacy.PRIVATE
            }
          })
        )

        for (const playlist of playlists) {
          await server.playlists.update({
            playlistId: playlist.shortUUID,
            attributes: { videoChannelId: await server.channels.getDefaultId({ token: userAccessToken }) },
            token: server.accessToken,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        }
      }
    })

    it('Should fail to update with another channel if the editor does not have the right on the target channel', async function () {
      const params = getBase({ videoChannelId: anotherRootChannel.id }, {
        token: editorToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })

      await command.update(getUpdate(params, playlist.shortUUID))
    })

    it('Should fail to update the watch later playlist', async function () {
      await command.update(getUpdate(
        getBase({}, { expectedStatus: HttpStatusCode.BAD_REQUEST_400 }),
        watchLaterPlaylistId
      ))
    })

    it('Should succeed with the correct params', async function () {
      for (const token of [ server.accessToken, editorToken ]) {
        {
          const params = getBase({}, { token, expectedStatus: HttpStatusCode.OK_200 })
          await command.create(params)
        }

        {
          const params = getBase({}, { token, expectedStatus: HttpStatusCode.NO_CONTENT_204 })
          await command.update(getUpdate(params, playlist.shortUUID))
        }
      }
    })
  })

  describe('When adding an element in a playlist', function () {
    const getBase = (
      attributes?: Partial<VideoPlaylistElementCreate>,
      wrapper?: Partial<Parameters<PlaylistsCommand['addElement']>[0]>
    ) => {
      return {
        attributes: {
          videoId,
          startTimestamp: 2,
          stopTimestamp: 3,

          ...attributes
        },

        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        playlistId: playlist.id,

        ...wrapper
      }
    }

    it('Should fail with an unauthenticated user', async function () {
      const params = getBase({}, { token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await command.addElement(params)
    })

    it('Should fail with the playlist of another user', async function () {
      const params = getBase({}, { token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await command.addElement(params)
    })

    it('Should fail for an editor to add elements to a private or another channel playlist', async function () {
      for (const playlistId of [ privatePlaylistUUID, anotherChannelPlaylistUUID ]) {
        await command.addElement(getBase({}, { playlistId, expectedStatus: HttpStatusCode.FORBIDDEN_403, token: editorToken }))
      }
    })

    it('Should fail with an unknown or incorrect playlist id', async function () {
      {
        const params = getBase({}, { playlistId: 'toto' })
        await command.addElement(params)
      }

      {
        const params = getBase({}, { playlistId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        await command.addElement(params)
      }
    })

    it('Should fail with an unknown or incorrect video id', async function () {
      const params = getBase({ videoId: 42 }, { expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await command.addElement(params)
    })

    it('Should fail with a bad start/stop timestamp', async function () {
      {
        const params = getBase({ startTimestamp: -42 })
        await command.addElement(params)
      }

      {
        const params = getBase({ stopTimestamp: 'toto' as any })
        await command.addElement(params)
      }
    })

    it('Succeed with the correct params', async function () {
      for (const token of [ editorToken, server.accessToken ]) {
        const params = getBase({}, { expectedStatus: HttpStatusCode.OK_200, token })
        const created = await command.addElement(params)
        elementId = created.id
      }
    })
  })

  describe('When updating an element in a playlist', function () {
    const getBase = (
      attributes?: Partial<VideoPlaylistElementUpdate>,
      wrapper?: Partial<Parameters<PlaylistsCommand['updateElement']>[0]>
    ) => {
      return {
        attributes: {
          startTimestamp: 1,
          stopTimestamp: 2,

          ...attributes
        },

        elementId,
        playlistId: playlist.id,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,

        ...wrapper
      }
    }

    it('Should fail with an unauthenticated user', async function () {
      const params = getBase({}, { token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await command.updateElement(params)
    })

    it('Should fail with the playlist of another user', async function () {
      const params = getBase({}, { token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await command.updateElement(params)
    })

    it('Should fail for an editor with elements of a private or another channel playlist', async function () {
      for (const playlistId of [ privatePlaylistUUID, anotherChannelPlaylistUUID ]) {
        await command.updateElement(getBase({}, { playlistId, expectedStatus: HttpStatusCode.FORBIDDEN_403, token: editorToken }))
      }
    })

    it('Should fail with an unknown or incorrect playlist id', async function () {
      {
        const params = getBase({}, { playlistId: 'toto' })
        await command.updateElement(params)
      }

      {
        const params = getBase({}, { playlistId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        await command.updateElement(params)
      }
    })

    it('Should fail with an unknown or incorrect playlistElement id', async function () {
      {
        const params = getBase({}, { elementId: 'toto' })
        await command.updateElement(params)
      }

      {
        const params = getBase({}, { elementId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        await command.updateElement(params)
      }
    })

    it('Should fail with a bad start/stop timestamp', async function () {
      {
        const params = getBase({ startTimestamp: 'toto' as any })
        await command.updateElement(params)
      }

      {
        const params = getBase({ stopTimestamp: -42 })
        await command.updateElement(params)
      }
    })

    it('Should fail with an unknown element', async function () {
      const params = getBase({}, { elementId: 888, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await command.updateElement(params)
    })

    it('Succeed with the correct params', async function () {
      for (const token of [ editorToken, server.accessToken ]) {
        const params = getBase({}, { expectedStatus: HttpStatusCode.NO_CONTENT_204, token })
        await command.updateElement(params)
      }
    })
  })

  describe('When reordering elements of a playlist or playlists in a channel', function () {
    let videoId3: number
    let videoId4: number

    const getBase = (
      attributes?: Partial<VideoPlaylistReorder>,
      wrapper?: Partial<Parameters<PlaylistsCommand['reorderElements'] | PlaylistsCommand['reorderPlaylistsOfChannel']>[0]>
    ) => {
      return {
        attributes: {
          startPosition: 1,
          insertAfterPosition: 2,
          reorderLength: 3,

          ...attributes
        },

        channelName: server.store.channel.name,
        playlistId: playlist.shortUUID,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,

        ...wrapper
      }
    }

    before(async function () {
      videoId3 = (await server.videos.quickUpload({ name: 'video 3' })).id
      videoId4 = (await server.videos.quickUpload({ name: 'video 4' })).id

      await command.create({
        attributes: {
          displayName: 'super playlist 2',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.store.channel.id
        }
      })

      for (const id of [ videoId3, videoId4 ]) {
        await command.addElement({ playlistId: playlist.shortUUID, attributes: { videoId: id } })
      }
    })

    describe('Common checks', function () {
      it('Should fail with an unauthenticated user', async function () {
        const params = getBase({}, { token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
        await command.reorderElements(params)
        await command.reorderPlaylistsOfChannel(params)
      })

      it('Should fail for an editor to add elements to a private or another channel playlist', async function () {
        for (const playlistId of [ privatePlaylistUUID, anotherChannelPlaylistUUID ]) {
          const params = getBase({}, {
            playlistId,
            channelName: 'another_root_channel',
            expectedStatus: HttpStatusCode.FORBIDDEN_403,
            token: editorToken
          })

          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }
      })

      it('Should fail with an invalid start position', async function () {
        {
          const params = getBase({ startPosition: -1 })
          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }

        {
          const params = getBase({ startPosition: 'toto' as any })
          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }

        {
          const params = getBase({ startPosition: 42 })
          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }
      })

      it('Should fail with an invalid insert after position', async function () {
        {
          const params = getBase({ insertAfterPosition: 'toto' as any })
          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }

        {
          const params = getBase({ insertAfterPosition: -2 })
          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }

        {
          const params = getBase({ insertAfterPosition: 42 })
          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }
      })

      it('Should fail with an invalid reorder length', async function () {
        {
          const params = getBase({ reorderLength: 'toto' as any })
          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }

        {
          const params = getBase({ reorderLength: -2 })
          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }

        {
          const params = getBase({ reorderLength: 42 })
          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }
      })

      it('Succeed with the correct params', async function () {
        for (const token of [ editorToken, server.accessToken ]) {
          const params = getBase({}, { expectedStatus: HttpStatusCode.NO_CONTENT_204, token })
          await command.reorderElements(params)
          await command.reorderPlaylistsOfChannel(params)
        }
      })
    })

    describe('Reordering elements of a playlist checks', function () {
      it('Should fail with the playlist of another user', async function () {
        const params = getBase({}, { token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await command.reorderElements(params)
      })

      it('Should fail with an invalid playlist', async function () {
        {
          const params = getBase({}, { playlistId: 'toto' })
          await command.reorderElements(params)
        }

        {
          const params = getBase({}, { playlistId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
          await command.reorderElements(params)
        }
      })
    })

    describe('Reordering playlists of a channel checks', function () {
      it('Should fail with the channel of another user', async function () {
        const params = getBase({}, { token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await command.reorderPlaylistsOfChannel(params)
      })

      it('Should fail with an unknown channel', async function () {
        const params = getBase({}, { channelName: 'toto', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        await command.reorderPlaylistsOfChannel(params)
      })

      it('Should fail with an invalid channel', async function () {
        {
          const params = getBase({}, { channelName: 42 as any, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
          await command.reorderPlaylistsOfChannel(params)
        }
      })
    })
  })

  describe('When checking exists in playlist endpoint', function () {
    const path = '/api/v1/users/me/video-playlists/videos-exist'

    it('Should fail with an unauthenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: { videoIds: [ 1, 2 ] },
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
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
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When deleting an element in a playlist', function () {
    const getBase = (wrapper: Partial<Parameters<PlaylistsCommand['removeElement']>[0]>) => {
      return {
        elementId,
        playlistId: playlist.uuid,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,

        ...wrapper
      }
    }

    it('Should fail with an unauthenticated user', async function () {
      const params = getBase({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await command.removeElement(params)
    })

    it('Should fail with the playlist of another user', async function () {
      const params = getBase({ token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await command.removeElement(params)
    })

    it('Should fail for an editor with a private or another channel playlist', async function () {
      for (const playlistId of [ privatePlaylistUUID, anotherChannelPlaylistUUID ]) {
        await command.removeElement(getBase({ token: editorToken, playlistId, expectedStatus: HttpStatusCode.FORBIDDEN_403 }))
      }
    })

    it('Should fail with an unknown or incorrect playlist id', async function () {
      {
        const params = getBase({ playlistId: 'toto' })
        await command.removeElement(params)
      }

      {
        const params = getBase({ playlistId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        await command.removeElement(params)
      }
    })

    it('Should fail with an unknown or incorrect video id', async function () {
      {
        const params = getBase({ elementId: 'toto' as any })
        await command.removeElement(params)
      }

      {
        const params = getBase({ elementId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        await command.removeElement(params)
      }
    })

    it('Should fail with an unknown element', async function () {
      const params = getBase({ elementId: 888, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await command.removeElement(params)
    })

    it('Succeed with the correct params', async function () {
      const params = getBase({ expectedStatus: HttpStatusCode.NO_CONTENT_204 })
      await command.removeElement(params)
    })
  })

  describe('When deleting a playlist', function () {
    it('Should fail with an unknown playlist', async function () {
      await command.delete({ playlistId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a playlist of another user', async function () {
      await command.delete({ token: userAccessToken, playlistId: playlist.uuid, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })
    it('Should fail for an editor with a private or another channel playlist', async function () {
      for (const playlistId of [ privatePlaylistUUID, anotherChannelPlaylistUUID ]) {
        await command.delete({ token: editorToken, playlistId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      }
    })

    it('Should fail with the watch later playlist', async function () {
      await command.delete({ playlistId: watchLaterPlaylistId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed with the correct params', async function () {
      await command.delete({ playlistId: playlist.uuid })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
