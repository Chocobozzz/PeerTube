/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  acceptFollower,
  cleanupTests,
  flushAndRunMultipleServers,
  ServerInfo,
  setAccessTokensToServers,
  unfollow,
  updateCustomSubConfig
} from '../../../../shared/extra-utils/index'
import { follow, getFollowersListPaginationAndSort, getFollowingListPaginationAndSort } from '../../../../shared/extra-utils/server/follows'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { ActorFollow } from '../../../../shared/models/actors'

const expect = chai.expect

async function checkFollow (follower: ServerInfo, following: ServerInfo, exists: boolean) {
  {
    const res = await getFollowersListPaginationAndSort(following.url, 0, 5, '-createdAt')
    const follows = res.body.data as ActorFollow[]

    if (exists === true) {
      expect(res.body.total).to.equal(1)

      expect(follows[ 0 ].follower.host).to.equal(follower.host)
      expect(follows[ 0 ].state).to.equal('accepted')
    } else {
      expect(follows.filter(f => f.state === 'accepted')).to.have.lengthOf(0)
    }
  }

  {
    const res = await getFollowingListPaginationAndSort(follower.url, 0, 5, '-createdAt')
    const follows = res.body.data as ActorFollow[]

    if (exists === true) {
      expect(res.body.total).to.equal(1)

      expect(follows[ 0 ].following.host).to.equal(following.host)
      expect(follows[ 0 ].state).to.equal('accepted')
    } else {
      expect(follows.filter(f => f.state === 'accepted')).to.have.lengthOf(0)
    }
  }
}

async function server1Follows2 (servers: ServerInfo[]) {
  await follow(servers[0].url, [ servers[1].host ], servers[0].accessToken)

  await waitJobs(servers)
}

async function resetFollows (servers: ServerInfo[]) {
  try {
    await unfollow(servers[ 0 ].url, servers[ 0 ].accessToken, servers[ 1 ])
    await unfollow(servers[ 1 ].url, servers[ 1 ].accessToken, servers[ 0 ])
  } catch { /* empty */ }

  await waitJobs(servers)

  await checkFollow(servers[0], servers[1], false)
  await checkFollow(servers[1], servers[0], false)
}

describe('Test auto follows', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
  })

  describe('Auto follow back', function () {

    it('Should not auto follow back if the option is not enabled', async function () {
      this.timeout(15000)

      await server1Follows2(servers)

      await checkFollow(servers[0], servers[1], true)
      await checkFollow(servers[1], servers[0], false)

      await resetFollows(servers)
    })

    it('Should auto follow back on auto accept if the option is enabled', async function () {
      this.timeout(15000)

      const config = {
        followings: {
          instance: {
            autoFollowBack: { enabled: true }
          }
        }
      }
      await updateCustomSubConfig(servers[1].url, servers[1].accessToken, config)

      await server1Follows2(servers)

      await checkFollow(servers[0], servers[1], true)
      await checkFollow(servers[1], servers[0], true)

      await resetFollows(servers)
    })

    it('Should wait the acceptation before auto follow back', async function () {
      this.timeout(30000)

      const config = {
        followings: {
          instance: {
            autoFollowBack: { enabled: true }
          }
        },
        followers: {
          instance: {
            manualApproval: true
          }
        }
      }
      await updateCustomSubConfig(servers[1].url, servers[1].accessToken, config)

      await server1Follows2(servers)

      await checkFollow(servers[0], servers[1], false)
      await checkFollow(servers[1], servers[0], false)

      await acceptFollower(servers[1].url, servers[1].accessToken, 'peertube@' + servers[0].host)
      await waitJobs(servers)

      await checkFollow(servers[0], servers[1], true)
      await checkFollow(servers[1], servers[0], true)

      await resetFollows(servers)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
