/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  flushAndRunMultipleServers,
  FollowsCommand,
  ServerInfo,
  setAccessTokensToServers,
  updateCustomSubConfig,
  waitJobs
} from '@shared/extra-utils'

const expect = chai.expect

async function checkServer1And2HasFollowers (servers: ServerInfo[], state = 'accepted') {
  const fns = [
    servers[0].followsCommand.getFollowings.bind(servers[0].followsCommand),
    servers[1].followsCommand.getFollowers.bind(servers[1].followsCommand)
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

async function checkNoFollowers (servers: ServerInfo[]) {
  const fns = [
    servers[0].followsCommand.getFollowings.bind(servers[0].followsCommand),
    servers[1].followsCommand.getFollowers.bind(servers[1].followsCommand)
  ]

  for (const fn of fns) {
    const body = await fn({ start: 0, count: 5, sort: 'createdAt' })
    expect(body.total).to.equal(0)
  }
}

describe('Test follows moderation', function () {
  let servers: ServerInfo[] = []
  let commands: FollowsCommand[]

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    commands = servers.map(s => s.followsCommand)
  })

  it('Should have server 1 following server 2', async function () {
    this.timeout(30000)

    await commands[0].follow({ targets: [ servers[1].url ] })

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

    await updateCustomSubConfig(servers[1].url, servers[1].accessToken, subConfig)

    await commands[0].follow({ targets: [ servers[1].url ] })
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

    await updateCustomSubConfig(servers[1].url, servers[1].accessToken, subConfig)

    await commands[0].follow({ targets: [ servers[1].url ] })
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

    await updateCustomSubConfig(servers[1].url, servers[1].accessToken, subConfig)
    await updateCustomSubConfig(servers[2].url, servers[2].accessToken, subConfig)

    await commands[0].follow({ targets: [ servers[1].url ] })
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

    await commands[0].follow({ targets: [ servers[2].url ] })
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
