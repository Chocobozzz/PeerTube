/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

describe('Test ActivityPub fetcher', function () {
  let servers: PeerTubeServer[]

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    const user = { username: 'user1', password: 'password' }
    for (const server of servers) {
      await server.users.create({ username: user.username, password: user.password })
    }

    const userAccessToken = await servers[0].login.getAccessToken(user)

    await servers[0].videos.upload({ attributes: { name: 'video root' } })
    const { uuid } = await servers[0].videos.upload({ attributes: { name: 'bad video root' } })
    await servers[0].videos.upload({ token: userAccessToken, attributes: { name: 'video user' } })

    {
      const to = 'http://localhost:' + servers[0].port + '/accounts/user1'
      const value = 'http://localhost:' + servers[1].port + '/accounts/user1'
      await servers[0].sql.setActorField(to, 'url', value)
    }

    {
      const value = 'http://localhost:' + servers[2].port + '/videos/watch/' + uuid
      await servers[0].sql.setVideoField(uuid, 'url', value)
    }
  })

  it('Should add only the video with a valid actor URL', async function () {
    this.timeout(60000)

    await doubleFollow(servers[0], servers[1])
    await waitJobs(servers)

    {
      const { total, data } = await servers[0].videos.list({ sort: 'createdAt' })

      expect(total).to.equal(3)
      expect(data[0].name).to.equal('video root')
      expect(data[1].name).to.equal('bad video root')
      expect(data[2].name).to.equal('video user')
    }

    {
      const { total, data } = await servers[1].videos.list({ sort: 'createdAt' })

      expect(total).to.equal(1)
      expect(data[0].name).to.equal('video root')
    }
  })

  after(async function () {
    this.timeout(20000)

    await cleanupTests(servers)
  })
})
