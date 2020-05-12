/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  acceptFollower,
  cleanupTests,
  flushAndRunMultipleServers,
  MockInstancesIndex,
  ServerInfo,
  setAccessTokensToServers,
  unfollow,
  updateCustomSubConfig,
  wait
} from '../../../../shared/extra-utils/index'
import { follow, getFollowersListPaginationAndSort, getFollowingListPaginationAndSort } from '../../../../shared/extra-utils/server/follows'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { ActorFollow } from '../../../../shared/models/actors'

const expect = chai.expect

async function checkFollow (follower: ServerInfo, following: ServerInfo, exists: boolean) {
  {
    const res = await getFollowersListPaginationAndSort({ url: following.url, start: 0, count: 5, sort: '-createdAt' })
    const follows = res.body.data as ActorFollow[]

    const follow = follows.find(f => {
      return f.follower.host === follower.host && f.state === 'accepted'
    })

    if (exists === true) {
      expect(follow).to.exist
    } else {
      expect(follow).to.be.undefined
    }
  }

  {
    const res = await getFollowingListPaginationAndSort({ url: follower.url, start: 0, count: 5, sort: '-createdAt' })
    const follows = res.body.data as ActorFollow[]

    const follow = follows.find(f => {
      return f.following.host === following.host && f.state === 'accepted'
    })

    if (exists === true) {
      expect(follow).to.exist
    } else {
      expect(follow).to.be.undefined
    }
  }
}

async function server1Follows2 (servers: ServerInfo[]) {
  await follow(servers[0].url, [ servers[1].host ], servers[0].accessToken)

  await waitJobs(servers)
}

async function resetFollows (servers: ServerInfo[]) {
  try {
    await unfollow(servers[0].url, servers[0].accessToken, servers[1])
    await unfollow(servers[1].url, servers[1].accessToken, servers[0])
  } catch { /* empty */
  }

  await waitJobs(servers)

  await checkFollow(servers[0], servers[1], false)
  await checkFollow(servers[1], servers[0], false)
}

describe('Test auto follows', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(3)

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

      config.followings.instance.autoFollowBack.enabled = false
      config.followers.instance.manualApproval = false
      await updateCustomSubConfig(servers[1].url, servers[1].accessToken, config)
    })
  })

  describe('Auto follow index', function () {
    const instanceIndexServer = new MockInstancesIndex()

    before(async () => {
      await instanceIndexServer.initialize()
    })

    it('Should not auto follow index if the option is not enabled', async function () {
      this.timeout(30000)

      await wait(5000)
      await waitJobs(servers)

      await checkFollow(servers[0], servers[1], false)
      await checkFollow(servers[1], servers[0], false)
    })

    it('Should auto follow the index', async function () {
      this.timeout(30000)

      instanceIndexServer.addInstance(servers[1].host)

      const config = {
        followings: {
          instance: {
            autoFollowIndex: {
              indexUrl: 'http://localhost:42101/api/v1/instances/hosts',
              enabled: true
            }
          }
        }
      }
      await updateCustomSubConfig(servers[0].url, servers[0].accessToken, config)

      await wait(5000)
      await waitJobs(servers)

      await checkFollow(servers[0], servers[1], true)

      await resetFollows(servers)
    })

    it('Should follow new added instances in the index but not old ones', async function () {
      this.timeout(30000)

      instanceIndexServer.addInstance(servers[2].host)

      await wait(5000)
      await waitJobs(servers)

      await checkFollow(servers[0], servers[1], false)
      await checkFollow(servers[0], servers[2], true)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
