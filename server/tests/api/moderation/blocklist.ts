/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  BlocklistCommand,
  cleanupTests,
  CommentsCommand,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  getUserNotifications,
  getVideosList,
  getVideosListWithToken,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  userLogin,
  waitJobs
} from '@shared/extra-utils'
import { UserNotification, UserNotificationType, Video } from '@shared/models'

const expect = chai.expect

async function checkAllVideos (server: ServerInfo, token: string) {
  {
    const res = await getVideosListWithToken(server.url, token)

    expect(res.body.data).to.have.lengthOf(5)
  }

  {
    const res = await getVideosList(server.url)

    expect(res.body.data).to.have.lengthOf(5)
  }
}

async function checkAllComments (server: ServerInfo, token: string, videoUUID: string) {
  const { data } = await server.commentsCommand.listThreads({ videoId: videoUUID, start: 0, count: 25, sort: '-createdAt', token })

  const threads = data.filter(t => t.isDeleted === false)
  expect(threads).to.have.lengthOf(2)

  for (const thread of threads) {
    const tree = await server.commentsCommand.getThread({ videoId: videoUUID, threadId: thread.id, token })
    expect(tree.children).to.have.lengthOf(1)
  }
}

async function checkCommentNotification (
  mainServer: ServerInfo,
  comment: { server: ServerInfo, token: string, videoUUID: string, text: string },
  check: 'presence' | 'absence'
) {
  const command = comment.server.commentsCommand

  const { threadId, createdAt } = await command.createThread({ token: comment.token, videoId: comment.videoUUID, text: comment.text })

  await waitJobs([ mainServer, comment.server ])

  const res = await getUserNotifications(mainServer.url, mainServer.accessToken, 0, 30)
  const commentNotifications = (res.body.data as UserNotification[])
                                  .filter(n => n.comment && n.comment.video.uuid === comment.videoUUID && n.createdAt >= createdAt)

  if (check === 'presence') expect(commentNotifications).to.have.lengthOf(1)
  else expect(commentNotifications).to.have.lengthOf(0)

  await command.delete({ token: comment.token, videoId: comment.videoUUID, commentId: threadId })

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

  let command: BlocklistCommand
  let commentsCommand: CommentsCommand[]

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(3)
    await setAccessTokensToServers(servers)

    command = servers[0].blocklistCommand
    commentsCommand = servers.map(s => s.commentsCommand)

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
      const created = await commentsCommand[0].createThread({ videoId: videoUUID1, text: 'comment root 1' })
      const reply = await commentsCommand[0].addReply({
        token: userToken1,
        videoId: videoUUID1,
        toCommentId: created.id,
        text: 'comment user 1'
      })
      await commentsCommand[0].addReply({ videoId: videoUUID1, toCommentId: reply.id, text: 'comment root 1' })
    }

    {
      const created = await commentsCommand[0].createThread({ token: userToken1, videoId: videoUUID1, text: 'comment user 1' })
      await commentsCommand[0].addReply({ videoId: videoUUID1, toCommentId: created.id, text: 'comment root 1' })
    }

    await waitJobs(servers)
  })

  describe('User blocklist', function () {

    describe('When managing account blocklist', function () {
      it('Should list all videos', function () {
        return checkAllVideos(servers[0], servers[0].accessToken)
      })

      it('Should list the comments', function () {
        return checkAllComments(servers[0], servers[0].accessToken, videoUUID1)
      })

      it('Should block a remote account', async function () {
        await command.addToMyBlocklist({ account: 'user2@localhost:' + servers[1].port })
      })

      it('Should hide its videos', async function () {
        const res = await getVideosListWithToken(servers[0].url, servers[0].accessToken)

        const videos: Video[] = res.body.data
        expect(videos).to.have.lengthOf(4)

        const v = videos.find(v => v.name === 'video user 2')
        expect(v).to.be.undefined
      })

      it('Should block a local account', async function () {
        await command.addToMyBlocklist({ account: 'user1' })
      })

      it('Should hide its videos', async function () {
        const res = await getVideosListWithToken(servers[0].url, servers[0].accessToken)

        const videos: Video[] = res.body.data
        expect(videos).to.have.lengthOf(3)

        const v = videos.find(v => v.name === 'video user 1')
        expect(v).to.be.undefined
      })

      it('Should hide its comments', async function () {
        const { data } = await commentsCommand[0].listThreads({
          token: servers[0].accessToken,
          videoId: videoUUID1,
          start: 0,
          count: 25,
          sort: '-createdAt'
        })

        expect(data).to.have.lengthOf(1)
        expect(data[0].totalReplies).to.equal(1)

        const t = data.find(t => t.text === 'comment user 1')
        expect(t).to.be.undefined

        for (const thread of data) {
          const tree = await commentsCommand[0].getThread({
            videoId: videoUUID1,
            threadId: thread.id,
            token: servers[0].accessToken
          })
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
        return checkAllVideos(servers[0], userToken1)
      })

      it('Should list blocked accounts', async function () {
        {
          const body = await command.listMyAccountBlocklist({ start: 0, count: 1, sort: 'createdAt' })
          expect(body.total).to.equal(2)

          const block = body.data[0]
          expect(block.byAccount.displayName).to.equal('root')
          expect(block.byAccount.name).to.equal('root')
          expect(block.blockedAccount.displayName).to.equal('user2')
          expect(block.blockedAccount.name).to.equal('user2')
          expect(block.blockedAccount.host).to.equal('localhost:' + servers[1].port)
        }

        {
          const body = await command.listMyAccountBlocklist({ start: 1, count: 2, sort: 'createdAt' })
          expect(body.total).to.equal(2)

          const block = body.data[0]
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
          await commentsCommand[1].createThread({ token: userToken2, videoId: videoUUID3, text: 'comment user 2' })
          await waitJobs(servers)

          await commentsCommand[0].createThread({ token: servers[0].accessToken, videoId: videoUUID3, text: 'uploader' })
          await waitJobs(servers)

          const commentId = await commentsCommand[1].findCommentId({ videoId: videoUUID3, text: 'uploader' })
          const message = 'reply by user 2'
          const reply = await commentsCommand[1].addReply({ token: userToken2, videoId: videoUUID3, toCommentId: commentId, text: message })
          await commentsCommand[1].addReply({ videoId: videoUUID3, toCommentId: reply.id, text: 'another reply' })

          await waitJobs(servers)
        }

        // Server 2 has all the comments
        {
          const { data } = await commentsCommand[1].listThreads({ videoId: videoUUID3, count: 25, sort: '-createdAt' })

          expect(data).to.have.lengthOf(2)
          expect(data[0].text).to.equal('uploader')
          expect(data[1].text).to.equal('comment user 2')

          const tree = await commentsCommand[1].getThread({ videoId: videoUUID3, threadId: data[0].id })
          expect(tree.children).to.have.lengthOf(1)
          expect(tree.children[0].comment.text).to.equal('reply by user 2')
          expect(tree.children[0].children).to.have.lengthOf(1)
          expect(tree.children[0].children[0].comment.text).to.equal('another reply')
        }

        // Server 1 and 3 should only have uploader comments
        for (const server of [ servers[0], servers[2] ]) {
          const { data } = await server.commentsCommand.listThreads({ videoId: videoUUID3, count: 25, sort: '-createdAt' })

          expect(data).to.have.lengthOf(1)
          expect(data[0].text).to.equal('uploader')

          const tree = await server.commentsCommand.getThread({ videoId: videoUUID3, threadId: data[0].id })

          if (server.serverNumber === 1) expect(tree.children).to.have.lengthOf(0)
          else expect(tree.children).to.have.lengthOf(1)
        }
      })

      it('Should unblock the remote account', async function () {
        await command.removeFromMyBlocklist({ account: 'user2@localhost:' + servers[1].port })
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
          const { data } = await server.commentsCommand.listThreads({ videoId: videoUUID3, count: 25, sort: '-createdAt' })

          // Server 3 should not have 2 comment threads, because server 1 did not forward the server 2 comment
          if (server.serverNumber === 3) {
            expect(data).to.have.lengthOf(1)
            continue
          }

          expect(data).to.have.lengthOf(2)
          expect(data[0].text).to.equal('uploader')
          expect(data[1].text).to.equal('comment user 2')

          const tree = await server.commentsCommand.getThread({ videoId: videoUUID3, threadId: data[0].id })
          expect(tree.children).to.have.lengthOf(1)
          expect(tree.children[0].comment.text).to.equal('reply by user 2')
          expect(tree.children[0].children).to.have.lengthOf(1)
          expect(tree.children[0].children[0].comment.text).to.equal('another reply')
        }
      })

      it('Should unblock the local account', async function () {
        await command.removeFromMyBlocklist({ account: 'user1' })
      })

      it('Should display its comments', function () {
        return checkAllComments(servers[0], servers[0].accessToken, videoUUID1)
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
        return checkAllVideos(servers[0], servers[0].accessToken)
      })

      it('Should list the comments', function () {
        return checkAllComments(servers[0], servers[0].accessToken, videoUUID1)
      })

      it('Should block a remote server', async function () {
        await command.addToMyBlocklist({ server: 'localhost:' + servers[1].port })
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
        return checkAllVideos(servers[0], userToken1)
      })

      it('Should hide its comments', async function () {
        this.timeout(10000)

        const { id } = await commentsCommand[1].createThread({ token: userToken2, videoId: videoUUID1, text: 'hidden comment 2' })

        await waitJobs(servers)

        await checkAllComments(servers[0], servers[0].accessToken, videoUUID1)

        await commentsCommand[1].delete({ token: userToken2, videoId: videoUUID1, commentId: id })
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
        const body = await command.listMyServerBlocklist({ start: 0, count: 1, sort: 'createdAt' })
        expect(body.total).to.equal(1)

        const block = body.data[0]
        expect(block.byAccount.displayName).to.equal('root')
        expect(block.byAccount.name).to.equal('root')
        expect(block.blockedServer.host).to.equal('localhost:' + servers[1].port)
      })

      it('Should unblock the remote server', async function () {
        await command.removeFromMyBlocklist({ server: 'localhost:' + servers[1].port })
      })

      it('Should display its videos', function () {
        return checkAllVideos(servers[0], servers[0].accessToken)
      })

      it('Should display its comments', function () {
        return checkAllComments(servers[0], servers[0].accessToken, videoUUID1)
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
          await checkAllVideos(servers[0], token)
        }
      })

      it('Should list the comments', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllComments(servers[0], token, videoUUID1)
        }
      })

      it('Should block a remote account', async function () {
        await command.addToServerBlocklist({ account: 'user2@localhost:' + servers[1].port })
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
        await command.addToServerBlocklist({ account: 'user1' })
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
          const { data } = await commentsCommand[0].listThreads({ videoId: videoUUID1, count: 20, sort: '-createdAt', token })
          const threads = data.filter(t => t.isDeleted === false)

          expect(threads).to.have.lengthOf(1)
          expect(threads[0].totalReplies).to.equal(1)

          const t = threads.find(t => t.text === 'comment user 1')
          expect(t).to.be.undefined

          for (const thread of threads) {
            const tree = await commentsCommand[0].getThread({ videoId: videoUUID1, threadId: thread.id, token })
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
          const body = await command.listServerAccountBlocklist({ start: 0, count: 1, sort: 'createdAt' })
          expect(body.total).to.equal(2)

          const block = body.data[0]
          expect(block.byAccount.displayName).to.equal('peertube')
          expect(block.byAccount.name).to.equal('peertube')
          expect(block.blockedAccount.displayName).to.equal('user2')
          expect(block.blockedAccount.name).to.equal('user2')
          expect(block.blockedAccount.host).to.equal('localhost:' + servers[1].port)
        }

        {
          const body = await command.listServerAccountBlocklist({ start: 1, count: 2, sort: 'createdAt' })
          expect(body.total).to.equal(2)

          const block = body.data[0]
          expect(block.byAccount.displayName).to.equal('peertube')
          expect(block.byAccount.name).to.equal('peertube')
          expect(block.blockedAccount.displayName).to.equal('user1')
          expect(block.blockedAccount.name).to.equal('user1')
          expect(block.blockedAccount.host).to.equal('localhost:' + servers[0].port)
        }
      })

      it('Should unblock the remote account', async function () {
        await command.removeFromServerBlocklist({ account: 'user2@localhost:' + servers[1].port })
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
        await command.removeFromServerBlocklist({ account: 'user1' })
      })

      it('Should display its comments', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllComments(servers[0], token, videoUUID1)
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
          await checkAllVideos(servers[0], token)
        }
      })

      it('Should list the comments', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllComments(servers[0], token, videoUUID1)
        }
      })

      it('Should block a remote server', async function () {
        await command.addToServerBlocklist({ server: 'localhost:' + servers[1].port })
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

        const { id } = await commentsCommand[1].createThread({ token: userToken2, videoId: videoUUID1, text: 'hidden comment 2' })

        await waitJobs(servers)

        await checkAllComments(servers[0], servers[0].accessToken, videoUUID1)

        await commentsCommand[1].delete({ token: userToken2, videoId: videoUUID1, commentId: id })
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
          await servers[1].followsCommand.unfollow({ target: servers[0] })
          await waitJobs(servers)
          await servers[1].followsCommand.follow({ targets: [ servers[0].host ] })

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
        const body = await command.listServerServerBlocklist({ start: 0, count: 1, sort: 'createdAt' })
        expect(body.total).to.equal(1)

        const block = body.data[0]
        expect(block.byAccount.displayName).to.equal('peertube')
        expect(block.byAccount.name).to.equal('peertube')
        expect(block.blockedServer.host).to.equal('localhost:' + servers[1].port)
      })

      it('Should unblock the remote server', async function () {
        await command.removeFromServerBlocklist({ server: 'localhost:' + servers[1].port })
      })

      it('Should list all videos', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllVideos(servers[0], token)
        }
      })

      it('Should list the comments', async function () {
        for (const token of [ userModeratorToken, servers[0].accessToken ]) {
          await checkAllComments(servers[0], token, videoUUID1)
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
          await servers[1].followsCommand.unfollow({ target: servers[0] })
          await waitJobs(servers)
          await servers[1].followsCommand.follow({ targets: [ servers[0].host ] })

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
