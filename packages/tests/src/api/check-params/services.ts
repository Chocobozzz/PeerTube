/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  HttpStatusCode,
  HttpStatusCodeType,
  VideoCreateResult,
  VideoPlaylistCreateResult,
  VideoPlaylistPrivacy,
  VideoPrivacy
} from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test services API validators', function () {
  let server: PeerTubeServer
  let playlistUUID: string

  let privateVideo: VideoCreateResult
  let unlistedVideo: VideoCreateResult

  let privatePlaylist: VideoPlaylistCreateResult
  let unlistedPlaylist: VideoPlaylistCreateResult

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    server.store.videoCreated = await server.videos.upload({ attributes: { name: 'my super name' } })

    privateVideo = await server.videos.quickUpload({ name: 'private', privacy: VideoPrivacy.PRIVATE })
    unlistedVideo = await server.videos.quickUpload({ name: 'unlisted', privacy: VideoPrivacy.UNLISTED })

    {
      const created = await server.playlists.create({
        attributes: {
          displayName: 'super playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.store.channel.id
        }
      })

      playlistUUID = created.uuid

      privatePlaylist = await server.playlists.create({
        attributes: {
          displayName: 'private',
          privacy: VideoPlaylistPrivacy.PRIVATE,
          videoChannelId: server.store.channel.id
        }
      })

      unlistedPlaylist = await server.playlists.create({
        attributes: {
          displayName: 'unlisted',
          privacy: VideoPlaylistPrivacy.UNLISTED,
          videoChannelId: server.store.channel.id
        }
      })
    }
  })

  describe('Test oEmbed API validators', function () {
    it('Should fail with an invalid url', async function () {
      const embedUrl = 'hello.com'
      await checkParamEmbed(server, embedUrl)
    })

    it('Should fail with an invalid host', async function () {
      const embedUrl = 'http://hello.com/videos/watch/' + server.store.videoCreated.uuid
      await checkParamEmbed(server, embedUrl)
    })

    it('Should fail with an invalid element id', async function () {
      const embedUrl = `${server.url}/videos/watch/blabla`
      await checkParamEmbed(server, embedUrl)
    })

    it('Should fail with an unknown element', async function () {
      const embedUrl = `${server.url}/videos/watch/88fc0165-d1f0-4a35-a51a-3b47f668689c`
      await checkParamEmbed(server, embedUrl, HttpStatusCode.NOT_FOUND_404)
    })

    it('Should fail with an invalid path', async function () {
      const embedUrl = `${server.url}/videos/watchs/${server.store.videoCreated.uuid}`

      await checkParamEmbed(server, embedUrl)
    })

    it('Should fail with an invalid max height', async function () {
      const embedUrl = `${server.url}/videos/watch/${server.store.videoCreated.uuid}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.BAD_REQUEST_400, { maxheight: 'hello' })
    })

    it('Should fail with an invalid max width', async function () {
      const embedUrl = `${server.url}/videos/watch/${server.store.videoCreated.uuid}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.BAD_REQUEST_400, { maxwidth: 'hello' })
    })

    it('Should fail with an invalid format', async function () {
      const embedUrl = `${server.url}/videos/watch/${server.store.videoCreated.uuid}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.BAD_REQUEST_400, { format: 'blabla' })
    })

    it('Should fail with a non supported format', async function () {
      const embedUrl = `${server.url}/videos/watch/${server.store.videoCreated.uuid}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.NOT_IMPLEMENTED_501, { format: 'xml' })
    })

    it('Should fail with a private video', async function () {
      const embedUrl = `${server.url}/videos/watch/${privateVideo.uuid}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with an unlisted video with the int id', async function () {
      const embedUrl = `${server.url}/videos/watch/${unlistedVideo.id}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.FORBIDDEN_403)
    })

    it('Should succeed with an unlisted video using the uuid id', async function () {
      for (const uuid of [ unlistedVideo.uuid, unlistedVideo.shortUUID ]) {
        const embedUrl = `${server.url}/videos/watch/${uuid}`

        await checkParamEmbed(server, embedUrl, HttpStatusCode.OK_200)
      }
    })

    it('Should fail with a private playlist', async function () {
      const embedUrl = `${server.url}/videos/watch/playlist/${privatePlaylist.uuid}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with an unlisted playlist using the int id', async function () {
      const embedUrl = `${server.url}/videos/watch/playlist/${unlistedPlaylist.id}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.FORBIDDEN_403)
    })

    it('Should succeed with an unlisted playlist using the uuid id', async function () {
      for (const uuid of [ unlistedPlaylist.uuid, unlistedPlaylist.shortUUID ]) {
        const embedUrl = `${server.url}/videos/watch/playlist/${uuid}`

        await checkParamEmbed(server, embedUrl, HttpStatusCode.OK_200)
      }
    })

    it('Should succeed with the correct params with a video', async function () {
      const embedUrl = `${server.url}/videos/watch/${server.store.videoCreated.uuid}`
      const query = {
        format: 'json',
        maxheight: 400,
        maxwidth: 400
      }

      await checkParamEmbed(server, embedUrl, HttpStatusCode.OK_200, query)
    })

    it('Should succeed with the correct params with a playlist', async function () {
      const embedUrl = `${server.url}/videos/watch/playlist/${playlistUUID}`
      const query = {
        format: 'json',
        maxheight: 400,
        maxwidth: 400
      }

      await checkParamEmbed(server, embedUrl, HttpStatusCode.OK_200, query)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})

function checkParamEmbed (
  server: PeerTubeServer,
  embedUrl: string,
  expectedStatus: HttpStatusCodeType = HttpStatusCode.BAD_REQUEST_400,
  query = {}
) {
  const path = '/services/oembed'

  return makeGetRequest({
    url: server.url,
    path,
    query: Object.assign(query, { url: embedUrl }),
    expectedStatus
  })
}
