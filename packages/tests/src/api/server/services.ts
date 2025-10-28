/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, Video, VideoPlaylistPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test services', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
  })

  describe('OEmbed', function () {
    let playlistShortUUID: string
    let playlistUUID: string
    let playlistDisplayName: string

    let video: Video

    const urlSuffixes = [
      {
        input: '',
        output: ''
      },
      {
        input: '?param=1',
        output: ''
      },
      {
        input: '?muted=1&warningTitle=0&toto=1',
        output: '?muted=1&warningTitle=0'
      }
    ]

    before(async function () {
      {
        const attributes = { name: 'my super name' }
        await servers[0].videos.upload({ attributes })

        const { data } = await servers[0].videos.list()
        video = data[0]
      }

      {
        const created = await servers[0].playlists.create({
          attributes: {
            displayName: 'The Life and Times of Scrooge McDuck',
            privacy: VideoPlaylistPrivacy.PUBLIC,
            videoChannelId: servers[0].store.channel.id
          }
        })

        playlistUUID = created.uuid
        playlistShortUUID = created.shortUUID
        playlistDisplayName = 'The Life and Times of Scrooge McDuck'

        await servers[0].playlists.addElement({
          playlistId: created.id,
          attributes: {
            videoId: video.id
          }
        })
      }
    })

    it('Should have a valid oEmbed video response', async function () {
      for (const basePath of [ '/videos/watch/', '/w/' ]) {
        for (const suffix of urlSuffixes) {
          const oembedUrl = servers[0].url + basePath + video.uuid + suffix.input

          const res = await servers[0].services.getOEmbed({ oembedUrl })
          const expectedHtml = '<iframe width="560" height="315" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" ' +
            `title="${video.name}" src="http://${servers[0].host}/videos/embed/${video.shortUUID}${suffix.output}" ` +
            'style="border: none" allow="fullscreen"></iframe>'

          const expectedThumbnailUrl = 'http://' + servers[0].host + video.previewPath

          expect(res.body.html).to.equal(expectedHtml)
          expect(res.body.title).to.equal(video.name)
          expect(res.body.author_name).to.equal(servers[0].store.channel.displayName)
          expect(res.body.width).to.equal(560)
          expect(res.body.height).to.equal(315)
          expect(res.body.thumbnail_url).to.equal(expectedThumbnailUrl)
          expect(res.body.thumbnail_width).to.equal(850)
          expect(res.body.thumbnail_height).to.equal(480)
        }
      }
    })

    it('Should have a valid playlist oEmbed response', async function () {
      for (const basePath of [ '/videos/watch/playlist/', '/w/p/' ]) {
        for (const suffix of urlSuffixes) {
          const oembedUrl = servers[0].url + basePath + playlistUUID + suffix.input

          const res = await servers[0].services.getOEmbed({ oembedUrl })
          const expectedHtml = '<iframe width="560" height="315" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" ' +
            `title="${playlistDisplayName}" src="http://${servers[0].host}/video-playlists/embed/${playlistShortUUID}${suffix.output}" ` +
            'style="border: none" allow="fullscreen"></iframe>'

          expect(res.body.html).to.equal(expectedHtml)
          expect(res.body.title).to.equal('The Life and Times of Scrooge McDuck')
          expect(res.body.author_name).to.equal(servers[0].store.channel.displayName)
          expect(res.body.width).to.equal(560)
          expect(res.body.height).to.equal(315)
          expect(res.body.thumbnail_url).exist
          expect(res.body.thumbnail_width).to.equal(280)
          expect(res.body.thumbnail_height).to.equal(157)
        }
      }
    })

    it('Should have a oEmbed response with query params', async function () {
      const query = '?start=1m2s&stop=2'
      const oembedUrl = `http://${servers[0].host}/w/${video.uuid}${query}&unknown=3`
      const res = await servers[0].services.getOEmbed({ oembedUrl })

      const expectedHtml = '<iframe width="560" height="315" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" ' +
        `title="${video.name}" src="http://${servers[0].host}/videos/embed/${video.shortUUID}${query}" ` +
        'style="border: none" allow="fullscreen"></iframe>'

      expect(res.body.html).to.equal(expectedHtml)
    })

    it('Should have a valid oEmbed response with small max height query', async function () {
      for (const basePath of [ '/videos/watch/', '/w/' ]) {
        const oembedUrl = 'http://' + servers[0].host + basePath + video.uuid
        const format = 'json'
        const maxHeight = 50
        const maxWidth = 50

        const res = await servers[0].services.getOEmbed({ oembedUrl, format, maxHeight, maxWidth })
        const expectedHtml = '<iframe width="50" height="50" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" ' +
          `title="${video.name}" src="http://${servers[0].host}/videos/embed/${video.shortUUID}" ` +
          'style="border: none" allow="fullscreen"></iframe>'

        expect(res.body.html).to.equal(expectedHtml)
        expect(res.body.title).to.equal(video.name)
        expect(res.body.author_name).to.equal(servers[0].store.channel.displayName)
        expect(res.body.height).to.equal(50)
        expect(res.body.width).to.equal(50)
        expect(res.body).to.not.have.property('thumbnail_url')
        expect(res.body).to.not.have.property('thumbnail_width')
        expect(res.body).to.not.have.property('thumbnail_height')
      }
    })
  })

  describe('Actor redirection', function () {
    it('Should redirect to actor url from handle', async function () {
      for (const type of [ 'actors' as const, 'accounts' as const ]) {
        {
          const url = await servers[1].services.getActorRedirection({ handle: `root`, type })
          expect(url).to.equal(`${servers[1].url}/accounts/root`)
        }

        {
          await servers[1].services.getActorRedirection({ handle: `unknown`, type, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

          await servers[1].services.getActorRedirection({
            handle: `unknown@${servers[0].host}`,
            type,
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          })
        }
      }

      {
        await servers[1].services.getActorRedirection({
          handle: `root@${servers[0].host}`,
          type: 'accounts',
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })
      }

      {
        const url = await servers[1].services.getActorRedirection({ handle: `root@${servers[0].host}`, type: 'actors' })
        expect(url).to.equal(`${servers[0].url}/accounts/root`)
      }

      {
        const url = await servers[1].services.getActorRedirection({ handle: `@root_channel@${servers[0].host}`, type: 'actors' })
        expect(url).to.equal(`${servers[0].url}/video-channels/root_channel`)
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
