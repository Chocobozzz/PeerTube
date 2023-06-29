/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { omit } from '@shared/core-utils'
import {
  Account,
  HTMLServerConfig,
  HttpStatusCode,
  ServerConfig,
  VideoPlaylistCreateResult,
  VideoPlaylistPrivacy,
  VideoPrivacy
} from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  makeHTMLRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '../../shared/server-commands'

function checkIndexTags (html: string, title: string, description: string, css: string, config: ServerConfig) {
  expect(html).to.contain('<title>' + title + '</title>')
  expect(html).to.contain('<meta name="description" content="' + description + '" />')
  expect(html).to.contain('<style class="custom-css-style">' + css + '</style>')

  const htmlConfig: HTMLServerConfig = omit(config, [ 'signup' ])
  const configObjectString = JSON.stringify(htmlConfig)
  const configEscapedString = JSON.stringify(configObjectString)

  expect(html).to.contain(`<script type="application/javascript">window.PeerTubeServerConfig = ${configEscapedString}</script>`)
}

describe('Test a client controllers', function () {
  let servers: PeerTubeServer[] = []
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
  let privateVideoId: string
  let internalVideoId: string
  let unlistedVideoId: string
  let passwordProtectedVideoId: string

  let playlistIds: (string | number)[] = []

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await setDefaultVideoChannel(servers)

    await servers[0].channels.update({
      channelName: servers[0].store.channel.name,
      attributes: { description: channelDescription }
    })

    // Public video

    {
      const attributes = { name: videoName, description: videoDescription }
      await servers[0].videos.upload({ attributes })

      const { data } = await servers[0].videos.list()
      expect(data.length).to.equal(1)

      const video = data[0]
      servers[0].store.video = video
      videoIds = [ video.id, video.uuid, video.shortUUID ]
    }

    {
      ({ uuid: privateVideoId } = await servers[0].videos.quickUpload({ name: 'private', privacy: VideoPrivacy.PRIVATE }));
      ({ uuid: unlistedVideoId } = await servers[0].videos.quickUpload({ name: 'unlisted', privacy: VideoPrivacy.UNLISTED }));
      ({ uuid: internalVideoId } = await servers[0].videos.quickUpload({ name: 'internal', privacy: VideoPrivacy.INTERNAL }));
      ({ uuid: passwordProtectedVideoId } = await servers[0].videos.quickUpload({
        name: 'password protected',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ 'password' ]
      }))
    }

    // Playlist

    {
      const attributes = {
        displayName: playlistName,
        description: playlistDescription,
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[0].store.channel.id
      }

      playlist = await servers[0].playlists.create({ attributes })
      playlistIds = [ playlist.id, playlist.shortUUID, playlist.uuid ]

      await servers[0].playlists.addElement({ playlistId: playlist.shortUUID, attributes: { videoId: servers[0].store.video.id } })
    }

    // Account

    {
      await servers[0].users.updateMe({ description: 'my account description' })

      account = await servers[0].accounts.get({ accountName: `${servers[0].store.user.username}@${servers[0].host}` })
    }

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
            expectedStatus: HttpStatusCode.OK_200
          })

          const expectedLink = `<link rel="alternate" type="application/json+oembed" href="${servers[0].url}/services/oembed?` +
          `url=http%3A%2F%2F${servers[0].hostname}%3A${servers[0].port}%2Fw%2F${servers[0].store.video.shortUUID}" ` +
          `title="${servers[0].store.video.name}" />`

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
            expectedStatus: HttpStatusCode.OK_200
          })

          const expectedLink = `<link rel="alternate" type="application/json+oembed" href="${servers[0].url}/services/oembed?` +
            `url=http%3A%2F%2F${servers[0].hostname}%3A${servers[0].port}%2Fw%2Fp%2F${playlist.shortUUID}" ` +
            `title="${playlistName}" />`

          expect(res.text).to.contain(expectedLink)
        }
      }
    })
  })

  describe('Open Graph', function () {

    async function accountPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${account.displayName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${account.description}" />`)
      expect(text).to.contain('<meta property="og:type" content="website" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/a/${servers[0].store.user.username}" />`)
    }

    async function channelPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${servers[0].store.channel.displayName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${channelDescription}" />`)
      expect(text).to.contain('<meta property="og:type" content="website" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/c/${servers[0].store.channel.name}" />`)
    }

    async function watchVideoPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${videoName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${videoDescriptionPlainText}" />`)
      expect(text).to.contain('<meta property="og:type" content="video" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/w/${servers[0].store.video.shortUUID}" />`)
    }

    async function watchPlaylistPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${playlistName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${playlistDescription}" />`)
      expect(text).to.contain('<meta property="og:type" content="video" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/w/p/${playlist.shortUUID}" />`)
    }

    it('Should have valid Open Graph tags on the account page', async function () {
      await accountPageTest('/accounts/' + servers[0].store.user.username)
      await accountPageTest('/a/' + servers[0].store.user.username)
      await accountPageTest('/@' + servers[0].store.user.username)
    })

    it('Should have valid Open Graph tags on the channel page', async function () {
      await channelPageTest('/video-channels/' + servers[0].store.channel.name)
      await channelPageTest('/c/' + servers[0].store.channel.name)
      await channelPageTest('/@' + servers[0].store.channel.name)
    })

    it('Should have valid Open Graph tags on the watch page', async function () {
      for (const path of watchVideoBasePaths) {
        for (const id of videoIds) {
          await watchVideoPageTest(path + id)
        }
      }
    })

    it('Should have valid Open Graph tags on the watch page with thread id Angular param', async function () {
      for (const path of watchVideoBasePaths) {
        for (const id of videoIds) {
          await watchVideoPageTest(path + id + ';threadId=1')
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
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
        expect(text).to.contain(`<meta property="twitter:title" content="${account.name}" />`)
        expect(text).to.contain(`<meta property="twitter:description" content="${account.description}" />`)
      }

      async function channelPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
        expect(text).to.contain(`<meta property="twitter:title" content="${servers[0].store.channel.displayName}" />`)
        expect(text).to.contain(`<meta property="twitter:description" content="${channelDescription}" />`)
      }

      async function watchVideoPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary_large_image" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />')
        expect(text).to.contain(`<meta property="twitter:title" content="${videoName}" />`)
        expect(text).to.contain(`<meta property="twitter:description" content="${videoDescriptionPlainText}" />`)
      }

      async function watchPlaylistPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
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
        await channelPageTest('/video-channels/' + servers[0].store.channel.name)
        await channelPageTest('/c/' + servers[0].store.channel.name)
        await channelPageTest('/@' + servers[0].store.channel.name)
      })
    })

    describe('Whitelisted', function () {

      before(async function () {
        const config = await servers[0].config.getCustomConfig()
        config.services.twitter = {
          username: '@Kuja',
          whitelisted: true
        }

        await servers[0].config.updateCustomConfig({ newCustomConfig: config })
      })

      async function accountPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      }

      async function channelPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="summary" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      }

      async function watchVideoPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
        const text = res.text

        expect(text).to.contain('<meta property="twitter:card" content="player" />')
        expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      }

      async function watchPlaylistPageTest (path: string) {
        const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
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
        await channelPageTest('/video-channels/' + servers[0].store.channel.name)
        await channelPageTest('/c/' + servers[0].store.channel.name)
        await channelPageTest('/@' + servers[0].store.channel.name)
      })
    })
  })

  describe('Index HTML', function () {

    it('Should have valid index html tags (title, description...)', async function () {
      const config = await servers[0].config.getConfig()
      const res = await makeHTMLRequest(servers[0].url, '/videos/trending')

      const description = 'PeerTube, an ActivityPub-federated video streaming platform using P2P directly in your web browser.'
      checkIndexTags(res.text, 'PeerTube', description, '', config)
    })

    it('Should update the customized configuration and have the correct index html tags', async function () {
      await servers[0].config.updateCustomSubConfig({
        newConfig: {
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
        }
      })

      const config = await servers[0].config.getConfig()
      const res = await makeHTMLRequest(servers[0].url, '/videos/trending')

      checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }', config)
    })

    it('Should have valid index html updated tags (title, description...)', async function () {
      const config = await servers[0].config.getConfig()
      const res = await makeHTMLRequest(servers[0].url, '/videos/trending')

      checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }', config)
    })

    it('Should use the original video URL for the canonical tag', async function () {
      for (const basePath of watchVideoBasePaths) {
        for (const id of videoIds) {
          const res = await makeHTMLRequest(servers[1].url, basePath + id)
          expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/videos/watch/${servers[0].store.video.uuid}" />`)
        }
      }
    })

    it('Should use the original account URL for the canonical tag', async function () {
      const accountURLtest = res => {
        expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/accounts/root" />`)
      }

      accountURLtest(await makeHTMLRequest(servers[1].url, '/accounts/root@' + servers[0].host))
      accountURLtest(await makeHTMLRequest(servers[1].url, '/a/root@' + servers[0].host))
      accountURLtest(await makeHTMLRequest(servers[1].url, '/@root@' + servers[0].host))
    })

    it('Should use the original channel URL for the canonical tag', async function () {
      const channelURLtests = res => {
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

    it('Should add noindex meta tag for remote accounts', async function () {
      const handle = 'root@' + servers[0].host
      const paths = [ '/accounts/', '/a/', '/@' ]

      for (const path of paths) {
        {
          const { text } = await makeHTMLRequest(servers[1].url, path + handle)
          expect(text).to.contain('<meta name="robots" content="noindex" />')
        }

        {
          const { text } = await makeHTMLRequest(servers[0].url, path + handle)
          expect(text).to.not.contain('<meta name="robots" content="noindex" />')
        }
      }
    })

    it('Should add noindex meta tag for remote channels', async function () {
      const handle = 'root_channel@' + servers[0].host
      const paths = [ '/video-channels/', '/c/', '/@' ]

      for (const path of paths) {
        {
          const { text } = await makeHTMLRequest(servers[1].url, path + handle)
          expect(text).to.contain('<meta name="robots" content="noindex" />')
        }

        {
          const { text } = await makeHTMLRequest(servers[0].url, path + handle)
          expect(text).to.not.contain('<meta name="robots" content="noindex" />')
        }
      }
    })

    it('Should not display internal/private/password protected video', async function () {
      for (const basePath of watchVideoBasePaths) {
        for (const id of [ privateVideoId, internalVideoId, passwordProtectedVideoId ]) {
          const res = await makeGetRequest({
            url: servers[0].url,
            path: basePath + id,
            accept: 'text/html',
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          })

          expect(res.text).to.not.contain('internal')
          expect(res.text).to.not.contain('private')
          expect(res.text).to.not.contain('password protected')
        }
      }
    })

    it('Should add noindex meta tag for unlisted video', async function () {
      for (const basePath of watchVideoBasePaths) {
        const res = await makeGetRequest({
          url: servers[0].url,
          path: basePath + unlistedVideoId,
          accept: 'text/html',
          expectedStatus: HttpStatusCode.OK_200
        })

        expect(res.text).to.contain('unlisted')
        expect(res.text).to.contain('<meta name="robots" content="noindex" />')
      }
    })
  })

  describe('Embed HTML', function () {

    it('Should have the correct embed html tags', async function () {
      const config = await servers[0].config.getConfig()
      const res = await makeHTMLRequest(servers[0].url, servers[0].store.video.embedPath)

      checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }', config)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
