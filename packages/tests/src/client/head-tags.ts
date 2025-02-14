/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { config, expect } from 'chai'
import { Account, HttpStatusCode, VideoPlaylistCreateResult } from '@peertube/peertube-models'
import { cleanupTests, makeGetRequest, PeerTubeServer } from '@peertube/peertube-server-commands'
import { getWatchPlaylistBasePaths, getWatchVideoBasePaths, prepareClientTests } from '@tests/shared/client.js'

config.truncateThreshold = 0

describe('Test <head> HTML tags', function () {
  let servers: PeerTubeServer[]
  let account: Account

  let videoIds: (string | number)[] = []

  let videoName: string
  let videoDescriptionPlainText: string

  let playlistName: string
  let playlistDescription: string
  let playlist: VideoPlaylistCreateResult

  let channelDescription: string

  let playlistIds: (string | number)[] = []

  let instanceConfig: {
    name: string
    shortDescription: string
    avatar: string
  }

  before(async function () {
    this.timeout(120000);

    ({
      servers,
      instanceConfig,
      account,
      playlistIds,
      videoIds,
      videoName,
      videoDescriptionPlainText,
      playlistName,
      playlist,
      playlistDescription,
      channelDescription
    } = await prepareClientTests())
  })

  describe('Open Graph', function () {

    async function indexPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      let url = servers[0].url
      if (path !== '/') url += path

      expect(text).to.contain(`<meta property="og:title" content="${instanceConfig.name}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${instanceConfig.shortDescription}" />`)
      expect(text).to.contain('<meta property="og:type" content="website" />')
      expect(text).to.contain(`<meta property="og:url" content="${url}`)
      expect(text).to.contain(`<meta property="og:image:url" content="${servers[0].url}/`)
    }

    async function accountPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${account.displayName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${account.description}" />`)
      expect(text).to.contain('<meta property="og:type" content="website" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/a/${servers[0].store.user.username}/video-channels" />`)
      expect(text).to.not.contain(`<meta property="og:image:url"`)
    }

    async function channelPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${servers[0].store.channel.displayName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${channelDescription}" />`)
      expect(text).to.contain('<meta property="og:type" content="website" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/c/${servers[0].store.channel.name}/videos" />`)
      expect(text).to.contain(`<meta property="og:image:url" content="${servers[0].url}/`)
    }

    async function watchVideoPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${videoName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${videoDescriptionPlainText}" />`)
      expect(text).to.contain('<meta property="og:type" content="video" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/w/${servers[0].store.video.shortUUID}" />`)
      expect(text).to.contain(`<meta property="og:image:url" content="${servers[0].url}/`)
    }

    async function watchPlaylistPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${playlistName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${playlistDescription}" />`)
      expect(text).to.contain('<meta property="og:type" content="video" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/w/p/${playlist.shortUUID}" />`)
      expect(text).to.contain(`<meta property="og:image:url" content="${servers[0].url}/`)
    }

    it('Should have valid Open Graph tags on the common page', async function () {
      await indexPageTest('/about/peertube')
      await indexPageTest('/videos')
      await indexPageTest('/homepage')
      await indexPageTest('/')
    })

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
      for (const path of getWatchVideoBasePaths()) {
        for (const id of videoIds) {
          await watchVideoPageTest(path + id)
        }
      }
    })

    it('Should have valid Open Graph tags on the watch page with thread id Angular param', async function () {
      for (const path of getWatchVideoBasePaths()) {
        for (const id of videoIds) {
          await watchVideoPageTest(path + id + ';threadId=1')
        }
      }
    })

    it('Should have valid Open Graph tags on the watch playlist page', async function () {
      for (const path of getWatchPlaylistBasePaths()) {
        for (const id of playlistIds) {
          await watchPlaylistPageTest(path + id)
        }
      }
    })
  })

  describe('Twitter card', async function () {

    before(async function () {
      const config = await servers[0].config.getCustomConfig()
      config.services.twitter = {
        username: '@Kuja'
      }

      await servers[0].config.updateCustomConfig({ newCustomConfig: config })
    })

    async function accountPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain('<meta property="twitter:card" content="summary" />')
      expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      expect(text).to.not.contain(`<meta property="twitter:image:url"`)
    }

    async function channelPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain('<meta property="twitter:card" content="summary" />')
      expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      expect(text).to.contain(`<meta property="twitter:image:url" content="${servers[0].url}`)
    }

    async function watchVideoPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain('<meta property="twitter:card" content="player" />')
      expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      expect(text).to.contain(`<meta property="twitter:image:url" content="${servers[0].url}`)
    }

    async function watchPlaylistPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain('<meta property="twitter:card" content="player" />')
      expect(text).to.contain('<meta property="twitter:site" content="@Kuja" />')
      expect(text).to.contain(`<meta property="twitter:image:url" content="${servers[0].url}`)
    }

    it('Should have valid twitter card on the watch video page', async function () {
      for (const path of getWatchVideoBasePaths()) {
        for (const id of videoIds) {
          await watchVideoPageTest(path + id)
        }
      }
    })

    it('Should have valid twitter card on the watch playlist page', async function () {
      for (const path of getWatchPlaylistBasePaths()) {
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

  describe('Escaping', function () {

    it('Should correctly escape values', async function () {
      await servers[0].users.updateMe({ description: '<strong>"super description"</strong>' })

      const res = await makeGetRequest({ url: servers[0].url, path: '/a/root', accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="twitter:description" content="&quot;super description&quot;" />`)
      expect(text).to.contain(`<meta property="og:description" content="&quot;super description&quot;" />`)
    })
  })

  describe('Mastodon link', function () {

    async function check (path: string, mastoLink: string, exist = true) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      const expected = `<link href="${mastoLink}" rel="me">`

      if (exist)expect(text).to.contain(expected)
      else expect(text).to.not.contain(expected)
    }

    it('Should correctly include Mastodon link in account', async function () {
      await servers[0].users.updateMe({
        description: 'hi, please <a href="https://social.example.com/@username" rel="me">Follow me on Mastodon!</a>'
      })

      await check('/a/root', 'https://social.example.com/@username')
    })

    it('Should correctly include Mastodon link in channel', async function () {
      await servers[0].channels.update({
        channelName: 'root_channel',
        attributes: {
          description: '<a rel="me" href="https://social.example.com/@username2">Follow me on Mastodon!</a>'
        }
      })

      await check('/c/root_channel', 'https://social.example.com/@username2')
    })

    it('Should correctly include Mastodon link on homepage', async function () {
      await servers[0].config.updateExistingConfig({
        newConfig: {
          instance: {
            description: '<a>toto</a>coucou<a rel="me" href="https://social.example.com/@username3">Follow me on Mastodon!</a>'
          }
        }
      })

      await check('/', 'https://social.example.com/@username3')
      await check('/about', 'https://social.example.com/@username3', false)
    })
  })

  describe('RSS links', function () {

    async function commonPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      const feedUrl = `${servers[0].url}/feeds/videos.xml`
      // eslint-disable-next-line max-len
      expect(text).to.contain(`<link rel="alternate" type="application/rss+xml" title="super instance title - Videos feed" href="${feedUrl}" />`)
    }

    async function channelPageTest (path: string) {
      await commonPageTest(path)

      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      const feedUrl = `${servers[0].url}/feeds/podcast/videos.xml?videoChannelId=${servers[0].store.channel.id}`

      // eslint-disable-next-line max-len
      expect(text).to.contain(`<link rel="alternate" type="application/rss+xml" title="${servers[0].store.channel.displayName} feed" href="${feedUrl}" />`)
    }

    async function watchVideoPageTest (path: string) {
      await commonPageTest(path)

      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      const feedUrl = `${servers[0].url}/feeds/video-comments.xml?videoId=${servers[0].store.video.uuid}`
      expect(text).to.contain(`<link rel="alternate" type="application/rss+xml" title="${videoName} - Comments feed" href="${feedUrl}" />`)
    }

    it('Should have valid RSS links on the watch video page', async function () {
      for (const path of getWatchVideoBasePaths()) {
        await watchVideoPageTest(path + videoIds[0])
      }
    })

    it('Should have valid RSS links on the watch playlist page', async function () {
      for (const path of getWatchPlaylistBasePaths()) {
        for (const id of playlistIds) {
          await commonPageTest(path + id)
        }
      }
    })

    it('Should have valid RSS links on the account page', async function () {
      await commonPageTest('/accounts/' + account.name)
      await commonPageTest('/a/' + account.name)
      await commonPageTest('/@' + account.name)
    })

    it('Should have valid RSS links the channel page', async function () {
      await channelPageTest('/video-channels/' + servers[0].store.channel.name)
      await channelPageTest('/c/' + servers[0].store.channel.name)
      await channelPageTest('/@' + servers[0].store.channel.name)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
