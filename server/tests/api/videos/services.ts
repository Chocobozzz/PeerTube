/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { flushTests, getOEmbed, getVideosList, killallServers, ServerInfo, setAccessTokensToServers, uploadVideo } from '../../utils/index'
import { runServer } from '../../utils/server/servers'

const expect = chai.expect

describe('Test services', function () {
  let server: ServerInfo = null

  before(async function () {
    this.timeout(30000)

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
    const expectedHtml = '<iframe width="560" height="315" sandbox="allow-same-origin allow-scripts" ' +
                         `src="http://localhost:9001/videos/embed/${server.video.uuid}" ` +
                         'frameborder="0" allowfullscreen></iframe>'
    const expectedThumbnailUrl = 'http://localhost:9001/static/previews/' + server.video.uuid + '.jpg'

    expect(res.body.html).to.equal(expectedHtml)
    expect(res.body.title).to.equal(server.video.name)
    expect(res.body.author_name).to.equal(server.video.account.name)
    expect(res.body.width).to.equal(560)
    expect(res.body.height).to.equal(315)
    expect(res.body.thumbnail_url).to.equal(expectedThumbnailUrl)
    expect(res.body.thumbnail_width).to.equal(560)
    expect(res.body.thumbnail_height).to.equal(315)
  })

  it('Should have a valid oEmbed response with small max height query', async function () {
    const oembedUrl = 'http://localhost:9001/videos/watch/' + server.video.uuid
    const format = 'json'
    const maxHeight = 50
    const maxWidth = 50

    const res = await getOEmbed(server.url, oembedUrl, format, maxHeight, maxWidth)
    const expectedHtml = '<iframe width="50" height="50" sandbox="allow-same-origin allow-scripts" ' +
                         `src="http://localhost:9001/videos/embed/${server.video.uuid}" ` +
                         'frameborder="0" allowfullscreen></iframe>'

    expect(res.body.html).to.equal(expectedHtml)
    expect(res.body.title).to.equal(server.video.name)
    expect(res.body.author_name).to.equal(server.video.account.name)
    expect(res.body.height).to.equal(50)
    expect(res.body.width).to.equal(50)
    expect(res.body).to.not.have.property('thumbnail_url')
    expect(res.body).to.not.have.property('thumbnail_width')
    expect(res.body).to.not.have.property('thumbnail_height')
  })

  after(async function () {
    killallServers([ server ])
  })
})
