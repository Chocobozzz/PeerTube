/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import * as request from 'supertest'
import { Account, VideoPlaylistPrivacy } from '@shared/models'
import {
  addVideoInPlaylist,
  cleanupTests,
  createVideoPlaylist,
  flushAndRunServer,
  getAccount,
  getCustomConfig,
  getVideosList,
  makeHTMLRequest,
  ServerInfo,
  serverLogin,
  setDefaultVideoChannel,
  updateCustomConfig,
  updateCustomSubConfig,
  uploadVideo,
  updateMyUser,
  updateVideoChannel
} from '../../shared/extra-utils'

const expect = chai.expect

function checkIndexTags (html: string, title: string, description: string, css: string) {
  expect(html).to.contain('<title>' + title + '</title>')
  expect(html).to.contain('<meta name="description" content="' + description + '" />')
  expect(html).to.contain('<style class="custom-css-style">' + css + '</style>')
}

describe('Test a client controllers', function () {
  let server: ServerInfo
  let account: Account

  const videoName = 'my super name for server 1'
  const videoDescription = 'my super description for server 1'

  const playlistName = 'super playlist name'
  const playlistDescription = 'super playlist description'
  let playlistUUID: string

  const channelDescription = 'my super channel description'

  before(async function () {
    this.timeout(120000)

    server = await flushAndRunServer(1)
    server.accessToken = await serverLogin(server)
    await setDefaultVideoChannel([ server ])

    await updateVideoChannel(server.url, server.accessToken, server.videoChannel.name, { description: channelDescription })

    // Video

    const videoAttributes = { name: videoName, description: videoDescription }
    await uploadVideo(server.url, server.accessToken, videoAttributes)

    const resVideosRequest = await getVideosList(server.url)
    const videos = resVideosRequest.body.data
    expect(videos.length).to.equal(1)

    server.video = videos[0]

    // Playlist

    const playlistAttrs = {
      displayName: playlistName,
      description: playlistDescription,
      privacy: VideoPlaylistPrivacy.PUBLIC,
      videoChannelId: server.videoChannel.id
    }

    const resVideoPlaylistRequest = await createVideoPlaylist({ url: server.url, token: server.accessToken, playlistAttrs })

    const playlist = resVideoPlaylistRequest.body.videoPlaylist
    const playlistId = playlist.id
    playlistUUID = playlist.uuid

    await addVideoInPlaylist({
      url: server.url,
      token: server.accessToken,
      playlistId,
      elementAttrs: { videoId: server.video.id }
    })

    // Account

    await updateMyUser({ url: server.url, accessToken: server.accessToken, description: 'my account description' })

    const resAccountRequest = await getAccount(server.url, `${server.user.username}@${server.host}`)
    account = resAccountRequest.body
  })

  describe('oEmbed', function () {
    it('Should have valid oEmbed discovery tags for videos', async function () {
      const path = '/videos/watch/' + server.video.uuid
      const res = await request(server.url)
        .get(path)
        .set('Accept', 'text/html')
        .expect(200)

      const port = server.port

      const expectedLink = '<link rel="alternate" type="application/json+oembed" href="http://localhost:' + port + '/services/oembed?' +
        `url=http%3A%2F%2Flocalhost%3A${port}%2Fvideos%2Fwatch%2F${server.video.uuid}" ` +
        `title="${server.video.name}" />`

      expect(res.text).to.contain(expectedLink)
    })

    it('Should have valid oEmbed discovery tags for a playlist', async function () {
      const res = await request(server.url)
        .get('/videos/watch/playlist/' + playlistUUID)
        .set('Accept', 'text/html')
        .expect(200)

      const port = server.port

      const expectedLink = '<link rel="alternate" type="application/json+oembed" href="http://localhost:' + port + '/services/oembed?' +
        `url=http%3A%2F%2Flocalhost%3A${port}%2Fvideos%2Fwatch%2Fplaylist%2F${playlistUUID}" ` +
        `title="${playlistName}" />`

      expect(res.text).to.contain(expectedLink)
    })
  })

  describe('Open Graph', function () {

    it('Should have valid Open Graph tags on the account page', async function () {
      const res = await request(server.url)
        .get('/accounts/' + server.user.username)
        .set('Accept', 'text/html')
        .expect(200)

      expect(res.text).to.contain(`<meta property="og:title" content="${account.displayName}" />`)
      expect(res.text).to.contain(`<meta property="og:description" content="${account.description}" />`)
      expect(res.text).to.contain('<meta property="og:type" content="website" />')
      expect(res.text).to.contain(`<meta property="og:url" content="${server.url}/accounts/${server.user.username}" />`)
    })

    it('Should have valid Open Graph tags on the channel page', async function () {
      const res = await request(server.url)
        .get('/video-channels/' + server.videoChannel.name)
        .set('Accept', 'text/html')
        .expect(200)

      expect(res.text).to.contain(`<meta property="og:title" content="${server.videoChannel.displayName}" />`)
      expect(res.text).to.contain(`<meta property="og:description" content="${channelDescription}" />`)
      expect(res.text).to.contain('<meta property="og:type" content="website" />')
      expect(res.text).to.contain(`<meta property="og:url" content="${server.url}/video-channels/${server.videoChannel.name}" />`)
    })

    it('Should have valid Open Graph tags on the watch page with video id', async function () {
      const res = await request(server.url)
        .get('/videos/watch/' + server.video.id)
        .set('Accept', 'text/html')
        .expect(200)

      expect(res.text).to.contain(`<meta property="og:title" content="${videoName}" />`)
      expect(res.text).to.contain(`<meta property="og:description" content="${videoDescription}" />`)
      expect(res.text).to.contain('<meta property="og:type" content="video" />')
      expect(res.text).to.contain(`<meta property="og:url" content="${server.url}/videos/watch/${server.video.uuid}" />`)
    })

    it('Should have valid Open Graph tags on the watch page with video uuid', async function () {
      const res = await request(server.url)
        .get('/videos/watch/' + server.video.uuid)
        .set('Accept', 'text/html')
        .expect(200)

      expect(res.text).to.contain(`<meta property="og:title" content="${videoName}" />`)
      expect(res.text).to.contain(`<meta property="og:description" content="${videoDescription}" />`)
      expect(res.text).to.contain('<meta property="og:type" content="video" />')
      expect(res.text).to.contain(`<meta property="og:url" content="${server.url}/videos/watch/${server.video.uuid}" />`)
    })

    it('Should have valid Open Graph tags on the watch playlist page', async function () {
      const res = await request(server.url)
        .get('/videos/watch/playlist/' + playlistUUID)
        .set('Accept', 'text/html')
        .expect(200)

      expect(res.text).to.contain(`<meta property="og:title" content="${playlistName}" />`)
      expect(res.text).to.contain(`<meta property="og:description" content="${playlistDescription}" />`)
      expect(res.text).to.contain('<meta property="og:type" content="video" />')
      expect(res.text).to.contain(`<meta property="og:url" content="${server.url}/videos/watch/playlist/${playlistUUID}" />`)
    })
  })

  describe('Twitter card', async function () {

    it('Should have valid twitter card on the watch video page', async function () {
      const res = await request(server.url)
        .get('/videos/watch/' + server.video.uuid)
        .set('Accept', 'text/html')
        .expect(200)

      expect(res.text).to.contain('<meta property="twitter:card" content="summary_large_image" />')
      expect(res.text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
      expect(res.text).to.contain(`<meta property="twitter:title" content="${videoName}" />`)
      expect(res.text).to.contain(`<meta property="twitter:description" content="${videoDescription}" />`)
    })

    it('Should have valid twitter card on the watch playlist page', async function () {
      const res = await request(server.url)
        .get('/videos/watch/playlist/' + playlistUUID)
        .set('Accept', 'text/html')
        .expect(200)

      expect(res.text).to.contain('<meta property="twitter:card" content="summary" />')
      expect(res.text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
      expect(res.text).to.contain(`<meta property="twitter:title" content="${playlistName}" />`)
      expect(res.text).to.contain(`<meta property="twitter:description" content="${playlistDescription}" />`)
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
        .get('/video-channels/' + server.videoChannel.name)
        .set('Accept', 'text/html')
        .expect(200)

      expect(res.text).to.contain('<meta property="twitter:card" content="summary" />')
      expect(res.text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
      expect(res.text).to.contain(`<meta property="twitter:title" content="${server.videoChannel.displayName}" />`)
      expect(res.text).to.contain(`<meta property="twitter:description" content="${channelDescription}" />`)
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
        .get('/videos/watch/playlist/' + playlistUUID)
        .set('Accept', 'text/html')
        .expect(200)

      expect(resVideoPlaylistRequest.text).to.contain('<meta property="twitter:card" content="player" />')
      expect(resVideoPlaylistRequest.text).to.contain('<meta property="twitter:site" content="@Kuja" />')

      const resAccountRequest = await request(server.url)
        .get('/accounts/' + account.name)
        .set('Accept', 'text/html')
        .expect(200)

      expect(resAccountRequest.text).to.contain('<meta property="twitter:card" content="summary" />')
      expect(resAccountRequest.text).to.contain('<meta property="twitter:site" content="@Kuja" />')

      const resChannelRequest = await request(server.url)
        .get('/video-channels/' + server.videoChannel.name)
        .set('Accept', 'text/html')
        .expect(200)

      expect(resChannelRequest.text).to.contain('<meta property="twitter:card" content="summary" />')
      expect(resChannelRequest.text).to.contain('<meta property="twitter:site" content="@Kuja" />')
    })
  })

  describe('Index HTML', function () {

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
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
