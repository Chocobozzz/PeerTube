/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  acceptFollower,
  cleanupTests,
  flushAndRunMultipleServers,
  ServerInfo,
  setAccessTokensToServers,
  updateCustomSubConfig
} from '../../../../shared/extra-utils/index'
import {
  follow,
  getFollowersListPaginationAndSort,
  getFollowingListPaginationAndSort,
  rejectFollower,
  removeFollower
} from '../../../../shared/extra-utils/server/follows'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { ActorFollow } from '../../../../shared/models/actors'

const expect = chai.expect

async function checkServer1And2HasFollowers (servers: ServerInfo[], state = 'accepted') {
  {
    const res = await getFollowingListPaginationAndSort({ url: servers[0].url, start: 0, count: 5, sort: 'createdAt' })
    expect(res.body.total).to.equal(1)

    const follow = res.body.data[0] as ActorFollow
    expect(follow.state).to.equal(state)
    expect(follow.follower.url).to.equal('http://localhost:' + servers[0].port + '/accounts/peertube')
    expect(follow.following.url).to.equal('http://localhost:' + servers[1].port + '/accounts/peertube')
  }

  {
    const res = await getFollowersListPaginationAndSort({ url: servers[1].url, start: 0, count: 5, sort: 'createdAt' })
    expect(res.body.total).to.equal(1)

    const follow = res.body.data[0] as ActorFollow
    expect(follow.state).to.equal(state)
    expect(follow.follower.url).to.equal('http://localhost:' + servers[0].port + '/accounts/peertube')
    expect(follow.following.url).to.equal('http://localhost:' + servers[1].port + '/accounts/peertube')
  }
}

async function checkNoFollowers (servers: ServerInfo[]) {
  {
    const res = await getFollowingListPaginationAndSort({ url: servers[0].url, start: 0, count: 5, sort: 'createdAt' })
    expect(res.body.total).to.equal(0)
  }

  {
    const res = await getFollowersListPaginationAndSort({ url: servers[1].url, start: 0, count: 5, sort: 'createdAt' })
    expect(res.body.total).to.equal(0)
  }
}

describe('Test follows moderation', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)
  })

  it('Should have server 1 following server 2', async function () {
    this.timeout(30000)

    await follow(servers[0].url, [ servers[1].url ], servers[0].accessToken)

    await waitJobs(servers)
  })

  it('Should have correct follows', async function () {
    await checkServer1And2HasFollowers(servers)
  })

  it('Should remove follower on server 2', async function () {
    await removeFollower(servers[1].url, servers[1].accessToken, servers[0])

    await waitJobs(servers)
  })

  it('Should not not have follows anymore', async function () {
    await checkNoFollowers(servers)
  })

  it('Should disable followers on server 2', async function () {
    const subConfig = {
      followers: {
        instance: {
          enabled: false,
          manualApproval: false
        }
      }
    }

    await updateCustomSubConfig(servers[1].url, servers[1].accessToken, subConfig)

    await follow(servers[0].url, [ servers[1].url ], servers[0].accessToken)
    await waitJobs(servers)

    await checkNoFollowers(servers)
  })

  it('Should re enable followers on server 2', async function () {
    const subConfig = {
      followers: {
        instance: {
          enabled: true,
          manualApproval: false
        }
      }
    }

    await updateCustomSubConfig(servers[1].url, servers[1].accessToken, subConfig)

    await follow(servers[0].url, [ servers[1].url ], servers[0].accessToken)
    await waitJobs(servers)

    await checkServer1And2HasFollowers(servers)
  })

  it('Should manually approve followers', async function () {
    this.timeout(20000)

    await removeFollower(servers[1].url, servers[1].accessToken, servers[0])
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

    await follow(servers[0].url, [ servers[1].url ], servers[0].accessToken)
    await waitJobs(servers)

    await checkServer1And2HasFollowers(servers, 'pending')
  })

  it('Should accept a follower', async function () {
    await acceptFollower(servers[1].url, servers[1].accessToken, 'peertube@localhost:' + servers[0].port)
    await waitJobs(servers)

    await checkServer1And2HasFollowers(servers)
  })

  it('Should reject another follower', async function () {
    this.timeout(20000)

    await follow(servers[0].url, [ servers[2].url ], servers[0].accessToken)
    await waitJobs(servers)

    {
      const res = await getFollowingListPaginationAndSort({ url: servers[0].url, start: 0, count: 5, sort: 'createdAt' })
      expect(res.body.total).to.equal(2)
    }

    {
      const res = await getFollowersListPaginationAndSort({ url: servers[1].url, start: 0, count: 5, sort: 'createdAt' })
      expect(res.body.total).to.equal(1)
    }

    {
      const res = await getFollowersListPaginationAndSort({ url: servers[2].url, start: 0, count: 5, sort: 'createdAt' })
      expect(res.body.total).to.equal(1)
    }

    await rejectFollower(servers[2].url, servers[2].accessToken, 'peertube@localhost:' + servers[0].port)
    await waitJobs(servers)

    await checkServer1And2HasFollowers(servers)

    {
      const res = await getFollowersListPaginationAndSort({ url: servers[2].url, start: 0, count: 5, sort: 'createdAt' })
      expect(res.body.total).to.equal(0)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
