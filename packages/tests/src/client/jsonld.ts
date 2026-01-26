/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoCreateResult, VideoPlaylistCreateResult, VideoPrivacy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeHTMLRequest,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { getWatchPlaylistBasePaths, getWatchVideoBasePaths } from '@tests/shared/client.js'
import { expect } from 'chai'

async function getJSONLD (server: PeerTubeServer, path: string) {
  let html: string

  try {
    const { text } = await makeHTMLRequest(server.url, path)
    html = text
  } catch (err) {
    const { text } = await makeHTMLRequest(server.url, path, HttpStatusCode.NOT_FOUND_404)
    html = text
  }

  const regexp = new RegExp('<script type="application/ld\\+json">([^<]+?)</script>')
  const matches = html.match(regexp)
  if (!matches) return null

  return JSON.parse(matches[1])
}

describe('Test JSONLD HTML tags', function () {
  let servers: PeerTubeServer[]

  let privateVideo: VideoCreateResult
  let publicVideo: VideoCreateResult

  let privatePlaylist: VideoPlaylistCreateResult
  let publicPlaylist: VideoPlaylistCreateResult

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    {
      privateVideo = await servers[0].videos.quickUpload({ name: 'private video', privacy: VideoPrivacy.PRIVATE })
      publicVideo = await servers[0].videos.upload({
        attributes: {
          name: 'simple public video',
          privacy: VideoPrivacy.PUBLIC,
          tags: [],
          language: undefined,
          nsfw: false,
          description: undefined
        }
      })

      await servers[0].videos.rate({ id: publicVideo.id, rating: 'like' })
      await servers[0].views.simulateView({ id: publicVideo.id, xForwardedFor: '0.0.0.1,127.0.0.1' })
      await servers[0].views.simulateView({ id: publicVideo.id, xForwardedFor: '0.0.0.2,127.0.0.1' })
      await servers[0].debug.sendCommand({ body: { command: 'process-video-views-buffer' } })
    }

    {
      privatePlaylist = await servers[0].playlists.create({
        attributes: {
          displayName: 'private playlist',
          privacy: VideoPrivacy.PRIVATE
        }
      })

      publicPlaylist = await servers[0].playlists.create({
        attributes: {
          displayName: 'public playlist',
          privacy: VideoPrivacy.PUBLIC,
          videoChannelId: servers[0].store.channel.id
        }
      })

      await servers[0].playlists.addElement({
        playlistId: publicPlaylist.uuid,
        attributes: {
          videoId: publicVideo.uuid
        }
      })
    }

    await waitJobs(servers)
  })

  describe('Common', function () {
    it('Should not have JSONLD tags on private video/playlist', async function () {
      expect(await getJSONLD(servers[0], getWatchVideoBasePaths()[0] + privateVideo.uuid)).to.be.null
      expect(await getJSONLD(servers[0], getWatchPlaylistBasePaths()[0] + privatePlaylist.uuid)).to.be.null
    })
  })

  describe('Video', function () {
    it('Should have valid JSONLD tags for a simple video', async function () {
      for (const server of servers) {
        const video = await server.videos.get({ id: publicVideo.uuid })
        const jsonld = await getJSONLD(server, getWatchVideoBasePaths()[0] + publicVideo.uuid)

        expect(jsonld).to.deep.equal({
          '@context': 'http://schema.org',
          '@type': 'VideoObject',
          'name': 'simple public video',
          'description': '',
          'image': server.url + video.previewPath,
          'thumbnailUrl': server.url + video.previewPath,
          'duration': 'PT' + video.duration + 'S',
          'url': server.url + '/w/' + publicVideo.shortUUID,
          'embedUrl': server.url + '/videos/embed/' + publicVideo.shortUUID,

          'author': {
            '@type': 'Organization',
            'name': 'Main root channel',
            'url': server.url === servers[0].url
              ? server.url + '/c/root_channel'
              : server.url + '/c/root_channel@' + servers[0].host
          },

          'contentRating': 'General Audience',

          'interactionStatistic': [
            {
              '@type': 'InteractionCounter',
              'interactionType': 'http://schema.org/WatchAction',
              'userInteractionCount': 2
            },
            {
              '@type': 'InteractionCounter',
              'interactionType': 'http://schema.org/LikeAction',
              'userInteractionCount': 1
            },
            {
              '@type': 'InteractionCounter',
              'interactionType': 'http://schema.org/DislikeAction',
              'userInteractionCount': 0
            }
          ],

          'publisher': {
            '@type': 'Organization',
            'name': 'PeerTube',
            'url': server.url
          },

          'uploadDate': video.createdAt,
          'datePublished': video.publishedAt,
          'dateModified': video.updatedAt
        })
      }
    })

    it('Should update the video and have valid JSONLD tags', async function () {
      await servers[0].videos.update({
        id: publicVideo.id,
        attributes: {
          tags: [ 'tag1', 'tag2' ],
          nsfw: true
        }
      })

      await servers[0].captions.add({ language: 'fr', videoId: publicVideo.uuid, fixture: 'subtitle-good1.vtt' })
      await servers[0].captions.add({ language: 'en', videoId: publicVideo.uuid, fixture: 'subtitle-good1.vtt' })

      await waitJobs(servers)

      for (const server of servers) {
        const { data: captions } = await server.captions.list({ videoId: publicVideo.uuid })
        const jsonld = await getJSONLD(server, getWatchVideoBasePaths()[0] + publicVideo.uuid)

        expect(jsonld.contentRating).to.equal('Mature')

        expect(jsonld.caption).to.deep.equal([
          {
            '@type': 'MediaObject',
            'contentUrl': captions.find(c => c.language.id === 'en').fileUrl,
            'encodingFormat': 'text/vtt',
            'inLanguage': 'en',
            'name': 'English'
          },
          {
            '@type': 'MediaObject',
            'contentUrl': captions.find(c => c.language.id === 'fr').fileUrl,
            'encodingFormat': 'text/vtt',
            'inLanguage': 'fr',
            'name': 'French'
          }
        ])

        expect(jsonld.keywords).to.deep.equal([
          'tag1',
          'tag2'
        ])
      }
    })
  })

  describe('Playlist', function () {
    it('Should have valid JSONLD tags for a simple playlist', async function () {
      for (const server of servers) {
        const jsonld = await getJSONLD(server, getWatchPlaylistBasePaths()[0] + publicPlaylist.uuid)
        const playlist = await server.playlists.get({ playlistId: publicPlaylist.uuid })

        expect(jsonld).to.deep.equal({
          '@context': 'http://schema.org',
          '@type': 'ItemList',
          'name': 'public playlist',
          'description': '',
          'url': server.url + '/w/p/' + publicPlaylist.shortUUID,
          'numberOfItems': 1,

          'embedUrl': server.url + playlist.embedPath,
          'image': server.url + playlist.thumbnailPath,
          'thumbnailUrl': server.url + playlist.thumbnailPath,

          'author': {
            '@type': 'Organization',
            'name': 'Main root channel',
            'url': server.url === servers[0].url
              ? server.url + '/c/root_channel'
              : server.url + '/c/root_channel@' + servers[0].host
          },

          'publisher': {
            '@type': 'Organization',
            'name': 'PeerTube',
            'url': server.url
          },

          'uploadDate': playlist.createdAt,
          'dateModified': playlist.updatedAt
        })
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
