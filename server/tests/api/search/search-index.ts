/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  flushAndRunServer,
  searchVideo,
  ServerInfo,
  setAccessTokensToServers,
  updateCustomSubConfig,
  uploadVideo,
  advancedVideosSearch,
  immutableAssign
} from '../../../../shared/extra-utils'
import { searchVideoChannel, advancedVideoChannelSearch } from '@shared/extra-utils/search/video-channels'
import { VideosSearchQuery, Video, VideoChannel } from '@shared/models'

const expect = chai.expect

describe('Test videos search', function () {
  let server: ServerInfo = null
  const localVideoName = 'local video' + new Date().toISOString()

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    await uploadVideo(server.url, server.accessToken, { name: localVideoName })
  })

  describe('Default search', async function () {

    it('Should make a local videos search by default', async function () {
      this.timeout(10000)

      await updateCustomSubConfig(server.url, server.accessToken, {
        search: {
          searchIndex: {
            enabled: true,
            isDefaultSearch: false,
            disableLocalSearch: false
          }
        }
      })

      const res = await searchVideo(server.url, 'local video')

      expect(res.body.total).to.equal(1)
      expect(res.body.data[0].name).to.equal(localVideoName)
    })

    it('Should make a local channels search by default', async function () {
      const res = await searchVideoChannel(server.url, 'root')

      expect(res.body.total).to.equal(1)
      expect(res.body.data[0].name).to.equal('root_channel')
      expect(res.body.data[0].host).to.equal('localhost:' + server.port)
    })

    it('Should make an index videos search by default', async function () {
      await updateCustomSubConfig(server.url, server.accessToken, {
        search: {
          searchIndex: {
            enabled: true,
            isDefaultSearch: true,
            disableLocalSearch: false
          }
        }
      })

      const res = await searchVideo(server.url, 'local video')
      expect(res.body.total).to.be.greaterThan(2)
    })

    it('Should make an index channels search by default', async function () {
      const res = await searchVideoChannel(server.url, 'root')
      expect(res.body.total).to.be.greaterThan(2)
    })

    it('Should make an index videos search if local search is disabled', async function () {
      await updateCustomSubConfig(server.url, server.accessToken, {
        search: {
          searchIndex: {
            enabled: true,
            isDefaultSearch: false,
            disableLocalSearch: true
          }
        }
      })

      const res = await searchVideo(server.url, 'local video')
      expect(res.body.total).to.be.greaterThan(2)
    })

    it('Should make an index channels search if local search is disabled', async function () {
      const res = await searchVideoChannel(server.url, 'root')
      expect(res.body.total).to.be.greaterThan(2)
    })
  })

  describe('Videos search', async function () {

    it('Should make a simple search and not have results', async function () {
      const res = await searchVideo(server.url, 'a'.repeat(500))

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    })

    it('Should make a simple search and have results', async function () {
      const res = await searchVideo(server.url, 'What is PeerTube')

      expect(res.body.total).to.be.greaterThan(1)
    })

    it('Should make a complex search', async function () {

      async function check (search: VideosSearchQuery, exists = true) {
        const res = await advancedVideosSearch(server.url, search)

        if (exists === false) {
          expect(res.body.total).to.equal(0)
          expect(res.body.data).to.have.lengthOf(0)
          return
        }

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)

        const video: Video = res.body.data[0]

        expect(video.name).to.equal('What is PeerTube?')
        expect(video.category.label).to.equal('Science & Technology')
        expect(video.licence.label).to.equal('Attribution - Share Alike')
        expect(video.privacy.label).to.equal('Public')
        expect(video.duration).to.equal(113)
        expect(video.thumbnailUrl.startsWith('https://framatube.org/static/thumbnails')).to.be.true

        expect(video.account.host).to.equal('framatube.org')
        expect(video.account.name).to.equal('framasoft')
        expect(video.account.url).to.equal('https://framatube.org/accounts/framasoft')
        expect(video.account.avatar).to.exist

        expect(video.channel.host).to.equal('framatube.org')
        expect(video.channel.name).to.equal('bf54d359-cfad-4935-9d45-9d6be93f63e8')
        expect(video.channel.url).to.equal('https://framatube.org/video-channels/bf54d359-cfad-4935-9d45-9d6be93f63e8')
        expect(video.channel.avatar).to.exist
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

      {
        await check(baseSearch)
      }

      {
        const search = immutableAssign(baseSearch, { startDate: '2018-10-01T10:54:46.396Z' })
        await check(search, false)
      }

      {
        const search = immutableAssign(baseSearch, { tagsAllOf: [ 'toto', 'framasoft' ] })
        await check(search, false)
      }

      {
        const search = immutableAssign(baseSearch, { durationMin: 2000 })
        await check(search, false)
      }

      {
        const search = immutableAssign(baseSearch, { nsfw: 'true' })
        await check(search, false)
      }

      {
        const search = immutableAssign(baseSearch, { nsfw: 'false' })
        await check(search, true)
      }

      {
        const search = immutableAssign(baseSearch, { nsfw: 'both' })
        await check(search, true)
      }
    })

    it('Should have a correct pagination', async function () {
      const search = {
        search: 'video',
        start: 0,
        count: 5
      }

      const res = await advancedVideosSearch(server.url, search)

      expect(res.body.total).to.be.greaterThan(5)
      expect(res.body.data).to.have.lengthOf(5)
    })

    it('Should use the nsfw instance policy as default', async function () {
      let nsfwUUID: string

      {
        await updateCustomSubConfig(server.url, server.accessToken, { instance: { defaultNSFWPolicy: 'display' } })

        const res = await searchVideo(server.url, 'NSFW search index')
        const video = res.body.data[0] as Video

        expect(res.body.data).to.have.length.greaterThan(0)
        expect(video.nsfw).to.be.true

        nsfwUUID = video.uuid
      }

      {
        await updateCustomSubConfig(server.url, server.accessToken, { instance: { defaultNSFWPolicy: 'do_not_list' } })

        const res = await searchVideo(server.url, 'NSFW search index')

        try {
          expect(res.body.data).to.have.lengthOf(0)
        } catch (err) {
          //
          const video = res.body.data[0] as Video

          expect(video.uuid).not.equal(nsfwUUID)
        }
      }
    })
  })

  describe('Channels search', async function () {

    it('Should make a simple search and not have results', async function () {
      const res = await searchVideoChannel(server.url, 'a'.repeat(500))

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    })

    it('Should make a search and have results', async function () {
      const res = await advancedVideoChannelSearch(server.url, { search: 'Framasoft', sort: 'createdAt' })

      expect(res.body.total).to.be.greaterThan(0)
      expect(res.body.data).to.have.length.greaterThan(0)

      const videoChannel: VideoChannel = res.body.data[0]
      expect(videoChannel.url).to.equal('https://framatube.org/video-channels/bf54d359-cfad-4935-9d45-9d6be93f63e8')
      expect(videoChannel.host).to.equal('framatube.org')
      expect(videoChannel.avatar).to.exist
      expect(videoChannel.displayName).to.exist

      expect(videoChannel.ownerAccount.url).to.equal('https://framatube.org/accounts/framasoft')
      expect(videoChannel.ownerAccount.name).to.equal('framasoft')
      expect(videoChannel.ownerAccount.host).to.equal('framatube.org')
      expect(videoChannel.ownerAccount.avatar).to.exist
    })

    it('Should have a correct pagination', async function () {
      const res = await advancedVideoChannelSearch(server.url, { search: 'root', start: 0, count: 2 })

      expect(res.body.total).to.be.greaterThan(2)
      expect(res.body.data).to.have.lengthOf(2)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
