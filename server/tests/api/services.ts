/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  ServerInfo,
  flushTests,
  uploadVideo,
  getVideosList,
  setAccessTokensToServers,
  killallServers,
  getOEmbed
} from '../utils'
import { runServer } from '../utils/servers'

describe('Test services', function () {
  let server: ServerInfo = null

  before(async function () {
    this.timeout(120000)

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

  it('Should have a valid oEmbed response', async function () {
    const oembedUrl = 'http://localhost:9001/videos/watch/' + server.video.uuid

    const res = await getOEmbed(server.url, oembedUrl)
    const expectedHtml = `<iframe width="560" height="315" src="http://localhost:9001/videos/embed/${server.video.uuid}" ` +
                         'frameborder="0" allowfullscreen></iframe>'
    const expectedThumbnailUrl = 'http://localhost:9001/static/thumbnails/' + server.video.uuid + '.jpg'

    expect(res.body.html).to.equal(expectedHtml)
    expect(res.body.title).to.equal(server.video.name)
    expect(res.body.author_name).to.equal(server.video.author)
    expect(res.body.height).to.equal(315)
    expect(res.body.width).to.equal(560)
    expect(res.body.thumbnail_url).to.equal(expectedThumbnailUrl)
    expect(res.body.thumbnail_width).to.equal(200)
    expect(res.body.thumbnail_height).to.equal(110)
  })

  it('Should have a valid oEmbed response with small max height query', async function () {
    const oembedUrl = 'http://localhost:9001/videos/watch/' + server.video.uuid
    const format = 'json'
    const maxHeight = 50
    const maxWidth = 50

    const res = await getOEmbed(server.url, oembedUrl, format, maxHeight, maxWidth)
    const expectedHtml = `<iframe width="50" height="50" src="http://localhost:9001/videos/embed/${server.video.uuid}" ` +
                         'frameborder="0" allowfullscreen></iframe>'

    expect(res.body.html).to.equal(expectedHtml)
    expect(res.body.title).to.equal(server.video.name)
    expect(res.body.author_name).to.equal(server.video.author)
    expect(res.body.height).to.equal(50)
    expect(res.body.width).to.equal(50)
    expect(res.body).to.not.have.property('thumbnail_url')
    expect(res.body).to.not.have.property('thumbnail_width')
    expect(res.body).to.not.have.property('thumbnail_height')
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
