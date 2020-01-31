/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import {
  cleanupTests,
  flushAndRunServer,
  makeGetRequest,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../../../shared/extra-utils'

describe('Test services API validators', function () {
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    const res = await uploadVideo(server.url, server.accessToken, { name: 'my super name' })
    server.video = res.body.video
  })

  describe('Test oEmbed API validators', function () {

    it('Should fail with an invalid url', async function () {
      const embedUrl = 'hello.com'
      await checkParamEmbed(server, embedUrl)
    })

    it('Should fail with an invalid host', async function () {
      const embedUrl = 'http://hello.com/videos/watch/' + server.video.uuid
      await checkParamEmbed(server, embedUrl)
    })

    it('Should fail with an invalid video id', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/blabla`
      await checkParamEmbed(server, embedUrl)
    })

    it('Should fail with an unknown video', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/88fc0165-d1f0-4a35-a51a-3b47f668689c`
      await checkParamEmbed(server, embedUrl, 404)
    })

    it('Should fail with an invalid path', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watchs/${server.video.uuid}`

      await checkParamEmbed(server, embedUrl)
    })

    it('Should fail with an invalid max height', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/${server.video.uuid}`

      await checkParamEmbed(server, embedUrl, 400, { maxheight: 'hello' })
    })

    it('Should fail with an invalid max width', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/${server.video.uuid}`

      await checkParamEmbed(server, embedUrl, 400, { maxwidth: 'hello' })
    })

    it('Should fail with an invalid format', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/${server.video.uuid}`

      await checkParamEmbed(server, embedUrl, 400, { format: 'blabla' })
    })

    it('Should fail with a non supported format', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/${server.video.uuid}`

      await checkParamEmbed(server, embedUrl, 501, { format: 'xml' })
    })

    it('Should succeed with the correct params', async function () {
      const embedUrl = `http://localhost:${server.port}/videos/watch/${server.video.uuid}`
      const query = {
        format: 'json',
        maxheight: 400,
        maxwidth: 400
      }

      await checkParamEmbed(server, embedUrl, 200, query)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})

function checkParamEmbed (server: ServerInfo, embedUrl: string, statusCodeExpected = 400, query = {}) {
  const path = '/services/oembed'

  return makeGetRequest({
    url: server.url,
    path,
    query: Object.assign(query, { url: embedUrl }),
    statusCodeExpected
  })
}
