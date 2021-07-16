/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { cleanupTests, flushAndRunServer, SearchCommand, ServerInfo, setAccessTokensToServers } from '@shared/extra-utils'
import { VideoChannel } from '@shared/models'

const expect = chai.expect

describe('Test channels search', function () {
  let server: ServerInfo = null
  let command: SearchCommand

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    {
      await server.users.create({ username: 'user1', password: 'password' })
      const channel = {
        name: 'squall_channel',
        displayName: 'Squall channel'
      }
      await server.channels.create({ attributes: channel })
    }

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

  after(async function () {
    await cleanupTests([ server ])
  })
})
