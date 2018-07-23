/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import * as request from 'supertest'
const expect = chai.expect

import {
  ServerInfo,
  flushTests,
  runServer,
  serverLogin,
  uploadVideo,
  getVideosList, updateCustomConfig, getCustomConfig, killallServers, makeHTMLRequest
} from './utils'
import { CustomConfig } from '../../shared/models/server/custom-config.model'

function checkIndexTags (html: string, title: string, description: string, css: string) {
  expect(html).to.contain('<title>' + title + '</title>')
  expect(html).to.contain('<meta name="description" content="' + description + '" />')
  expect(html).to.contain('<style class="custom-css-style">' + css + '</style>')
}

describe('Test a client controllers', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(120000)

    await flushTests()

    server = await runServer(1)
    server.accessToken = await serverLogin(server)

    const videoAttributes = {
      name: 'my super name for server 1',
      description: 'my super description for server 1'
    }
    await uploadVideo(server.url, server.accessToken, videoAttributes)

    const res = await getVideosList(server.url)
    const videos = res.body.data

    expect(videos.length).to.equal(1)

    server.video = videos[0]
  })

  it('Should have valid Open Graph tags on the watch page with video id', async function () {
    const res = await request(server.url)
      .get('/videos/watch/' + server.video.id)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain('<meta property="og:title" content="my super name for server 1" />')
    expect(res.text).to.contain('<meta property="og:description" content="my super description for server 1" />')
  })

  it('Should have valid Open Graph tags on the watch page with video uuid', async function () {
    const res = await request(server.url)
      .get('/videos/watch/' + server.video.uuid)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain('<meta property="og:title" content="my super name for server 1" />')
    expect(res.text).to.contain('<meta property="og:description" content="my super description for server 1" />')
  })

  it('Should have valid oEmbed discovery tags', async function () {
    const path = '/videos/watch/' + server.video.uuid
    const res = await request(server.url)
      .get(path)
      .set('Accept', 'text/html')
      .expect(200)

    const expectedLink = '<link rel="alternate" type="application/json+oembed" href="http://localhost:9001/services/oembed?' +
      `url=http%3A%2F%2Flocalhost%3A9001%2Fvideos%2Fwatch%2F${server.video.uuid}" ` +
      `title="${server.video.name}" />`

    expect(res.text).to.contain(expectedLink)
  })

  it('Should have valid twitter card', async function () {
    const res = await request(server.url)
      .get('/videos/watch/' + server.video.uuid)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain('<meta property="twitter:card" content="summary_large_image" />')
    expect(res.text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
  })

  it('Should have valid twitter card if Twitter is whitelisted', async function () {
    const res1 = await getCustomConfig(server.url, server.accessToken)
    const config = res1.body
    config.services.twitter = {
      username: '@Kuja',
      whitelisted: true
    }
    await updateCustomConfig(server.url, server.accessToken, config)

    const res = await request(server.url)
      .get('/videos/watch/' + server.video.uuid)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain('<meta property="twitter:card" content="player" />')
    expect(res.text).to.contain('<meta property="twitter:site" content="@Kuja" />')
  })

  it('Should have valid index html tags (title, description...)', async function () {
    const res = await makeHTMLRequest(server.url, '/videos/trending')

    const description = 'PeerTube, a federated (ActivityPub) video streaming platform using P2P (BitTorrent) directly in the web browser ' +
      'with WebTorrent and Angular.'
    checkIndexTags(res.text, 'PeerTube', description, '')
  })

  it('Should update the customized configuration and have the correct index html tags', async function () {
    const newCustomConfig: CustomConfig = {
      instance: {
        name: 'PeerTube updated',
        shortDescription: 'my short description',
        description: 'my super description',
        terms: 'my super terms',
        defaultClientRoute: '/videos/recently-added',
        defaultNSFWPolicy: 'blur' as 'blur',
        customizations: {
          javascript: 'alert("coucou")',
          css: 'body { background-color: red; }'
        }
      },
      services: {
        twitter: {
          username: '@Kuja',
          whitelisted: true
        }
      },
      cache: {
        previews: {
          size: 2
        },
        captions: {
          size: 3
        }
      },
      signup: {
        enabled: false,
        limit: 5
      },
      admin: {
        email: 'superadmin1@example.com'
      },
      user: {
        videoQuota: 5242881
      },
      transcoding: {
        enabled: true,
        threads: 1,
        resolutions: {
          '240p': false,
          '360p': true,
          '480p': true,
          '720p': false,
          '1080p': false
        }
      }
    }
    await updateCustomConfig(server.url, server.accessToken, newCustomConfig)

    const res = await makeHTMLRequest(server.url, '/videos/trending')

    checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }')
  })

  it('Should have valid index html updated tags (title, description...)', async function () {
    const res = await makeHTMLRequest(server.url, '/videos/trending')

    checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }')
  })

  after(async function () {
    killallServers([ server ])
  })
})
