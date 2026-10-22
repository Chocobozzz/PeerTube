/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoDetails, VideoRecommendationStrategy } from '@peertube/peertube-models'
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

describe('Test video recommendation strategy', function () {
  let servers: PeerTubeServer[]
  let videoA: VideoDetails

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    // Videos A and B in the root default channel
    {
      const { uuid } = await servers[0].videos.upload({
        attributes: { name: 'video A', nsfw: false, recommendationStrategy: VideoRecommendationStrategy.ONLY_LOCAL_VIDEOS }
      })
      videoA = await servers[0].videos.get({ id: uuid })

      await servers[0].videos.quickUpload({ name: 'video B' })
    }

    // Video C in another root channel
    {
      const channel = await servers[0].channels.create({ attributes: { displayName: 'Other channel', name: 'other_channel' } })
      await servers[0].videos.quickUpload({ name: 'video C', channelId: channel.id })
    }

    // Video D of another user
    {
      const token = await servers[0].users.generateUserAndToken('user2')
      await servers[0].videos.quickUpload({ name: 'video D', token })
    }

    // Video E on another server
    await servers[1].videos.quickUpload({ name: 'video E' })

    await waitJobs(servers)
  })

  it('Should default a new video to the any videos strategy', async function () {
    const { uuid } = await servers[0].videos.quickUpload({ name: 'video F' })
    const video = await servers[0].videos.get({ id: uuid })

    expect(video.recommendationStrategy.id).to.equal(VideoRecommendationStrategy.ANY_VIDEOS)

    await servers[0].videos.remove({ id: uuid })
    await waitJobs(servers)
  })

  it('Should federate the video recommendation strategy', async function () {
    for (const server of servers) {
      const video = await server.videos.get({ id: videoA.uuid })

      expect(video.recommendationStrategy.id).to.equal(VideoRecommendationStrategy.ONLY_LOCAL_VIDEOS)
      expect(video.recommendationStrategy.label).to.equal('Only instance local videos')
    }
  })

  it('Should list any videos', async function () {
    for (const server of servers) {
      const { data } = await server.videos.listRecommendations({ strategy: VideoRecommendationStrategy.ANY_VIDEOS, videoId: videoA.uuid })

      expect(data.map(v => v.name)).to.have.members([ 'video A', 'video B', 'video C', 'video D', 'video E' ])
    }
  })

  it('Should only list videos of the same channel', async function () {
    for (const server of servers) {
      const { data } = await server.videos.listRecommendations({
        strategy: VideoRecommendationStrategy.ONLY_CHANNEL_VIDEOS,
        videoId: videoA.uuid
      })

      expect(data.map(v => v.name)).to.have.members([ 'video A', 'video B' ])
    }
  })

  it('Should only list videos of the same owner', async function () {
    for (const server of servers) {
      const { data } = await server.videos.listRecommendations({
        strategy: VideoRecommendationStrategy.ONLY_OWNER_VIDEOS,
        videoId: videoA.uuid
      })

      expect(data.map(v => v.name)).to.have.members([ 'video A', 'video B', 'video C' ])
    }
  })

  it('Should only list videos of the instance that owns the video', async function () {
    // Remote instances must recommend videos of the video origin instance
    for (const server of servers) {
      const { data } = await server.videos.listRecommendations({
        strategy: VideoRecommendationStrategy.ONLY_LOCAL_VIDEOS,
        videoId: videoA.uuid
      })

      expect(data.map(v => v.name)).to.have.members([ 'video A', 'video B', 'video C', 'video D' ])
    }
  })

  it('Should only list local videos without a video id', async function () {
    {
      const { data } = await servers[0].videos.listRecommendations({ strategy: VideoRecommendationStrategy.ONLY_LOCAL_VIDEOS })
      expect(data.map(v => v.name)).to.have.members([ 'video A', 'video B', 'video C', 'video D' ])
    }

    {
      const { data } = await servers[1].videos.listRecommendations({ strategy: VideoRecommendationStrategy.ONLY_LOCAL_VIDEOS })
      expect(data.map(v => v.name)).to.have.members([ 'video E' ])
    }
  })

  it('Should ignore the strategy stored in the video', async function () {
    await servers[0].videos.update({ id: videoA.uuid, attributes: { recommendationStrategy: VideoRecommendationStrategy.ANY_VIDEOS } })
    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: videoA.uuid })
      expect(video.recommendationStrategy.id).to.equal(VideoRecommendationStrategy.ANY_VIDEOS)

      const { data } = await server.videos.listRecommendations({
        strategy: VideoRecommendationStrategy.ONLY_CHANNEL_VIDEOS,
        videoId: videoA.uuid
      })

      expect(data.map(v => v.name)).to.have.members([ 'video A', 'video B' ])
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
