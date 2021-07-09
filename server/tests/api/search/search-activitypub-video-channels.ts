/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createUser,
  flushAndRunMultipleServers,
  getVideoChannelVideos,
  SearchCommand,
  ServerInfo,
  setAccessTokensToServers,
  updateMyUser,
  updateVideo,
  uploadVideo,
  userLogin,
  wait,
  waitJobs
} from '@shared/extra-utils'
import { VideoChannel } from '@shared/models'

const expect = chai.expect

describe('Test ActivityPub video channels search', function () {
  let servers: ServerInfo[]
  let userServer2Token: string
  let videoServer2UUID: string
  let channelIdServer2: number
  let command: SearchCommand

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    {
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: 'user1_server1', password: 'password' })
      const channel = {
        name: 'channel1_server1',
        displayName: 'Channel 1 server 1'
      }
      await servers[0].channelsCommand.create({ attributes: channel })
    }

    {
      const user = { username: 'user1_server2', password: 'password' }
      await createUser({ url: servers[1].url, accessToken: servers[1].accessToken, username: user.username, password: user.password })
      userServer2Token = await userLogin(servers[1], user)

      const channel = {
        name: 'channel1_server2',
        displayName: 'Channel 1 server 2'
      }
      const created = await servers[1].channelsCommand.create({ token: userServer2Token, attributes: channel })
      channelIdServer2 = created.id

      const res = await uploadVideo(servers[1].url, userServer2Token, { name: 'video 1 server 2', channelId: channelIdServer2 })
      videoServer2UUID = res.body.video.uuid
    }

    await waitJobs(servers)

    command = servers[0].searchCommand
  })

  it('Should not find a remote video channel', async function () {
    this.timeout(15000)

    {
      const search = 'http://localhost:' + servers[1].port + '/video-channels/channel1_server3'
      const body = await command.searchChannels({ search, token: servers[0].accessToken })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }

    {
      // Without token
      const search = 'http://localhost:' + servers[1].port + '/video-channels/channel1_server2'
      const body = await command.searchChannels({ search })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }
  })

  it('Should search a local video channel', async function () {
    const searches = [
      'http://localhost:' + servers[0].port + '/video-channels/channel1_server1',
      'channel1_server1@localhost:' + servers[0].port
    ]

    for (const search of searches) {
      const body = await command.searchChannels({ search })

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].name).to.equal('channel1_server1')
      expect(body.data[0].displayName).to.equal('Channel 1 server 1')
    }
  })

  it('Should search a local video channel with an alternative URL', async function () {
    const search = 'http://localhost:' + servers[0].port + '/c/channel1_server1'

    for (const token of [ undefined, servers[0].accessToken ]) {
      const body = await command.searchChannels({ search, token })

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].name).to.equal('channel1_server1')
      expect(body.data[0].displayName).to.equal('Channel 1 server 1')
    }
  })

  it('Should search a remote video channel with URL or handle', async function () {
    const searches = [
      'http://localhost:' + servers[1].port + '/video-channels/channel1_server2',
      'http://localhost:' + servers[1].port + '/c/channel1_server2',
      'http://localhost:' + servers[1].port + '/c/channel1_server2/videos',
      'channel1_server2@localhost:' + servers[1].port
    ]

    for (const search of searches) {
      const body = await command.searchChannels({ search, token: servers[0].accessToken })

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].name).to.equal('channel1_server2')
      expect(body.data[0].displayName).to.equal('Channel 1 server 2')
    }
  })

  it('Should not list this remote video channel', async function () {
    const body = await servers[0].channelsCommand.list()
    expect(body.total).to.equal(3)
    expect(body.data).to.have.lengthOf(3)
    expect(body.data[0].name).to.equal('channel1_server1')
    expect(body.data[1].name).to.equal('user1_server1_channel')
    expect(body.data[2].name).to.equal('root_channel')
  })

  it('Should list video channel videos of server 2 without token', async function () {
    this.timeout(30000)

    await waitJobs(servers)

    const res = await getVideoChannelVideos(servers[0].url, null, 'channel1_server2@localhost:' + servers[1].port, 0, 5)
    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should list video channel videos of server 2 with token', async function () {
    const res = await getVideoChannelVideos(servers[0].url, servers[0].accessToken, 'channel1_server2@localhost:' + servers[1].port, 0, 5)

    expect(res.body.total).to.equal(1)
    expect(res.body.data[0].name).to.equal('video 1 server 2')
  })

  it('Should update video channel of server 2, and refresh it on server 1', async function () {
    this.timeout(60000)

    await servers[1].channelsCommand.update({
      token: userServer2Token,
      channelName: 'channel1_server2',
      attributes: { displayName: 'channel updated' }
    })
    await updateMyUser({ url: servers[1].url, accessToken: userServer2Token, displayName: 'user updated' })

    await waitJobs(servers)
    // Expire video channel
    await wait(10000)

    const search = 'http://localhost:' + servers[1].port + '/video-channels/channel1_server2'
    const body = await command.searchChannels({ search, token: servers[0].accessToken })
    expect(body.total).to.equal(1)
    expect(body.data).to.have.lengthOf(1)

    const videoChannel: VideoChannel = body.data[0]
    expect(videoChannel.displayName).to.equal('channel updated')

    // We don't return the owner account for now
    // expect(videoChannel.ownerAccount.displayName).to.equal('user updated')
  })

  it('Should update and add a video on server 2, and update it on server 1 after a search', async function () {
    this.timeout(60000)

    await updateVideo(servers[1].url, userServer2Token, videoServer2UUID, { name: 'video 1 updated' })
    await uploadVideo(servers[1].url, userServer2Token, { name: 'video 2 server 2', channelId: channelIdServer2 })

    await waitJobs(servers)

    // Expire video channel
    await wait(10000)

    const search = 'http://localhost:' + servers[1].port + '/video-channels/channel1_server2'
    await command.searchChannels({ search, token: servers[0].accessToken })

    await waitJobs(servers)

    const videoChannelName = 'channel1_server2@localhost:' + servers[1].port
    const res = await getVideoChannelVideos(servers[0].url, servers[0].accessToken, videoChannelName, 0, 5, '-createdAt')

    expect(res.body.total).to.equal(2)
    expect(res.body.data[0].name).to.equal('video 2 server 2')
    expect(res.body.data[1].name).to.equal('video 1 updated')
  })

  it('Should delete video channel of server 2, and delete it on server 1', async function () {
    this.timeout(60000)

    await servers[1].channelsCommand.delete({ token: userServer2Token, channelName: 'channel1_server2' })

    await waitJobs(servers)
    // Expire video
    await wait(10000)

    const search = 'http://localhost:' + servers[1].port + '/video-channels/channel1_server2'
    const body = await command.searchChannels({ search, token: servers[0].accessToken })
    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
