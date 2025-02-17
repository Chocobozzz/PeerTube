/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  BooleanBothQuery,
  VideoChannelsSearchQuery,
  VideoPlaylistPrivacy,
  VideoPlaylistsSearchQuery,
  VideoPlaylistType,
  VideosSearchQuery
} from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  SearchCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test index search', function () {
  const localVideoName = 'local video' + new Date().toISOString()

  let server: PeerTubeServer = null
  let command: SearchCommand

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    await server.videos.upload({ attributes: { name: localVideoName } })

    command = server.search
  })

  describe('Default search', async function () {

    it('Should make a local videos search by default', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          search: {
            searchIndex: {
              enabled: true,
              isDefaultSearch: false,
              disableLocalSearch: false
            }
          }
        }
      })

      const body = await command.searchVideos({ search: 'local video' })

      expect(body.total).to.equal(1)
      expect(body.data[0].name).to.equal(localVideoName)
    })

    it('Should make a local channels search by default', async function () {
      const body = await command.searchChannels({ search: 'root' })

      expect(body.total).to.equal(1)
      expect(body.data[0].name).to.equal('root_channel')
      expect(body.data[0].host).to.equal(server.host)
    })

    it('Should make an index videos search by default', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          search: {
            searchIndex: {
              enabled: true,
              isDefaultSearch: true,
              disableLocalSearch: false
            }
          }
        }
      })

      const body = await command.searchVideos({ search: 'local video' })
      expect(body.total).to.be.greaterThan(2)
    })

    it('Should make an index channels search by default', async function () {
      const body = await command.searchChannels({ search: 'root' })
      expect(body.total).to.be.greaterThan(2)
    })
  })

  describe('Videos search', async function () {

    async function check (search: VideosSearchQuery, exists = true) {
      const body = await command.advancedVideoSearch({ search })

      if (exists === false) {
        expect(body.total).to.equal(0)
        expect(body.data).to.have.lengthOf(0)
        return
      }

      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)

      const video = body.data[0]

      expect(video.name).to.equal('What is PeerTube?')
      expect(video.category.label).to.equal('Science & Technology')
      expect(video.licence.label).to.equal('Attribution - Share Alike')
      expect(video.privacy.label).to.equal('Public')
      expect(video.duration).to.equal(113)
      expect(video.thumbnailUrl.startsWith('https://framatube.org/lazy-static/thumbnails')).to.be.true

      expect(video.account.host).to.equal('framatube.org')
      expect(video.account.name).to.equal('framasoft')
      expect(video.account.url).to.equal('https://framatube.org/accounts/framasoft')
      expect(video.account.avatars.length).to.equal(2, 'Account should have one avatar image')

      expect(video.channel.host).to.equal('framatube.org')
      expect(video.channel.name).to.equal('joinpeertube')
      expect(video.channel.url).to.equal('https://framatube.org/video-channels/joinpeertube')
      expect(video.channel.avatars.length).to.equal(2, 'Channel should have one avatar image')
    }

    const baseSearch: VideosSearchQuery = {
      search: 'what is peertube',
      start: 0,
      count: 2,
      categoryOneOf: [ 15 ],
      licenceOneOf: [ 2 ],
      tagsAllOf: [ 'framasoft', 'peertube' ],
      startDate: '2018-10-01T10:50:46.396Z',
      endDate: '2018-10-01T10:55:46.396Z'
    }

    it('Should make a simple search and not have results', async function () {
      const body = await command.searchVideos({ search: 'djidane'.repeat(50) })

      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    })

    it('Should make a simple search and have results', async function () {
      const body = await command.searchVideos({ search: 'What is PeerTube' })

      expect(body.total).to.be.greaterThan(1)
    })

    it('Should make a simple search', async function () {
      await check(baseSearch)
    })

    it('Should search by start date', async function () {
      const search = { ...baseSearch, startDate: '2018-10-01T10:54:46.396Z' }
      await check(search, false)
    })

    it('Should search by tags', async function () {
      const search = { ...baseSearch, tagsAllOf: [ 'toto', 'framasoft' ] }
      await check(search, false)
    })

    it('Should search by duration', async function () {
      const search = { ...baseSearch, durationMin: 2000 }
      await check(search, false)
    })

    it('Should search by nsfw attribute', async function () {
      {
        const search = { ...baseSearch, nsfw: 'true' as BooleanBothQuery }
        await check(search, false)
      }

      {
        const search = { ...baseSearch, nsfw: 'false' as BooleanBothQuery }
        await check(search, true)
      }

      {
        const search = { ...baseSearch, nsfw: 'both' as BooleanBothQuery }
        await check(search, true)
      }
    })

    it('Should search by host', async function () {
      {
        const search = { ...baseSearch, host: 'example.com' }
        await check(search, false)
      }

      {
        const search = { ...baseSearch, host: 'framatube.org' }
        await check(search, true)
      }
    })

    it('Should search by uuids', async function () {
      const goodUUID = '9c9de5e8-0a1e-484a-b099-e80766180a6d'
      const goodShortUUID = 'kkGMgK9ZtnKfYAgnEtQxbv'
      const badUUID = 'c29c5b77-4a04-493d-96a9-2e9267e308f0'
      const badShortUUID = 'rP5RgUeX9XwTSrspCdkDej'

      {
        const uuidsMatrix = [
          [ goodUUID ],
          [ goodUUID, badShortUUID ],
          [ badShortUUID, goodShortUUID ],
          [ goodUUID, goodShortUUID ]
        ]

        for (const uuids of uuidsMatrix) {
          const search = { ...baseSearch, uuids }
          await check(search, true)
        }
      }

      {
        const uuidsMatrix = [
          [ badUUID ],
          [ badShortUUID ]
        ]

        for (const uuids of uuidsMatrix) {
          const search = { ...baseSearch, uuids }
          await check(search, false)
        }
      }
    })

    it('Should have a correct pagination', async function () {
      const search = {
        search: 'video',
        start: 0,
        count: 5
      }

      const body = await command.advancedVideoSearch({ search })

      expect(body.total).to.be.greaterThan(5)
      expect(body.data).to.have.lengthOf(5)
    })

    it('Should use the nsfw instance policy as default', async function () {
      let nsfwUUID: string

      {
        await server.config.updateExistingConfig({
          newConfig: {
            instance: { defaultNSFWPolicy: 'display' }
          }
        })

        const body = await command.searchVideos({ search: 'NSFW search index', sort: '-match' })
        expect(body.data).to.have.length.greaterThan(0)

        const video = body.data[0]
        expect(video.nsfw).to.be.true

        nsfwUUID = video.uuid
      }

      {
        await server.config.updateExistingConfig({
          newConfig: {
            instance: { defaultNSFWPolicy: 'do_not_list' }
          }
        })

        const body = await command.searchVideos({ search: 'NSFW search index', sort: '-match' })

        try {
          expect(body.data).to.have.lengthOf(0)
        } catch {
          const video = body.data[0]

          expect(video.uuid).not.equal(nsfwUUID)
        }
      }
    })
  })

  describe('Channels search', async function () {

    async function check (search: VideoChannelsSearchQuery, exists = true) {
      const body = await command.advancedChannelSearch({ search })

      if (exists === false) {
        expect(body.total).to.equal(0)
        expect(body.data).to.have.lengthOf(0)
        return
      }

      expect(body.total).to.be.greaterThan(0)
      expect(body.data).to.have.length.greaterThan(0)

      const videoChannel = body.data[0]
      expect(videoChannel.url).to.equal('https://framatube.org/video-channels/bf54d359-cfad-4935-9d45-9d6be93f63e8')
      expect(videoChannel.host).to.equal('framatube.org')
      expect(videoChannel.avatars.length).to.equal(2, 'Channel should have two avatar images')
      expect(videoChannel.displayName).to.exist

      expect(videoChannel.ownerAccount.url).to.equal('https://framatube.org/accounts/framasoft')
      expect(videoChannel.ownerAccount.name).to.equal('framasoft')
      expect(videoChannel.ownerAccount.host).to.equal('framatube.org')
      expect(videoChannel.ownerAccount.avatars.length).to.equal(2, 'Account should have two avatar images')
    }

    it('Should make a simple search and not have results', async function () {
      const body = await command.searchChannels({ search: 'a'.repeat(500) })

      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    })

    it('Should make a search and have results', async function () {
      await check({ search: 'Framasoft vidéos', sort: 'createdAt' }, true)
    })

    it('Should make host search and have appropriate results', async function () {
      await check({ search: 'Framasoft videos', host: 'example.com' }, false)
      await check({ search: 'Framasoft videos', host: 'framatube.org' }, true)
    })

    it('Should make handles search and have appropriate results', async function () {
      await check({ handles: [ 'bf54d359-cfad-4935-9d45-9d6be93f63e8@framatube.org' ] }, true)
      await check({ handles: [ 'jeanine', 'bf54d359-cfad-4935-9d45-9d6be93f63e8@framatube.org' ] }, true)
      await check({ handles: [ 'jeanine', 'chocobozzz_channel2@peertube2.cpy.re' ] }, false)
    })

    it('Should have a correct pagination', async function () {
      const body = await command.advancedChannelSearch({ search: { search: 'root', start: 0, count: 2 } })

      expect(body.total).to.be.greaterThan(2)
      expect(body.data).to.have.lengthOf(2)
    })
  })

  describe('Playlists search', async function () {

    async function check (search: VideoPlaylistsSearchQuery, exists = true) {
      const body = await command.advancedPlaylistSearch({ search })

      if (exists === false) {
        expect(body.total).to.equal(0)
        expect(body.data).to.have.lengthOf(0)
        return
      }

      expect(body.total).to.be.greaterThan(0)
      expect(body.data).to.have.length.greaterThan(0)

      const videoPlaylist = body.data[0]

      expect(videoPlaylist.url).to.equal('https://peertube2.cpy.re/videos/watch/playlist/73804a40-da9a-40c2-b1eb-2c6d9eec8f0a')
      expect(videoPlaylist.thumbnailUrl).to.exist
      expect(videoPlaylist.embedUrl).to.equal('https://peertube2.cpy.re/video-playlists/embed/fgei1ws1oa6FCaJ2qZPG29')

      expect(videoPlaylist.type.id).to.equal(VideoPlaylistType.REGULAR)
      expect(videoPlaylist.privacy.id).to.equal(VideoPlaylistPrivacy.PUBLIC)
      expect(videoPlaylist.videosLength).to.exist

      expect(videoPlaylist.createdAt).to.exist
      expect(videoPlaylist.updatedAt).to.exist

      expect(videoPlaylist.uuid).to.equal('73804a40-da9a-40c2-b1eb-2c6d9eec8f0a')
      expect(videoPlaylist.displayName).to.exist

      expect(videoPlaylist.ownerAccount.url).to.equal('https://peertube2.cpy.re/accounts/chocobozzz')
      expect(videoPlaylist.ownerAccount.name).to.equal('chocobozzz')
      expect(videoPlaylist.ownerAccount.host).to.equal('peertube2.cpy.re')
      expect(videoPlaylist.ownerAccount.avatars.length).to.equal(2, 'Account should have two avatar images')

      expect(videoPlaylist.videoChannel.url).to.equal('https://peertube2.cpy.re/video-channels/chocobozzz_channel')
      expect(videoPlaylist.videoChannel.name).to.equal('chocobozzz_channel')
      expect(videoPlaylist.videoChannel.host).to.equal('peertube2.cpy.re')
      expect(videoPlaylist.videoChannel.avatars.length).to.equal(2, 'Channel should have two avatar images')
    }

    it('Should make a simple search and not have results', async function () {
      const body = await command.searchPlaylists({ search: 'a'.repeat(500) })

      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    })

    it('Should make a search and have results', async function () {
      await check({ search: 'E2E playlist', sort: '-match' }, true)
    })

    it('Should make host search and have appropriate results', async function () {
      await check({ search: 'E2E playlist', host: 'example.com' }, false)
      await check({ search: 'E2E playlist', host: 'peertube2.cpy.re', sort: '-match' }, true)
    })

    it('Should make a search by uuids and have appropriate results', async function () {
      const goodUUID = '73804a40-da9a-40c2-b1eb-2c6d9eec8f0a'
      const goodShortUUID = 'fgei1ws1oa6FCaJ2qZPG29'
      const badUUID = 'c29c5b77-4a04-493d-96a9-2e9267e308f0'
      const badShortUUID = 'rP5RgUeX9XwTSrspCdkDej'

      {
        const uuidsMatrix = [
          [ goodUUID ],
          [ goodUUID, badShortUUID ],
          [ badShortUUID, goodShortUUID ],
          [ goodUUID, goodShortUUID ]
        ]

        for (const uuids of uuidsMatrix) {
          const search = { search: 'E2E playlist', sort: '-match', uuids }
          await check(search, true)
        }
      }

      {
        const uuidsMatrix = [
          [ badUUID ],
          [ badShortUUID ]
        ]

        for (const uuids of uuidsMatrix) {
          const search = { search: 'E2E playlist', sort: '-match', uuids }
          await check(search, false)
        }
      }
    })

    it('Should have a correct pagination', async function () {
      const body = await command.advancedChannelSearch({ search: { search: 'root', start: 0, count: 2 } })

      expect(body.total).to.be.greaterThan(2)
      expect(body.data).to.have.lengthOf(2)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
