/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoPlaylistCreateResult } from '@peertube/peertube-models'
import { cleanupTests, makeGetRequest, makeHTMLRequest, PeerTubeServer } from '@peertube/peertube-server-commands'
import { checkIndexTags, getWatchPlaylistBasePaths, getWatchVideoBasePaths, prepareClientTests } from '@tests/shared/client.js'
import { expect } from 'chai'

describe('Test index HTML generation', function () {
  let servers: PeerTubeServer[]

  let videoIds: (string | number)[] = []
  let privateVideoId: string
  let internalVideoId: string
  let unlistedVideoId: string
  let unlistedVideoNumericId: number
  let passwordProtectedVideoId: string

  let playlist: VideoPlaylistCreateResult

  let playlistIds: (string | number)[] = []
  let privatePlaylistId: string
  let unlistedPlaylistId: string
  let unlistedPlaylistNumericId: number

  let instanceConfig: {
    name: string
    shortDescription: string
  }

  before(async function () {
    this.timeout(120000)
    ;({
      servers,
      playlistIds,
      videoIds,
      playlist,
      privateVideoId,
      internalVideoId,
      passwordProtectedVideoId,
      unlistedVideoId,
      unlistedVideoNumericId,
      privatePlaylistId,
      unlistedPlaylistId,
      unlistedPlaylistNumericId,
      instanceConfig
    } = await prepareClientTests())
  })

  describe('Instance tags', function () {
    it('Should have valid index html tags (title, description...)', async function () {
      const config = await servers[0].config.getConfig()
      const res = await makeHTMLRequest(servers[0].url, '/videos/browse')

      checkIndexTags(res.text, instanceConfig.name, instanceConfig.shortDescription, '', config)
    })

    it('Should update the customized configuration and have the correct index html tags', async function () {
      await servers[0].config.updateExistingConfig({
        newConfig: {
          instance: {
            name: 'PeerTube updated',
            shortDescription: 'my short description',
            description: 'my super description',
            terms: 'my super terms',
            defaultNSFWPolicy: 'warn',
            defaultClientRoute: '/videos/recently-added',
            customizations: {
              javascript: 'alert("coucou")',
              css: 'body { background-color: red; }'
            }
          }
        }
      })

      const config = await servers[0].config.getConfig()
      const res = await makeHTMLRequest(servers[0].url, '/videos/browse')

      checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }', config)
    })

    it('Should have valid index html updated tags (title, description...)', async function () {
      const config = await servers[0].config.getConfig()
      const res = await makeHTMLRequest(servers[0].url, '/videos/browse')

      checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }', config)
    })

    it('Should escape HTML characters in the index html tags', async function () {
      await servers[0].config.updateExistingConfig({
        newConfig: {
          instance: {
            name: '</script><img src=x onerror=alert(1)>'
          }
        }
      })
      const res = await makeHTMLRequest(servers[0].url, '/videos/browse')
      expect(res.text).to.contain('\\u003c/script\\u003e\\u003cimg src=x onerror=alert(1)\\u003e')
      expect(res.text).to.contain('<h1>&lt;&#x2F;script&gt;&lt;img src&#x3D;x onerror&#x3D;alert(1)&gt;</h1>')
    })
  })

  describe('Server rendered content', function () {
    it('Should render the instance name and short description', async function () {
      await servers[0].config.updateExistingConfig({
        newConfig: {
          instance: { name: 'PeerTube & co', shortDescription: 'my **short** description' }
        }
      })

      const { text } = await makeHTMLRequest(servers[0].url, '/videos/browse')

      expect(text).to.contain('<h1>PeerTube &amp; co</h1><p>my <strong>short</strong> description</p>')
    })

    it('Should render the video name and description', async function () {
      for (const basePath of getWatchVideoBasePaths()) {
        for (const id of videoIds) {
          const { text } = await makeHTMLRequest(servers[0].url, basePath + id)

          expect(text).to.contain('<h1>my super name for server 1</h1>')
          expect(text).to.contain('<strong>description</strong>')
        }
      }
    })

    it('Should render the playlist name and description', async function () {
      for (const basePath of getWatchPlaylistBasePaths()) {
        for (const id of playlistIds) {
          const { text } = await makeHTMLRequest(servers[0].url, basePath + id)

          expect(text).to.contain('<h1>super playlist name</h1><p>super playlist description</p>')
        }
      }
    })

    it('Should render the channel name and description', async function () {
      const { text } = await makeHTMLRequest(servers[0].url, '/c/root_channel')

      expect(text).to.contain('<h1>Main root channel</h1><p>my super channel description</p>')
    })
  })

  describe('Canonical tags', function () {
    it('Should use the original video URL for the canonical tag', async function () {
      for (const basePath of getWatchVideoBasePaths()) {
        for (const id of videoIds) {
          const res = await makeHTMLRequest(servers[0].url, basePath + id)
          expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/w/${servers[0].store.video.shortUUID}" />`)
        }
      }
    })

    it('Should use the original playlist URL for the canonical tag', async function () {
      for (const basePath of getWatchPlaylistBasePaths()) {
        for (const id of playlistIds) {
          const res = await makeHTMLRequest(servers[0].url, basePath + id)
          expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/w/p/${playlist.shortUUID}" />`)
        }
      }
    })

    it('Should use the original account URL for the canonical tag', async function () {
      const accountURLtest = res => {
        expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/a/root/video-channels" />`)
      }

      accountURLtest(await makeHTMLRequest(servers[0].url, '/accounts/root@' + servers[0].host))
      accountURLtest(await makeHTMLRequest(servers[0].url, '/a/root@' + servers[0].host))
      accountURLtest(await makeHTMLRequest(servers[0].url, '/@root@' + servers[0].host))
    })

    it('Should use the original channel URL for the canonical tag', async function () {
      const channelURLtests = res => {
        expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/c/root_channel/videos" />`)
      }

      channelURLtests(await makeHTMLRequest(servers[0].url, '/video-channels/root_channel@' + servers[0].host))
      channelURLtests(await makeHTMLRequest(servers[0].url, '/c/root_channel@' + servers[0].host))
      channelURLtests(await makeHTMLRequest(servers[0].url, '/@root_channel@' + servers[0].host))
    })

    it('Should not include query parameters in the canonical tag of client pages', async function () {
      const res = await makeHTMLRequest(servers[0].url, '/videos/browse?scope=local&sort=-views')

      expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/videos/browse" />`)
    })

    it('Should escape canonical tag URL', async function () {
      const res = await makeHTMLRequest(servers[0].url, '/watch/foo"><svg/onload=alert(1)>')
      expect(res.text).to.not.contain('<svg/onload=alert(1)>')
    })
  })

  describe('Indexation tags', function () {
    it('Should not index remote videos', async function () {
      for (const basePath of getWatchVideoBasePaths()) {
        for (const id of videoIds) {
          {
            const res = await makeHTMLRequest(servers[1].url, basePath + id)
            expect(res.text).to.contain('<meta name="robots" content="noindex" />')
          }

          {
            const res = await makeHTMLRequest(servers[0].url, basePath + id)
            expect(res.text).to.not.contain('<meta name="robots" content="noindex" />')
          }
        }
      }
    })

    it('Should not index remote playlists', async function () {
      for (const basePath of getWatchPlaylistBasePaths()) {
        for (const id of playlistIds) {
          {
            const res = await makeHTMLRequest(servers[1].url, basePath + id)
            expect(res.text).to.contain('<meta name="robots" content="noindex" />')
          }

          {
            const res = await makeHTMLRequest(servers[0].url, basePath + id)
            expect(res.text).to.not.contain('<meta name="robots" content="noindex" />')
          }
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

    it('Should add noindex meta tag for private client pages and search results', async function () {
      for (const path of [ '/login', '/signup', '/my-library/videos', '/admin/overview/users', '/search?search=toto' ]) {
        const { text } = await makeHTMLRequest(servers[0].url, path)

        expect(text, path).to.contain('<meta name="robots" content="noindex" />')
        expect(text, path).to.not.contain('rel="canonical"')
      }

      for (const path of [ '/', '/videos/browse', '/about/instance/home' ]) {
        const { text } = await makeHTMLRequest(servers[0].url, path)

        expect(text, path).to.not.contain('<meta name="robots" content="noindex" />')
      }
    })

    it('Should add noindex meta tag for unlisted video', async function () {
      for (const basePath of getWatchVideoBasePaths()) {
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

    it('Should add noindex meta tag for unlisted video playlist', async function () {
      for (const basePath of getWatchPlaylistBasePaths()) {
        const res = await makeGetRequest({
          url: servers[0].url,
          path: basePath + unlistedPlaylistId,
          accept: 'text/html',
          expectedStatus: HttpStatusCode.OK_200
        })

        expect(res.text).to.contain('unlisted')
        expect(res.text).to.contain('<meta name="robots" content="noindex" />')
      }
    })
  })

  describe('Check no leaks for private objects', function () {
    it('Should not display internal/private video', async function () {
      for (const basePath of getWatchVideoBasePaths()) {
        for (const id of [ privateVideoId, internalVideoId ]) {
          const res = await makeGetRequest({
            url: servers[0].url,
            path: basePath + id,
            accept: 'text/html',
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          })

          expect(res.text).to.not.contain('internal')
          expect(res.text).to.not.contain('private')
        }
      }
    })

    it('Should not display password protected video', async function () {
      for (const basePath of getWatchVideoBasePaths()) {
        const res = await makeGetRequest({
          url: servers[0].url,
          path: basePath + passwordProtectedVideoId,
          accept: 'text/html',
          expectedStatus: HttpStatusCode.OK_200
        })

        expect(res.text).to.not.contain('password protected')
      }
    })

    it('Should not display unlisted video using its numeric id', async function () {
      for (const basePath of getWatchVideoBasePaths()) {
        const res = await makeGetRequest({
          url: servers[0].url,
          path: basePath + unlistedVideoNumericId,
          accept: 'text/html',
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })

        expect(res.text).to.not.contain(unlistedVideoId)
        expect(res.text).to.not.contain('<meta property="og:title" content="unlisted" />')
      }
    })

    it('Should not display unlisted video playlist using its numeric id', async function () {
      for (const basePath of getWatchPlaylistBasePaths()) {
        const res = await makeGetRequest({
          url: servers[0].url,
          path: basePath + unlistedPlaylistNumericId,
          accept: 'text/html',
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })

        expect(res.text).to.not.contain(unlistedPlaylistId)
        expect(res.text).to.not.contain('<meta property="og:title" content="unlisted" />')
      }
    })

    it('Should not display private video playlist', async function () {
      for (const basePath of getWatchPlaylistBasePaths()) {
        const res = await makeGetRequest({
          url: servers[0].url,
          path: basePath + privatePlaylistId,
          accept: 'text/html',
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })

        expect(res.text).to.not.contain('private')
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
