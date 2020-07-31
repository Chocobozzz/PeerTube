/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import * as request from 'supertest'
import {
  cleanupTests,
  flushAndRunServer,
  getCustomConfig,
  getVideosList,
  makeHTMLRequest,
  ServerInfo,
  serverLogin,
  updateCustomConfig,
  updateCustomSubConfig,
  uploadVideo,
  createVideoPlaylist,
  addVideoInPlaylist,
  getAccount,
  addVideoChannel
} from '../../shared/extra-utils'
import { VideoPlaylistPrivacy } from '@shared/models'
import { MVideoPlaylist, MAccount, MChannel } from '@server/types/models'

const expect = chai.expect

function checkIndexTags (html: string, title: string, description: string, css: string) {
  expect(html).to.contain('<title>' + title + '</title>')
  expect(html).to.contain('<meta name="description" content="' + description + '" />')
  expect(html).to.contain('<style class="custom-css-style">' + css + '</style>')
}

describe('Test a client controllers', function () {
  let server: ServerInfo
  let videoPlaylist: MVideoPlaylist
  let account: MAccount
  let videoChannel: MChannel
  const name = 'my super name for server 1'
  const description = 'my super description for server 1'

  before(async function () {
    this.timeout(120000)

    server = await flushAndRunServer(1)
    server.accessToken = await serverLogin(server)

    // Video

    const videoAttributes = { name, description }

    await uploadVideo(server.url, server.accessToken, videoAttributes)

    const resVideosRequest = await getVideosList(server.url)

    const videos = resVideosRequest.body.data

    expect(videos.length).to.equal(1)

    server.video = videos[0]

    // Playlist

    const playlistAttrs = {
      displayName: name,
      description,
      privacy: VideoPlaylistPrivacy.PUBLIC
    }

    const resVideoPlaylistRequest = await createVideoPlaylist({ url: server.url, token: server.accessToken, playlistAttrs })

    videoPlaylist = resVideoPlaylistRequest.body.videoPlaylist

    await addVideoInPlaylist({
      url: server.url,
      token: server.accessToken,
      playlistId: videoPlaylist.id,
      elementAttrs: { videoId: server.video.id }
    })

    // Account

    const resAccountRequest = await getAccount(server.url, `${server.user.username}@${server.host}:${server.port}`)

    account = resAccountRequest.body.account

    // Channel

    const videoChannelAttributesArg = {
      name: `${server.user.username}_channel`,
      displayName: name,
      description
    }

    const resChannelRequest = await addVideoChannel(server.url, server.accessToken, videoChannelAttributesArg)

    videoChannel = resChannelRequest.body.videoChannel
  })

  it('Should have valid Open Graph tags on the watch page with video id', async function () {
    const res = await request(server.url)
      .get('/videos/watch/' + server.video.id)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain(`<meta property="og:title" content="${name}" />`)
    expect(res.text).to.contain(`<meta property="og:description" content="${description}" />`)
    expect(res.text).to.contain('<meta property="og:type" content="video" />')
    expect(res.text).to.contain(`<meta property="og:url" content="${server.url}/videos/watch/${server.video.uuid}" />`)
  })

  it('Should have valid Open Graph tags on the watch page with video uuid', async function () {
    const res = await request(server.url)
      .get('/videos/watch/' + server.video.uuid)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain(`<meta property="og:title" content="${name}" />`)
    expect(res.text).to.contain(`<meta property="og:description" content="${description}" />`)
    expect(res.text).to.contain('<meta property="og:type" content="video" />')
    expect(res.text).to.contain(`<meta property="og:url" content="${server.url}/videos/watch/${server.video.uuid}" />`)
  })

  it('Should have valid Open Graph tags on the watch playlist page', async function () {
    const res = await request(server.url)
      .get('/videos/watch/playlist/' + videoPlaylist.uuid)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain(`<meta property="og:title" content="${videoPlaylist.name}" />`)
    expect(res.text).to.contain(`<meta property="og:description" content="${videoPlaylist.description}" />`)
    expect(res.text).to.contain('<meta property="og:type" content="video" />')
    expect(res.text).to.contain(`<meta property="og:url" content="${server.url}/videos/watch/playlist/${videoPlaylist.uuid}" />`)
  })

  it('Should have valid Open Graph tags on the account page', async function () {
    const res = await request(server.url)
      .get('/accounts/' + server.user.username)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain(`<meta property="og:title" content="${account.getDisplayName()}" />`)
    expect(res.text).to.contain(`<meta property="og:description" content="${account.description}" />`)
    expect(res.text).to.contain('<meta property="og:type" content="website" />')
    expect(res.text).to.contain(`<meta property="og:url" content="${server.url}/accounts/${server.user.username}" />`)
  })

  it('Should have valid Open Graph tags on the channel page', async function () {
    const res = await request(server.url)
      .get('/video-channels/' + videoChannel.name)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain(`<meta property="og:title" content="${videoChannel.getDisplayName()}" />`)
    expect(res.text).to.contain(`<meta property="og:description" content="${videoChannel.description}" />`)
    expect(res.text).to.contain('<meta property="og:type" content="website" />')
    expect(res.text).to.contain(`<meta property="og:url" content="${server.url}/video-channels/${videoChannel.name}" />`)
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

  it('Should have valid twitter card on the whatch video page', async function () {
    const res = await request(server.url)
      .get('/videos/watch/' + server.video.uuid)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain('<meta property="twitter:card" content="summary_large_image" />')
    expect(res.text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
    expect(res.text).to.contain(`<meta property="twitter:title" content="${name}" />`)
    expect(res.text).to.contain(`<meta property="twitter:description" content="${description}" />`)
  })

  it('Should have valid twitter card on the watch playlist page', async function () {
    const res = await request(server.url)
      .get('/videos/watch/playlist/' + videoPlaylist.uuid)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain('<meta property="twitter:card" content="summary" />')
    expect(res.text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
    expect(res.text).to.contain(`<meta property="twitter:title" content="${videoPlaylist.name}" />`)
    expect(res.text).to.contain(`<meta property="twitter:description" content="${videoPlaylist.description}" />`)
  })

  it('Should have valid twitter card on the account page', async function () {
    const res = await request(server.url)
      .get('/accounts/' + account.name)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain('<meta property="twitter:card" content="summary" />')
    expect(res.text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
    expect(res.text).to.contain(`<meta property="twitter:title" content="${account.name}" />`)
    expect(res.text).to.contain(`<meta property="twitter:description" content="${account.description}" />`)
  })

  it('Should have valid twitter card on the channel page', async function () {
    const res = await request(server.url)
      .get('/video-channels/' + videoChannel.name)
      .set('Accept', 'text/html')
      .expect(200)

    expect(res.text).to.contain('<meta property="twitter:card" content="summary" />')
    expect(res.text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
    expect(res.text).to.contain(`<meta property="twitter:title" content="${videoChannel.name}" />`)
    expect(res.text).to.contain(`<meta property="twitter:description" content="${videoChannel.description}" />`)
  })

  it('Should have valid twitter card if Twitter is whitelisted', async function () {
    const res1 = await getCustomConfig(server.url, server.accessToken)
    const config = res1.body
    config.services.twitter = {
      username: '@Kuja',
      whitelisted: true
    }
    await updateCustomConfig(server.url, server.accessToken, config)

    const resVideoRequest = await request(server.url)
      .get('/videos/watch/' + server.video.uuid)
      .set('Accept', 'text/html')
      .expect(200)

    expect(resVideoRequest.text).to.contain('<meta property="twitter:card" content="player" />')
    expect(resVideoRequest.text).to.contain('<meta property="twitter:site" content="@Kuja" />')

    const resVideoPlaylistRequest = await request(server.url)
      .get('/videos/watch/playlist/' + videoPlaylist.uuid)
      .set('Accept', 'text/html')
      .expect(200)

    expect(resVideoPlaylistRequest.text).to.contain('<meta property="twitter:card" content="player" />')
    expect(resVideoPlaylistRequest.text).to.contain('<meta property="twitter:site" content="@Kuja" />')

    const resAccountRequest = await request(server.url)
      .get('/accounts/' + account.name)
      .set('Accept', 'text/html')
      .expect(200)

    expect(resAccountRequest.text).to.contain('<meta property="twitter:card" content="player" />')
    expect(resAccountRequest.text).to.contain('<meta property="twitter:site" content="@Kuja" />')

    const resChannelRequest = await request(server.url)
      .get('/video-channels/' + videoChannel.name)
      .set('Accept', 'text/html')
      .expect(200)

    expect(resChannelRequest.text).to.contain('<meta property="twitter:card" content="player" />')
    expect(resChannelRequest.text).to.contain('<meta property="twitter:site" content="@Kuja" />')
  })

  it('Should have valid index html tags (title, description...)', async function () {
    const res = await makeHTMLRequest(server.url, '/videos/trending')

    const description = 'PeerTube, an ActivityPub-federated video streaming platform using P2P directly in your web browser.'
    checkIndexTags(res.text, 'PeerTube', description, '')
  })

  it('Should update the customized configuration and have the correct index html tags', async function () {
    await updateCustomSubConfig(server.url, server.accessToken, {
      instance: {
        name: 'PeerTube updated',
        shortDescription: 'my short description',
        description: 'my super description',
        terms: 'my super terms',
        defaultClientRoute: '/videos/recently-added',
        defaultNSFWPolicy: 'blur',
        customizations: {
          javascript: 'alert("coucou")',
          css: 'body { background-color: red; }'
        }
      }
    })

    const res = await makeHTMLRequest(server.url, '/videos/trending')

    checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }')
  })

  it('Should have valid index html updated tags (title, description...)', async function () {
    const res = await makeHTMLRequest(server.url, '/videos/trending')

    checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }')
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
