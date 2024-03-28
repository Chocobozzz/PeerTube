/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { expectStartWith } from '@tests/shared/checks.js'
import { ActorFollow, FollowState } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  FollowsCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

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
    expect(follow.follower.url).to.equal(servers[0].url + '/accounts/peertube')
    expect(follow.following.url).to.equal(servers[1].url + '/accounts/peertube')
  }
}

async function checkFollows (options: {
  follower: PeerTubeServer
  followerState: FollowState | 'deleted'

  following: PeerTubeServer
  followingState: FollowState | 'deleted'
}) {
  const { follower, followerState, followingState, following } = options

  const followerUrl = follower.url + '/accounts/peertube'
  const followingUrl = following.url + '/accounts/peertube'
  const finder = (d: ActorFollow) => d.follower.url === followerUrl && d.following.url === followingUrl

  {
    const { data } = await follower.follows.getFollowings()
    const follow = data.find(finder)

    if (followerState === 'deleted') {
      expect(follow).to.not.exist
    } else {
      expect(follow.state).to.equal(followerState)
      expect(follow.follower.url).to.equal(followerUrl)
      expect(follow.following.url).to.equal(followingUrl)
    }
  }

  {
    const { data } = await following.follows.getFollowers()
    const follow = data.find(finder)

    if (followingState === 'deleted') {
      expect(follow).to.not.exist
    } else {
      expect(follow.state).to.equal(followingState)
      expect(follow.follower.url).to.equal(followerUrl)
      expect(follow.following.url).to.equal(followingUrl)
    }
  }
}

async function checkNoFollowers (servers: PeerTubeServer[]) {
  const fns = [
    servers[0].follows.getFollowings.bind(servers[0].follows),
    servers[1].follows.getFollowers.bind(servers[1].follows)
  ]

  for (const fn of fns) {
    const body = await fn({ start: 0, count: 5, sort: 'createdAt', state: 'accepted' })
    expect(body.total).to.equal(0)
  }
}

