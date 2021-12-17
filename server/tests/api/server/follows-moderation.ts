/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createMultipleServers,
  FollowsCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

const expect = chai.expect

async function checkServer1And2HasFollowers (servers: PeerTubeServer[], state = 'accepted') {
  const fns = [
    servers[0].follows.getFollowings.bind(servers[0].follows),
    servers[1].follows.getFollowers.bind(servers[1].follows)
  ]

  for (const fn of fns) {
    const body = await fn({ start: 0, count: 5, sort: 'createdAt' })
    expect(body.total).to.equal(1)

    const follow = body.data[0]
    expect(follow.state).to.equal(state)
    expect(follow.follower.url).to.equal('http://localhost:' + servers[0].port + '/accounts/peertube')
    expect(follow.following.url).to.equal('http://localhost:' + servers[1].port + '/accounts/peertube')
  }
}

async function checkNoFollowers (servers: PeerTubeServer[]) {
  const fns = [
    servers[0].follows.getFollowings.bind(servers[0].follows),
    servers[1].follows.getFollowers.bind(servers[1].follows)
  ]

  for (const fn of fns) {
    const body = await fn({ start: 0, count: 5, sort: 'createdAt' })
    expect(body.total).to.equal(0)
  }
}

describe('Test follows moderation', function () {
  let servers: PeerTubeServer[] = []
  let commands: FollowsCommand[]

  before(async function () {
    this.timeout(30000)

    servers = await createMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    commands = servers.map(s => s.follows)
  })

  it('Should have server 1 following server 2', async function () {
    this.timeout(30000)

    await commands[0].follow({ hosts: [ servers[1].url ] })

    await waitJobs(servers)
  })

  it('Should have correct follows', async function () {
    await checkServer1And2HasFollowers(servers)
  })

  it('Should remove follower on server 2', async function () {
    this.timeout(10000)

    await commands[1].removeFollower({ follower: servers[0] })

    await waitJobs(servers)
  })

  it('Should not not have follows anymore', async function () {
    await checkNoFollowers(servers)
  })

  it('Should disable followers on server 2', async function () {
    this.timeout(10000)

    const subConfig = {
      followers: {
        instance: {
          enabled: false,
          manualApproval: false
        }
      }
    }

    await servers[1].config.updateCustomSubConfig({ newConfig: subConfig })

    await commands[0].follow({ hosts: [ servers[1].url ] })
    await waitJobs(servers)

    await checkNoFollowers(servers)
  })

  it('Should re enable followers on server 2', async function () {
    this.timeout(10000)

    const subConfig = {
      followers: {
        instance: {
          enabled: true,
          manualApproval: false
        }
      }
    }

    await servers[1].config.updateCustomSubConfig({ newConfig: subConfig })

    await commands[0].follow({ hosts: [ servers[1].url ] })
    await waitJobs(servers)

    await checkServer1And2HasFollowers(servers)
  })

  it('Should manually approve followers', async function () {
    this.timeout(20000)

    await commands[1].removeFollower({ follower: servers[0] })
    await waitJobs(servers)

    const subConfig = {
      followers: {
        instance: {
          enabled: true,
          manualApproval: true
        }
      }
    }

    await servers[1].config.updateCustomSubConfig({ newConfig: subConfig })
    await servers[2].config.updateCustomSubConfig({ newConfig: subConfig })

    await commands[0].follow({ hosts: [ servers[1].url ] })
    await waitJobs(servers)

    await checkServer1And2HasFollowers(servers, 'pending')
  })

  it('Should accept a follower', async function () {
    this.timeout(10000)

    await commands[1].acceptFollower({ follower: 'peertube@localhost:' + servers[0].port })
    await waitJobs(servers)

    await checkServer1And2HasFollowers(servers)
  })

  it('Should reject another follower', async function () {
    this.timeout(20000)

    await commands[0].follow({ hosts: [ servers[2].url ] })
    await waitJobs(servers)

    {
      const body = await commands[0].getFollowings({ start: 0, count: 5, sort: 'createdAt' })
      expect(body.total).to.equal(2)
    }

    {
      const body = await commands[1].getFollowers({ start: 0, count: 5, sort: 'createdAt' })
      expect(body.total).to.equal(1)
    }

    {
      const body = await commands[2].getFollowers({ start: 0, count: 5, sort: 'createdAt' })
      expect(body.total).to.equal(1)
    }

    await commands[2].rejectFollower({ follower: 'peertube@localhost:' + servers[0].port })
    await waitJobs(servers)

    await checkServer1And2HasFollowers(servers)

    {
      const body = await commands[2].getFollowers({ start: 0, count: 5, sort: 'createdAt' })
      expect(body.total).to.equal(0)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
