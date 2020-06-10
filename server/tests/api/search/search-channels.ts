/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { searchVideoChannel, advancedVideoChannelSearch } from '@shared/extra-utils/search/video-channels'
import {
  addVideoChannel,
  cleanupTests,
  createUser,
  flushAndRunServer,
  ServerInfo,
  setAccessTokensToServers
} from '../../../../shared/extra-utils'
import { VideoChannel } from '@shared/models'

const expect = chai.expect

describe('Test channels search', function () {
  let server: ServerInfo = null

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    {
      await createUser({ url: server.url, accessToken: server.accessToken, username: 'user1', password: 'password' })
      const channel = {
        name: 'squall_channel',
        displayName: 'Squall channel'
      }
      await addVideoChannel(server.url, server.accessToken, channel)
    }
  })

  it('Should make a simple search and not have results', async function () {
    const res = await searchVideoChannel(server.url, 'abc')

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should make a search and have results', async function () {
    {
      const search = {
        search: 'Squall',
        start: 0,
        count: 1
      }
      const res = await advancedVideoChannelSearch(server.url, search)
      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.have.lengthOf(1)

      const channel: VideoChannel = res.body.data[0]
      expect(channel.name).to.equal('squall_channel')
      expect(channel.displayName).to.equal('Squall channel')
    }

    {
      const search = {
        search: 'Squall',
        start: 1,
        count: 1
      }

      const res = await advancedVideoChannelSearch(server.url, search)

      expect(res.body.total).to.equal(1)

      expect(res.body.data).to.have.lengthOf(0)
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
