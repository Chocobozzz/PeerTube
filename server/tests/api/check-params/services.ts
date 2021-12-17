/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@shared/server-commands'
import { HttpStatusCode, VideoPlaylistPrivacy } from '@shared/models'

describe('Test services API validators', function () {
  let server: PeerTubeServer
  let playlistUUID: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    server.store.videoCreated = await server.videos.upload({ attributes: { name: 'my super name' } })

    {
      const created = await server.playlists.create({
        attributes: {
          displayName: 'super playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.store.channel.id
        }
      })

      playlistUUID = created.uuid
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
      const embedUrl = `http://localhost:${server.port}/videos/watch/blabla`
      await checkParamEmbed(server, embedUrl)
    })

    it('Should fail with an unknown element', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/88fc0165-d1f0-4a35-a51a-3b47f668689c`
      await checkParamEmbed(server, embedUrl, HttpStatusCode.NOT_FOUND_404)
    })

    it('Should fail with an invalid path', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watchs/${server.store.videoCreated.uuid}`

      await checkParamEmbed(server, embedUrl)
    })

    it('Should fail with an invalid max height', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/${server.store.videoCreated.uuid}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.BAD_REQUEST_400, { maxheight: 'hello' })
    })

    it('Should fail with an invalid max width', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/${server.store.videoCreated.uuid}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.BAD_REQUEST_400, { maxwidth: 'hello' })
    })

    it('Should fail with an invalid format', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/${server.store.videoCreated.uuid}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.BAD_REQUEST_400, { format: 'blabla' })
    })

    it('Should fail with a non supported format', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/${server.store.videoCreated.uuid}`

      await checkParamEmbed(server, embedUrl, HttpStatusCode.NOT_IMPLEMENTED_501, { format: 'xml' })
    })

    it('Should succeed with the correct params with a video', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/${server.store.videoCreated.uuid}`
      const query = {
        format: 'json',
        maxheight: 400,
        maxwidth: 400
      }

      await checkParamEmbed(server, embedUrl, HttpStatusCode.OK_200, query)
    })

    it('Should succeed with the correct params with a playlist', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/playlist/${playlistUUID}`
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

function checkParamEmbed (server: PeerTubeServer, embedUrl: string, expectedStatus = HttpStatusCode.BAD_REQUEST_400, query = {}) {
  const path = '/services/oembed'

  return makeGetRequest({
    url: server.url,
    path,
    query: Object.assign(query, { url: embedUrl }),
    expectedStatus
  })
}
