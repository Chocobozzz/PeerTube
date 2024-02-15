/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { Account, HttpStatusCode, VideoPlaylistCreateResult } from '@peertube/peertube-models'
import { cleanupTests, makeGetRequest, PeerTubeServer } from '@peertube/peertube-server-commands'
import { getWatchPlaylistBasePaths, getWatchVideoBasePaths, prepareClientTests } from '@tests/shared/client.js'

describe('Test Open Graph and Twitter cards HTML tags', function () {
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

  before(async function () {
    this.timeout(120000);

    ({
      servers,
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

    async function accountPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${account.displayName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${account.description}" />`)
      expect(text).to.contain('<meta property="og:type" content="website" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/a/${servers[0].store.user.username}/video-channels" />`)
    }

    async function channelPageTest (path: string) {
      const res = await makeGetRequest({ url: servers[0].url, path, accept: 'text/html', expectedStatus: HttpStatusCode.OK_200 })
      const text = res.text

      expect(text).to.contain(`<meta property="og:title" content="${servers[0].store.channel.displayName}" />`)
      expect(text).to.contain(`<meta property="og:description" content="${channelDescription}" />`)
      expect(text).to.contain('<meta property="og:type" content="website" />')
      expect(text).to.contain(`<meta property="og:url" content="${servers[0].url}/c/${servers[0].store.channel.name}/videos" />`)
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

  after(async function () {
    await cleanupTests(servers)
  })
})
