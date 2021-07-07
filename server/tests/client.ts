/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { omit } from 'lodash'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { Account, CustomConfig, HTMLServerConfig, ServerConfig, VideoPlaylistCreateResult, VideoPlaylistPrivacy } from '@shared/models'
import {
  addVideoInPlaylist,
  cleanupTests,
  createVideoPlaylist,
  doubleFollow,
  flushAndRunMultipleServers,
  getAccount,
  getConfig,
  getCustomConfig,
  getVideosList,
  makeGetRequest,
  makeHTMLRequest,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateCustomConfig,
  updateCustomSubConfig,
  updateMyUser,
  updateVideoChannel,
  uploadVideo,
  waitJobs
} from '../../shared/extra-utils'

const expect = chai.expect

function checkIndexTags (html: string, title: string, description: string, css: string, config: ServerConfig) {
  expect(html).to.contain('<title>' + title + '</title>')
  expect(html).to.contain('<meta name="description" content="' + description + '" />')
  expect(html).to.contain('<style class="custom-css-style">' + css + '</style>')

  const htmlConfig: HTMLServerConfig = omit(config, 'signup')
  expect(html).to.contain(`<script type="application/javascript">window.PeerTubeServerConfig = '${JSON.stringify(htmlConfig)}'</script>`)
}

