/* tslint:disable:no-unused-expression */

import * as request from 'supertest'
import 'mocha'

import {
  flushTests,
  runServer,
  setAccessTokensToServers,
  killallServers
} from '../../utils'
import { getVideosList, uploadVideo } from '../../utils/videos/videos'

describe('Test services API validators', function () {
  let server

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    await flushTests()

    server = await runServer(1)
    await setAccessTokensToServers([ server ])

    const videoAttributes = {
      name: 'my super name'
    }
    await uploadVideo(server.url, server.accessToken, videoAttributes)

    const res = await getVideosList(server.url)
    server.video = res.body.data[0]
  })

  describe('Test oEmbed API validators', function () {
    const path = '/services/oembed'

    it('Should fail with an invalid url', async function () {
      const embedUrl = 'hello.com'

      await request(server.url)
        .get(path)
        .query({ url: embedUrl })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400)
    })

    it('Should fail with an invalid host', async function () {
      const embedUrl = 'http://hello.com/videos/watch/' + server.video.uuid

      await request(server.url)
        .get(path)
        .query({ url: embedUrl })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400)
    })

    it('Should fail with an invalid video id', async function () {
      const embedUrl = 'http://localhost:9001/videos/watch/blabla'

      await request(server.url)
        .get(path)
        .query({ url: embedUrl })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400)
    })

    it('Should fail with an unknown video', async function () {
      const embedUrl = 'http://localhost:9001/videos/watch/88fc0165-d1f0-4a35-a51a-3b47f668689c'

      await request(server.url)
        .get(path)
        .query({ url: embedUrl })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(404)
    })

    it('Should fail with an invalid path', async function () {
      const embedUrl = 'http://localhost:9001/videos/watchs/' + server.video.uuid

      await request(server.url)
        .get(path)
        .query({ url: embedUrl })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400)
    })

    it('Should fail with an invalid max height', async function () {
      const embedUrl = 'http://localhost:9001/videos/watch/' + server.video.uuid

      await request(server.url)
        .get(path)
        .query({
          url: embedUrl,
          maxheight: 'hello'
        })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400)
    })

    it('Should fail with an invalid max width', async function () {
      const embedUrl = 'http://localhost:9001/videos/watch/' + server.video.uuid

      await request(server.url)
        .get(path)
        .query({
          url: embedUrl,
          maxwidth: 'hello'
        })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400)
    })

    it('Should fail with an invalid format', async function () {
      const embedUrl = 'http://localhost:9001/videos/watch/' + server.video.uuid

      await request(server.url)
        .get(path)
        .query({
          url: embedUrl,
          format: 'blabla'
        })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400)
    })

    it('Should fail with a non supported format', async function () {
      const embedUrl = 'http://localhost:9001/videos/watch/' + server.video.uuid

      await request(server.url)
        .get(path)
        .query({
          url: embedUrl,
          format: 'xml'
        })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(501)
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
