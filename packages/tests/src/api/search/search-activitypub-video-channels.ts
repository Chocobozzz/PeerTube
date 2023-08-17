/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { VideoChannel } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  PeerTubeServer,
  SearchCommand,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test ActivityPub video channels search', function () {
  let servers: PeerTubeServer[]
  let userServer2Token: string
  let videoServer2UUID: string
  let channelIdServer2: number
  let command: SearchCommand

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await setDefaultAccountAvatar(servers)

    {
      await servers[0].users.create({ username: 'user1_server1', password: 'password' })
      const channel = {
        name: 'channel1_server1',
        displayName: 'Channel 1 server 1'
      }
      await servers[0].channels.create({ attributes: channel })
    }

    {
      const user = { username: 'user1_server2', password: 'password' }
      await servers[1].users.create({ username: user.username, password: user.password })
      userServer2Token = await servers[1].login.getAccessToken(user)

      const channel = {
        name: 'channel1_server2',
        displayName: 'Channel 1 server 2'
      }
      const created = await servers[1].channels.create({ token: userServer2Token, attributes: channel })
      channelIdServer2 = created.id

      const attributes = { name: 'video 1 server 2', channelId: channelIdServer2 }
      const { uuid } = await servers[1].videos.upload({ token: userServer2Token, attributes })
      videoServer2UUID = uuid
    }

    await waitJobs(servers)

    command = servers[0].search
  })

  it('Should not find a remote video channel', async function () {
    this.timeout(15000)

    {
      const search = servers[1].url + '/video-channels/channel1_server3'
      const body = await command.searchChannels({ search, token: servers[0].accessToken })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }

    {
      // Without token
      const search = servers[1].url + '/video-channels/channel1_server2'
      const body = await command.searchChannels({ search })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }
  })

  it('Should search a local video channel', async function () {
    const searches = [
      servers[0].url + '/video-channels/channel1_server1',
      'channel1_server1@' + servers[0].host
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
    const search = servers[0].url + '/c/channel1_server1'

    for (const token of [ undefined, servers[0].accessToken ]) {
      const body = await command.searchChannels({ search, token })

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].name).to.equal('channel1_server1')
      expect(body.data[0].displayName).to.equal('Channel 1 server 1')
    }
  })

  it('Should search a local video channel with a query in URL', async function () {
    const searches = [
      servers[0].url + '/video-channels/channel1_server1',
      servers[0].url + '/c/channel1_server1'
    ]

    for (const search of searches) {
      for (const token of [ undefined, servers[0].accessToken ]) {
        const body = await command.searchChannels({ search: search + '?param=2', token })

        expect(body.total).to.equal(1)
        expect(body.data).to.be.an('array')
        expect(body.data).to.have.lengthOf(1)
        expect(body.data[0].name).to.equal('channel1_server1')
        expect(body.data[0].displayName).to.equal('Channel 1 server 1')
      }
    }
  })

  it('Should search a remote video channel with URL or handle', async function () {
    const searches = [
      servers[1].url + '/video-channels/channel1_server2',
      servers[1].url + '/c/channel1_server2',
      servers[1].url + '/c/channel1_server2/videos',
      'channel1_server2@' + servers[1].host
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
    const body = await servers[0].channels.list()
    expect(body.total).to.equal(3)
    expect(body.data).to.have.lengthOf(3)
    expect(body.data[0].name).to.equal('channel1_server1')
    expect(body.data[1].name).to.equal('user1_server1_channel')
    expect(body.data[2].name).to.equal('root_channel')
  })

  it('Should list video channel videos of server 2 without token', async function () {
    this.timeout(30000)

    await waitJobs(servers)

    const { total, data } = await servers[0].videos.listByChannel({
      token: null,
      handle: 'channel1_server2@' + servers[1].host
    })
    expect(total).to.equal(0)
    expect(data).to.have.lengthOf(0)
  })

  it('Should list video channel videos of server 2 with token', async function () {
    const { total, data } = await servers[0].videos.listByChannel({
      handle: 'channel1_server2@' + servers[1].host
    })

    expect(total).to.equal(1)
    expect(data[0].name).to.equal('video 1 server 2')
  })

  it('Should update video channel of server 2, and refresh it on server 1', async function () {
    this.timeout(120000)

    await servers[1].channels.update({
      token: userServer2Token,
      channelName: 'channel1_server2',
      attributes: { displayName: 'channel updated' }
    })
    await servers[1].users.updateMe({ token: userServer2Token, displayName: 'user updated' })

    await waitJobs(servers)
    // Expire video channel
    await wait(10000)

    const search = servers[1].url + '/video-channels/channel1_server2'
    const body = await command.searchChannels({ search, token: servers[0].accessToken })
    expect(body.total).to.equal(1)
    expect(body.data).to.have.lengthOf(1)

    const videoChannel: VideoChannel = body.data[0]
    expect(videoChannel.displayName).to.equal('channel updated')

    // We don't return the owner account for now
    // expect(videoChannel.ownerAccount.displayName).to.equal('user updated')
  })

  it('Should update and add a video on server 2, and update it on server 1 after a search', async function () {
    this.timeout(120000)

    await servers[1].videos.update({ token: userServer2Token, id: videoServer2UUID, attributes: { name: 'video 1 updated' } })
    await servers[1].videos.upload({ token: userServer2Token, attributes: { name: 'video 2 server 2', channelId: channelIdServer2 } })

    await waitJobs(servers)

    // Expire video channel
    await wait(10000)

    const search = servers[1].url + '/video-channels/channel1_server2'
    await command.searchChannels({ search, token: servers[0].accessToken })

    await waitJobs(servers)

    const handle = 'channel1_server2@' + servers[1].host
    const { total, data } = await servers[0].videos.listByChannel({ handle, sort: '-createdAt' })

    expect(total).to.equal(2)
    expect(data[0].name).to.equal('video 2 server 2')
    expect(data[1].name).to.equal('video 1 updated')
  })

  it('Should delete video channel of server 2, and delete it on server 1', async function () {
    this.timeout(120000)

    await servers[1].channels.delete({ token: userServer2Token, channelName: 'channel1_server2' })

    await waitJobs(servers)
    // Expire video
    await wait(10000)

    const search = servers[1].url + '/video-channels/channel1_server2'
    const body = await command.searchChannels({ search, token: servers[0].accessToken })
    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