describe('Test a client controllers', function () {
  let servers: ServerInfo[] = []
  let account: Account

  const videoName = 'my super name for server 1'
  const videoDescription = 'my<br> super __description__ for *server* 1<p></p>'
  const videoDescriptionPlainText = 'my super description for server 1'

  const playlistName = 'super playlist name'
  const playlistDescription = 'super playlist description'
  let playlist: VideoPlaylistCreateResult

  const channelDescription = 'my super channel description'

  const watchVideoBasePaths = [ '/videos/watch/', '/w/' ]
  const watchPlaylistBasePaths = [ '/videos/watch/playlist/', '/w/p/' ]

  let videoIds: (string | number)[] = []
  let playlistIds: (string | number)[] = []

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await setDefaultVideoChannel(servers)

    await updateVideoChannel(servers[0].url, servers[0].accessToken, servers[0].videoChannel.name, { description: channelDescription })

    // Video

    const videoAttributes = { name: videoName, description: videoDescription }
    await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

    const resVideosRequest = await getVideosList(servers[0].url)
    const videos = resVideosRequest.body.data
    expect(videos.length).to.equal(1)

    const video = videos[0]
    servers[0].video = video
    videoIds = [ video.id, video.uuid, video.shortUUID ]

    // Playlist

    const playlistAttrs = {
      displayName: playlistName,
      description: playlistDescription,
      privacy: VideoPlaylistPrivacy.PUBLIC,
      videoChannelId: servers[0].videoChannel.id
    }

    const resVideoPlaylistRequest = await createVideoPlaylist({ url: servers[0].url, token: servers[0].accessToken, playlistAttrs })
    playlist = resVideoPlaylistRequest.body.videoPlaylist
    playlistIds = [ playlist.id, playlist.shortUUID, playlist.uuid ]

    await addVideoInPlaylist({
      url: servers[0].url,
      token: servers[0].accessToken,
      playlistId: playlist.shortUUID,
      elementAttrs: { videoId: video.id }
    })

    // Account

    await updateMyUser({ url: servers[0].url, accessToken: servers[0].accessToken, description: 'my account description' })

    const resAccountRequest = await getAccount(servers[0].url, `${servers[0].user.username}@${servers[0].host}`)
    account = resAccountRequest.body

    await waitJobs(servers)
  })

  describe('oEmbed', function () {

    it('Should have valid oEmbed discovery tags for videos', async function () {
      for (const basePath of watchVideoBasePaths) {
        for (const id of videoIds) {
          const res = await makeGetRequest({
            url: servers[0].url,
            path: basePath + id,
            accept: 'text/html',
            statusCodeExpected: HttpStatusCode.OK_200
          })

          const port = servers[0].port

          const expectedLink = '<link rel="alternate" type="application/json+oembed" href="http://localhost:' + port + '/services/oembed?' +
            `url=http%3A%2F%2Flocalhost%3A${port}%2Fw%2F${servers[0].video.uuid}" ` +
            `title="${servers[0].video.name}" />`

          expect(res.text).to.contain(expectedLink)
        }
      }
    })

    it('Should have valid oEmbed discovery tags for a playlist', async function () {
      for (const basePath of watchPlaylistBasePaths) {
        for (const id of playlistIds) {
          const res = await makeGetRequest({
            url: servers[0].url,
            path: basePath + id,
            accept: 'text/html',
            statusCodeExpected: HttpStatusCode.OK_200
          })

          const port = servers[0].port

          const expectedLink = '<link rel="alternate" type="application/json+oembed" href="http://localhost:' + port + '/services/oembed?' +
            `url=http%3A%2F%2Flocalhost%3A${port}%2Fw%2Fp%2F${playlist.uuid}" ` +
            `title="${playlistName}" />`

          expect(res.text).to.contain(expectedLink)
        }
      }
    })
  })

  describe('Open Graph', function () {

    async function accountPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${account.displayName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${account.description}" />`)
      expect(text).to.contain('<meta property="og:type" content="website" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/accounts/${servers[0].user.username}" />`)
    }

    async function channelPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${servers[0].videoChannel.displayName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${channelDescription}" />`)
      expect(text).to.contain('<meta property="og:type" content="website" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/video-channels/${servers[0].videoChannel.name}" />`)
    }

    async function watchVideoPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${videoName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${videoDescriptionPlainText}" />`)
      expect(text).to.contain('<meta property="og:type" content="video" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/w/${servers[0].video.uuid}" />`)
    }

    async function watchPlaylistPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${playlistName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${playlistDescription}" />`)
      expect(text).to.contain('<meta property="og:type" content="video" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/w/p/${playlist.uuid}" />`)
    }

    it('Should have valid Open Graph tags on the account page', async function () {
      await accountPageTest('/accounts/' + servers[0].user.username)
      await accountPageTest('/a/' + servers[0].user.username)
      await accountPageTest('/@' + servers[0].user.username)
    })

    it('Should have valid Open Graph tags on the channel page', async function () {
      await channelPageTest('/video-channels/' + servers[0].videoChannel.name)
      await channelPageTest('/c/' + servers[0].videoChannel.name)
      await channelPageTest('/@' + servers[0].videoChannel.name)
    })

    it('Should have valid Open Graph tags on the watch page', async function () {
      for (const path of watchVideoBasePaths) {
        for (const id of videoIds) {
          await watchVideoPageTest(path + id)
        }
      }
    })

    it('Should have valid Open Graph tags on the watch playlist page', async function () {
      for (const path of watchPlaylistBasePaths) {
        for (const id of playlistIds) {
          await watchPlaylistPageTest(path + id)
        }
      }
    })
  })

  describe('Twitter card', async function () {

    describe('Not whitelisted', function () {

      async function accountPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
        expect(text).to.contain(`<meta property="twitter:title" content="${account.name}" />`)
        expect(text).to.contain(`<meta property="twitter:description" content="${account.description}" />`)
      }

      async function channelPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
        expect(text).to.contain(`<meta property="twitter:title" content="${servers[0].videoChannel.displayName}" />`)
        expect(text).to.contain(`<meta property="twitter:description" content="${channelDescription}" />`)
      }

      async function watchVideoPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary_large_image" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
        expect(text).to.contain(`<meta property="twitter:title" content="${videoName}" />`)
        expect(text).to.contain(`<meta property="twitter:description" content="${videoDescriptionPlainText}" />`)
      }

      async function watchPlaylistPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
        expect(text).to.contain(`<meta property="twitter:title" content="${playlistName}" />`)
        expect(text).to.contain(`<meta property="twitter:description" content="${playlistDescription}" />`)
      }

      it('Should have valid twitter card on the watch video page', async function () {
        for (const path of watchVideoBasePaths) {
          for (const id of videoIds) {
            await watchVideoPageTest(path + id)
          }
        }
      })

      it('Should have valid twitter card on the watch playlist page', async function () {
        for (const path of watchPlaylistBasePaths) {
          for (const id of playlistIds) {
            await watchPlaylistPageTest(path + id)
          }
        }
      })

      it('Should have valid twitter card on the account page', async function () {
        await accountPageTest('/accounts/' + account.name)
        await accountPageTest('/a/' + account.name)
        await accountPageTest('/@' + account.name)
      })

      it('Should have valid twitter card on the channel page', async function () {
        await channelPageTest('/video-channels/' + servers[0].videoChannel.name)
        await channelPageTest('/c/' + servers[0].videoChannel.name)
        await channelPageTest('/@' + servers[0].videoChannel.name)
      })
    })

    describe('Whitelisted', function () {

      before(async function () {
        const res = await getCustomConfig(servers[0].url, servers[0].accessToken)
        const config = res.body as CustomConfig
        config.services.twitter = {
          username: '@Kuja',
          whitelisted: true
        }

        await updateCustomConfig(servers[0].url, servers[0].accessToken, config)
      })

      async function accountPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      }

      async function channelPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      }

      async function watchVideoPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="player" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      }

      async function watchPlaylistPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', statusCodeExpected: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="player" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      }

      it('Should have valid twitter card on the watch video page', async function () {
        for (const path of watchVideoBasePaths) {
          for (const id of videoIds) {
            await watchVideoPageTest(path + id)
          }
        }
      })

      it('Should have valid twitter card on the watch playlist page', async function () {
        for (const path of watchPlaylistBasePaths) {
          for (const id of playlistIds) {
            await watchPlaylistPageTest(path + id)
          }
        }
      })

      it('Should have valid twitter card on the account page', async function () {
        await accountPageTest('/accounts/' + account.name)
        await accountPageTest('/a/' + account.name)
        await accountPageTest('/@' + account.name)
      })

      it('Should have valid twitter card on the channel page', async function () {
        await channelPageTest('/video-channels/' + servers[0].videoChannel.name)
        await channelPageTest('/c/' + servers[0].videoChannel.name)
        await channelPageTest('/@' + servers[0].videoChannel.name)
      })
    })
  })

  describe('Index HTML', function () {

    it('Should have valid index html tags (title, description...)', async function () {
      const resConfig = await getConfig(servers[0].url)
      const res = await makeHTMLRequest(servers[0].url, '/videos/trending')

      const description = 'PeerTube, an ActivityPub-federated video streaming platform using P2P directly in your web browser.'
      checkIndexTags(res.text, 'PeerTube', description, '', resConfig.body)
    })

    it('Should update the customized configuration and have the correct index html tags', async function () {
      await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
        instance: {
          name: 'PeerTube updated',
          shortDescription: 'my short description',
          description: 'my super description',
          terms: 'my super terms',
          defaultNSFWPolicy: 'blur',
          defaultClientRoute: '/videos/recently-added',
          customizations: {
            javascript: 'alert("coucou")',
            css: 'body { background-color: red; }'
          }
        }
      })

      const resConfig = await getConfig(servers[0].url)
      const res = await makeHTMLRequest(servers[0].url, '/videos/trending')

      checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }', resConfig.body)
    })

    it('Should have valid index html updated tags (title, description...)', async function () {
      const resConfig = await getConfig(servers[0].url)
      const res = await makeHTMLRequest(servers[0].url, '/videos/trending')

      checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }', resConfig.body)
    })

    it('Should use the original video URL for the canonical tag', async function () {
      for (const basePath of watchVideoBasePaths) {
        for (const id of videoIds) {
          const res = await makeHTMLRequest(servers[1].url, basePath + id)
          expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/videos/watch/${servers[0].video.uuid}" />`)
        }
      }
    })

    it('Should use the original account URL for the canonical tag', async function () {
      const accountURLtest = (res) => {
        expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/accounts/root" />`)
      }

      accountURLtest(await makeHTMLRequest(servers[1].url, '/accounts/root@' + servers[0].host))
      accountURLtest(await makeHTMLRequest(servers[1].url, '/a/root@' + servers[0].host))
      accountURLtest(await makeHTMLRequest(servers[1].url, '/@root@' + servers[0].host))
    })

    it('Should use the original channel URL for the canonical tag', async function () {
      const channelURLtests = (res) => {
        expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/video-channels/root_channel" />`)
      }

      channelURLtests(await makeHTMLRequest(servers[1].url, '/video-channels/root_channel@' + servers[0].host))
      channelURLtests(await makeHTMLRequest(servers[1].url, '/c/root_channel@' + servers[0].host))
      channelURLtests(await makeHTMLRequest(servers[1].url, '/@root_channel@' + servers[0].host))
    })

    it('Should use the original playlist URL for the canonical tag', async function () {
      for (const basePath of watchPlaylistBasePaths) {
        for (const id of playlistIds) {
          const res = await makeHTMLRequest(servers[1].url, basePath + id)
          expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/video-playlists/${playlist.uuid}" />`)
        }
      }
    })
  })

  describe('Embed HTML', function () {

    it('Should have the correct embed html tags', async function () {
      const resConfig = await getConfig(servers[0].url)
      const res = await makeHTMLRequest(servers[0].url, servers[0].video.embedPath)

      checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }', resConfig.body)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
