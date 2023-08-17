/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  BulkCommand,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test bulk actions', function () {
  const commentsUser3: { videoId: number, commentId: number }[] = []

  let servers: PeerTubeServer[] = []
  let user1Token: string
  let user2Token: string
  let user3Token: string

  let bulkCommand: BulkCommand

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    {
      const user = { username: 'user1', password: 'password' }
      await servers[0].users.create({ username: user.username, password: user.password })

      user1Token = await servers[0].login.getAccessToken(user)
    }

    {
      const user = { username: 'user2', password: 'password' }
      await servers[0].users.create({ username: user.username, password: user.password })

      user2Token = await servers[0].login.getAccessToken(user)
    }

    {
      const user = { username: 'user3', password: 'password' }
      await servers[1].users.create({ username: user.username, password: user.password })

      user3Token = await servers[1].login.getAccessToken(user)
    }

    await doubleFollow(servers[0], servers[1])

    bulkCommand = new BulkCommand(servers[0])
  })

  describe('Bulk remove comments', function () {
    async function checkInstanceCommentsRemoved () {
      {
        const { data } = await servers[0].videos.list()

        // Server 1 should not have these comments anymore
        for (const video of data) {
          const { data } = await servers[0].comments.listThreads({ videoId: video.id })
          const comment = data.find(c => c.text === 'comment by user 3')

          expect(comment).to.not.exist
        }
      }

      {
        const { data } = await servers[1].videos.list()

        // Server 1 should not have these comments on videos of server 1
        for (const video of data) {
          const { data } = await servers[1].comments.listThreads({ videoId: video.id })
          const comment = data.find(c => c.text === 'comment by user 3')

          if (video.account.host === servers[0].host) {
            expect(comment).to.not.exist
          } else {
            expect(comment).to.exist
          }
        }
      }
    }

    before(async function () {
      this.timeout(240000)

      await servers[0].videos.upload({ attributes: { name: 'video 1 server 1' } })
      await servers[0].videos.upload({ attributes: { name: 'video 2 server 1' } })
      await servers[0].videos.upload({ token: user1Token, attributes: { name: 'video 3 server 1' } })

      await servers[1].videos.upload({ attributes: { name: 'video 1 server 2' } })

      await waitJobs(servers)

      {
        const { data } = await servers[0].videos.list()
        for (const video of data) {
          await servers[0].comments.createThread({ videoId: video.id, text: 'comment by root server 1' })
          await servers[0].comments.createThread({ token: user1Token, videoId: video.id, text: 'comment by user 1' })
          await servers[0].comments.createThread({ token: user2Token, videoId: video.id, text: 'comment by user 2' })
        }
      }

      {
        const { data } = await servers[1].videos.list()

        for (const video of data) {
          await servers[1].comments.createThread({ videoId: video.id, text: 'comment by root server 2' })

          const comment = await servers[1].comments.createThread({ token: user3Token, videoId: video.id, text: 'comment by user 3' })
          commentsUser3.push({ videoId: video.id, commentId: comment.id })
        }
      }

      await waitJobs(servers)
    })

    it('Should delete comments of an account on my videos', async function () {
      this.timeout(60000)

      await bulkCommand.removeCommentsOf({
        token: user1Token,
        attributes: {
          accountName: 'user2',
          scope: 'my-videos'
        }
      })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        for (const video of data) {
          const { data } = await server.comments.listThreads({ videoId: video.id })
          const comment = data.find(c => c.text === 'comment by user 2')

          if (video.name === 'video 3 server 1') expect(comment).to.not.exist
          else expect(comment).to.exist
        }
      }
    })

    it('Should delete comments of an account on the instance', async function () {
      this.timeout(60000)

      await bulkCommand.removeCommentsOf({
        attributes: {
          accountName: 'user3@' + servers[1].host,
          scope: 'instance'
        }
      })

      await waitJobs(servers)

      await checkInstanceCommentsRemoved()
    })

    it('Should not re create the comment on video update', async function () {
      this.timeout(60000)

      for (const obj of commentsUser3) {
        await servers[1].comments.addReply({
          token: user3Token,
          videoId: obj.videoId,
          toCommentId: obj.commentId,
          text: 'comment by user 3 bis'
        })
      }

      await waitJobs(servers)

      await checkInstanceCommentsRemoved()
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
