import { VideoRecommendationPolicy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Video recommendation policy (server-side)', function () {
  let server: PeerTubeServer
  let videoA: any

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1, {})
    await setAccessTokensToServers([ server ])

    // Create 2 videos in same channel
    videoA = await server.videos.upload({ attributes: { name: 'VideoA' } })
    // Fetch video details
    videoA = await server.videos.get({ id: videoA.id })

    await server.videos.upload({ attributes: { name: 'VideoB' } })

    // Create another channel + video
    const channel = await server.channels.create({ attributes: { displayName: 'Other channel', name: 'other' } })
    await server.videos.upload({
      attributes: { name: 'VideoC', channelId: channel.id }
    })

    // Create another user + video
    const token = await server.users.generateUserAndToken('user2')
    await server.videos.upload({
      token,
      attributes: { name: 'VideoD' }
    })

    await waitJobs(server)
  })

  it('only-channel-videos: should only return videos from same channel', async function () {
    await server.videos.update({ id: videoA.id, attributes: { recommendationPolicy: VideoRecommendationPolicy.ONLY_CHANNEL_VIDEOS } })

    const res = await server.videos.listRecommendations({ id: videoA.uuid })

    const videos = res.data
    expect(videos.length).to.be.greaterThan(0)
    expect(videos.every(v => v.channel.id === videoA.channel.id)).to.equal(true)
  })

  it('only-owner-videos: should only return videos from same owner', async function () {
    await server.videos.update({ id: videoA.id, attributes: { recommendationPolicy: VideoRecommendationPolicy.ONLY_OWNER_VIDEOS } })

    const res = await server.videos.listRecommendations({ id: videoA.uuid })

    const videos = res.data
    expect(videos.length).to.be.greaterThan(0)
    expect(videos.every(v => v.account.id === videoA.account.id)).to.equal(true)
  })

  it('only-local-videos: should only return local videos', async function () {
    await server.videos.update({ id: videoA.id, attributes: { recommendationPolicy: VideoRecommendationPolicy.ONLY_LOCAL_VIDEOS } })

    const res = await server.videos.listRecommendations({ id: videoA.uuid })

    const videos = res.data
    expect(videos.every(v => v.isLocal === true)).to.equal(true)
  })

  it('any-videos: should allow mixed results', async function () {
    await server.videos.update({ id: videoA.id, attributes: { recommendationPolicy: VideoRecommendationPolicy.ANY_VIDEOS } })

    const res = await server.videos.listRecommendations({ id: videoA.uuid })

    const videos = res.data
    const hasDifferentChannel = videos.some(v => v.channel.id !== videoA.channel.id)

    expect(hasDifferentChannel).to.equal(true)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
