/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { Video, VideoPlaylistPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test services', function () {
  let server: PeerTubeServer = null

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
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    {
      const attributes = { name: 'my super name' }
      await server.videos.upload({ attributes })

      const { data } = await server.videos.list()
      video = data[0]
    }

    {
      const created = await server.playlists.create({
        attributes: {
          displayName: 'The Life and Times of Scrooge McDuck',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.store.channel.id
        }
      })

      playlistUUID = created.uuid
      playlistShortUUID = created.shortUUID
      playlistDisplayName = 'The Life and Times of Scrooge McDuck'

      await server.playlists.addElement({
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
        const oembedUrl = server.url + basePath + video.uuid + suffix.input

        const res = await server.services.getOEmbed({ oembedUrl })
        const expectedHtml = '<iframe width="560" height="315" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" ' +
          `title="${video.name}" src="http://${server.host}/videos/embed/${video.shortUUID}${suffix.output}" ` +
          'frameborder="0" allowfullscreen></iframe>'

        const expectedThumbnailUrl = 'http://' + server.host + video.previewPath

        expect(res.body.html).to.equal(expectedHtml)
        expect(res.body.title).to.equal(video.name)
        expect(res.body.author_name).to.equal(server.store.channel.displayName)
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
        const oembedUrl = server.url + basePath + playlistUUID + suffix.input

        const res = await server.services.getOEmbed({ oembedUrl })
        const expectedHtml = '<iframe width="560" height="315" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" ' +
          `title="${playlistDisplayName}" src="http://${server.host}/video-playlists/embed/${playlistShortUUID}${suffix.output}" ` +
          'frameborder="0" allowfullscreen></iframe>'

        expect(res.body.html).to.equal(expectedHtml)
        expect(res.body.title).to.equal('The Life and Times of Scrooge McDuck')
        expect(res.body.author_name).to.equal(server.store.channel.displayName)
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
    const oembedUrl = `http://${server.host}/w/${video.uuid}${query}&unknown=3`
    const res = await server.services.getOEmbed({ oembedUrl })

    const expectedHtml = '<iframe width="560" height="315" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" ' +
      `title="${video.name}" src="http://${server.host}/videos/embed/${video.shortUUID}${query}" ` +
      'frameborder="0" allowfullscreen></iframe>'

    expect(res.body.html).to.equal(expectedHtml)
  })

  it('Should have a valid oEmbed response with small max height query', async function () {
    for (const basePath of [ '/videos/watch/', '/w/' ]) {
      const oembedUrl = 'http://' + server.host + basePath + video.uuid
      const format = 'json'
      const maxHeight = 50
      const maxWidth = 50

      const res = await server.services.getOEmbed({ oembedUrl, format, maxHeight, maxWidth })
      const expectedHtml = '<iframe width="50" height="50" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" ' +
        `title="${video.name}" src="http://${server.host}/videos/embed/${video.shortUUID}" ` +
        'frameborder="0" allowfullscreen></iframe>'

      expect(res.body.html).to.equal(expectedHtml)
      expect(res.body.title).to.equal(video.name)
      expect(res.body.author_name).to.equal(server.store.channel.displayName)
      expect(res.body.height).to.equal(50)
      expect(res.body.width).to.equal(50)
      expect(res.body).to.not.have.property('thumbnail_url')
      expect(res.body).to.not.have.property('thumbnail_width')
      expect(res.body).to.not.have.property('thumbnail_height')
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
