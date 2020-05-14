/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { VideoComment } from '@shared/models/videos/video-comment.model'
import {
  addVideoCommentThread,
  bulkRemoveCommentsOf,
  cleanupTests,
  createUser,
  flushAndRunMultipleServers,
  getVideoCommentThreads,
  getVideosList,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  userLogin,
  waitJobs,
  addVideoCommentReply
} from '../../../../shared/extra-utils/index'
import { doubleFollow } from '../../../../shared/extra-utils/server/follows'
import { Video } from '@shared/models'

const expect = chai.expect

describe('Test bulk actions', function () {
  const commentsUser3: { videoId: number, commentId: number }[] = []

  let servers: ServerInfo[] = []
  let user1AccessToken: string
  let user2AccessToken: string
  let user3AccessToken: string

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    {
      const user = { username: 'user1', password: 'password' }
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: user.username, password: user.password })

      user1AccessToken = await userLogin(servers[0], user)
    }

    {
      const user = { username: 'user2', password: 'password' }
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: user.username, password: user.password })

      user2AccessToken = await userLogin(servers[0], user)
    }

    {
      const user = { username: 'user3', password: 'password' }
      await createUser({ url: servers[1].url, accessToken: servers[1].accessToken, username: user.username, password: user.password })

      user3AccessToken = await userLogin(servers[1], user)
    }

    await doubleFollow(servers[0], servers[1])
  })

  describe('Bulk remove comments', function () {
    async function checkInstanceCommentsRemoved () {
      {
        const res = await getVideosList(servers[0].url)
        const videos = res.body.data as Video[]

        // Server 1 should not have these comments anymore
        for (const video of videos) {
          const resThreads = await getVideoCommentThreads(servers[0].url, video.id, 0, 10)
          const comments = resThreads.body.data as VideoComment[]
          const comment = comments.find(c => c.text === 'comment by user 3')

          expect(comment).to.not.exist
        }
      }

      {
        const res = await getVideosList(servers[1].url)
        const videos = res.body.data as Video[]

        // Server 1 should not have these comments on videos of server 1
        for (const video of videos) {
          const resThreads = await getVideoCommentThreads(servers[1].url, video.id, 0, 10)
          const comments = resThreads.body.data as VideoComment[]
          const comment = comments.find(c => c.text === 'comment by user 3')

          if (video.account.host === 'localhost:' + servers[0].port) {
            expect(comment).to.not.exist
          } else {
            expect(comment).to.exist
          }
        }
      }
    }

    before(async function () {
      this.timeout(60000)

      await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video 1 server 1' })
      await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video 2 server 1' })
      await uploadVideo(servers[0].url, user1AccessToken, { name: 'video 3 server 1' })

      await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video 1 server 2' })

      await waitJobs(servers)

      {
        const res = await getVideosList(servers[0].url)
        for (const video of res.body.data) {
          await addVideoCommentThread(servers[0].url, servers[0].accessToken, video.id, 'comment by root server 1')
          await addVideoCommentThread(servers[0].url, user1AccessToken, video.id, 'comment by user 1')
          await addVideoCommentThread(servers[0].url, user2AccessToken, video.id, 'comment by user 2')
        }
      }

      {
        const res = await getVideosList(servers[1].url)
        for (const video of res.body.data) {
          await addVideoCommentThread(servers[1].url, servers[1].accessToken, video.id, 'comment by root server 2')

          const res = await addVideoCommentThread(servers[1].url, user3AccessToken, video.id, 'comment by user 3')
          commentsUser3.push({ videoId: video.id, commentId: res.body.comment.id })
        }
      }

      await waitJobs(servers)
    })

    it('Should delete comments of an account on my videos', async function () {
      this.timeout(60000)

      await bulkRemoveCommentsOf({
        url: servers[0].url,
        token: user1AccessToken,
        attributes: {
          accountName: 'user2',
          scope: 'my-videos'
        }
      })

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getVideosList(server.url)

        for (const video of res.body.data) {
          const resThreads = await getVideoCommentThreads(server.url, video.id, 0, 10)
          const comments = resThreads.body.data as VideoComment[]
          const comment = comments.find(c => c.text === 'comment by user 2')

          if (video.name === 'video 3 server 1') {
            expect(comment).to.not.exist
          } else {
            expect(comment).to.exist
          }
        }
      }
    })

    it('Should delete comments of an account on the instance', async function () {
      this.timeout(60000)

      await bulkRemoveCommentsOf({
        url: servers[0].url,
        token: servers[0].accessToken,
        attributes: {
          accountName: 'user3@localhost:' + servers[1].port,
          scope: 'instance'
        }
      })

      await waitJobs(servers)

      await checkInstanceCommentsRemoved()
    })

    it('Should not re create the comment on video update', async function () {
      this.timeout(60000)

      for (const obj of commentsUser3) {
        await addVideoCommentReply(servers[1].url, user3AccessToken, obj.videoId, obj.commentId, 'comment by user 3 bis')
      }

      await waitJobs(servers)

      await checkInstanceCommentsRemoved()
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
