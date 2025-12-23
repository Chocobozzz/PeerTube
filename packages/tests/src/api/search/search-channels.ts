/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { VideoChannel } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  doubleFollow,
  PeerTubeServer,
  SearchCommand,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar
} from '@peertube/peertube-server-commands'

describe('Test channels search', function () {
  let server: PeerTubeServer
  let remoteServer: PeerTubeServer
  let command: SearchCommand

  before(async function () {
    this.timeout(120000)

    const servers = await Promise.all([
      createSingleServer(1),
      createSingleServer(2)
    ])
    server = servers[0]
    remoteServer = servers[1]

    await setAccessTokensToServers([ server, remoteServer ])
    await setDefaultChannelAvatar(server)
    await setDefaultAccountAvatar(server)

    await servers[1].config.disableTranscoding()

    {
      await server.users.create({ username: 'user1' })
      const channel = {
        name: 'squall_channel',
        displayName: 'Squall channel'
      }
      await server.channels.create({ attributes: channel })
    }

    {
      await remoteServer.users.create({ username: 'user1' })
      const channel = {
        name: 'zell_channel',
        displayName: 'Zell channel'
      }
      const { id } = await remoteServer.channels.create({ attributes: channel })

      await remoteServer.videos.upload({ attributes: { channelId: id } })
    }

    await doubleFollow(server, remoteServer)

    command = server.search
  })

  it('Should make a simple search and not have results', async function () {
    const body = await command.searchChannels({ search: 'abc' })

    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  it('Should make a search and have results', async function () {
    {
      const search = {
        search: 'Squall',
        start: 0,
        count: 1
      }
      const body = await command.advancedChannelSearch({ search })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)

      const channel: VideoChannel = body.data[0]
      expect(channel.name).to.equal('squall_channel')
      expect(channel.displayName).to.equal('Squall channel')
    }

    {
      const search = {
        search: 'Squall',
        start: 1,
        count: 1
      }

      const body = await command.advancedChannelSearch({ search })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(0)
    }
  })

  it('Should also search by account display name', async function () {
    {
      const body = await command.searchChannels({ search: 'roat' })
      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    }

    {
      const body = await command.searchChannels({ search: 'root' })
      expect(body.data.map(c => c.displayName)).to.have.members([ 'Squall channel', 'Main root channel', 'Zell channel' ])
    }
  })

  it('Should filter by host', async function () {
    {
      const search = { search: 'channel', host: remoteServer.host }

      const body = await command.advancedChannelSearch({ search })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].displayName).to.equal('Zell channel')
    }

    {
      const search = { search: 'Sq', host: server.host }

      const body = await command.advancedChannelSearch({ search })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].displayName).to.equal('Squall channel')
    }

    {
      const search = { search: 'Squall', host: 'example.com' }

      const body = await command.advancedChannelSearch({ search })
      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    }
  })

  it('Should filter by names', async function () {
    {
      const body = await command.advancedChannelSearch({ search: { handles: [ 'squall_channel', 'zell_channel' ] } })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].displayName).to.equal('Squall channel')
    }

    {
      const body = await command.advancedChannelSearch({ search: { handles: [ 'squall_channel@' + server.host ] } })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].displayName).to.equal('Squall channel')
    }

    {
      const body = await command.advancedChannelSearch({ search: { handles: [ 'chocobozzz_channel' ] } })
      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    }

    {
      const body = await command.advancedChannelSearch({ search: { handles: [ 'squall_channel', 'zell_channel@' + remoteServer.host ] } })
      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(2)
      expect(body.data[0].displayName).to.equal('Squall channel')
      expect(body.data[1].displayName).to.equal('Zell channel')
    }
  })

  after(async function () {
    await cleanupTests([ server, remoteServer ])
  })
})
