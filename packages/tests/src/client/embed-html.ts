/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { ServerConfig, VideoPlaylistCreateResult } from '@peertube/peertube-models'
import { cleanupTests, makeHTMLRequest, PeerTubeServer } from '@peertube/peertube-server-commands'
import { checkIndexTags, prepareClientTests } from '@tests/shared/client.js'

describe('Test embed HTML generation', function () {
  let servers: PeerTubeServer[]

  let videoIds: (string | number)[] = []
  let videoName: string
  let videoDescriptionPlainText: string

  let privateVideoId: string
  let internalVideoId: string
  let unlistedVideoId: string
  let passwordProtectedVideoId: string

  let playlistIds: (string | number)[] = []
  let playlist: VideoPlaylistCreateResult
  let privatePlaylistId: string
  let unlistedPlaylistId: string
  let playlistName: string
  let playlistDescription: string

  let instanceConfig: { name: string, shortDescription: string }

  before(async function () {
    this.timeout(120000);

    ({
      servers,
      videoIds,
      privateVideoId,
      internalVideoId,
      passwordProtectedVideoId,
      unlistedVideoId,
      videoName,
      videoDescriptionPlainText,

      playlistIds,
      playlistName,
      playlistDescription,
      playlist,
      unlistedPlaylistId,
      privatePlaylistId,
      instanceConfig
    } = await prepareClientTests())
  })

  describe('HTML tags', function () {
    let config: ServerConfig

    before(async function () {
      config = await servers[0].config.getConfig()
    })

    it('Should have the correct embed html instance tags', async function () {
      const res = await makeHTMLRequest(servers[0].url, '/videos/embed/toto')

      checkIndexTags(res.text, instanceConfig.name, instanceConfig.shortDescription, '', config)

      expect(res.text).to.not.contain(`"name":`)
    })

    it('Should have the correct embed html video tags', async function () {
      const config = await servers[0].config.getConfig()
      const res = await makeHTMLRequest(servers[0].url, servers[0].store.video.embedPath)

      checkIndexTags(res.text, `${videoName} - ${instanceConfig.name}`, videoDescriptionPlainText, '', config)

      expect(res.text).to.contain(`"name":"${videoName}",`)
    })

    it('Should have the correct embed html playlist tags', async function () {
      const config = await servers[0].config.getConfig()
      const res = await makeHTMLRequest(servers[0].url, '/video-playlists/embed/' + playlistIds[0])

      checkIndexTags(res.text, `${playlistName} - ${instanceConfig.name}`, playlistDescription, '', config)
      expect(res.text).to.contain(`"name":"${playlistName}",`)
    })
  })

  describe('Canonical tags', function () {

    it('Should use the original video URL for the canonical tag', async function () {
      for (const id of videoIds) {
        const res = await makeHTMLRequest(servers[0].url, '/videos/embed/' + id)
        expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/w/${servers[0].store.video.shortUUID}" />`)
      }
    })

    it('Should use the original playlist URL for the canonical tag', async function () {
      for (const id of playlistIds) {
        const res = await makeHTMLRequest(servers[0].url, '/video-playlists/embed/' + id)
        expect(res.text).to.contain(`<link rel="canonical" href="${servers[0].url}/w/p/${playlist.shortUUID}" />`)
      }
    })

  })

  describe('Indexation tags', function () {

    it('Should not index remote videos', async function () {
      for (const id of videoIds) {
        {
          const res = await makeHTMLRequest(servers[1].url, '/videos/embed/' + id)
          expect(res.text).to.contain('<meta name="robots" content="noindex" />')
        }

        {
          const res = await makeHTMLRequest(servers[0].url, '/videos/embed/' + id)
          expect(res.text).to.not.contain('<meta name="robots" content="noindex" />')
        }
      }
    })

    it('Should not index remote playlists', async function () {
      for (const id of playlistIds) {
        {
          const res = await makeHTMLRequest(servers[1].url, '/video-playlists/embed/' + id)
          expect(res.text).to.contain('<meta name="robots" content="noindex" />')
        }

        {
          const res = await makeHTMLRequest(servers[0].url, '/video-playlists/embed/' + id)
          expect(res.text).to.not.contain('<meta name="robots" content="noindex" />')
        }
      }
    })

    it('Should add noindex meta tags for unlisted video', async function () {
      {
        const res = await makeHTMLRequest(servers[0].url, '/videos/embed/' + videoIds[0])

        expect(res.text).to.not.contain('<meta name="robots" content="noindex" />')
      }

      {
        const res = await makeHTMLRequest(servers[0].url, '/videos/embed/' + unlistedVideoId)

        expect(res.text).to.contain('unlisted')
        expect(res.text).to.contain('<meta name="robots" content="noindex" />')
      }
    })

    it('Should add noindex meta tags for unlisted playlist', async function () {
      {
        const res = await makeHTMLRequest(servers[0].url, '/video-playlists/embed/' + playlistIds[0])

        expect(res.text).to.not.contain('<meta name="robots" content="noindex" />')
      }

      {
        const res = await makeHTMLRequest(servers[0].url, '/video-playlists/embed/' + unlistedPlaylistId)

        expect(res.text).to.contain('unlisted')
        expect(res.text).to.contain('<meta name="robots" content="noindex" />')
      }
    })
  })

  describe('Check leak of private objects', function () {

    it('Should not leak video information in embed', async function () {
      for (const id of [ privateVideoId, internalVideoId, passwordProtectedVideoId ]) {
        const res = await makeHTMLRequest(servers[0].url, '/videos/embed/' + id)

        expect(res.text).to.not.contain('internal')
        expect(res.text).to.not.contain('private')
        expect(res.text).to.not.contain('password protected')
        expect(res.text).to.contain('<meta name="robots" content="noindex" />')
      }
    })

    it('Should not leak playlist information in embed', async function () {
      const res = await makeHTMLRequest(servers[0].url, '/video-playlists/embed/' + privatePlaylistId)

      expect(res.text).to.not.contain('private')
      expect(res.text).to.contain('<meta name="robots" content="noindex" />')
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
