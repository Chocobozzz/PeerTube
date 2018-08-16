/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { createUser, doubleFollow, flushAndRunMultipleServers, follow, getVideosList, unfollow, userLogin } from '../../utils'
import { getMyUserInformation, killallServers, ServerInfo, uploadVideo } from '../../utils/index'
import { setAccessTokensToServers } from '../../utils/users/login'
import { Video, VideoChannel } from '../../../../shared/models/videos'
import { waitJobs } from '../../utils/server/jobs'
import {
  addUserSubscription,
  listUserSubscriptions,
  listUserSubscriptionVideos,
  removeUserSubscription
} from '../../utils/users/user-subscriptions'

const expect = chai.expect

describe('Test users subscriptions', function () {
  let servers: ServerInfo[] = []
  const users: { accessToken: string, videoChannelName: string }[] = []
  let rootChannelNameServer1: string

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    const res = await getMyUserInformation(servers[0].url, servers[0].accessToken)
    rootChannelNameServer1 = res.body.videoChannels[0].name

    {
      for (const server of servers) {
        const user = { username: 'user' + server.serverNumber, password: 'password' }
        await createUser(server.url, server.accessToken, user.username, user.password)

        const accessToken = await userLogin(server, user)
        const res = await getMyUserInformation(server.url, accessToken)
        const videoChannels: VideoChannel[] = res.body.videoChannels

        users.push({ accessToken, videoChannelName: videoChannels[0].name })

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
    this.timeout(30000)

    await addUserSubscription(servers[0].url, users[0].accessToken, users[2].videoChannelName + '@localhost:9003')
    await addUserSubscription(servers[0].url, users[0].accessToken, rootChannelNameServer1 + '@localhost:9001')

    await waitJobs(servers)

    await uploadVideo(servers[2].url, users[2].accessToken, { name: 'video server 3 added after follow' })

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
      const res = await listUserSubscriptions(servers[0].url, servers[0].accessToken)
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(0)
    }

    {
      const res = await listUserSubscriptions(servers[0].url, users[0].accessToken)
      expect(res.body.total).to.equal(2)

      const subscriptions: VideoChannel[] = res.body.data
      expect(subscriptions).to.be.an('array')
      expect(subscriptions).to.have.lengthOf(2)

      expect(subscriptions[0].name).to.equal(users[2].videoChannelName)
      expect(subscriptions[1].name).to.equal(rootChannelNameServer1)
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
    this.timeout(30000)

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
    this.timeout(30000)

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
    this.timeout(30000)

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

  it('Should remove user of server 3 subscription', async function () {
    await removeUserSubscription(servers[0].url, users[0].accessToken, users[2].videoChannelName + '@localhost:9003')

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
    await removeUserSubscription(servers[0].url, users[0].accessToken, rootChannelNameServer1 + '@localhost:9001')

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
      expect(video.name).to.not.contain('video server 3 added after follow')
    }
  })

  it('Should follow user of server 3 again', async function () {
    this.timeout(30000)

    await addUserSubscription(servers[0].url, users[0].accessToken, users[2].videoChannelName + '@localhost:9003')

    await waitJobs(servers)

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

  after(async function () {
    killallServers(servers)
  })
})
