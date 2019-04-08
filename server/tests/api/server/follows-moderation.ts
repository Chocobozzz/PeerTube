/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { flushAndRunMultipleServers, killallServers, ServerInfo, setAccessTokensToServers } from '../../../../shared/utils/index'
import {
  follow,
  getFollowersListPaginationAndSort,
  getFollowingListPaginationAndSort,
  removeFollower
} from '../../../../shared/utils/server/follows'
import { waitJobs } from '../../../../shared/utils/server/jobs'
import { ActorFollow } from '../../../../shared/models/actors'

const expect = chai.expect

describe('Test follows moderation', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
  })

  it('Should have server 1 following server 2', async function () {
    this.timeout(30000)

    await follow(servers[0].url, [ servers[1].url ], servers[0].accessToken)

    await waitJobs(servers)
  })

  it('Should have correct follows', async function () {
    {
      const res = await getFollowingListPaginationAndSort(servers[0].url, 0, 5, 'createdAt')
      expect(res.body.total).to.equal(1)

      const follow = res.body.data[0] as ActorFollow
      expect(follow.follower.url).to.equal('http://localhost:9001/accounts/peertube')
      expect(follow.following.url).to.equal('http://localhost:9002/accounts/peertube')
    }

    {
      const res = await getFollowersListPaginationAndSort(servers[1].url, 0, 5, 'createdAt')
      expect(res.body.total).to.equal(1)

      const follow = res.body.data[0] as ActorFollow
      expect(follow.follower.url).to.equal('http://localhost:9001/accounts/peertube')
      expect(follow.following.url).to.equal('http://localhost:9002/accounts/peertube')
    }
  })

  it('Should remove follower on server 2', async function () {
    await removeFollower(servers[1].url, servers[1].accessToken, servers[0])

    await waitJobs(servers)
  })

  it('Should not not have follows anymore', async function () {
    {
      const res = await getFollowingListPaginationAndSort(servers[ 0 ].url, 0, 1, 'createdAt')
      expect(res.body.total).to.equal(0)
    }

    {
      const res = await getFollowingListPaginationAndSort(servers[ 0 ].url, 0, 1, 'createdAt')
      expect(res.body.total).to.equal(0)
    }
  })

  after(async function () {
    killallServers(servers)
  })
})
