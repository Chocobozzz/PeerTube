/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { Video, VideoPlaylistPrivacy } from '@shared/models'
import {
  addVideoInPlaylist,
  createVideoPlaylist,
  getOEmbed,
  getVideosList,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  uploadVideo
} from '../../../../shared/extra-utils'
import { cleanupTests, flushAndRunServer } from '../../../../shared/extra-utils/server/servers'

const expect = chai.expect

describe('Test services', function () {
  let server: ServerInfo = null
  let playlistUUID: string
  let playlistDisplayName: string
  let video: Video

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    {
      const videoAttributes = {
        name: 'my super name'
      }
      await uploadVideo(server.url, server.accessToken, videoAttributes)

      const res = await getVideosList(server.url)
      video = res.body.data[0]
    }

    {
      const res = await createVideoPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'The Life and Times of Scrooge McDuck',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.videoChannel.id
        }
      })

      playlistUUID = res.body.videoPlaylist.uuid
      playlistDisplayName = 'The Life and Times of Scrooge McDuck'

      await addVideoInPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistId: res.body.videoPlaylist.id,
        elementAttrs: {
          videoId: video.id
        }
      })
    }
  })

  it('Should have a valid oEmbed video response', async function () {
    for (const basePath of [ '/videos/watch/', '/w/' ]) {
      const oembedUrl = 'http://localhost:' + server.port + basePath + video.uuid

      const res = await getOEmbed(server.url, oembedUrl)
      const expectedHtml = '<iframe width="560" height="315" sandbox="allow-same-origin allow-scripts" ' +
        `title="${video.name}" src="http://localhost:${server.port}/videos/embed/${video.uuid}" ` +
        'frameborder="0" allowfullscreen></iframe>'
      const expectedThumbnailUrl = 'http://localhost:' + server.port + video.previewPath

      expect(res.body.html).to.equal(expectedHtml)
      expect(res.body.title).to.equal(video.name)
      expect(res.body.author_name).to.equal(server.videoChannel.displayName)
      expect(res.body.width).to.equal(560)
      expect(res.body.height).to.equal(315)
      expect(res.body.thumbnail_url).to.equal(expectedThumbnailUrl)
      expect(res.body.thumbnail_width).to.equal(850)
      expect(res.body.thumbnail_height).to.equal(480)
    }
  })

  it('Should have a valid playlist oEmbed response', async function () {
    for (const basePath of [ '/videos/watch/playlist/', '/w/p/' ]) {
      const oembedUrl = 'http://localhost:' + server.port + basePath + playlistUUID

      const res = await getOEmbed(server.url, oembedUrl)
      const expectedHtml = '<iframe width="560" height="315" sandbox="allow-same-origin allow-scripts" ' +
        `title="${playlistDisplayName}" src="http://localhost:${server.port}/video-playlists/embed/${playlistUUID}" ` +
        'frameborder="0" allowfullscreen></iframe>'

      expect(res.body.html).to.equal(expectedHtml)
      expect(res.body.title).to.equal('The Life and Times of Scrooge McDuck')
      expect(res.body.author_name).to.equal(server.videoChannel.displayName)
      expect(res.body.width).to.equal(560)
      expect(res.body.height).to.equal(315)
      expect(res.body.thumbnail_url).exist
      expect(res.body.thumbnail_width).to.equal(280)
      expect(res.body.thumbnail_height).to.equal(157)
    }
  })

  it('Should have a valid oEmbed response with small max height query', async function () {
    for (const basePath of [ '/videos/watch/', '/w/' ]) {
      const oembedUrl = 'http://localhost:' + server.port + basePath + video.uuid
      const format = 'json'
      const maxHeight = 50
      const maxWidth = 50

      const res = await getOEmbed(server.url, oembedUrl, format, maxHeight, maxWidth)
      const expectedHtml = '<iframe width="50" height="50" sandbox="allow-same-origin allow-scripts" ' +
        `title="${video.name}" src="http://localhost:${server.port}/videos/embed/${video.uuid}" ` +
        'frameborder="0" allowfullscreen></iframe>'

      expect(res.body.html).to.equal(expectedHtml)
      expect(res.body.title).to.equal(video.name)
      expect(res.body.author_name).to.equal(server.videoChannel.displayName)
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
