/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoDetails, VideoRecommendationScope, VideoRecommendationScopeType } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test video recommendations', function () {
  let servers: PeerTubeServer[]
  let videoA: VideoDetails
  let userToken: string

  async function listNames (server: PeerTubeServer, options: {
    scope?: VideoRecommendationScopeType
    videoId?: string
    count?: number
    excludeVideoIds?: number[]
    token?: string
  }) {
    const { data } = await server.videos.listRecommendations(options)

    return data.map(v => v.name)
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    // Video A in the root default channel: the reference video
    {
      const { uuid } = await servers[0].videos.upload({
        attributes: { name: 'video A', tags: [ 'tag1', 'tag2' ], recommendationScope: VideoRecommendationScope.LOCAL }
      })
      videoA = await servers[0].videos.get({ id: uuid })
    }

    // Video C in another root channel
    {
      const channel = await servers[0].channels.create({ attributes: { displayName: 'Other channel', name: 'other_channel' } })
      await servers[0].videos.upload({ attributes: { name: 'video C', tags: [ 'tag2' ], channelId: channel.id } })
    }

    // Video D of another user
    {
      userToken = await servers[0].users.generateUserAndToken('user2')
      await servers[0].videos.upload({ token: userToken, attributes: { name: 'video D', tags: [ 'tag1' ] } })
    }

    // Video E on another server
    await servers[1].videos.upload({ attributes: { name: 'video E', tags: [ 'tag1' ] } })
    await waitJobs(servers)

    // Video B in the root default channel, without tags and more recent than other videos
    await servers[0].videos.upload({ attributes: { name: 'video B' } })

    await waitJobs(servers)
  })

  describe('Recommendation scope of a video', function () {
    it('Should default a new video to the all videos scope', async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video F' })
      const video = await servers[0].videos.get({ id: uuid })

      expect(video.recommendationScope.id).to.equal(VideoRecommendationScope.ALL)

      await servers[0].videos.remove({ id: uuid })
      await waitJobs(servers)
    })

    it('Should federate the video recommendation scope', async function () {
      for (const server of servers) {
        const video = await server.videos.get({ id: videoA.uuid })

        expect(video.recommendationScope.id).to.equal(VideoRecommendationScope.LOCAL)
        expect(video.recommendationScope.label).to.equal('Videos of the same platform')
      }
    })
  })

  describe('Recommended videos', function () {
    it('Should list videos sharing tags first, then the latest videos', async function () {
      for (const server of servers) {
        const names = await listNames(server, { scope: VideoRecommendationScope.ALL, videoId: videoA.uuid })

        expect(names).to.deep.equal([ 'video E', 'video D', 'video C', 'video B' ])
      }
    })

    it('Should only list the latest videos without a reference video', async function () {
      const names = await listNames(servers[0], { scope: VideoRecommendationScope.ALL })

      expect(names).to.deep.equal([ 'video B', 'video E', 'video D', 'video C', 'video A' ])
    })

    it('Should limit the number of videos', async function () {
      for (const server of servers) {
        expect(await listNames(server, { scope: VideoRecommendationScope.ALL, videoId: videoA.uuid, count: 2 }))
          .to.deep.equal([ 'video E', 'video D' ])

        expect(await listNames(server, { scope: VideoRecommendationScope.ALL, videoId: videoA.uuid, count: 4 }))
          .to.deep.equal([ 'video E', 'video D', 'video C', 'video B' ])
      }
    })

    it('Should exclude videos', async function () {
      for (const server of servers) {
        const { data } = await server.videos.list()
        const excludeVideoIds = data.filter(v => v.name === 'video D' || v.name === 'video B').map(v => v.id)

        const names = await listNames(server, { scope: VideoRecommendationScope.ALL, videoId: videoA.uuid, excludeVideoIds })

        expect(names).to.deep.equal([ 'video E', 'video C' ])
      }
    })

    it('Should not waste recommendations on videos sharing multiple tags', async function () {
      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video G', tags: [ 'tag1', 'tag2' ] } })
      await waitJobs(servers)

      for (const server of servers) {
        const names = await listNames(server, { scope: VideoRecommendationScope.ALL, videoId: videoA.uuid, count: 2 })

        expect(names).to.deep.equal([ 'video G', 'video E' ])
      }

      await servers[0].videos.remove({ id: uuid })
      await waitJobs(servers)
    })

    it('Should not recommend already watched related videos first to a logged in user', async function () {
      const { uuid } = (await servers[0].videos.list()).data.find(v => v.name === 'video D')
      await servers[0].views.view({ id: uuid, token: userToken, currentTime: 2 })

      const names = await listNames(servers[0], { scope: VideoRecommendationScope.ALL, videoId: videoA.uuid, token: userToken })

      // Video D is still recommended as one of the latest videos
      expect(names).to.deep.equal([ 'video E', 'video C', 'video B', 'video D' ])
    })

    it('Should only list videos of the same channel', async function () {
      for (const server of servers) {
        const names = await listNames(server, { scope: VideoRecommendationScope.CHANNEL, videoId: videoA.uuid })

        expect(names).to.deep.equal([ 'video B' ])
      }
    })

    it('Should only list videos of the same account', async function () {
      for (const server of servers) {
        const names = await listNames(server, { scope: VideoRecommendationScope.ACCOUNT, videoId: videoA.uuid })

        expect(names).to.deep.equal([ 'video C', 'video B' ])
      }
    })

    it('Should only list videos of the platform that owns the video', async function () {
      // Remote platforms must recommend videos of the video origin platform
      for (const server of servers) {
        const names = await listNames(server, { scope: VideoRecommendationScope.LOCAL, videoId: videoA.uuid })

        expect(names).to.deep.equal([ 'video D', 'video C', 'video B' ])
      }
    })

    it('Should only list local videos without a reference video', async function () {
      expect(await listNames(servers[0], { scope: VideoRecommendationScope.LOCAL }))
        .to.deep.equal([ 'video B', 'video D', 'video C', 'video A' ])

      expect(await listNames(servers[1], { scope: VideoRecommendationScope.LOCAL }))
        .to.deep.equal([ 'video E' ])
    })

    it('Should default to the scope stored in the reference video', async function () {
      // Video A has the local scope
      for (const server of servers) {
        const names = await listNames(server, { videoId: videoA.uuid })

        expect(names).to.deep.equal([ 'video D', 'video C', 'video B' ])
      }
    })

    it('Should default to all videos without a reference video', async function () {
      const names = await listNames(servers[0], {})

      expect(names).to.deep.equal([ 'video B', 'video E', 'video D', 'video C', 'video A' ])
    })

    it('Should override the scope stored in the video', async function () {
      await servers[0].videos.update({ id: videoA.uuid, attributes: { recommendationScope: VideoRecommendationScope.ALL } })
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: videoA.uuid })
        expect(video.recommendationScope.id).to.equal(VideoRecommendationScope.ALL)

        const names = await listNames(server, { scope: VideoRecommendationScope.CHANNEL, videoId: videoA.uuid })
        expect(names).to.deep.equal([ 'video B' ])
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
