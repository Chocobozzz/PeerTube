/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  follow,
  getVideosList,
  unfollow,
  updateVideo,
  userLogin
} from '../../../../shared/extra-utils'
import { ServerInfo, uploadVideo } from '../../../../shared/extra-utils/index'
import { setAccessTokensToServers } from '../../../../shared/extra-utils/users/login'
import { Video, VideoChannel } from '../../../../shared/models/videos'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import {
  addUserSubscription,
  areSubscriptionsExist,
  getUserSubscription,
  listUserSubscriptions,
  listUserSubscriptionVideos,
  removeUserSubscription
} from '../../../../shared/extra-utils/users/user-subscriptions'

const expect = chai.expect

describe('Test users subscriptions', function () {
  let servers: ServerInfo[] = []
  const users: { accessToken: string }[] = []
  let video3UUID: string

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    {
      for (const server of servers) {
        const user = { username: 'user' + server.serverNumber, password: 'password' }
        await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })

        const accessToken = await userLogin(server, user)
        users.push({ accessToken })

        const videoName1 = 'video 1-' + server.serverNumber
        await uploadVideo(server.url, accessToken, { name: videoName1 })

        const videoName2 = 'video 2-' + server.serverNumber
        await uploadVideo(server.url, accessToken, { name: videoName2 })
      }
    }

    await waitJobs(servers)
  })

  it('Should display videos of server 2 on server 1', async function () {
    const res = await getVideosList(servers[0].url)

    expect(res.body.total).to.equal(4)
  })

  it('User of server 1 should follow user of server 3 and root of server 1', async function () {
    this.timeout(60000)

    await addUserSubscription(servers[0].url, users[0].accessToken, 'user3_channel@localhost:' + servers[2].port)
    await addUserSubscription(servers[0].url, users[0].accessToken, 'root_channel@localhost:' + servers[0].port)

    await waitJobs(servers)

    const res = await uploadVideo(servers[2].url, users[2].accessToken, { name: 'video server 3 added after follow' })
    video3UUID = res.body.video.uuid

    await waitJobs(servers)
  })

  it('Should not display videos of server 3 on server 1', async function () {
    const res = await getVideosList(servers[0].url)

    expect(res.body.total).to.equal(4)
    for (const video of res.body.data) {
      expect(video.name).to.not.contain('1-3')
      expect(video.name).to.not.contain('2-3')
      expect(video.name).to.not.contain('video server 3 added after follow')
    }
  })

  it('Should list subscriptions', async function () {
    {
      const res = await listUserSubscriptions({ url: servers[0].url, token: servers[0].accessToken })
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(0)
    }

    {
      const res = await listUserSubscriptions({ url: servers[0].url, token: users[0].accessToken, sort: 'createdAt' })
      expect(res.body.total).to.equal(2)

      const subscriptions: VideoChannel[] = res.body.data
      expect(subscriptions).to.be.an('array')
      expect(subscriptions).to.have.lengthOf(2)

      expect(subscriptions[0].name).to.equal('user3_channel')
      expect(subscriptions[1].name).to.equal('root_channel')
    }
  })

  it('Should get subscription', async function () {
    {
      const res = await getUserSubscription(servers[0].url, users[0].accessToken, 'user3_channel@localhost:' + servers[2].port)
      const videoChannel: VideoChannel = res.body

      expect(videoChannel.name).to.equal('user3_channel')
      expect(videoChannel.host).to.equal('localhost:' + servers[2].port)
      expect(videoChannel.displayName).to.equal('Main user3 channel')
      expect(videoChannel.followingCount).to.equal(0)
      expect(videoChannel.followersCount).to.equal(1)
    }

    {
      const res = await getUserSubscription(servers[0].url, users[0].accessToken, 'root_channel@localhost:' + servers[0].port)
      const videoChannel: VideoChannel = res.body

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

    const res = await areSubscriptionsExist(servers[0].url, users[0].accessToken, uris)
    const body = res.body

    expect(body['user3_channel@localhost:' + servers[2].port]).to.be.true
    expect(body['root2_channel@localhost:' + servers[0].port]).to.be.false
    expect(body['root_channel@localhost:' + servers[0].port]).to.be.true
    expect(body['user3_channel@localhost:' + servers[0].port]).to.be.false
  })

  it('Should search among subscriptions', async function () {
    {
      const res = await listUserSubscriptions({
        url: servers[0].url,
        token: users[0].accessToken,
        sort: '-createdAt',
        search: 'user3_channel'
      })
      expect(res.body.total).to.equal(1)

      const subscriptions = res.body.data
      expect(subscriptions).to.have.lengthOf(1)
    }

    {
      const res = await listUserSubscriptions({
        url: servers[0].url,
        token: users[0].accessToken,
        sort: '-createdAt',
        search: 'toto'
      })
      expect(res.body.total).to.equal(0)

      const subscriptions = res.body.data
      expect(subscriptions).to.have.lengthOf(0)
    }
  })

  it('Should list subscription videos', async function () {
    {
      const res = await listUserSubscriptionVideos(servers[0].url, servers[0].accessToken)
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(0)
    }

    {
      const res = await listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt')
      expect(res.body.total).to.equal(3)

      const videos: Video[] = res.body.data
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
    await uploadVideo(servers[0].url, servers[0].accessToken, { name: videoName })

    await waitJobs(servers)

    {
      const res = await listUserSubscriptionVideos(servers[0].url, servers[0].accessToken)
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(0)
    }

    {
      const res = await listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt')
      expect(res.body.total).to.equal(4)

      const videos: Video[] = res.body.data
      expect(videos).to.be.an('array')
      expect(videos).to.have.lengthOf(4)

      expect(videos[0].name).to.equal('video 1-3')
      expect(videos[1].name).to.equal('video 2-3')
      expect(videos[2].name).to.equal('video server 3 added after follow')
      expect(videos[3].name).to.equal('video server 1 added after follow')
    }

    {
      const res = await getVideosList(servers[0].url)

      expect(res.body.total).to.equal(5)
      for (const video of res.body.data) {
        expect(video.name).to.not.contain('1-3')
        expect(video.name).to.not.contain('2-3')
        expect(video.name).to.not.contain('video server 3 added after follow')
      }
    }
  })

  it('Should have server 1 follow server 3 and display server 3 videos', async function () {
    this.timeout(60000)

    await follow(servers[0].url, [ servers[2].url ], servers[0].accessToken)

    await waitJobs(servers)

    const res = await getVideosList(servers[0].url)

    expect(res.body.total).to.equal(8)

    const names = [ '1-3', '2-3', 'video server 3 added after follow' ]
    for (const name of names) {
      const video = res.body.data.find(v => v.name.indexOf(name) === -1)
      expect(video).to.not.be.undefined
    }
  })

  it('Should remove follow server 1 -> server 3 and hide server 3 videos', async function () {
    this.timeout(60000)

    await unfollow(servers[0].url, servers[0].accessToken, servers[2])

    await waitJobs(servers)

    const res = await getVideosList(servers[0].url)

    expect(res.body.total).to.equal(5)
    for (const video of res.body.data) {
      expect(video.name).to.not.contain('1-3')
      expect(video.name).to.not.contain('2-3')
      expect(video.name).to.not.contain('video server 3 added after follow')
    }
  })

  it('Should still list subscription videos', async function () {
    {
      const res = await listUserSubscriptionVideos(servers[0].url, servers[0].accessToken)
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(0)
    }

    {
      const res = await listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt')
      expect(res.body.total).to.equal(4)

      const videos: Video[] = res.body.data
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

    await updateVideo(servers[2].url, users[2].accessToken, video3UUID, { name: 'video server 3 added after follow updated' })

    await waitJobs(servers)

    const res = await listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt')
    const videos: Video[] = res.body.data
    expect(videos[2].name).to.equal('video server 3 added after follow updated')
  })

  it('Should remove user of server 3 subscription', async function () {
    this.timeout(30000)

    await removeUserSubscription(servers[0].url, users[0].accessToken, 'user3_channel@localhost:' + servers[2].port)

    await waitJobs(servers)
  })

  it('Should not display its videos anymore', async function () {
    {
      const res = await listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt')
      expect(res.body.total).to.equal(1)

      const videos: Video[] = res.body.data
      expect(videos).to.be.an('array')
      expect(videos).to.have.lengthOf(1)

      expect(videos[0].name).to.equal('video server 1 added after follow')
    }
  })

  it('Should remove the root subscription and not display the videos anymore', async function () {
    this.timeout(30000)

    await removeUserSubscription(servers[0].url, users[0].accessToken, 'root_channel@localhost:' + servers[0].port)

    await waitJobs(servers)

    {
      const res = await listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt')
      expect(res.body.total).to.equal(0)

      const videos: Video[] = res.body.data
      expect(videos).to.be.an('array')
      expect(videos).to.have.lengthOf(0)
    }
  })

  it('Should correctly display public videos on server 1', async function () {
    const res = await getVideosList(servers[0].url)

    expect(res.body.total).to.equal(5)
    for (const video of res.body.data) {
      expect(video.name).to.not.contain('1-3')
      expect(video.name).to.not.contain('2-3')
      expect(video.name).to.not.contain('video server 3 added after follow updated')
    }
  })

  it('Should follow user of server 3 again', async function () {
    this.timeout(60000)

    await addUserSubscription(servers[0].url, users[0].accessToken, 'user3_channel@localhost:' + servers[2].port)

    await waitJobs(servers)

    {
      const res = await listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt')
      expect(res.body.total).to.equal(3)

      const videos: Video[] = res.body.data
      expect(videos).to.be.an('array')
      expect(videos).to.have.lengthOf(3)

      expect(videos[0].name).to.equal('video 1-3')
      expect(videos[1].name).to.equal('video 2-3')
      expect(videos[2].name).to.equal('video server 3 added after follow updated')
    }

    {
      const res = await getVideosList(servers[0].url)

      expect(res.body.total).to.equal(5)
      for (const video of res.body.data) {
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