describe('Test follows moderation', function () {
  let servers: PeerTubeServer[] = []
  let commands: FollowsCommand[]

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    commands = servers.map(s => s.follows)
  })

  describe('Default behaviour', function () {

    it('Should have server 1 following server 2', async function () {
      this.timeout(30000)

      await commands[0].follow({ hosts: [ servers[1].url ] })

      await waitJobs(servers)
    })

    it('Should have correct follows', async function () {
      await checkServer1And2HasFollowers(servers)
    })

    it('Should remove follower on server 2', async function () {
      await commands[1].removeFollower({ follower: servers[0] })

      await waitJobs(servers)
    })

    it('Should not not have follows anymore', async function () {
      await checkNoFollowers(servers)
    })
  })

  describe('Disabled/Enabled followers', function () {

    it('Should disable followers on server 2', async function () {
      const subConfig = {
        followers: {
          instance: {
            enabled: false,
            manualApproval: false
          }
        }
      }

      await servers[1].config.updateExistingConfig({ newConfig: subConfig })

      await commands[0].follow({ hosts: [ servers[1].url ] })
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

      await servers[1].config.updateExistingConfig({ newConfig: subConfig })

      await commands[0].follow({ hosts: [ servers[1].url ] })
      await waitJobs(servers)

      await checkServer1And2HasFollowers(servers)
    })
  })

  describe('Manual approbation', function () {

    it('Should manually approve followers', async function () {
      this.timeout(20000)

      await commands[0].unfollow({ target: servers[1] })
      await waitJobs(servers)

      const subConfig = {
        followers: {
          instance: {
            enabled: true,
            manualApproval: true
          }
        }
      }

      await servers[1].config.updateExistingConfig({ newConfig: subConfig })
      await servers[2].config.updateExistingConfig({ newConfig: subConfig })

      await commands[0].follow({ hosts: [ servers[1].url ] })
      await waitJobs(servers)

      await checkServer1And2HasFollowers(servers, 'pending')
    })

    it('Should accept a follower', async function () {
      await commands[1].acceptFollower({ follower: 'peertube@' + servers[0].host })
      await waitJobs(servers)

      await checkServer1And2HasFollowers(servers)
    })

    it('Should reject another follower', async function () {
      this.timeout(20000)

      await commands[0].follow({ hosts: [ servers[2].url ] })
      await waitJobs(servers)

      {
        const body = await commands[0].getFollowings()
        expect(body.total).to.equal(2)
      }

      {
        const body = await commands[1].getFollowers()
        expect(body.total).to.equal(1)
      }

      {
        const body = await commands[2].getFollowers()
        expect(body.total).to.equal(1)
      }

      await commands[2].rejectFollower({ follower: 'peertube@' + servers[0].host })
      await waitJobs(servers)

      { // server 1
        {
          const { data } = await commands[0].getFollowings({ state: 'accepted' })
          expect(data).to.have.lengthOf(1)
        }

        {
          const { data } = await commands[0].getFollowings({ state: 'rejected' })
          expect(data).to.have.lengthOf(1)
          expectStartWith(data[0].following.url, servers[2].url)
        }
      }

      { // server 3
        {
          const { data } = await commands[2].getFollowers({ state: 'accepted' })
          expect(data).to.have.lengthOf(0)
        }

        {
          const { data } = await commands[2].getFollowers({ state: 'rejected' })
          expect(data).to.have.lengthOf(1)
          expectStartWith(data[0].follower.url, servers[0].url)
        }
      }
    })

    it('Should still auto accept channel followers', async function () {
      await commands[0].follow({ handles: [ 'root_channel@' + servers[1].host ] })

      await waitJobs(servers)

      const body = await commands[0].getFollowings()
      const follow = body.data[0]
      expect(follow.following.name).to.equal('root_channel')
      expect(follow.state).to.equal('accepted')
    })
  })

  describe('Accept/reject state', function () {

    it('Should not change the follow on refollow with and without auto accept', async function () {
      const run = async () => {
        await commands[0].follow({ hosts: [ servers[2].url ] })
        await waitJobs(servers)

        await checkFollows({
          follower: servers[0],
          followerState: 'rejected',
          following: servers[2],
          followingState: 'rejected'
        })
      }

      await servers[2].config.updateExistingConfig({ newConfig: { followers: { instance: { manualApproval: false } } } })
      await run()

      await servers[2].config.updateExistingConfig({ newConfig: { followers: { instance: { manualApproval: true } } } })
      await run()
    })

    it('Should not change the rejected status on unfollow', async function () {
      await commands[0].unfollow({ target: servers[2] })
      await waitJobs(servers)

      await checkFollows({
        follower: servers[0],
        followerState: 'deleted',
        following: servers[2],
        followingState: 'rejected'
      })
    })

    it('Should delete the follower and add again the follower', async function () {
      await commands[2].removeFollower({ follower: servers[0] })
      await waitJobs(servers)

      await commands[0].follow({ hosts: [ servers[2].url ] })
      await waitJobs(servers)

      await checkFollows({
        follower: servers[0],
        followerState: 'pending',
        following: servers[2],
        followingState: 'pending'
      })
    })

    it('Should be able to reject a previously accepted follower', async function () {
      await commands[1].rejectFollower({ follower: 'peertube@' + servers[0].host })
      await waitJobs(servers)

      await checkFollows({
        follower: servers[0],
        followerState: 'rejected',
        following: servers[1],
        followingState: 'rejected'
      })
    })

    it('Should be able to re accept a previously rejected follower', async function () {
      await commands[1].acceptFollower({ follower: 'peertube@' + servers[0].host })
      await waitJobs(servers)

      await checkFollows({
        follower: servers[0],
        followerState: 'accepted',
        following: servers[1],
        followingState: 'accepted'
      })
    })
  })

  describe('Muted servers', function () {

    it('Should ignore follow requests of muted servers', async function () {
      await servers[1].blocklist.addToServerBlocklist({ server: servers[0].host })

      await commands[0].unfollow({ target: servers[1] })

      await waitJobs(servers)

      await checkFollows({
        follower: servers[0],
        followerState: 'deleted',
        following: servers[1],
        followingState: 'deleted'
      })

      await commands[0].follow({ hosts: [ servers[1].host ] })
      await waitJobs(servers)

      await checkFollows({
        follower: servers[0],
        followerState: 'rejected',
        following: servers[1],
        followingState: 'deleted'
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
