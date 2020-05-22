/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { AccountBlock, ServerBlock, Video, UserNotification, UserNotificationType } from '../../../../shared/index'
import {
  cleanupTests,
  createUser,
  deleteVideoComment,
  doubleFollow,
  flushAndRunMultipleServers,
  ServerInfo,
  uploadVideo,
  userLogin,
  follow,
  unfollow
} from '../../../../shared/extra-utils/index'
import { setAccessTokensToServers } from '../../../../shared/extra-utils/users/login'
import { getVideosList, getVideosListWithToken } from '../../../../shared/extra-utils/videos/videos'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  getVideoCommentThreads,
  getVideoThreadComments,
  findCommentId
} from '../../../../shared/extra-utils/videos/video-comments'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { VideoComment, VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'
import {
  addAccountToAccountBlocklist,
  addAccountToServerBlocklist,
  addServerToAccountBlocklist,
  addServerToServerBlocklist,
  getAccountBlocklistByAccount,
  getAccountBlocklistByServer,
  getServerBlocklistByAccount,
  getServerBlocklistByServer,
  removeAccountFromAccountBlocklist,
  removeAccountFromServerBlocklist,
  removeServerFromAccountBlocklist,
  removeServerFromServerBlocklist
} from '../../../../shared/extra-utils/users/blocklist'
import { getUserNotifications } from '../../../../shared/extra-utils/users/user-notifications'

const expect = chai.expect

async function checkAllVideos (url: string, token: string) {
  {
    const res = await getVideosListWithToken(url, token)

    expect(res.body.data).to.have.lengthOf(5)
  }

  {
    const res = await getVideosList(url)

    expect(res.body.data).to.have.lengthOf(5)
  }
}

async function checkAllComments (url: string, token: string, videoUUID: string) {
  const resThreads = await getVideoCommentThreads(url, videoUUID, 0, 25, '-createdAt', token)

  const allThreads: VideoComment[] = resThreads.body.data
  const threads = allThreads.filter(t => t.isDeleted === false)
  expect(threads).to.have.lengthOf(2)

  for (const thread of threads) {
    const res = await getVideoThreadComments(url, videoUUID, thread.id, token)

    const tree: VideoCommentThreadTree = res.body
    expect(tree.children).to.have.lengthOf(1)
  }
}

async function checkCommentNotification (
  mainServer: ServerInfo,
  comment: { server: ServerInfo, token: string, videoUUID: string, text: string },
  check: 'presence' | 'absence'
) {
  const resComment = await addVideoCommentThread(comment.server.url, comment.token, comment.videoUUID, comment.text)
  const created = resComment.body.comment as VideoComment
  const threadId = created.id
  const createdAt = created.createdAt

  await waitJobs([ mainServer, comment.server ])

  const res = await getUserNotifications(mainServer.url, mainServer.accessToken, 0, 30)
  const commentNotifications = (res.body.data as UserNotification[])
                                  .filter(n => n.comment && n.comment.video.uuid === comment.videoUUID && n.createdAt >= createdAt)

  if (check === 'presence') expect(commentNotifications).to.have.lengthOf(1)
  else expect(commentNotifications).to.have.lengthOf(0)

  await deleteVideoComment(comment.server.url, comment.token, comment.videoUUID, threadId)

  await waitJobs([ mainServer, comment.server ])
}

describe('Test blocklist', function () {
  let servers: ServerInfo[]
  let videoUUID1: string
  let videoUUID2: string
  let videoUUID3: string
  let userToken1: string
  let userModeratorToken: string
  let userToken2: string

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(3)
    await setAccessTokensToServers(servers)

    {
      const user = { username: 'user1', password: 'password' }
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: user.username, password: user.password })

      userToken1 = await userLogin(servers[0], user)
      await uploadVideo(servers[0].url, userToken1, { name: 'video user 1' })
    }

    {
      const user = { username: 'moderator', password: 'password' }
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: user.username, password: user.password })

      userModeratorToken = await userLogin(servers[0], user)
    }

    {
      const user = { username: 'user2', password: 'password' }
      await createUser({ url: servers[1].url, accessToken: servers[1].accessToken, username: user.username, password: user.password })

      userToken2 = await userLogin(servers[1], user)
      await uploadVideo(servers[1].url, userToken2, { name: 'video user 2' })
    }

    {
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video server 1' })
      videoUUID1 = res.body.video.uuid
    }

    {
      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video server 2' })
      videoUUID2 = res.body.video.uuid
    }

    {
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video 2 server 1' })
      videoUUID3 = res.body.video.uuid
    }

    await doubleFollow(servers[0], servers[1])
    await doubleFollow(servers[0], servers[2])

    {
      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID1, 'comment root 1')
      const resReply = await addVideoCommentReply(servers[0].url, userToken1, videoUUID1, resComment.body.comment.id, 'comment user 1')
      await addVideoCommentReply(servers[0].url, servers[0].accessToken, videoUUID1, resReply.body.comment.id, 'comment root 1')
    }

    {
      const resComment = await addVideoCommentThread(servers[0].url, userToken1, videoUUID1, 'comment user 1')
      await addVideoCommentReply(servers[0].url, servers[0].accessToken, videoUUID1, resComment.body.comment.id, 'comment root 1')
    }

    await waitJobs(servers)
  })

  describe('User blocklist', function () {

    describe('When managing account blocklist', function () {
      it('Should list all videos', function () {
        return checkAllVideos(servers[0].url, servers[0].accessToken)
      })

      it('Should list the comments', function () {
        return checkAllComments(servers[0].url, servers[0].accessToken, videoUUID1)
      })

      it('Should block a remote account', async function () {
        await addAccountToAccountBlocklist(servers[0].url, servers[0].accessToken, 'user2@localhost:' + servers[1].port)
      })

      it('Should hide its videos', async function () {
        const res = await getVideosListWithToken(servers[0].url, servers[0].accessToken)

        const videos: Video[] = res.body.data
        expect(videos).to.have.lengthOf(4)

        const v = videos.find(v => v.name === 'video user 2')
        expect(v).to.be.undefined
      })

      it('Should block a local account', async function () {
        await addAccountToAccountBlocklist(servers[0].url, servers[0].accessToken, 'user1')
      })

      it('Should hide its videos', async function () {
        const res = await getVideosListWithToken(servers[0].url, servers[0].accessToken)

        const videos: Video[] = res.body.data
        expect(videos).to.have.lengthOf(3)

        const v = videos.find(v => v.name === 'video user 1')
        expect(v).to.be.undefined
      })

      it('Should hide its comments', async function () {
        const resThreads = await getVideoCommentThreads(servers[0].url, videoUUID1, 0, 25, '-createdAt', servers[0].accessToken)

        const threads: VideoComment[] = resThreads.body.data
        expect(threads).to.have.lengthOf(1)
        expect(threads[0].totalReplies).to.equal(0)

        const t = threads.find(t => t.text === 'comment user 1')
        expect(t).to.be.undefined

        for (const thread of threads) {
          const res = await getVideoThreadComments(servers[0].url, videoUUID1, thread.id, servers[0].accessToken)

          const tree: VideoCommentThreadTree = res.body
          expect(tree.children).to.have.lengthOf(0)
        }
      })

      it('Should not have notifications from blocked accounts', async function () {
        this.timeout(20000)

        {
          const comment = { server: servers[0], token: userToken1, videoUUID: videoUUID1, text: 'hidden comment' }
          await checkCommentNotification(servers[0], comment, 'absence')
        }

        {
          const comment = {
            server: servers[0],
            token: userToken1,
            videoUUID: videoUUID2,
            text: 'hello @root@localhost:' + servers[0].port
          }
          await checkCommentNotification(servers[0], comment, 'absence')
        }
      })

      it('Should list all the videos with another user', async function () {
        return checkAllVideos(servers[0].url, userToken1)
      })

      it('Should list blocked accounts', async function () {
        {
          const res = await getAccountBlocklistByAccount(servers[0].url, servers[0].accessToken, 0, 1, 'createdAt')
          const blocks: AccountBlock[] = res.body.data

          expect(res.body.total).to.equal(2)

          const block = blocks[0]
          expect(block.byAccount.displayName).to.equal('root')
          expect(block.byAccount.name).to.equal('root')
          expect(block.blockedAccount.displayName).to.equal('user2')
          expect(block.blockedAccount.name).to.equal('user2')
          expect(block.blockedAccount.host).to.equal('localhost:' + servers[1].port)
        }

        {
          const res = await getAccountBlocklistByAccount(servers[0].url, servers[0].accessToken, 1, 2, 'createdAt')
          const blocks: AccountBlock[] = res.body.data

          expect(res.body.total).to.equal(2)

          const block = blocks[0]
          expect(block.byAccount.displayName).to.equal('root')
          expect(block.byAccount.name).to.equal('root')
          expect(block.blockedAccount.displayName).to.equal('user1')
          expect(block.blockedAccount.name).to.equal('user1')
          expect(block.blockedAccount.host).to.equal('localhost:' + servers[0].port)
        }
      })

      it('Should not allow a remote blocked user to comment my videos', async function () {
        this.timeout(60000)

        {
          await addVideoCommentThread(servers[1].url, userToken2, videoUUID3, 'comment user 2')
          await waitJobs(servers)

          await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID3, 'uploader')
          await waitJobs(servers)

          const commentId = await findCommentId(servers[1].url, videoUUID3, 'uploader')
          const message = 'reply by user 2'
          const resReply = await addVideoCommentReply(servers[1].url, userToken2, videoUUID3, commentId, message)
          await addVideoCommentReply(servers[1].url, servers[1].accessToken, videoUUID3, resReply.body.comment.id, 'another reply')

          await waitJobs(servers)
        }

        // Server 2 has all the comments
        {
          const resThreads = await getVideoCommentThreads(servers[1].url, videoUUID3, 0, 25, '-createdAt')
          const threads: VideoComment[] = resThreads.body.data

          expect(threads).to.have.lengthOf(2)
          expect(threads[0].text).to.equal('uploader')
          expect(threads[1].text).to.equal('comment user 2')

          const resReplies = await getVideoThreadComments(servers[1].url, videoUUID3, threads[0].id)

          const tree: VideoCommentThreadTree = resReplies.body
          expect(tree.children).to.have.lengthOf(1)
          expect(tree.children[0].comment.text).to.equal('reply by user 2')
          expect(tree.children[0].children).to.have.lengthOf(1)
          expect(tree.children[0].children[0].comment.text).to.equal('another reply')
        }

        // Server 1 and 3 should only have uploader comments
        for (const server of [ servers[0], servers[2] ]) {
          const resThreads = await getVideoCommentThreads(server.url, videoUUID3, 0, 25, '-createdAt')
          const threads: VideoComment[] = resThreads.body.data

          expect(threads).to.have.lengthOf(1)
          expect(threads[0].text).to.equal('uploader')

          const resReplies = await getVideoThreadComments(server.url, videoUUID3, threads[0].id)

          const tree: VideoCommentThreadTree = resReplies.body
          if (server.serverNumber === 1) {
            expect(tree.children).to.have.lengthOf(0)
          } else {
            expect(tree.children).to.have.lengthOf(1)
          }
        }
      })

      it('Should unblock the remote account', async function () {
        await removeAccountFromAccountBlocklist(servers[0].url, servers[0].accessToken, 'user2@localhost:' + servers[1].port)
      })

      it('Should display its videos', async function () {
        const res = await getVideosListWithToken(servers[0].url, servers[0].accessToken)

        const videos: Video[] = res.body.data
        expect(videos).to.have.lengthOf(4)

        const v = videos.find(v => v.name === 'video user 2')
        expect(v).not.to.be.undefined
      })

      it('Should display its comments on my video', async function () {
        for (const server of servers) {
          const resThreads = await getVideoCommentThreads(server.url, videoUUID3, 0, 25, '-createdAt')
          const threads: VideoComment[] = resThreads.body.data

          // Server 3 should not have 2 comment threads, because server 1 did not forward the server 2 comment
          if (server.serverNumber === 3) {
            expect(threads).to.have.lengthOf(1)
            continue
          }

          expect(threads).to.have.lengthOf(2)
          expect(threads[0].text).to.equal('uploader')
          expect(threads[1].text).to.equal('comment user 2')

          const resReplies = await getVideoThreadComments(server.url, videoUUID3, threads[0].id)

          const tree: VideoCommentThreadTree = resReplies.body
          expect(tree.children).to.have.lengthOf(1)
          expect(tree.children[0].comment.text).to.equal('reply by user 2')
          expect(tree.children[0].children).to.have.lengthOf(1)
          expect(tree.children[0].children[0].comment.text).to.equal('another reply')
        }
      })

      it('Should unblock the local account', async function () {
        await removeAccountFromAccountBlocklist(servers[0].url, servers[0].accessToken, 'user1')
      })

      it('Should display its comments', function () {
        return checkAllComments(servers[0].url, servers[0].accessToken, videoUUID1)
      })

      it('Should have a notification from a non blocked account', async function () {
        this.timeout(20000)

        {
          const comment = { server: servers[1], token: userToken2, videoUUID: videoUUID1, text: 'displayed comment' }
          await checkCommentNotification(servers[0], comment, 'presence')
        }

        {
          const comment = {
            server: servers[0],
            token: userToken1,
            videoUUID: videoUUID2,
            text: 'hello @root@localhost:' + servers[0].port
          }
          await checkCommentNotification(servers[0], comment, 'presence')
        }
      })
    })

    describe('When managing server blocklist', function () {
      it('Should list all videos', function () {
        return checkAllVideos(servers[0].url, servers[0].accessToken)
      })

      it('Should list the comments', function () {
        return checkAllComments(servers[0].url, servers[0].accessToken, videoUUID1)
      })

      it('Should block a remote server', async function () {
        await addServerToAccountBlocklist(servers[0].url, servers[0].accessToken, 'localhost:' + servers[1].port)
      })

      it('Should hide its videos', async function () {
        const res = await getVideosListWithToken(servers[0].url, servers[0].accessToken)

        const videos: Video[] = res.body.data
        expect(videos).to.have.lengthOf(3)

        const v1 = videos.find(v => v.name === 'video user 2')
        const v2 = videos.find(v => v.name === 'video server 2')

        expect(v1).to.be.undefined
        expect(v2).to.be.undefined
      })

      it('Should list all the videos with another user', async function () {
        return checkAllVideos(servers[0].url, userToken1)
      })

      it('Should hide its comments', async function () {
        this.timeout(10000)

        const resThreads = await addVideoCommentThread(servers[1].url, userToken2, videoUUID1, 'hidden comment 2')
        const threadId = resThreads.body.comment.id

        await waitJobs(servers)

        await checkAllComments(servers[0].url, servers[0].accessToken, videoUUID1)

        await deleteVideoComment(servers[1].url, userToken2, videoUUID1, threadId)
      })

      it('Should not have notifications from blocked server', async function () {
        this.timeout(20000)

        {
          const comment = { server: servers[1], token: userToken2, videoUUID: videoUUID1, text: 'hidden comment' }
          await checkCommentNotification(servers[0], comment, 'absence')
        }

        {
          const comment = {
            server: servers[1],
            token: userToken2,
            videoUUID: videoUUID1,
            text: 'hello @root@localhost:' + servers[0].port
          }
          await checkCommentNotification(servers[0], comment, 'absence')
        }
      })

      it('Should list blocked servers', async function () {
        const res = await getServerBlocklistByAccount(servers[0].url, servers[0].accessToken, 0, 1, 'createdAt')
        const blocks: ServerBlock[] = res.body.data

        expect(res.body.total).to.equal(1)

        const block = blocks[0]
        expect(block.byAccount.displayName).to.equal('root')
        expect(block.byAccount.name).to.equal('root')
        expect(block.blockedServer.host).to.equal('localhost:' + servers[1].port)
      })

      it('Should unblock the remote server', async function () {
        await removeServerFromAccountBlocklist(servers[0].url, servers[0].accessToken, 'localhost:' + servers[1].port)
      })

      it('Should display its videos', function () {
        return checkAllVideos(servers[0].url, servers[0].accessToken)
      })

      it('Should display its comments', function () {
        return checkAllComments(servers[0].url, servers[0].accessToken, videoUUID1)
      })

      it('Should have notification from unblocked server', async function () {
        this.timeout(20000)

        {
          const comment = { server: servers[1], token: userToken2, videoUUID: videoUUID1, text: 'displayed comment' }
          await checkCommentNotification(servers[0], comment, 'presence')
        }

        {
          const comment = {
            server: servers[1],
            token: userToken2,
            videoUUID: videoUUID1,
            text: 'hello @root@localhost:' + servers[0].port
          }
          await checkCommentNotification(servers[0], comment, 'presence')
        }
      })
    })
  })

  describe('Server blocklist', function () {

    describe('When managing account blocklist', function () {
      it('Should list all videos', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllVideos(servers[0].url, token)
        }
      })

      it('Should list the comments', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllComments(servers[0].url, token, videoUUID1)
        }
      })

      it('Should block a remote account', async function () {
        await addAccountToServerBlocklist(servers[0].url, servers[0].accessToken, 'user2@localhost:' + servers[1].port)
      })

      it('Should hide its videos', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          const res = await getVideosListWithToken(servers[0].url, token)

          const videos: Video[] = res.body.data
          expect(videos).to.have.lengthOf(4)

          const v = videos.find(v => v.name === 'video user 2')
          expect(v).to.be.undefined
        }
      })

      it('Should block a local account', async function () {
        await addAccountToServerBlocklist(servers[0].url, servers[0].accessToken, 'user1')
      })

      it('Should hide its videos', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          const res = await getVideosListWithToken(servers[0].url, token)

          const videos: Video[] = res.body.data
          expect(videos).to.have.lengthOf(3)

          const v = videos.find(v => v.name === 'video user 1')
          expect(v).to.be.undefined
        }
      })

      it('Should hide its comments', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          const resThreads = await getVideoCommentThreads(servers[0].url, videoUUID1, 0, 20, '-createdAt', token)

          let threads: VideoComment[] = resThreads.body.data
          threads = threads.filter(t => t.isDeleted === false)

          expect(threads).to.have.lengthOf(1)
          expect(threads[0].totalReplies).to.equal(0)

          const t = threads.find(t => t.text === 'comment user 1')
          expect(t).to.be.undefined

          for (const thread of threads) {
            const res = await getVideoThreadComments(servers[0].url, videoUUID1, thread.id, token)

            const tree: VideoCommentThreadTree = res.body
            expect(tree.children).to.have.lengthOf(0)
          }
        }
      })

      it('Should not have notification from blocked accounts by instance', async function () {
        this.timeout(20000)

        {
          const comment = { server: servers[0], token: userToken1, videoUUID: videoUUID1, text: 'hidden comment' }
          await checkCommentNotification(servers[0], comment, 'absence')
        }

        {
          const comment = {
            server: servers[1],
            token: userToken2,
            videoUUID: videoUUID1,
            text: 'hello @root@localhost:' + servers[0].port
          }
          await checkCommentNotification(servers[0], comment, 'absence')
        }
      })

      it('Should list blocked accounts', async function () {
        {
          const res = await getAccountBlocklistByServer(servers[0].url, servers[0].accessToken, 0, 1, 'createdAt')
          const blocks: AccountBlock[] = res.body.data

          expect(res.body.total).to.equal(2)

          const block = blocks[0]
          expect(block.byAccount.displayName).to.equal('peertube')
          expect(block.byAccount.name).to.equal('peertube')
          expect(block.blockedAccount.displayName).to.equal('user2')
          expect(block.blockedAccount.name).to.equal('user2')
          expect(block.blockedAccount.host).to.equal('localhost:' + servers[1].port)
        }

        {
          const res = await getAccountBlocklistByServer(servers[0].url, servers[0].accessToken, 1, 2, 'createdAt')
          const blocks: AccountBlock[] = res.body.data

          expect(res.body.total).to.equal(2)

          const block = blocks[0]
          expect(block.byAccount.displayName).to.equal('peertube')
          expect(block.byAccount.name).to.equal('peertube')
          expect(block.blockedAccount.displayName).to.equal('user1')
          expect(block.blockedAccount.name).to.equal('user1')
          expect(block.blockedAccount.host).to.equal('localhost:' + servers[0].port)
        }
      })

      it('Should unblock the remote account', async function () {
        await removeAccountFromServerBlocklist(servers[0].url, servers[0].accessToken, 'user2@localhost:' + servers[1].port)
      })

      it('Should display its videos', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          const res = await getVideosListWithToken(servers[0].url, token)

          const videos: Video[] = res.body.data
          expect(videos).to.have.lengthOf(4)

          const v = videos.find(v => v.name === 'video user 2')
          expect(v).not.to.be.undefined
        }
      })

      it('Should unblock the local account', async function () {
        await removeAccountFromServerBlocklist(servers[0].url, servers[0].accessToken, 'user1')
      })

      it('Should display its comments', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllComments(servers[0].url, token, videoUUID1)
        }
      })

      it('Should have notifications from unblocked accounts', async function () {
        this.timeout(20000)

        {
          const comment = { server: servers[0], token: userToken1, videoUUID: videoUUID1, text: 'displayed comment' }
          await checkCommentNotification(servers[0], comment, 'presence')
        }

        {
          const comment = {
            server: servers[1],
            token: userToken2,
            videoUUID: videoUUID1,
            text: 'hello @root@localhost:' + servers[0].port
          }
          await checkCommentNotification(servers[0], comment, 'presence')
        }
      })
    })

    describe('When managing server blocklist', function () {
      it('Should list all videos', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllVideos(servers[0].url, token)
        }
      })

      it('Should list the comments', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllComments(servers[0].url, token, videoUUID1)
        }
      })

      it('Should block a remote server', async function () {
        await addServerToServerBlocklist(servers[0].url, servers[0].accessToken, 'localhost:' + servers[1].port)
      })

      it('Should hide its videos', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          const res1 = await getVideosList(servers[0].url)
          const res2 = await getVideosListWithToken(servers[0].url, token)

          for (const res of [ res1, res2 ]) {
            const videos: Video[] = res.body.data
            expect(videos).to.have.lengthOf(3)

            const v1 = videos.find(v => v.name === 'video user 2')
            const v2 = videos.find(v => v.name === 'video server 2')

            expect(v1).to.be.undefined
            expect(v2).to.be.undefined
          }
        }
      })

      it('Should hide its comments', async function () {
        this.timeout(10000)

        const resThreads = await addVideoCommentThread(servers[1].url, userToken2, videoUUID1, 'hidden comment 2')
        const threadId = resThreads.body.comment.id

        await waitJobs(servers)

        await checkAllComments(servers[0].url, servers[0].accessToken, videoUUID1)

        await deleteVideoComment(servers[1].url, userToken2, videoUUID1, threadId)
      })

      it('Should not have notification from blocked instances by instance', async function () {
        this.timeout(50000)

        {
          const comment = { server: servers[1], token: userToken2, videoUUID: videoUUID1, text: 'hidden comment' }
          await checkCommentNotification(servers[0], comment, 'absence')
        }

        {
          const comment = {
            server: servers[1],
            token: userToken2,
            videoUUID: videoUUID1,
            text: 'hello @root@localhost:' + servers[0].port
          }
          await checkCommentNotification(servers[0], comment, 'absence')
        }

        {
          const now = new Date()
          await unfollow(servers[1].url, servers[1].accessToken, servers[0])
          await waitJobs(servers)
          await follow(servers[1].url, [ servers[0].host ], servers[1].accessToken)

          await waitJobs(servers)

          const res = await getUserNotifications(servers[0].url, servers[0].accessToken, 0, 30)
          const commentNotifications = (res.body.data as UserNotification[])
                                          .filter(n => {
                                            return n.type === UserNotificationType.NEW_INSTANCE_FOLLOWER &&
                                            n.createdAt >= now.toISOString()
                                          })

          expect(commentNotifications).to.have.lengthOf(0)
        }
      })

      it('Should list blocked servers', async function () {
        const res = await getServerBlocklistByServer(servers[0].url, servers[0].accessToken, 0, 1, 'createdAt')
        const blocks: ServerBlock[] = res.body.data

        expect(res.body.total).to.equal(1)

        const block = blocks[0]
        expect(block.byAccount.displayName).to.equal('peertube')
        expect(block.byAccount.name).to.equal('peertube')
        expect(block.blockedServer.host).to.equal('localhost:' + servers[1].port)
      })

      it('Should unblock the remote server', async function () {
        await removeServerFromServerBlocklist(servers[0].url, servers[0].accessToken, 'localhost:' + servers[1].port)
      })

      it('Should list all videos', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllVideos(servers[0].url, token)
        }
      })

      it('Should list the comments', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllComments(servers[0].url, token, videoUUID1)
        }
      })

      it('Should have notification from unblocked instances', async function () {
        this.timeout(50000)

        {
          const comment = { server: servers[1], token: userToken2, videoUUID: videoUUID1, text: 'displayed comment' }
          await checkCommentNotification(servers[0], comment, 'presence')
        }

        {
          const comment = {
            server: servers[1],
            token: userToken2,
            videoUUID: videoUUID1,
            text: 'hello @root@localhost:' + servers[0].port
          }
          await checkCommentNotification(servers[0], comment, 'presence')
        }

        {
          const now = new Date()
          await unfollow(servers[1].url, servers[1].accessToken, servers[0])
          await waitJobs(servers)
          await follow(servers[1].url, [ servers[0].host ], servers[1].accessToken)

          await waitJobs(servers)

          const res = await getUserNotifications(servers[0].url, servers[0].accessToken, 0, 30)
          const commentNotifications = (res.body.data as UserNotification[])
                                          .filter(n => {
                                            return n.type === UserNotificationType.NEW_INSTANCE_FOLLOWER &&
                                            n.createdAt >= now.toISOString()
                                          })

          expect(commentNotifications).to.have.lengthOf(1)
        }
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
