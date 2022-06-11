/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  SubscriptionsCommand,
  waitJobs
} from '@shared/extra-utils'

const expect = chai.expect

describe('Test users subscriptions', function () {
  let servers: PeerTubeServer[] = []
  const users: { accessToken: string }[] = []
  let video3UUID: string

  let command: SubscriptionsCommand

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    {
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
    }

    await waitJobs(servers)

    command = servers[0].subscriptions
  })

  it('Should display videos of server 2 on server 1', async function () {
    const { total } = await servers[0].videos.list()

    expect(total).to.equal(4)
  })

  it('User of server 1 should follow user of server 3 and root of server 1', async function () {
    this.timeout(60000)

    await command.add({ token: users[0].accessToken, targetUri: 'user3_channel@localhost:' + servers[2].port })
    await command.add({ token: users[0].accessToken, targetUri: 'root_channel@localhost:' + servers[0].port })

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
      const videoChannel = await command.get({ token: users[0].accessToken, uri: 'user3_channel@localhost:' + servers[2].port })

      expect(videoChannel.name).to.equal('user3_channel')
      expect(videoChannel.host).to.equal('localhost:' + servers[2].port)
      expect(videoChannel.displayName).to.equal('Main user3 channel')
      expect(videoChannel.followingCount).to.equal(0)
      expect(videoChannel.followersCount).to.equal(1)
    }

    {
      const videoChannel = await command.get({ token: users[0].accessToken, uri: 'root_channel@localhost:' + servers[0].port })

      expect(videoChannel.name).to.equal('root_channel')
      expect(videoChannel.host).to.equal('localhost:' + servers[0].port)
      expect(videoChannel.displayName).to.equal('Main root channel')
      expect(videoChannel.followingCount).to.equal(0)
      expect(videoChannel.followersCount).to.equal(1)
    }
  })

  it('Should return the existing subscriptions', async function () {
    const uris = [
      'user3_channel@localhost:' + servers[2].port,
      'root2_channel@localhost:' + servers[0].port,
      'root_channel@localhost:' + servers[0].port,
      'user3_channel@localhost:' + servers[0].port
    ]

    const body = await command.exist({ token: users[0].accessToken, uris })

    expect(body['user3_channel@localhost:' + servers[2].port]).to.be.true
    expect(body['root2_channel@localhost:' + servers[0].port]).to.be.false
    expect(body['root_channel@localhost:' + servers[0].port]).to.be.true
    expect(body['user3_channel@localhost:' + servers[0].port]).to.be.false
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

  it('Should list subscription videos', async function () {
    {
      const body = await command.listVideos()
      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }

    {
      const body = await command.listVideos({ token: users[0].accessToken, sort: 'createdAt' })
      expect(body.total).to.equal(3)

      const videos = body.data
      expect(videos).to.be.an('array')
      expect(videos).to.have.lengthOf(3)

      expect(videos[0].name).to.equal('video 1-3')
      expect(videos[1].name).to.equal('video 2-3')
      expect(videos[2].name).to.equal('video server 3 added after follow')
    }
  })

  it('Should upload a video by root on server 1 and see it in the subscription videos', async function () {
    this.timeout(60000)

    const videoName = 'video server 1 added after follow'
    await servers[0].videos.upload({ attributes: { name: videoName } })

    await waitJobs(servers)

    {
      const body = await command.listVideos()
      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }

    {
      const body = await command.listVideos({ token: users[0].accessToken, sort: 'createdAt' })
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

  it('Should have server 1 follow server 3 and display server 3 videos', async function () {
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
      const body = await command.listVideos()
      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }

    {
      const body = await command.listVideos({ token: users[0].accessToken, sort: 'createdAt' })
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

  it('Should update a video of server 3 and see the updated video on server 1', async function () {
    this.timeout(30000)

    await servers[2].videos.update({ id: video3UUID, attributes: { name: 'video server 3 added after follow updated' } })

    await waitJobs(servers)

    const body = await command.listVideos({ token: users[0].accessToken, sort: 'createdAt' })
    expect(body.data[2].name).to.equal('video server 3 added after follow updated')
  })

  it('Should remove user of server 3 subscription', async function () {
    this.timeout(30000)

    await command.remove({ token: users[0].accessToken, uri: 'user3_channel@localhost:' + servers[2].port })

    await waitJobs(servers)
  })

  it('Should not display its videos anymore', async function () {
    const body = await command.listVideos({ token: users[0].accessToken, sort: 'createdAt' })
    expect(body.total).to.equal(1)

    const videos = body.data
    expect(videos).to.be.an('array')
    expect(videos).to.have.lengthOf(1)

    expect(videos[0].name).to.equal('video server 1 added after follow')
  })

  it('Should remove the root subscription and not display the videos anymore', async function () {
    this.timeout(30000)

    await command.remove({ token: users[0].accessToken, uri: 'root_channel@localhost:' + servers[0].port })

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

  it('Should follow user of server 3 again', async function () {
    this.timeout(60000)

    await command.add({ token: users[0].accessToken, targetUri: 'user3_channel@localhost:' + servers[2].port })

    await waitJobs(servers)

    {
      const body = await command.listVideos({ token: users[0].accessToken, sort: 'createdAt' })
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

  after(async function () {
    await cleanupTests(servers)
  })
})
