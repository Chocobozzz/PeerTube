/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  SubscriptionsCommand,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test users subscriptions', function () {
  let servers: PeerTubeServer[] = []
  const users: { accessToken: string }[] = []
  let video3UUID: string

  let command: SubscriptionsCommand

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultChannelAvatar(servers)
    await setDefaultAccountAvatar(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    for (const server of servers) {
      const user = { username: 'user' + server.serverNumber, password: 'password' }
      await server.users.create({ username: user.username, password: user.password })

      const accessToken = await server.login.getAccessToken(user)
      users.push({ accessToken })

      const videoName1 = 'video 1-' + server.serverNumber
      await server.videos.upload({ token: accessToken, attributes: { name: videoName1 } })

      const videoName2 = 'video 2-' + server.serverNumber
      await server.videos.upload({ token: accessToken, attributes: { name: videoName2 } })
    }

    await waitJobs(servers)

    command = servers[0].subscriptions
  })

  describe('Distinction between server videos and user videos', function () {

    it('Should display videos of server 2 on server 1', async function () {
      const { total } = await servers[0].videos.list()

      expect(total).to.equal(4)
    })

    it('User of server 1 should follow user of server 3 and root of server 1', async function () {
      this.timeout(60000)

      await command.add({ token: users[0].accessToken, targetUri: 'user3_channel@' + servers[2].host })
      await command.add({ token: users[0].accessToken, targetUri: 'root_channel@' + servers[0].host })

      await waitJobs(servers)

      const attributes = { name: 'video server 3 added after follow' }
      const { uuid } = await servers[2].videos.upload({ token: users[2].accessToken, attributes })
      video3UUID = uuid

      await waitJobs(servers)
    })

    it('Should not display videos of server 3 on server 1', async function () {
      const { total, data } = await servers[0].videos.list()
      expect(total).to.equal(4)

      for (const video of data) {
        expect(video.name).to.not.contain('1-3')
        expect(video.name).to.not.contain('2-3')
        expect(video.name).to.not.contain('video server 3 added after follow')
      }
    })
  })

  describe('Subscription endpoints', function () {

    it('Should list subscriptions', async function () {
      {
        const body = await command.list()
        expect(body.total).to.equal(0)
        expect(body.data).to.be.an('array')
        expect(body.data).to.have.lengthOf(0)
      }

      {
        const body = await command.list({ token: users[0].accessToken, sort: 'createdAt' })
        expect(body.total).to.equal(2)

        const subscriptions = body.data
        expect(subscriptions).to.be.an('array')
        expect(subscriptions).to.have.lengthOf(2)

        expect(subscriptions[0].name).to.equal('user3_channel')
        expect(subscriptions[1].name).to.equal('root_channel')
      }
    })

    it('Should get subscription', async function () {
      {
        const videoChannel = await command.get({ token: users[0].accessToken, uri: 'user3_channel@' + servers[2].host })

        expect(videoChannel.name).to.equal('user3_channel')
        expect(videoChannel.host).to.equal(servers[2].host)
        expect(videoChannel.displayName).to.equal('Main user3 channel')
        expect(videoChannel.followingCount).to.equal(0)
        expect(videoChannel.followersCount).to.equal(1)
      }

      {
        const videoChannel = await command.get({ token: users[0].accessToken, uri: 'root_channel@' + servers[0].host })

        expect(videoChannel.name).to.equal('root_channel')
        expect(videoChannel.host).to.equal(servers[0].host)
        expect(videoChannel.displayName).to.equal('Main root channel')
        expect(videoChannel.followingCount).to.equal(0)
        expect(videoChannel.followersCount).to.equal(1)
      }
    })

    it('Should return the existing subscriptions', async function () {
      const uris = [
        'user3_channel@' + servers[2].host,
        'root2_channel@' + servers[0].host,
        'root_channel@' + servers[0].host,
        'user3_channel@' + servers[0].host
      ]

      const body = await command.exist({ token: users[0].accessToken, uris })

      expect(body['user3_channel@' + servers[2].host]).to.be.true
      expect(body['root2_channel@' + servers[0].host]).to.be.false
      expect(body['root_channel@' + servers[0].host]).to.be.true
      expect(body['user3_channel@' + servers[0].host]).to.be.false
    })

    it('Should search among subscriptions', async function () {
      {
        const body = await command.list({ token: users[0].accessToken, sort: '-createdAt', search: 'user3_channel' })
        expect(body.total).to.equal(1)
        expect(body.data).to.have.lengthOf(1)
      }

      {
        const body = await command.list({ token: users[0].accessToken, sort: '-createdAt', search: 'toto' })
        expect(body.total).to.equal(0)
        expect(body.data).to.have.lengthOf(0)
      }
    })

    it('Should sort subscriptions by channelUpdatedAt', async function () {
      const body = await command.list({ token: users[0].accessToken, sort: '-channelUpdatedAt' })
      expect(body.total).to.equal(2)

      const subscriptions = body.data
      expect(subscriptions[0].name).to.equal('user3_channel')
      expect(subscriptions[1].name).to.equal('root_channel')
    })
  })

  describe('Subscription videos', function () {

    it('Should list subscription videos', async function () {
      {
        const body = await servers[0].videos.listMySubscriptionVideos()
        expect(body.total).to.equal(0)
        expect(body.data).to.be.an('array')
        expect(body.data).to.have.lengthOf(0)
      }

      {
        const body = await servers[0].videos.listMySubscriptionVideos({ token: users[0].accessToken, sort: 'createdAt' })
        expect(body.total).to.equal(3)

        const videos = body.data
        expect(videos).to.be.an('array')
        expect(videos).to.have.lengthOf(3)

        expect(videos[0].name).to.equal('video 1-3')
        expect(videos[1].name).to.equal('video 2-3')
        expect(videos[2].name).to.equal('video server 3 added after follow')
      }

      {
        const body = await servers[0].videos.listMySubscriptionVideos({ token: users[0].accessToken, count: 1, start: 1 })
        expect(body.total).to.equal(3)

        const videos = body.data
        expect(videos).to.be.an('array')
        expect(videos).to.have.lengthOf(1)

        expect(videos[0].name).to.equal('video 2-3')
      }
    })

    it('Should upload a video by root on server 1 and see it in the subscription videos', async function () {
      this.timeout(60000)

      const videoName = 'video server 1 added after follow'
      await servers[0].videos.upload({ attributes: { name: videoName } })

      await waitJobs(servers)

      {
        const body = await servers[0].videos.listMySubscriptionVideos()
        expect(body.total).to.equal(0)
        expect(body.data).to.be.an('array')
        expect(body.data).to.have.lengthOf(0)
      }

      {
        const body = await servers[0].videos.listMySubscriptionVideos({ token: users[0].accessToken, sort: 'createdAt' })
        expect(body.total).to.equal(4)

        const videos = body.data
        expect(videos).to.be.an('array')
        expect(videos).to.have.lengthOf(4)

        expect(videos[0].name).to.equal('video 1-3')
        expect(videos[1].name).to.equal('video 2-3')
        expect(videos[2].name).to.equal('video server 3 added after follow')
        expect(videos[3].name).to.equal('video server 1 added after follow')
      }

      {
        const { data, total } = await servers[0].videos.list()
        expect(total).to.equal(5)

        for (const video of data) {
          expect(video.name).to.not.contain('1-3')
          expect(video.name).to.not.contain('2-3')
          expect(video.name).to.not.contain('video server 3 added after follow')
        }
      }
    })

    it('Should have server 1 following server 3 and display server 3 videos', async function () {
      this.timeout(60000)

      await servers[0].follows.follow({ hosts: [ servers[2].url ] })

      await waitJobs(servers)

      const { data, total } = await servers[0].videos.list()
      expect(total).to.equal(8)

      const names = [ '1-3', '2-3', 'video server 3 added after follow' ]
      for (const name of names) {
        const video = data.find(v => v.name.includes(name))
        expect(video).to.not.be.undefined
      }
    })

    it('Should remove follow server 1 -> server 3 and hide server 3 videos', async function () {
      this.timeout(60000)

      await servers[0].follows.unfollow({ target: servers[2] })

      await waitJobs(servers)

      const { total, data } = await servers[0].videos.list()
      expect(total).to.equal(5)

      for (const video of data) {
        expect(video.name).to.not.contain('1-3')
        expect(video.name).to.not.contain('2-3')
        expect(video.name).to.not.contain('video server 3 added after follow')
      }
    })

    it('Should still list subscription videos', async function () {
      {
        const body = await servers[0].videos.listMySubscriptionVideos()
        expect(body.total).to.equal(0)
        expect(body.data).to.be.an('array')
        expect(body.data).to.have.lengthOf(0)
      }

      {
        const body = await servers[0].videos.listMySubscriptionVideos({ token: users[0].accessToken, sort: 'createdAt' })
        expect(body.total).to.equal(4)

        const videos = body.data
        expect(videos).to.be.an('array')
        expect(videos).to.have.lengthOf(4)

        expect(videos[0].name).to.equal('video 1-3')
        expect(videos[1].name).to.equal('video 2-3')
        expect(videos[2].name).to.equal('video server 3 added after follow')
        expect(videos[3].name).to.equal('video server 1 added after follow')
      }
    })
  })

  describe('Existing subscription video update', function () {

    it('Should update a video of server 3 and see the updated video on server 1', async function () {
      this.timeout(30000)

      await servers[2].videos.update({ id: video3UUID, attributes: { name: 'video server 3 added after follow updated' } })

      await waitJobs(servers)

      const body = await servers[0].videos.listMySubscriptionVideos({ token: users[0].accessToken, sort: 'createdAt' })
      expect(body.data[2].name).to.equal('video server 3 added after follow updated')
    })
  })

  describe('Subscription removal', function () {

    it('Should remove user of server 3 subscription', async function () {
      this.timeout(30000)

      await command.remove({ token: users[0].accessToken, uri: 'user3_channel@' + servers[2].host })

      await waitJobs(servers)
    })

    it('Should not display its videos anymore', async function () {
      const body = await servers[0].videos.listMySubscriptionVideos({ token: users[0].accessToken, sort: 'createdAt' })
      expect(body.total).to.equal(1)

      const videos = body.data
      expect(videos).to.be.an('array')
      expect(videos).to.have.lengthOf(1)

      expect(videos[0].name).to.equal('video server 1 added after follow')
    })

    it('Should remove the root subscription and not display the videos anymore', async function () {
      this.timeout(30000)

      await command.remove({ token: users[0].accessToken, uri: 'root_channel@' + servers[0].host })

      await waitJobs(servers)

      {
        const body = await command.list({ token: users[0].accessToken, sort: 'createdAt' })
        expect(body.total).to.equal(0)

        const videos = body.data
        expect(videos).to.be.an('array')
        expect(videos).to.have.lengthOf(0)
      }
    })

    it('Should correctly display public videos on server 1', async function () {
      const { total, data } = await servers[0].videos.list()
      expect(total).to.equal(5)

      for (const video of data) {
        expect(video.name).to.not.contain('1-3')
        expect(video.name).to.not.contain('2-3')
        expect(video.name).to.not.contain('video server 3 added after follow updated')
      }
    })
  })

  describe('Re-follow', function () {

    it('Should follow user of server 3 again', async function () {
      this.timeout(60000)

      await command.add({ token: users[0].accessToken, targetUri: 'user3_channel@' + servers[2].host })

      await waitJobs(servers)

      {
        const body = await servers[0].videos.listMySubscriptionVideos({ token: users[0].accessToken, sort: 'createdAt' })
        expect(body.total).to.equal(3)

        const videos = body.data
        expect(videos).to.be.an('array')
        expect(videos).to.have.lengthOf(3)

        expect(videos[0].name).to.equal('video 1-3')
        expect(videos[1].name).to.equal('video 2-3')
        expect(videos[2].name).to.equal('video server 3 added after follow updated')
      }

      {
        const { total, data } = await servers[0].videos.list()
        expect(total).to.equal(5)

        for (const video of data) {
          expect(video.name).to.not.contain('1-3')
          expect(video.name).to.not.contain('2-3')
          expect(video.name).to.not.contain('video server 3 added after follow updated')
        }
      }
    })

    it('Should follow user channels of server 3 by root of server 3', async function () {
      this.timeout(60000)

      await servers[2].channels.create({ token: users[2].accessToken, attributes: { name: 'user3_channel2' } })

      await servers[2].subscriptions.add({ token: servers[2].accessToken, targetUri: 'user3_channel@' + servers[2].host })
      await servers[2].subscriptions.add({ token: servers[2].accessToken, targetUri: 'user3_channel2@' + servers[2].host })

      await waitJobs(servers)
    })
  })

  describe('Followers listing', function () {

    it('Should list user 3 followers', async function () {
      {
        const { total, data } = await servers[2].accounts.listFollowers({
          token: users[2].accessToken,
          accountName: 'user3',
          start: 0,
          count: 5,
          sort: 'createdAt'
        })

        expect(total).to.equal(3)
        expect(data).to.have.lengthOf(3)

        expect(data[0].following.host).to.equal(servers[2].host)
        expect(data[0].following.name).to.equal('user3_channel')
        expect(data[0].follower.host).to.equal(servers[0].host)
        expect(data[0].follower.name).to.equal('user1')

        expect(data[1].following.host).to.equal(servers[2].host)
        expect(data[1].following.name).to.equal('user3_channel')
        expect(data[1].follower.host).to.equal(servers[2].host)
        expect(data[1].follower.name).to.equal('root')

        expect(data[2].following.host).to.equal(servers[2].host)
        expect(data[2].following.name).to.equal('user3_channel2')
        expect(data[2].follower.host).to.equal(servers[2].host)
        expect(data[2].follower.name).to.equal('root')
      }

      {
        const { total, data } = await servers[2].accounts.listFollowers({
          token: users[2].accessToken,
          accountName: 'user3',
          start: 0,
          count: 1,
          sort: '-createdAt'
        })

        expect(total).to.equal(3)
        expect(data).to.have.lengthOf(1)

        expect(data[0].following.host).to.equal(servers[2].host)
        expect(data[0].following.name).to.equal('user3_channel2')
        expect(data[0].follower.host).to.equal(servers[2].host)
        expect(data[0].follower.name).to.equal('root')
      }

      {
        const { total, data } = await servers[2].accounts.listFollowers({
          token: users[2].accessToken,
          accountName: 'user3',
          start: 1,
          count: 1,
          sort: '-createdAt'
        })

        expect(total).to.equal(3)
        expect(data).to.have.lengthOf(1)

        expect(data[0].following.host).to.equal(servers[2].host)
        expect(data[0].following.name).to.equal('user3_channel')
        expect(data[0].follower.host).to.equal(servers[2].host)
        expect(data[0].follower.name).to.equal('root')
      }

      {
        const { total, data } = await servers[2].accounts.listFollowers({
          token: users[2].accessToken,
          accountName: 'user3',
          search: 'user1',
          sort: '-createdAt'
        })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)

        expect(data[0].following.host).to.equal(servers[2].host)
        expect(data[0].following.name).to.equal('user3_channel')
        expect(data[0].follower.host).to.equal(servers[0].host)
        expect(data[0].follower.name).to.equal('user1')
      }
    })

    it('Should list user3_channel followers', async function () {
      {
        const { total, data } = await servers[2].channels.listFollowers({
          token: users[2].accessToken,
          channelName: 'user3_channel',
          start: 0,
          count: 5,
          sort: 'createdAt'
        })

        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)

        expect(data[0].following.host).to.equal(servers[2].host)
        expect(data[0].following.name).to.equal('user3_channel')
        expect(data[0].follower.host).to.equal(servers[0].host)
        expect(data[0].follower.name).to.equal('user1')

        expect(data[1].following.host).to.equal(servers[2].host)
        expect(data[1].following.name).to.equal('user3_channel')
        expect(data[1].follower.host).to.equal(servers[2].host)
        expect(data[1].follower.name).to.equal('root')
      }

      {
        const { total, data } = await servers[2].channels.listFollowers({
          token: users[2].accessToken,
          channelName: 'user3_channel',
          start: 0,
          count: 1,
          sort: '-createdAt'
        })

        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(1)

        expect(data[0].following.host).to.equal(servers[2].host)
        expect(data[0].following.name).to.equal('user3_channel')
        expect(data[0].follower.host).to.equal(servers[2].host)
        expect(data[0].follower.name).to.equal('root')
      }

      {
        const { total, data } = await servers[2].channels.listFollowers({
          token: users[2].accessToken,
          channelName: 'user3_channel',
          start: 1,
          count: 1,
          sort: '-createdAt'
        })

        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(1)

        expect(data[0].following.host).to.equal(servers[2].host)
        expect(data[0].following.name).to.equal('user3_channel')
        expect(data[0].follower.host).to.equal(servers[0].host)
        expect(data[0].follower.name).to.equal('user1')
      }

      {
        const { total, data } = await servers[2].channels.listFollowers({
          token: users[2].accessToken,
          channelName: 'user3_channel',
          search: 'user1',
          sort: '-createdAt'
        })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)

        expect(data[0].following.host).to.equal(servers[2].host)
        expect(data[0].following.name).to.equal('user3_channel')
        expect(data[0].follower.host).to.equal(servers[0].host)
        expect(data[0].follower.name).to.equal('user1')
      }
    })
  })

  describe('Subscription videos privacy', function () {

    it('Should update video as internal and not see from remote server', async function () {
      this.timeout(30000)

      await servers[2].videos.update({ id: video3UUID, attributes: { name: 'internal', privacy: VideoPrivacy.INTERNAL } })
      await waitJobs(servers)

      {
        const { data } = await servers[0].videos.listMySubscriptionVideos({ token: users[0].accessToken })
        expect(data.find(v => v.name === 'internal')).to.not.exist
      }
    })

    it('Should see internal from local user', async function () {
      const { data } = await servers[2].videos.listMySubscriptionVideos({ token: servers[2].accessToken })
      expect(data.find(v => v.name === 'internal')).to.exist
    })

    it('Should update video as private and not see from anyone server', async function () {
      this.timeout(30000)

      await servers[2].videos.update({ id: video3UUID, attributes: { name: 'private', privacy: VideoPrivacy.PRIVATE } })
      await waitJobs(servers)

      {
        const { data } = await servers[0].videos.listMySubscriptionVideos({ token: users[0].accessToken })
        expect(data.find(v => v.name === 'private')).to.not.exist
      }

      {
        const { data } = await servers[2].videos.listMySubscriptionVideos({ token: servers[2].accessToken })
        expect(data.find(v => v.name === 'private')).to.not.exist
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
